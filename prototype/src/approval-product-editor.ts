import { effectiveRoundingBands } from "./pricing-ending-rule";
import Decimal from "decimal.js";
import type { AuthenticatedActor } from "./authority-types";
import {
  actorAtLocation,
  authoritySnapshot,
  bindAuthoritySnapshot,
  freshActor,
} from "./authority";
import { requireCapability } from "./permissions";
import { actorAudit, domainScope } from "./domain-authority";
import { businessFingerprint } from "./business-fingerprint";
import { projectProductReadDTO } from "./catalog-read-model";
import { regularPrice } from "./catalog";
import { calculatePrice } from "./pricing";
import { calculateWeighedPrice } from "./weighed";
import { productStoreCost } from "./product-costs";
import { effectiveApprovalLocation } from "./received";
import {
  supplierItemFacts,
  saveSupplierItem,
  type SupplierItemFact,
} from "./supplier-items";
import { supplierMatches } from "./supplier-editor";
import {
  productEditSnapshot,
  saveProductEdits,
  ProductEditError,
  type ProductEdits,
} from "./product-editor";
import {
  approvalSnapshot,
  changeApprovalCategory,
  keepApprovedPrice,
  proposeManualOverride,
  resolveApproval,
  type PriceScope,
} from "./approvals";
import { createId } from "./ids";
import type { Approval, DemoState, Product } from "./types";

export class ApprovalProductEditError extends Error {
  constructor(
    public readonly code:
      | "reason"
      | "margin"
      | "taxable"
      | "supplier_item_code"
      | "manual_price_choice",
  ) {
    super(code);
  }
}
export interface ApprovalProductEdits extends Omit<
  ProductEdits,
  "selling_price"
