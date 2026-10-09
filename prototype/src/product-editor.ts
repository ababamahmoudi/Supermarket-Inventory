import Decimal from "decimal.js";
import { effectivePrice, lookupBranch } from "./catalog";
import { reconcileOffers, syncPriceConflicts } from "./approvals";
import { createId } from "./ids";
import { configuredBranches } from "./settings";
import { supplierChoices, supplierMatches } from "./supplier-editor";
import type { Branch, DemoState, Product, Role } from "./types";

export interface ProductEditorContext {
  company_id: string;
  role: Role;
  actor: string;
  branch: Branch;
  allowed_branches: Exclude<Branch, "all">[];
}
export interface ProductEdits {
  name_en: string;
  name_fa: string;
  description_en: string;
  description_fa: string;
  unit_size: string;
  ai_category: string;
  pricing_category: string;
  barcode: string;
  main_supplier: string;
  date_tracking: boolean;
  selling_price?: string;
  scope: "all" | "branch";
}
export type ProductEditErrorCode =
  | "permission"
  | "company"
  | "branch"
  | "not_found"
  | "stale"
  | "name_en"
  | "name_fa"
  | "unit_size"
  | "category"
  | "pricing_category"
  | "supplier"
  | "barcode_conflict"
  | "price";
export class ProductEditError extends Error {
  constructor(public readonly code: ProductEditErrorCode) {
    super(code);
  }
}
function fail(code: ProductEditErrorCode): never {
  throw new ProductEditError(code);
}
function ownProduct(state: DemoState, company: string, code: string): Product {
  if (company !== state.config.company.seed_key) fail("company");
  const product = state.products.find(
    (item) => item.company_id === company && item.code === code,
  );
  if (!product) fail("not_found");
  return product;
}
function checkContext(state: DemoState, context: ProductEditorContext) {
  if (context.role !== "supervisor") fail("permission");
  if (context.company_id !== state.config.company.seed_key) fail("company");
  const configured = configuredBranches(state.config);
  if (
    !context.allowed_branches.length ||
    context.allowed_branches.some((branch) => !configured.includes(branch))
  )
    fail("branch");
  if (
    context.branch !== "all" &&
    !context.allowed_branches.includes(context.branch)
  )
    fail("branch");
  if (
    context.branch === "all" &&
    configured.some((branch) => !context.allowed_branches.includes(branch))
  )
    fail("branch");
}
/** Capture only this product and its derived price decisions, offers and conflicts. */
function snapshot(state: DemoState, product: Product) {
  const matches = (record: { company_id: string; product_code: string }) =>
    record.company_id === product.company_id &&
    record.product_code === product.code;
  return structuredClone({
    product,
    approvals: state.approvals.filter(matches),
    offers: state.offers.filter(matches),
    alerts: state.alerts.filter(matches),
  });
}
export function productEditSnapshot(
  state: DemoState,
  code: string,
  company = state.config.company.seed_key,
): string {
  return JSON.stringify(snapshot(state, ownProduct(state, company, code)));
}
/** The frontend domain enforces permissions too; hiding Edit is insufficient. */
export function saveProductEdits(
  state: DemoState,
  context: ProductEditorContext,
  code: string,
  edits: ProductEdits,
  expectedSnapshot: string,
  now = new Date(),
): void {
  checkContext(state, context);
  const product = ownProduct(state, context.company_id, code);
  if (productEditSnapshot(state, code, context.company_id) !== expectedSnapshot)
    fail("stale");
  for (const key of ["name_en", "name_fa", "unit_size"] as const)
    if (!edits[key].trim()) fail(key);
  if (!edits.ai_category.trim()) fail("category");
  if (
    !state.config.pricing_categories.some(
      (category) => category.key === edits.pricing_category,
    )
  )
    fail("pricing_category");
  // Suppliers are configuration/loaded records, never free-form invented identities.
  const suppliers = new Set(
    state.products
      .filter((item) => item.company_id === context.company_id)
      .map((item) => item.main_supplier),
  );
  for (const invoice of [...(state.invoices ?? []), state.invoice])
    if (invoice.company_id === context.company_id)
      suppliers.add(invoice.supplier);
  if (
    !suppliers.has(edits.main_supplier) &&
    !supplierChoices(state).some((item) =>
      supplierMatches(item, edits.main_supplier),
    )
  )
    fail("supplier");
  if (
    edits.barcode.trim() &&
    state.products.some(
      (item) =>
        item.company_id === context.company_id &&
        item.code !== code &&
        item.barcode === edits.barcode.trim(),
    )
  )
    fail("barcode_conflict");
  let price: string | undefined;
  if (edits.selling_price !== undefined) {
    if (!/^\d+(\.\d{1,2})?$/.test(edits.selling_price)) fail("price");
    const amount = new Decimal(edits.selling_price);
    if (!amount.isFinite() || amount.lte(0)) fail("price");
    price = amount.toFixed(2);
    if (edits.scope === "all") {
      if (
        configuredBranches(state.config).some(
          (branch) => !context.allowed_branches.includes(branch),
        )
      )
        fail("branch");
    } else if (
      context.branch === "all" ||
      !context.allowed_branches.includes(context.branch)
    )
      fail("branch");
  }
  const before = snapshot(state, product);
  const currentPrice = effectivePrice(
    state,
    product,
    lookupBranch(context.branch),
  );
  Object.assign(product, {
    name_en: edits.name_en.trim(),
    name_fa: edits.name_fa.trim(),
    description_en: edits.description_en.trim(),
    description_fa: edits.description_fa.trim(),
    unit_size: edits.unit_size.trim(),
    ai_category: edits.ai_category.trim(),
    pricing_category: edits.pricing_category,
    tax_profile: state.config.pricing_categories.find(
      (category) => category.key === edits.pricing_category,
    )!.default_tax_profile,
    barcode: edits.barcode.trim(),
    main_supplier: edits.main_supplier,
    date_tracking: edits.date_tracking,
  });
  if (price !== undefined) {
    const targetBranch = edits.scope === "all" ? "all" : context.branch;
    if (edits.scope === "all") {
      product.selling_price = price;
      product.branch_prices = {};
    } else
      product.branch_prices = {
        ...product.branch_prices,
        [context.branch]: price,
      };
    product.status = "active";
    const provenance =
      product.price_provenance?.[context.branch] ??
      product.price_provenance?.all;
    if (edits.scope === "all" && product.price_provenance) {
      // A company price does not create invoice receipts in other branches.
      // Retain every recorded branch's own source instead of copying one
      // branch's invoice into a new company-wide source.
      product.price_provenance = Object.fromEntries(
        Object.entries(product.price_provenance).map(([key, source]) => [
          key,
          {
            ...source,
            changed_price: price,
            changed_by: context.actor,
            changed_at: now.toISOString(),
          },
        ]),
      );
    } else if (provenance) {
      const changed = {
        ...provenance,
        changed_price: price,
        changed_by: context.actor,
        changed_at: now.toISOString(),
      };
      product.price_provenance = {
        ...product.price_provenance,
        [context.branch]: changed,
      };
    }
    state.approvals.push({
      id: createId("manual-price"),
      company_id: context.company_id,
      branch: targetBranch,
      type: "price_change",
      product_code: code,
      status: "approved",
      proposed_price: price,
      current_price: currentPrice,
      scope: edits.scope,
      manual_override: true,
      created_at: now.toISOString(),
      reason: "Supervisor manual price change",
      unit_cost: product.last_cost_before_tax,
      triggered_by: context.actor,
    });
    reconcileOffers(state, code, context.company_id);
    syncPriceConflicts(state, code, context.company_id);
  }
  state.activity.push({
    id: createId("product-edit"),
    company_id: context.company_id,
    branch:
      price === undefined
        ? "all"
        : edits.scope === "all"
          ? "all"
          : context.branch,
    scope: edits.scope,
    product_code: code,
    action: "Save product",
    by: context.actor,
    at: now.toISOString(),
    reversible: true,
    before,
    after: snapshot(state, product),
  });
}

