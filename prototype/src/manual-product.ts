import Decimal from "decimal.js";
import { freshActor } from "./authority";
import { can, requireCapability } from "./permissions";
import { actorAudit } from "./domain-authority";
import { requireInvoiceAuthority } from "./invoice-authority";
import { createId } from "./ids";
import { calculatePrice } from "./pricing";
import { calculateWeighedPrice, weightCostPerLb } from "./weighed";
import { configuredBranches, activePricingCategories } from "./settings";
import { supplierChoices, supplierMatches } from "./supplier-editor";
import { reconcileOffers } from "./approvals";
import { setManualPriceMarker } from "./manual-prices";
import { normalizeSearch, lookupBranch } from "./catalog";
import {
  applyProductDateDrafts,
  validateProductDateDrafts,
  validateProductTrackingDate,
} from "./date-tracking";
import type { DemoState, Product } from "./types";
import type { ProductEditorContext, ProductEdits } from "./product-editor";

export interface NewProductEdits extends ProductEdits {
  last_cost_before_tax: string;
  last_cost_unit?: "lb" | "kg";
  similar_name_confirmed?: boolean;
  minimum_margin_confirmed?: boolean;
}
export class NewProductError extends Error {
  constructor(
    public readonly code:
      | "permission"
      | "company"
      | "branch"
      | "name_en"
      | "name_fa"
      | "unit_size"
      | "category"
      | "pricing_category"
      | "supplier"
      | "barcode_conflict"
      | "cost"
      | "price"
      | "margin"
      | "similar"
      | "inventory_disabled",
  ) {
    super(code);
  }
}
export function similarProductNames<
  P extends Pick<Product, "company_id" | "name_en">,
