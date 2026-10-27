import Decimal from "decimal.js";
import type { AuthenticatedActor, SystemAttribution } from "./authority-types";
import { freshActor } from "./authority";
import { requireCapability } from "./permissions";
import { requireSystemReconciliation } from "./authority-repository";
import { actorAudit } from "./domain-authority";
import { effectivePrice, pendingPrice } from "./catalog";
import { hasApprovedPriceAtLocation } from "./lookup-branch";
import { branchId, branchSellsToCustomers } from "./settings";
import { nextProductCode } from "./manual-product";
import { createId } from "./ids";
import {
  calculatePackagePrice,
  calculatePackageCost,
  packageSettings,
  packageSizeInLb,
  type PackageUnit,
} from "./package-pricing";
import {
  inStorePackageBarcode,
  validatePackageBarcode,
  packageBarcodeIdentity,
} from "./package-barcodes";
import type { DemoState, Product } from "./types";

export class WeightPackageError extends Error {
  constructor(
    readonly code:
      | "parent"
      | "package"
      | "stale"
      | "barcode_conflict"
      | "reason"
      | "duplicate_size",
  ) {
    super(code);
    this.name = "WeightPackageError";
  }
}
function productInCompany(state: DemoState, code: string) {
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key && item.code === code,
  );
  if (!product) throw new WeightPackageError("parent");
  return product;
}
function weightParent(state: DemoState, code: string) {
  const product = productInCompany(state, code);
  if (
    product.sold_by !== "weight" ||
    product.package_of_product_id ||
    product.status === "archived"
  )
    throw new WeightPackageError("parent");
  return product;
}
function editor(state: DemoState, actor: AuthenticatedActor) {
  const current = freshActor(state, actor);
  requireCapability(state, current, "catalog.package_edit", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
    mutation: true,
  });
  return current;
}
function parentSnapshot(product: Product) {
  return JSON.stringify({
    code: product.code,
    name_en: product.name_en,
    name_fa: product.name_fa,
    sold_by: product.sold_by,
    status: product.status,
    pricing_category: product.pricing_category,
    taxable: product.taxable,
    tax_profile: product.tax_profile,
    main_supplier: product.main_supplier,
  });
}
export function packageParentSnapshot(
  state: DemoState,
  actor: AuthenticatedActor,
  parentCode: string,
): string {
  editor(state, actor);
  return parentSnapshot(weightParent(state, parentCode));
}
function assertUniqueBarcode(
  state: DemoState,
  barcode: string,
  exceptCode?: string,
) {
  if (
    state.products.some(
      (item) =>
        item.company_id === state.config.company.seed_key &&
        item.code !== exceptCode &&
        packageBarcodeIdentity(item.barcode) ===
          packageBarcodeIdentity(barcode),
    )
  )
    throw new WeightPackageError("barcode_conflict");
}
function assertUniqueSize(
  state: DemoState,
  parentCode: string,
  sizeLb: string,
  exceptCode?: string,
) {
  if (
    state.products.some(
      (item) =>
        item.company_id === state.config.company.seed_key &&
        item.package_of_product_id === parentCode &&
        item.code !== exceptCode &&
        item.status !== "archived" &&
        item.package_size_lb &&
        new Decimal(item.package_size_lb).eq(sizeLb),
    )
  )
    throw new WeightPackageError("duplicate_size");
}
function names(parent: Product, size: string, unit: PackageUnit) {
  const faUnit = { g: "گرم", kg: "کیلوگرم", lb: "پوند", oz: "اونس" }[unit];
  const faSize = size
    .replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])
    .replace(".", "٫");
  return {
    name_en: `${parent.name_en} ${size} ${unit}`,
    name_fa: `${parent.name_fa || parent.name_en} ${faSize} ${faUnit}`,
  };
}
function audit(
  state: DemoState,
  actor: AuthenticatedActor,
  product: Product,
  action: string,
  before: unknown,
  now: Date,
) {
  state.activity.push({
    id: createId("weight-package"),
    company_id: actor.company_id,
    branch: "all",
    product_code: product.code,
    entity_type: "product",
    entity_id: product.code,
    action,
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    reversible: false,
    before,
    after: structuredClone(product),
  });
}
export interface NewWeightPackageInput {
  parent_code: string;
  expected_parent_snapshot: string;
  size: string;
  unit: PackageUnit;
  barcode?: string;
  name_en?: string;
  name_fa?: string;
}
export function addWeightPackage(
  state: DemoState,
  actor: AuthenticatedActor,
  input: NewWeightPackageInput,
  now = new Date(),
): Product {
  actor = editor(state, actor);
  const parent = weightParent(state, input.parent_code);
  if (parentSnapshot(parent) !== input.expected_parent_snapshot)
    throw new WeightPackageError("stale");
  const size = new Decimal(
    packageSizeInLb(input.size, input.unit, state.config),
  );
  assertUniqueSize(state, parent.code, size.toString());
  const code = nextProductCode(state);
  const barcode = input.barcode?.trim()
    ? validatePackageBarcode(input.barcode)
    : inStorePackageBarcode(code, packageSettings(state.config).barcode_prefix);
  assertUniqueBarcode(state, barcode);
  const label = names(parent, new Decimal(input.size).toString(), input.unit);
  const product: Product = {
    company_id: actor.company_id,
    code,
    ...label,
    name_en: input.name_en?.trim() || label.name_en,
    name_fa: input.name_fa?.trim() || label.name_fa,
    unit_size: `${new Decimal(input.size).toString()} ${input.unit}`,
    package_of_product_id: parent.code,
    package_size: new Decimal(input.size).toString(),
    package_size_unit: input.unit,
    package_size_lb: size.toString(),
    package_barcode_generated: !input.barcode?.trim(),
    package_version: 1,
    barcode,
    sold_by: "each",
    pricing_category: parent.pricing_category,
    tax_profile: parent.tax_profile,
    taxable: parent.taxable,
    main_supplier: parent.main_supplier,
    ai_category: parent.ai_category,
    date_tracking: parent.date_tracking,
    last_cost_before_tax: "0.0000",
    selling_price: "",
    branch_prices: {},
    status: "active",
    offer: null,
  };
  // Validate the full configuration before taking a code or appending a record.
  packageSettings(state.config);
  state.product_code_high_water = Number(code);
  state.products.push(product);
  audit(state, actor, product, "Add package size", null, now);
  return product;
}
export interface WeightPackageEdits {
  expected_version: number;
  size: string;
  unit: PackageUnit;
  barcode: string;
  name_en: string;
  name_fa: string;
}
export function editWeightPackage(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  edits: WeightPackageEdits,
  now = new Date(),
): Product {
  actor = editor(state, actor);
  const product = productInCompany(state, code);
  if (!product.package_of_product_id || product.status === "archived")
    throw new WeightPackageError("package");
  weightParent(state, product.package_of_product_id);
  if (edits.expected_version !== product.package_version)
    throw new WeightPackageError("stale");
  if (!edits.name_en.trim()) throw new WeightPackageError("package");
  const sizeLb = packageSizeInLb(edits.size, edits.unit, state.config);
  const barcode = validatePackageBarcode(edits.barcode);
  assertUniqueBarcode(state, barcode, code);
  assertUniqueSize(state, product.package_of_product_id, sizeLb, code);
  const before = structuredClone(product);
  Object.assign(product, {
    package_size: new Decimal(edits.size).toString(),
    package_size_unit: edits.unit,
    package_size_lb: sizeLb,
    unit_size: `${new Decimal(edits.size).toString()} ${edits.unit}`,
    barcode,
    name_en: edits.name_en.trim(),
    name_fa: edits.name_fa.trim(),
    package_barcode_generated:
      product.package_barcode_generated && barcode === product.barcode,
    package_version: (product.package_version ?? 0) + 1,
  });
  audit(state, actor, product, "Edit package size", before, now);
  return product;
}
export function archiveWeightPackage(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  expectedVersion: number,
  reason: string,
  now = new Date(),
) {
  actor = editor(state, actor);
  const product = productInCompany(state, code);
  if (!product.package_of_product_id) throw new WeightPackageError("package");
  if (product.package_version !== expectedVersion)
    throw new WeightPackageError("stale");
  if (!reason.trim()) throw new WeightPackageError("reason");
  if (product.status === "archived") return;
  const before = structuredClone(product);
  product.status = "archived";
  product.package_version = (product.package_version ?? 0) + 1;
  audit(
    state,
    actor,
    product,
    "Archive package size",
    { product: before, reason: reason.trim() },
    now,
  );
}

