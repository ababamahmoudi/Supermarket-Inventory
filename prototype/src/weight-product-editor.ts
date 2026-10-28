import Decimal from "decimal.js";
import type { AuthenticatedActor } from "./authority-types";
import { freshActor, cloneWithAuthority, actorAtLocation } from "./authority";
import { requireCapability } from "./permissions";
import { businessFingerprint } from "./business-fingerprint";
import {
  productEditSnapshot,
  saveProductEdits,
  type ProductEdits,
} from "./product-editor";
import { addProduct, type NewProductEdits } from "./manual-product";
import {
  addWeightPackage,
  editWeightPackage,
  archiveWeightPackage,
  packageParentSnapshot,
} from "./weight-packages";
import { readWeightPackages } from "./package-service";
import { productStoreCost, recordManualProductCost } from "./product-costs";
import {
  calculateWeighedPrice,
  weightCostPerLb,
  type WeightUnit,
} from "./weighed";
import { manualPrice } from "./manual-prices";
import { regularPrice } from "./catalog";
import { projectProductReadDTO } from "./catalog-read-model";
import { createId } from "./ids";
import { sellingBranches } from "./settings";
import { actorAudit } from "./domain-authority";
import type { PackageUnit } from "./package-pricing";
import { savePriceChange, type ChangePriceInput } from "./sales";
import type { DemoState, Product } from "./types";