>(
  state: {
    readonly config: { readonly company: { readonly seed_key: string } };
    readonly products: readonly P[];
  },
  name: string,
): P[] {
  const normalized = name
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (normalized.length < 4) return [];
  const words = normalized.split(" ").filter((word) => word.length > 2);
  return state.products.filter((product) => {
    if (product.company_id !== state.config.company.seed_key) return false;
    const existing = product.name_en
      .toLocaleLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    return (
      existing === normalized ||
      (words.length >= 2 &&
        words.filter((word) => existing.split(" ").includes(word)).length >= 2)
    );
  });
}
/** The retained high-water mark is independent of archive/revert and stock. */
export function nextProductCode(state: {
  readonly product_code_high_water?: number;
  readonly config: {
    readonly company: { readonly seed_key: string };
    readonly product_codes: { readonly min_digits: number };
  };
  readonly products: readonly Pick<Product, "company_id" | "code">[];
}): string {
  const maximum = Math.max(
    state.product_code_high_water ?? 0,
    0,
    ...state.products
      .filter(
        (product) =>
          product.company_id === state.config.company.seed_key &&
          /^\d+$/.test(product.code),
      )
      .map((product) => Number(product.code)),
  );
  return String(maximum + 1).padStart(
    state.config.product_codes.min_digits,
    "0",
  );
}
export function addProduct(
  state: DemoState,
  context: ProductEditorContext,
  edits: NewProductEdits,
  invoiceQuickAdd = false,
  now = new Date(),
): Product {
  const fail = (code: NewProductError["code"]): never => {
    throw new NewProductError(code);
  };
  context = freshActor(state, context);
  if (context.company_id !== state.config.company.seed_key) fail("company");
  if ("opening_counts" in edits) fail("inventory_disabled");
  const activeCreation = can(state, context, "catalog.create_active", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
    mutation: true,
  }).allowed;
  if (invoiceQuickAdd) {
    context = requireInvoiceAuthority(
      state,
      context,
      "invoices.product_propose",
      state.invoice.id,
      true,
    );
  } else {
    requireCapability(state, context, "catalog.create_active", {
      company_id: state.config.company.seed_key,
      kind: "company_shared",
      mutation: true,
    });
  }
  const proposalBranch = invoiceQuickAdd
    ? state.invoice.branch
    : context.branch;
  const allowed = configuredBranches(state.config);
  if (proposalBranch !== "all" && !allowed.includes(proposalBranch))
    fail("branch");
  for (const field of ["name_en", "unit_size"] as const)
    if (!edits[field].trim()) fail(field);
  const category = activePricingCategories(state.config).find(
    (item) => item.key === edits.pricing_category,
  );
  if (!category) fail("pricing_category");
  if (
    !supplierChoices(state).some((supplier) =>
      supplierMatches(supplier, edits.main_supplier),
    )
  )
    fail("supplier");
  if (
    edits.barcode.trim() &&
    state.products.some(
      (product) =>
        product.company_id === context.company_id &&
        normalizeSearch(product.barcode) === normalizeSearch(edits.barcode),
    )
  )
    fail("barcode_conflict");
  if (
    similarProductNames(state, edits.name_en).length &&
    !edits.similar_name_confirmed
  )
    fail("similar");
  if (!/^\d+(\.\d{1,4})?$/.test(edits.last_cost_before_tax)) fail("cost");
  if (
    edits.sold_by !== undefined &&
    edits.sold_by !== "each" &&
    edits.sold_by !== "weight"
  )
    fail("unit_size");
  const weighed = edits.sold_by === "weight";
  const calculation = weighed
    ? calculateWeighedPrice(
        edits.last_cost_before_tax,
        edits.last_cost_unit ?? "lb",
        edits.pricing_category,
        state.config,
      )
    : calculatePrice(
        edits.last_cost_before_tax,
        edits.pricing_category,
        state.config,
      );
  const canonicalCost = weighed
    ? weightCostPerLb(
        edits.last_cost_before_tax,
        edits.last_cost_unit ?? "lb",
        state.config,
      )
    : edits.last_cost_before_tax;
  const price = edits.selling_price ?? calculation.selling_price;
  if (!/^\d+(\.\d{1,2})?$/.test(price) || new Decimal(price).lte(0))
    fail("price");
  const overridden =
    new Decimal(price).toFixed(2) !== calculation.selling_price;
  if (!activeCreation && overridden) fail("permission");
  const below =
    category!.minimum_margin !== null &&
    new Decimal(price)
      .minus(canonicalCost)
      .lt(new Decimal(price).times(category!.minimum_margin));
  if (activeCreation && below && !edits.minimum_margin_confirmed)
    fail("margin");
  const code = nextProductCode(state);
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
  state.product_code_high_water = Number(code);
  const product: Product = {
    company_id: context.company_id,
    code,
    name_en: edits.name_en.trim(),
    name_fa: edits.name_fa.trim(),
    description_en: edits.description_en.trim(),
    description_fa: edits.description_fa.trim(),
    unit_size: edits.unit_size.trim(),
    ai_category: edits.ai_category.trim(),
    pricing_category: edits.pricing_category,
    barcode: edits.barcode.trim(),
    main_supplier: edits.main_supplier,
    date_tracking: edits.date_tracking,
    date_reminder_days: edits.date_reminder_days,
    first_added_branch: invoiceQuickAdd
      ? state.invoice.branch
      : lookupBranch(context.branch),
    sold_by: edits.sold_by ?? "each",
    last_cost_before_tax: new Decimal(canonicalCost).toFixed(4),
    selling_price: activeCreation ? new Decimal(price).toFixed(2) : "",
    pending_price: activeCreation ? undefined : calculation.selling_price,
    pending_branch: proposalBranch,
    offer: null,
    taxable:
      state.config.tax.profiles.find(
        (item) => item.key === category!.default_tax_profile,
      )?.taxable === true,
    tax_profile: category!.default_tax_profile,
    status: activeCreation ? "active" : "pending_approval",
  };
  state.products.push(product);
  applyProductDateDrafts(state, context, product, edits.dates, now);
  if (activeCreation)
    setManualPriceMarker(state, context, product, "all", price, now);
  if (!activeCreation)
    state.approvals.push({
      id: `${code}:manual-new-product`,
      company_id: context.company_id,
      branch: proposalBranch,
      type: "new_product",
      product_code: code,
      status: "pending",
      proposed_price: calculation.selling_price,
      current_price: null,
      created_at: now.toISOString(),
      triggered_by: context.actor,
      triggered_by_user_id: context.user_id,
      unit_cost: product.last_cost_before_tax,
      margin: calculation.margin,
      threshold: category!.minimum_margin,
    });
  if (activeCreation && overridden)
    state.approvals.push({
      id: `${code}:manual-price`,
      company_id: context.company_id,
      branch: "all",
      type: "price_change",
      product_code: code,
      status: "approved",
      proposed_price: new Decimal(price).toFixed(2),
      current_price: calculation.selling_price,
      scope: "all",
      manual_override: true,
      unit_cost: product.last_cost_before_tax,
      acknowledgment_reason: below
        ? "Below minimum margin confirmed"
        : undefined,
      created_at: now.toISOString(),
      triggered_by: context.actor,
      triggered_by_user_id: context.user_id,
    });
  if (activeCreation) reconcileOffers(state, context, code, context.company_id);
  state.activity.push({
    id: createId("product-activity"),
    company_id: context.company_id,
    branch: "all",
    product_code: code,
    action: "Add product",
    by: context.actor,
    ...actorAudit(state, context, now),
    at: now.toISOString(),
    reversible: false,
    entity_type: "product",
    entity_id: code,
    before: null,
    after: structuredClone(product),
  });
  return product;
}