> {
  selling_price: string;
  taxable: boolean;
  supplier_item_code: string;
  reason: string;
  minimum_margin_confirmed: boolean;
  manual_price_choice?: "rule" | "keep";
}
function source(
  state: DemoState,
  context: AuthenticatedActor,
  id: string,
  mutation = false,
) {
  const actor = freshActor(state, context);
  const approval = state.approvals.find(
    (entry) => entry.id === id && entry.company_id === actor.company_id,
  );
  if (
    !approval ||
    approval.status !== "pending" ||
    approval.type === "new_supplier" ||
    approval.type === "barcode_conflict"
  )
    throw new Error("Approval is no longer pending");
  const branch = effectiveApprovalLocation(state, approval);
  requireCapability(
    state,
    actor,
    "approvals.decide",
    domainScope(state, { ...approval, branch }, mutation),
  );
  requireCapability(state, actor, "catalog.edit", {
    company_id: actor.company_id,
    kind: "company_shared",
    entity_id: approval.product_code,
    mutation,
  });
  const product = state.products.find(
    (entry) =>
      entry.company_id === actor.company_id &&
      entry.code === approval.product_code,
  );
  if (!product) throw new ProductEditError("not_found");
  const unitCost = approval.source_manual_request
    ? productStoreCost(state, actorAtLocation(state, actor, branch), product)
    : (approval.unit_cost ?? product.last_cost_before_tax);
  if (typeof unitCost !== "string" || !/^\d+(?:\.\d{1,4})?$/.test(unitCost))
    throw new Error("A current unit cost is required");
  return { actor, approval, branch, product, unitCost };
}
function relatedItems(
  state: DemoState,
  actor: AuthenticatedActor,
  product: Product,
): SupplierItemFact[] {
  return supplierItemFacts(state, actor, product.main_supplier, "all")
    .filter((entry) => entry.product_code === product.code)
    .sort(
      (a, b) =>
        (b.last_bought_date ?? "").localeCompare(a.last_bought_date ?? "") ||
        a.id.localeCompare(b.id),
    );
}
function supplierItemForApproval(
  items: SupplierItemFact[],
  approval: Approval,
) {
  const invoices = new Set(
    [approval.source_invoice_id, ...(approval.invoice_ids ?? [])].filter(
      Boolean,
    ),
  );
  return (
    items.find((item) =>
      item.history.some((purchase) => invoices.has(purchase.invoice_id)),
    ) ?? items[0]
  );
}
function snapshot(
  state: DemoState,
  actor: AuthenticatedActor,
  approval: Approval,
  product: Product,
  unitCost: string,
) {
  return businessFingerprint({
    approval: structuredClone(approval),
    approval_prices: approvalSnapshot(state, actor, product.code),
    product: productEditSnapshot(state, actor, product.code),
    supplier_items: state.supplier_items?.filter(
      (item) =>
        item.company_id === actor.company_id &&
        item.product_code === product.code,
    ),
    suppliers: state.suppliers?.filter(
      (item) => item.company_id === actor.company_id,
    ),
    cost: unitCost,
    pricing: state.config.pricing_categories,
    bands: effectiveRoundingBands(state.config),
    corrections: state.config.special_corrections,
    weighed: state.config.weighed_items,
    tax: state.config.tax,
  });
}
function calculation(
  state: DemoState,
  product: Product,
  cost: string,
  categoryKey: string,
) {
  const category = state.config.pricing_categories.find(
    (entry) => entry.key === categoryKey && !entry.archived,
  );
  if (!category) throw new ProductEditError("pricing_category");
  return product.sold_by === "weight"
    ? calculateWeighedPrice(cost, "lb", categoryKey, state.config)
    : calculatePrice(cost, categoryKey, state.config);
}
/** Protected, product-sized read; the editor never receives a canonical business snapshot. */
export function approvalProductEditRead(
  state: DemoState,
  context: AuthenticatedActor,
  id: string,
  categoryKey?: string,
) {
  const { actor, approval, product, branch, unitCost } = source(
    state,
    context,
    id,
  );
  const category =
    categoryKey ?? approval.pricing_category ?? product.pricing_category;
  const calculated = calculation(state, product, unitCost, category);
  const item = supplierItemForApproval(
    relatedItems(state, actor, product),
    approval,
  );
  const price =
    approval.manual_price_review?.calculated_price ?? approval.proposed_price;
  const margin = new Decimal(price).gt(0)
    ? new Decimal(price).minus(unitCost).div(price).toFixed(8)
    : null;
  const minimum = state.config.pricing_categories.find(
    (entry) => entry.key === category,
  )?.minimum_margin;
  const taxable =
    state.config.tax.profiles.find((entry) => entry.key === product.tax_profile)
      ?.taxable ?? product.taxable;
  return {
    existingProduct: projectProductReadDTO(state, actor, product),
    unitCost,
    proposedPrice: price,
    margin,
    supplierItemCode: item?.supplier_item_code ?? "",
    taxable,
    expectedSnapshot: snapshot(state, actor, approval, product, unitCost),
    calculatedPrice: calculated.selling_price,
    pricingCategory: approval.pricing_category ?? product.pricing_category,
    belowMinimum: Boolean(
      margin !== null &&
      minimum != null &&
      minimum !== "" &&
      new Decimal(margin).lt(minimum),
    ),
    branch,
    approvalType: approval.type,
    manualPriceReview: approval.manual_price_review
      ? {
          keptPrice: approval.manual_price_review.kept_price,
          calculatedPrice: approval.manual_price_review.calculated_price,
        }
      : null,
  };
}
/** Stage all changes privately; a rejected approval cannot partially save its product. */
export function editAndApproveProduct(
  state: DemoState,
  context: AuthenticatedActor,
  id: string,
  edits: ApprovalProductEdits,
  expectedSnapshot: string,
  scope: PriceScope = "all",
  target: string = context.branch,
  now = new Date(),
): void {
  const current = source(state, context, id, true);
  if (
    snapshot(
      state,
      current.actor,
      current.approval,
      current.product,
      current.unitCost,
    ) !== expectedSnapshot
  )
    throw new ProductEditError("stale");
  if (scope !== "all" && scope !== "branch")
    throw new ProductEditError("branch");
  for (const key of [
    "name_en",
    "name_fa",
    "description_en",
    "description_fa",
    "unit_size",
    "ai_category",
    "pricing_category",
    "barcode",
    "main_supplier",
    "selling_price",
    "supplier_item_code",
    "reason",
  ] as const)
    if (typeof edits[key] !== "string")
      throw new ProductEditError(
        key === "selling_price"
          ? "price"
          : key === "main_supplier"
            ? "supplier"
            : "stale",
      );
  if (typeof edits.taxable !== "boolean")
    throw new ApprovalProductEditError("taxable");
  if (
    !/^\d+(?:\.\d{1,2})?$/.test(edits.selling_price) ||
    new Decimal(edits.selling_price).lte(0)
  )
    throw new ProductEditError("price");
  if (
    edits.sold_by !== undefined &&
    edits.sold_by !== (current.product.sold_by ?? "each")
  )
    throw new ProductEditError("unit_size");
  const category = state.config.pricing_categories.find(
    (entry) => entry.key === edits.pricing_category && !entry.archived,
  );
  if (!category) throw new ProductEditError("pricing_category");
  const calculated = calculation(
    state,
    current.product,
    current.unitCost,
    category.key,
  );
  const price = new Decimal(edits.selling_price).toFixed(2);
  const margin = new Decimal(price).minus(current.unitCost).div(price);
  const belowMinimum =
    (category.minimum_margin != null &&
      category.minimum_margin !== "" &&
      margin.lt(category.minimum_margin)) ||
    new Decimal(price).lt(current.unitCost);
  if (belowMinimum && edits.minimum_margin_confirmed !== true)
    throw new ApprovalProductEditError("margin");
  const manual = !new Decimal(price).eq(calculated.selling_price);
  const priceChanged = !new Decimal(price).eq(current.approval.proposed_price);
  if (
    (belowMinimum ||
      (manual && priceChanged) ||
      current.approval.type === "margin_review") &&
    !edits.reason.trim()
  )
    throw new ApprovalProductEditError("reason");
  const profile =
    state.config.tax.profiles.find(
      (entry) =>
        entry.key === category.default_tax_profile &&
        entry.taxable === edits.taxable,
    ) ??
    state.config.tax.profiles.find((entry) => entry.taxable === edits.taxable);
  if (!profile) throw new ApprovalProductEditError("taxable");
  const categoryChanged =
    category.key !==
    (current.approval.pricing_category ?? current.product.pricing_category);
  const manualChoice = edits.manual_price_choice ?? "rule";
  if (manualChoice !== "rule" && manualChoice !== "keep")
    throw new ApprovalProductEditError("manual_price_choice");
  if (current.approval.manual_price_review && !categoryChanged) {
    const allowed =
      manualChoice === "keep"
        ? current.approval.manual_price_review.kept_price
        : current.approval.manual_price_review.calculated_price;
    if (!new Decimal(price).eq(allowed))
      throw new ApprovalProductEditError("manual_price_choice");
  }
  const candidate = structuredClone(state);
  bindAuthoritySnapshot(candidate, authoritySnapshot(state));
  const actor = current.actor;
  const initialActivityCount = candidate.activity.length;
  const before = {
    product: structuredClone(current.product),
    approval: structuredClone(current.approval),
    supplier_items: structuredClone(
      state.supplier_items?.filter(
        (item) =>
          item.company_id === actor.company_id &&
          item.product_code === current.product.code,
      ) ?? [],
    ),
    dates: structuredClone(
      state.expiry.filter(
        (item) =>
          item.company_id === actor.company_id &&
          item.product_code === current.product.code,
      ),
    ),
  };
  const priorSupplierItem = supplierItemForApproval(
    relatedItems(candidate, actor, current.product),
    current.approval,
  );
  saveProductEdits(
    candidate,
    actor,
    current.product.code,
    {
      ...edits,
      selling_price: undefined,
      scope,
    },
    productEditSnapshot(candidate, actor, current.product.code),
    now,
  );
  const approval = candidate.approvals.find(
    (entry) => entry.id === id && entry.company_id === actor.company_id,
  )!;
  const product = candidate.products.find(
    (entry) =>
      entry.code === current.product.code &&
      entry.company_id === actor.company_id,
  )!;
  if (categoryChanged && approval.type !== "margin_review")
    changeApprovalCategory(candidate, actor, id, category.key);
  // The existing regular/manual choice remains a genuine approval decision.
  if (
    approval.type !== "margin_review" &&
    (!approval.manual_price_review || categoryChanged)
  ) {
    approval.proposed_price = price;
    approval.pricing_category = category.key;
    approval.unit_cost = current.unitCost;
    approval.margin = margin.toFixed(8);
    approval.threshold = category.minimum_margin;
    approval.manual_override = manual;
    approval.clear_manual_price = !manual;
  }
  let decidedApproval = approval;
  if (approval.type === "margin_review") {
    const approved = regularPrice(candidate, product, current.branch);
    if (!categoryChanged && approved && new Decimal(approved).eq(price)) {
      keepApprovedPrice(candidate, actor, id, edits.reason);
    } else {
      decidedApproval = proposeManualOverride(
        candidate,
        actor,
        id,
        price,
        edits.reason,
      );
      decidedApproval.pricing_category = category.key;
      decidedApproval.unit_cost = current.unitCost;
      decidedApproval.margin = margin.toFixed(8);
      decidedApproval.threshold = category.minimum_margin;
      resolveApproval(
        candidate,
        actor,
        decidedApproval.id,
        "approve",
        scope,
        target,
        edits.reason,
        approvalSnapshot(candidate, actor, product.code),
      );
    }
  } else {
    resolveApproval(
      candidate,
      actor,
      id,
      "approve",
      scope,
      target,
      edits.reason,
      approvalSnapshot(candidate, actor, product.code),
      manualChoice,
    );
  }
  // Category approval normally picks its default tax profile; explicit product
  // tax selection is the final validated metadata choice in this one action.
  product.taxable = edits.taxable;
  product.tax_profile = profile.key;
  const supplierChanged = !supplierMatches(
    { name: current.product.main_supplier },
    edits.main_supplier,
  );
  if (
    supplierChanged ||
    (priorSupplierItem?.supplier_item_code ?? "") !==
      edits.supplier_item_code.trim()
  ) {
    const targetItems = supplierItemFacts(
      candidate,
      actor,
      edits.main_supplier,
      "all",
    ).filter((item) => item.product_code === product.code);
    const existing = supplierChanged
      ? targetItems.find(
          (item) => item.supplier_item_code === edits.supplier_item_code.trim(),
        )
      : priorSupplierItem;
    const savedItem = saveSupplierItem(
      candidate,
      actor,
      edits.main_supplier,
      {
        product_code: product.code,
        supplier_item_code: edits.supplier_item_code,
        units_per_case: existing?.units_per_case ?? 1,
      },
      existing?.id,
      now,
    );
    savedItem.supplier_item_code_inferred = false;
  }
  const operations = candidate.activity.slice(initialActivityCount);
  candidate.activity.splice(initialActivityCount);
  candidate.activity.push({
    id: createId("edit-approve-product"),
    company_id: actor.company_id,
    branch: current.branch,
    product_code: product.code,
    entity_type: "approval",
    entity_id: id,
    action: "Edit and approve product",
    by: actor.actor,
    ...actorAudit(candidate, actor, now),
    at: now.toISOString(),
    reversible: false,
    scope,
    before,
    after: {
      product: structuredClone(product),
      approval: structuredClone(approval),
      decided_approval: structuredClone(decidedApproval),
      supplier_items: structuredClone(
        candidate.supplier_items?.filter(
          (item) =>
            item.company_id === actor.company_id &&
            item.product_code === product.code,
        ) ?? [],
      ),
      dates: structuredClone(
        candidate.expiry.filter(
          (item) =>
            item.company_id === actor.company_id &&
            item.product_code === product.code,
        ),
      ),
      reason: edits.reason.trim(),
      minimum_margin_confirmed: edits.minimum_margin_confirmed === true,
      manual_price_choice: approval.manual_price_review
        ? manualChoice
        : undefined,
      operations,
    },
  });
  Object.assign(state, candidate);
}
