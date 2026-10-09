import Decimal from "decimal.js";
import { createId } from "./ids";
import { calculatePrice } from "./pricing";
import { configuredBranches, activePricingCategories } from "./settings";
import { supplierChoices, supplierMatches } from "./supplier-editor";
import { reconcileOffers } from "./approvals";
import type { DemoState, Product } from "./types";
import type { ProductEditorContext, ProductEdits } from "./product-editor";

export interface NewProductEdits extends ProductEdits {
  last_cost_before_tax: string;
  opening_counts?: {
    branch: ProductEditorContext["branch"];
    quantity: number;
  }[];
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
      | "stock",
  ) {
    super(code);
  }
}
export function similarProductNames(state: DemoState, name: string): Product[] {
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
export function nextProductCode(state: DemoState): string {
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
  if (context.company_id !== state.config.company.seed_key) fail("company");
  if (
    context.role !== "supervisor" &&
    !(
      context.role === "floor_worker" &&
      invoiceQuickAdd &&
      context.branch !== "all"
    )
  )
    fail("permission");
  const allowed = configuredBranches(state.config);
  if (
    context.branch !== "all" &&
    (!allowed.includes(context.branch) ||
      !context.allowed_branches.includes(context.branch))
  )
    fail("branch");
  for (const field of ["name_en", "name_fa", "unit_size"] as const)
    if (!edits[field].trim()) fail(field);
  if (!edits.ai_category.trim()) fail("category");
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
        product.barcode === edits.barcode.trim(),
    )
  )
    fail("barcode_conflict");
  if (
    similarProductNames(state, edits.name_en).length &&
    !edits.similar_name_confirmed
  )
    fail("similar");
  if (!/^\d+(\.\d{1,4})?$/.test(edits.last_cost_before_tax)) fail("cost");
  const calculation = calculatePrice(
    edits.last_cost_before_tax,
    edits.pricing_category,
    state.config,
  );
  const price = edits.selling_price ?? calculation.selling_price;
  if (!/^\d+(\.\d{1,2})?$/.test(price) || new Decimal(price).lte(0))
    fail("price");
  const overridden =
    new Decimal(price).toFixed(2) !== calculation.selling_price;
  if (
    context.role !== "supervisor" &&
    (overridden || (edits.opening_counts ?? []).length)
  )
    fail("permission");
  const below =
    category!.minimum_margin !== null &&
    new Decimal(price)
      .minus(edits.last_cost_before_tax)
      .lt(new Decimal(price).times(category!.minimum_margin));
  if (context.role === "supervisor" && below && !edits.minimum_margin_confirmed)
    fail("margin");
  const counts = edits.opening_counts ?? [];
  for (const row of counts)
    if (
      row.branch === "all" ||
      !allowed.includes(row.branch) ||
      !context.allowed_branches.includes(row.branch) ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 0
    )
      fail("stock");
  if (new Set(counts.map((row) => row.branch)).size !== counts.length)
    fail("stock");
  const code = nextProductCode(state);
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
    last_cost_before_tax: new Decimal(edits.last_cost_before_tax).toFixed(4),
    selling_price:
      context.role === "supervisor" ? new Decimal(price).toFixed(2) : "",
    pending_price:
      context.role === "supervisor" ? undefined : calculation.selling_price,
    pending_branch: context.branch,
    offer: null,
    taxable:
      state.config.tax.profiles.find(
        (item) => item.key === category!.default_tax_profile,
      )?.taxable === true,
    tax_profile: category!.default_tax_profile,
    status: context.role === "supervisor" ? "active" : "pending_approval",
  };
  state.products.push(product);
  if (context.role === "floor_worker")
    state.approvals.push({
      id: `${code}:manual-new-product`,
      company_id: context.company_id,
      branch: context.branch,
      type: "new_product",
      product_code: code,
      status: "pending",
      proposed_price: calculation.selling_price,
      current_price: null,
      created_at: now.toISOString(),
      triggered_by: context.actor,
      unit_cost: product.last_cost_before_tax,
      margin: calculation.margin,
      threshold: category!.minimum_margin,
    });
  if (context.role === "supervisor" && overridden)
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
    });
  for (const row of counts) {
    state.stock_movements ??= [];
    state.stock_movements.push({
      id: `${code}:opening:${row.branch}`,
      company_id: context.company_id,
      branch: row.branch,
      product_code: code,
      qty: row.quantity,
      type: "opening_count",
      reference: "Opening count",
      by: context.actor,
      at: now.toISOString(),
    });
    state.stock[`${row.branch}:${code}`] =
      (state.stock[`${row.branch}:${code}`] ?? 0) + row.quantity;
  }
  if (context.role === "supervisor")
    reconcileOffers(state, code, context.company_id);
  state.activity.push({
    id: createId("product-activity"),
    company_id: context.company_id,
    branch: "all",
    product_code: code,
    action: "Add product",
    by: context.actor,
    at: now.toISOString(),
    reversible: false,
    entity_type: "product",
    entity_id: code,
    before: null,
    after: structuredClone(product),
  });
  return product;
}