export interface WeightPackageDraft {
  key: string;
  code?: string;
  expected_version?: number;
  size: string;
  unit: PackageUnit;
  barcode: string;
  name_en: string;
  name_fa: string;
  generated?: boolean;
  archived?: boolean;
  archive_reason?: string;
}
export class WeightEditorError extends Error {
  constructor(
    readonly code:
      "stale" | "cost" | "pending_cost_review" | "packages_active" | "package",
  ) {
    super(code);
    this.name = "WeightEditorError";
  }
}
function guard(
  state: DemoState,
  actor: AuthenticatedActor,
  packageOnly = false,
) {
  actor = freshActor(state, actor);
  requireCapability(
    state,
    actor,
    packageOnly ? "catalog.package_edit" : "catalog.edit",
    { company_id: actor.company_id, kind: "company_shared", mutation: true },
  );
  return actor;
}
function parent(state: DemoState, code: string) {
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.code === code &&
      !item.package_of_product_id &&
      item.status !== "archived",
  );
  if (!product) throw new WeightEditorError("stale");
  return product;
}
export function weightEditorSnapshot(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  packageOnly = false,
): string {
  actor = guard(state, actor, packageOnly);
  const product = parent(state, code);
  return businessFingerprint({
    product,
    children: state.products.filter(
      (item) =>
        item.company_id === actor.company_id &&
        item.package_of_product_id === code,
    ),
    approvals: state.approvals.filter(
      (item) =>
        item.company_id === actor.company_id && item.product_code === code,
    ),
    offers: state.offers.filter(
      (item) =>
        item.company_id === actor.company_id && item.product_code === code,
    ),
    sales: state.sales?.filter(
      (item) =>
        item.company_id === actor.company_id &&
        (item.product_code === code ||
          state.products.some(
            (child) =>
              child.company_id === actor.company_id &&
              child.code === item.product_code &&
              child.package_of_product_id === code,
          )),
    ),
    dates: state.expiry.filter(
      (item) =>
        item.company_id === actor.company_id && item.product_code === code,
    ),
    source_cost: packageOnly
      ? undefined
      : productStoreCost(state, actor, product),
    pricing: {
      categories: state.config.pricing_categories,
      bands: state.config.rounding_bands,
      corrections: state.config.special_corrections,
      weighed: state.config.weighed_items,
      tax: state.config.tax,
      branches: state.config.branches,
    },
  });
}
export function readWeightEditor(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  packageOnly = false,
) {
  actor = guard(state, actor, packageOnly);
  const product = parent(state, code);
  const cost = packageOnly ? null : productStoreCost(state, actor, product);
  return {
    snapshot: weightEditorSnapshot(state, actor, code, packageOnly),
    cost_per_lb: cost,
    packages:
      product.sold_by === "weight"
        ? readWeightPackages(state, actor, code)
        : [],
    approved_price: regularPrice(state, product, actor.branch),
    package_parent_snapshot:
      product.sold_by === "weight"
        ? packageParentSnapshot(state, actor, code)
        : null,
  };
}
function applyPackages(
  state: DemoState,
  actor: AuthenticatedActor,
  product: Product,
  drafts: readonly WeightPackageDraft[],
  now: Date,
) {
  if (!drafts.length) return;
  requireCapability(state, actor, "catalog.package_edit", {
    company_id: actor.company_id,
    kind: "company_shared",
    mutation: true,
  });
  if (product.sold_by !== "weight")
    throw new WeightEditorError("packages_active");
  const used = new Set<string>();
  // Archive first so a replacement of a discontinued size can use a fresh code.
  for (const row of [
    ...drafts.filter((row) => row.archived),
    ...drafts.filter((row) => !row.archived),
  ]) {
    const identity = row.code ?? row.key;
    if (used.has(identity)) throw new WeightEditorError("package");
    used.add(identity);
    if (row.code) {
      const child = state.products.find(
        (item) =>
          item.company_id === actor.company_id &&
          item.code === row.code &&
          item.package_of_product_id === product.code,
      );
      if (!child || child.package_version !== row.expected_version)
        throw new WeightEditorError("stale");
      if (row.archived)
        archiveWeightPackage(
          state,
          actor,
          row.code,
          row.expected_version!,
          row.archive_reason ?? "",
          now,
        );
      else if (
        row.size !== child.package_size ||
        row.unit !== child.package_size_unit ||
        row.barcode !== child.barcode ||
        row.name_en !== child.name_en ||
        row.name_fa !== child.name_fa
      )
        editWeightPackage(
          state,
          actor,
          row.code,
          {
            expected_version: row.expected_version!,
            size: row.size,
            unit: row.unit,
            barcode: row.barcode,
            name_en: row.name_en,
            name_fa: row.name_fa,
          },
          now,
        );
    } else if (!row.archived)
      addWeightPackage(
        state,
        actor,
        {
          parent_code: product.code,
          expected_parent_snapshot: packageParentSnapshot(
            state,
            actor,
            product.code,
          ),
          size: row.size,
          unit: row.unit,
          barcode: row.barcode || undefined,
          name_en: row.name_en || undefined,
          name_fa: row.name_fa || undefined,
        },
        now,
      );
  }
}
function costProposal(
  state: DemoState,
  actor: AuthenticatedActor,
  product: Product,
  cost: string,
  previousCost: string,
  now: Date,
) {
  const branch = actor.branch;
  const manual = manualPrice(state, product, branch);
  const current = regularPrice(state, product, branch);
  const calculation = calculateWeighedPrice(
    cost,
    "lb",
    product.pricing_category,
    state.config,
  );
  const existing = state.approvals.filter(
    (item) =>
      item.company_id === actor.company_id &&
      item.product_code === product.code &&
      item.status === "pending" &&
      (branch === "all" || item.branch === "all" || item.branch === branch) &&
      ["new_product", "price_change", "margin_review"].includes(item.type),
  );
  if (
    existing.some(
      (item) =>
        !item.config_version?.startsWith("manual-weight-cost:") ||
        (item.branch === "all" && branch !== "all"),
    )
  )
    throw new WeightEditorError("pending_cost_review");
  for (const item of existing) item.status = "superseded";
  if (
    current === calculation.selling_price &&
    !calculation.below_minimum_margin &&
    !manual
  )
    return;
  const review = Boolean(manual && current);
  const category = state.config.pricing_categories.find(
    (item) => item.key === product.pricing_category,
  )!;
  state.approvals.push({
    id: createId("manual-weight-cost-approval"),
    company_id: actor.company_id,
    branch,
    product_code: product.code,
    type:
      current === null
        ? "new_product"
        : current === calculation.selling_price && !review
          ? "margin_review"
          : "price_change",
    status: "pending",
    proposed_price: calculation.selling_price,
    current_price: current,
    unit_cost: cost,
    margin: calculation.margin,
    threshold: category.minimum_margin,
    config_version: `manual-weight-cost:${now.toISOString()}`,
    created_at: now.toISOString(),
    triggered_by: actor.actor,
    triggered_by_user_id: actor.user_id,
    reason: calculation.below_minimum_margin
      ? "Below minimum margin"
      : undefined,
    clear_manual_price: review,
    manual_price_review: review
      ? {
          kept_price: current!,
          calculated_price: calculation.selling_price,
          prior_cost: previousCost,
          received_cost: cost,
          receiver_recommendation: "rule",
        }
      : undefined,
  });
  product.pending_price = calculation.selling_price;
  product.pending_branch = branch;
  state.activity.push({
    id: createId("manual-weight-price-proposal"),
    company_id: actor.company_id,
    branch,
    product_code: product.code,
    entity_type: "product",
    entity_id: product.code,
    action: "Propose price after manual cost edit",
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    reversible: false,
    before: { unit_cost_before_tax: previousCost, price: current },
    after: {
      unit_cost_before_tax: cost,
      proposed_price: calculation.selling_price,
    },
  });
}
export function saveWeightProductEditor(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  edits: ProductEdits,
  expectedSnapshot: string,
  packages: readonly WeightPackageDraft[],
  costInput?: { value: string; unit: WeightUnit },
  now = new Date(),
  stagedPrice?: ChangePriceInput,
): void {
  actor = guard(state, actor);
  if (weightEditorSnapshot(state, actor, code) !== expectedSnapshot)
    throw new WeightEditorError("stale");
  const draft = cloneWithAuthority(state);
  const product = parent(draft, code);
  const priorCost = productStoreCost(draft, actor, product);
  const newCost = costInput
    ? weightCostPerLb(costInput.value, costInput.unit, draft.config)
    : priorCost;
  if (newCost === null) throw new WeightEditorError("cost");
  if (
    edits.sold_by === "each" &&
    draft.products.some(
      (item) =>
        item.company_id === actor.company_id &&
        item.package_of_product_id === code &&
        item.status !== "archived" &&
        !packages.some((row) => row.code === item.code && row.archived),
    )
  )
    throw new WeightEditorError("packages_active");
  // Archived child drafts are applied before a deliberate parent conversion to Each.
  applyPackages(
    draft,
    actor,
    product,
    packages.filter((row) => row.archived),
    now,
  );
  saveProductEdits(
    draft,
    actor,
    code,
    edits,
    productEditSnapshot(draft, actor, code),
    now,
  );
  if (
    costInput &&
    !new Decimal(newCost).eq(priorCost ?? product.last_cost_before_tax)
  ) {
    if (product.sold_by !== "weight") throw new WeightEditorError("cost");
    recordManualProductCost(draft, actor, product, newCost, now);
    const covered =
      stagedPrice?.mode === "regular"
        ? new Set(stagedPrice.branches)
        : new Set<string>();
    const pendingLocations =
      actor.branch === "all" && stagedPrice?.mode === "regular"
        ? sellingBranches(draft.config).filter(
            (location) =>
              actor.allowed_branches.includes(location) &&
              !covered.has(location),
          )
        : !covered.has(actor.branch)
          ? [actor.branch]
          : [];
    for (const location of pendingLocations)
      costProposal(
        draft,
        location === actor.branch
          ? actor
          : actorAtLocation(draft, actor, location),
        product,
        newCost,
        priorCost ?? product.last_cost_before_tax,
        now,
      );
  }
  if (stagedPrice) {
    if (stagedPrice.product_code !== product.code)
      throw new WeightEditorError("stale");
    savePriceChange(draft, actor, stagedPrice, now);
  }
  applyPackages(
    draft,
    actor,
    parent(draft, code),
    packages.filter((row) => !row.archived),
    now,
  );
  Object.assign(state, draft);
}
export function weightPricingSnapshot(
  state: DemoState,
  actor: AuthenticatedActor,
): string {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "catalog.create_active", {
    company_id: actor.company_id,
    kind: "company_shared",
  });
  return businessFingerprint({
    company: actor.company_id,
    categories: state.config.pricing_categories,
    bands: state.config.rounding_bands,
    corrections: state.config.special_corrections,
    weighed: state.config.weighed_items,
    tax: state.config.tax,
    branches: state.config.branches,
  });
}