/** Persist the blocked attempt separately, so rejected edits never partially save. */
export function recordProductBarcodeConflict(
  state: DemoState,
  context: ProductEditorContext,
  code: string,
  barcode: string,
  now = new Date(),
): void {
  checkContext(state, context);
  const product = ownProduct(state, context.company_id, code);
  const normalized = barcode.trim();
  const existing = state.products.find(
    (item) =>
      item.company_id === context.company_id &&
      item.code !== code &&
      item.barcode === normalized,
  );
  if (!normalized || !existing) return;
  const duplicate = state.approvals.some(
    (item) =>
      item.company_id === context.company_id &&
      item.type === "barcode_conflict" &&
      item.product_code === code &&
      item.branch === context.branch &&
      item.status === "pending" &&
      item.barcode === normalized &&
      item.conflicting_product_code === existing.code,
  );
  if (duplicate) return;
  state.approvals.push({
    id: createId("barcode-conflict"),
    company_id: context.company_id,
    branch: context.branch,
    type: "barcode_conflict",
    product_code: code,
    status: "pending",
    proposed_price: effectivePrice(state, product, context.branch) ?? "",
    reason: "Barcode conflict",
    created_at: now.toISOString(),
    triggered_by: context.actor,
    barcode: normalized,
    conflicting_product_code: existing.code,
  });
  state.activity.push({
    id: createId("barcode-conflict-activity"),
    company_id: context.company_id,
    branch: context.branch,
    product_code: code,
    action: "Report barcode conflict",
    by: context.actor,
    at: now.toISOString(),
    reversible: false,
    before: { barcode: product.barcode },
    after: {
      barcode: product.barcode,
      attempted_barcode: normalized,
      conflicting_product_code: existing.code,
    },
  });
}
