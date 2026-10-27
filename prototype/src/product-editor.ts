import {
  regularPrice,
  normalizeSearch,
  conflictingBarcodeProduct,
} from "./catalog";
import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { requireCapability } from "./permissions";
import { actorAudit } from "./domain-authority";
import {
  applyProductDateDrafts,
  stopProductDateTracking,
  validateProductDateDrafts,
  validateProductTrackingDate,
  DateTrackingError,
  type ProductDateDraft,
  type StopTrackingChoice,
} from "./date-tracking";
import { createId } from "./ids";
import { supplierChoices, supplierMatches } from "./supplier-editor";
import type { DemoState, Product } from "./types";

export type ProductEditorContext = AuthenticatedActor;
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
  date_tracking?: boolean;
  date_reminder_days?: number;
  dates?: ProductDateDraft[];
  date_tracking_stop?: StopTrackingChoice;
  sold_by?: "each" | "weight";
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
  const actor = freshActor(state, context);
  requireCapability(state, actor, "catalog.edit", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
    mutation: true,
  });
  return actor;
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
    dates: state.expiry.filter(matches),
  });
}
export function productEditSnapshot(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  company = state.config.company.seed_key,
): string {
  checkContext(state, actor);
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
  context = checkContext(state, context);
  const product = ownProduct(state, context.company_id, code);
  if (
    product.sold_by === "weight" &&
    edits.sold_by === "each" &&
    state.products.some(
      (item) =>
        item.company_id === product.company_id &&
        item.package_of_product_id === product.code &&
        item.status !== "archived",
    )
  )
    fail("unit_size");
  if (
    product.package_of_product_id &&
    (edits.pricing_category !== product.pricing_category ||
      edits.main_supplier !== product.main_supplier ||
      (edits.sold_by !== undefined && edits.sold_by !== "each") ||
      edits.unit_size !== product.unit_size ||
      edits.barcode.trim() !== product.barcode)
  )
    fail("pricing_category");
  if (
    edits.sold_by !== undefined &&
    edits.sold_by !== "each" &&
    edits.sold_by !== "weight"
  )
    fail("unit_size");
  if (
    productEditSnapshot(state, context, code, context.company_id) !==
    expectedSnapshot
  )
    fail("stale");
  for (const key of ["name_en", "unit_size"] as const)
    if (!edits[key].trim()) fail(key);
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
    conflictingBarcodeProduct(
      state.products,
      context.company_id,
      edits.barcode,
      code,
    )
  )
    fail("barcode_conflict");
  validateProductDateDrafts(
    state,
    context,
    code,
    edits.dates,
    edits.date_reminder_days,
    edits.date_tracking_stop,
  );
  validateProductTrackingDate(
    state,
    context.company_id,
    code,
    edits.date_tracking,
    edits.dates,
  );
  if (
    edits.date_tracking === false &&
    product.date_tracking !== false &&
    !edits.date_tracking_stop
  )
    throw new DateTrackingError("stop_choice");
  // Existing-product price writes belong to the separately validated price dialog.
  if (edits.selling_price !== undefined) fail("price");
  const before = snapshot(state, product);
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
    date_reminder_days: edits.date_reminder_days ?? product.date_reminder_days,
    sold_by: edits.sold_by ?? product.sold_by ?? "each",
  });
  applyProductDateDrafts(state, context, product, edits.dates, now);
  if (edits.date_tracking === false && edits.date_tracking_stop === "clear")
    stopProductDateTracking(state, context, code, "clear");
  state.activity.push({
    id: createId("product-edit"),
    company_id: context.company_id,
    branch: "all",
    scope: edits.scope,
    product_code: code,
    action: "Save product",
    by: context.actor,
    ...actorAudit(state, context, now),
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
  context = checkContext(state, context);
  const product = ownProduct(state, context.company_id, code);
  const normalized = barcode.trim();
  const existing = state.products.find(
    (item) =>
      item.company_id === context.company_id &&
      item.code !== code &&
      normalizeSearch(item.barcode) === normalizeSearch(normalized),
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
    proposed_price: regularPrice(state, product, context.branch) ?? "",
    reason: "Barcode conflict",
    created_at: now.toISOString(),
    triggered_by: context.actor,
    triggered_by_user_id: context.user_id,
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
    ...actorAudit(state, context, now),
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