export function addWeightProductEditor(
  state: DemoState,
  actor: AuthenticatedActor,
  edits: NewProductEdits,
  packages: readonly WeightPackageDraft[],
  expectedPricingSnapshot: string,
  now = new Date(),
) {
  actor = freshActor(state, actor);
  if (weightPricingSnapshot(state, actor) !== expectedPricingSnapshot)
    throw new WeightEditorError("stale");
  const draft = cloneWithAuthority(state);
  const product = addProduct(draft, actor, edits, false, now);
  applyPackages(draft, actor, product, packages, now);
  Object.assign(state, draft);
  return projectProductReadDTO(
    state,
    actor,
    state.products.find(
      (item) =>
        item.company_id === actor.company_id && item.code === product.code,
    )!,
  );
}
export function savePackageEditor(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  expectedSnapshot: string,
  packages: readonly WeightPackageDraft[],
  now = new Date(),
): void {
  actor = guard(state, actor, true);
  if (weightEditorSnapshot(state, actor, code, true) !== expectedSnapshot)
    throw new WeightEditorError("stale");
  const draft = cloneWithAuthority(state);
  applyPackages(draft, actor, parent(draft, code), packages, now);
  Object.assign(state, draft);
}

export interface WeightPriceCandidateInput {
  code: string;
  cost: string;
  cost_unit: WeightUnit;
  pricing_category: string;
}
/** A private, authority-bound candidate for the existing price dialog's real preview. */
export function weightPriceCandidate(
  state: DemoState,
  actor: AuthenticatedActor,
  input: WeightPriceCandidateInput,
): DemoState {
  actor = guard(state, actor);
  const draft = cloneWithAuthority(state);
  const product = parent(draft, input.code);
  if (
    !draft.config.pricing_categories.some(
      (category) =>
        category.key === input.pricing_category && !category.archived,
    )
  )
    throw new WeightEditorError("cost");
  product.pricing_category = input.pricing_category;
  const cost = weightCostPerLb(input.cost, input.cost_unit, draft.config);
  recordManualProductCost(draft, actor, product, cost);
  return draft;
}
export function weightEditorPricePreview(
  state: DemoState,
  actor: AuthenticatedActor,
  input: { cost: string; cost_unit: WeightUnit; pricing_category: string },
  isNew: boolean,
) {
  actor = freshActor(state, actor);
  requireCapability(
    state,
    actor,
    isNew ? "catalog.create_active" : "catalog.edit",
    { company_id: actor.company_id, kind: "company_shared" },
  );
  requireCapability(state, actor, "catalog.cost_read", {
    company_id: actor.company_id,
    kind: "company_shared",
  });
  const calculation = calculateWeighedPrice(
    input.cost,
    input.cost_unit,
    input.pricing_category,
    state.config,
  );
  const category = state.config.pricing_categories.find(
    (item) => item.key === input.pricing_category,
  )!;
  return {
    ...calculation,
    pricing_snapshot: isNew ? weightPricingSnapshot(state, actor) : undefined,
    divisor: category.cost_divisor,
    category_label: category.label,
    pricing_config: {
      pricing_categories: structuredClone(state.config.pricing_categories),
      rounding_bands: structuredClone(state.config.rounding_bands),
      special_corrections: structuredClone(state.config.special_corrections),
      weighed_items: structuredClone(state.config.weighed_items),
    },
  };
}