function reconcilePackages(
  state: DemoState,
  actor: AuthenticatedActor | null,
  now: Date,
) {
  const company = state.config.company.seed_key;
  const branches = state.config.branches.flatMap((branch, index) => {
    const id = branchId(branch, index);
    return branch.active !== false && branchSellsToCustomers(state.config, id)
      ? [id]
      : [];
  });
  for (const product of state.products) {
    if (
      product.company_id !== company ||
      !product.package_of_product_id ||
      product.status === "archived"
    )
      continue;
    const parent = state.products.find(
      (item) =>
        item.company_id === company &&
        item.code === product.package_of_product_id,
    );
    if (
      !parent ||
      parent.sold_by !== "weight" ||
      parent.package_of_product_id ||
      parent.status === "archived"
    )
      throw new WeightPackageError("parent");
    if (!product.package_size || !product.package_size_unit)
      throw new WeightPackageError("package");
    const sizeLb = packageSizeInLb(
      product.package_size,
      product.package_size_unit,
      state.config,
    );
    const pending: Record<string, string> = {};
    const updates = branches.map((branch) => {
      const parentPrice = hasApprovedPriceAtLocation(state, parent, branch, now)
        ? effectivePrice(state, parent, branch, now)
        : null;
      const proposed = pendingPrice(state, parent, branch);
      if (proposed)
        pending[branch] = calculatePackagePrice(
          product.package_size!,
          product.package_size_unit!,
          proposed,
          parent.last_cost_before_tax,
          parent.pricing_category,
          state.config,
        ).selling_price;
      const result = parentPrice
        ? calculatePackagePrice(
            product.package_size!,
            product.package_size_unit!,
            parentPrice,
            parent.last_cost_before_tax,
            parent.pricing_category,
            state.config,
          )
        : null;
      return { branch, result };
    });
    Object.assign(product, {
      package_size_lb: sizeLb,
      pricing_category: parent.pricing_category,
      tax_profile: parent.tax_profile,
      taxable: parent.taxable,
      main_supplier: parent.main_supplier,
      package_pending_prices: pending,
    });
    const priorCost = product.last_cost_before_tax;
    product.last_cost_before_tax = calculatePackageCost(
      product.package_size,
      product.package_size_unit,
      parent.last_cost_before_tax,
      state.config,
    );
    if (priorCost !== product.last_cost_before_tax)
      state.activity.push({
        id: createId("package-cost"),
        company_id: company,
        branch: "all",
        product_code: product.code,
        entity_type: "product",
        entity_id: product.code,
        action: "Package cost recalculated",
        by: actor?.actor ?? "System",
        ...(actor ? actorAudit(state, actor, now) : {}),
        at: now.toISOString(),
        reversible: false,
        before: { unit_cost_before_tax: priorCost },
        after: {
          unit_cost_before_tax: product.last_cost_before_tax,
          package_cost_basis: {
            parent_product_code: parent.code,
            size_lb: sizeLb,
            parent_cost_per_lb: parent.last_cost_before_tax,
            container_cost: packageSettings(state.config).container_cost,
          },
        },
      });
    product.branch_prices ??= {};
    for (const { branch, result } of updates) {
      const prior = product.branch_prices[branch] ?? null;
      const next = result?.selling_price ?? null;
      if (prior === next) continue;
      if (next) product.branch_prices[branch] = next;
      else delete product.branch_prices[branch];
      const id = createId("package-price");
      state.activity.push({
        id,
        company_id: company,
        branch,
        product_code: product.code,
        entity_type: "product",
        entity_id: product.code,
        action: "Package price recalculated",
        by: actor?.actor ?? "System",
        ...(actor ? actorAudit(state, actor, now) : {}),
        at: now.toISOString(),
        reversible: false,
        before: { price: prior },
        after: {
          price: next,
          parent_product_code: parent.code,
          formula: result?.formula ?? "Parent has no approved price",
        },
      });
      if (!next) continue;
      state.label_waitlist ??= [];
      const existing = state.label_waitlist.find(
        (item) =>
          item.company_id === company &&
          item.branch === branch &&
          item.product_code === product.code &&
          !item.lot_id,
      );
      if (existing)
        Object.assign(existing, {
          source_event_id: id,
          source_reason: "regular_price_changed",
          preferred_template: "regular",
        });
      else
        state.label_waitlist.push({
          id: createId("package-label"),
          company_id: company,
          branch,
          branch_id: branch,
          product_code: product.code,
          copies: 1,
          added_by: actor?.actor ?? "System",
          added_by_user_id: actor?.user_id,
          added_at: now.toISOString(),
          source_event_id: id,
          source_reason: "regular_price_changed",
          preferred_template: "regular",
        });
    }
  }
}
/** Run before canonical price-update snapshots, inside the same protected transaction. */
export function syncWeightPackages(
  state: DemoState,
  actor: AuthenticatedActor,
  now = new Date(),
) {
  actor = freshActor(state, actor);
  reconcilePackages(state, actor, now);
}
export function syncWeightPackagesAtClock(
  state: DemoState,
  attribution: SystemAttribution,
  now = new Date(attribution.applied_at),
) {
  requireSystemReconciliation(state, attribution, "price_updates");
  reconcilePackages(state, null, now);
}
