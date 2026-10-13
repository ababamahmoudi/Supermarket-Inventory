import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { allowedLocationIds, can, requireCapability } from "./permissions";
import { manualPrice } from "./manual-prices";
import {
  projectOffersReadView,
  type OfferReadDTO,
  type OfferStoreSuppressionReadDTO,
} from "./offers-read-model";
import {
  projectLabelsReadView,
  type LabelsReadProjection,
} from "./labels-read-model";
import type { DemoState, Product } from "./types";

/** Public catalog/lookup/label fields. Financial evidence is a separate DTO. */
export type ProductReadDTO = Pick<
  Product,
  | "company_id"
  | "code"
  | "name_en"
  | "name_fa"
  | "unit_size"
  | "description_en"
  | "description_fa"
  | "ai_category"
  | "pricing_category"
  | "main_supplier"
  | "barcode"
  | "tax_profile"
  | "taxable"
  | "status"
  | "date_tracking"
  | "date_reminder_days"
  | "sold_by"
  | "selling_price"
  | "branch_prices"
  | "pending_price"
  | "pending_branch"
  | "last_received_relative_days"
  | "price_approved_relative_days"
  | "first_added_branch"
  | "offer"
> & {
  /** A public badge flag, without rule-price, cost or decision provenance. */
  manual_price_scopes: readonly string[];
};

function visibleLocations(state: DemoState, actor: AuthenticatedActor) {
  const allowed = allowedLocationIds(state, actor, { includeInactive: true });
  return actor.branch === "all"
    ? [...allowed]
    : allowed.filter((id) => id === actor.branch);
}

/** Called inside the protected query; never spread a canonical Product. */
export function projectProductReadDTO(
  state: DemoState,
  actor: AuthenticatedActor,
  product: Product,
): ProductReadDTO {
  const current = freshActor(state, actor);
  if (product.company_id !== current.company_id)
    throw new Error("Product is outside the current company");
  if (!(
    can(state, current, "catalog.read").allowed ||
    can(state, current, "lookup.read").allowed ||
    can(state, current, "labels.read").allowed
  ))
    requireCapability(state, current, "catalog.read");
  const locations = new Set(visibleLocations(state, current));
  const byLocation = <T>(source: Record<string, T> | undefined) =>
    source === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(source).filter(([id]) => locations.has(id)),
        );
  const pendingVisible =
    !product.pending_branch ||
    product.pending_branch === "all" ||
    locations.has(product.pending_branch);
  return {
    company_id: product.company_id,
    code: product.code,
    name_en: product.name_en,
    name_fa: product.name_fa,
    unit_size: product.unit_size,
    description_en: product.description_en,
    description_fa: product.description_fa,
    ai_category: product.ai_category,
    pricing_category: product.pricing_category,
    main_supplier: product.main_supplier,
    barcode: product.barcode,
    tax_profile: product.tax_profile,
    taxable: product.taxable,
    status: product.status,
    date_tracking: product.date_tracking,
    date_reminder_days: product.date_reminder_days,
    sold_by: product.sold_by,
    selling_price: product.selling_price,
    branch_prices: byLocation(product.branch_prices),
    pending_price: pendingVisible ? product.pending_price : undefined,
    pending_branch: pendingVisible ? product.pending_branch : undefined,
    last_received_relative_days: byLocation(
      product.last_received_relative_days,
    ),
    price_approved_relative_days: product.price_approved_relative_days,
    first_added_branch:
      product.first_added_branch && locations.has(product.first_added_branch)
        ? product.first_added_branch
        : undefined,
    offer: product.offer,
    manual_price_scopes: ["all", ...locations].filter(
      (location) => manualPrice(state, product, location) !== null,
    ),
  };
}

export interface CatalogReadProjection extends LabelsReadProjection {
  products: ProductReadDTO[];
  offers: OfferReadDTO[];
  offer_store_suppressions: OfferStoreSuppressionReadDTO[];
}
export function projectCatalogReadView(
  state: DemoState,
  actor: AuthenticatedActor,
): CatalogReadProjection {
  const current = freshActor(state, actor);
  return {
    products: state.products
      .filter((product) => product.company_id === current.company_id)
      .map((product) => projectProductReadDTO(state, current, product)),
    offers: projectOffersReadView(state, current).offers,
    offer_store_suppressions: projectOffersReadView(state, current)
      .offer_store_suppressions,
    ...projectLabelsReadView(state, current),
  };
}

/** Owner/Manager source details are obtained by a fresh protected query. */
export interface CatalogFinancialDTO {
  last_cost_before_tax: Product["last_cost_before_tax"];
  manual_prices: Product["manual_prices"];
  price_provenance: Product["price_provenance"];
}
export function queryCatalogFinancialDetails(
  state: DemoState,
  actor: AuthenticatedActor,
  productCode: string,
): CatalogFinancialDTO {
  const current = freshActor(state, actor);
  const product = state.products.find(
    (item) =>
      item.company_id === current.company_id && item.code === productCode,
  );
  if (!product) throw new Error("Product not found in this company");
  requireCapability(state, current, "catalog.cost_read", {
    company_id: product.company_id,
    kind: "company_shared",
    entity_id: product.code,
  });
  const locations = new Set(visibleLocations(state, current));
  const scoped = <T>(source: Record<string, T> | undefined) =>
    source === undefined
      ? undefined
      : structuredClone(
          Object.fromEntries(
            Object.entries(source).filter(
              ([id]) => id === "all" || locations.has(id),
            ),
          ),
        );
  return {
    last_cost_before_tax: product.last_cost_before_tax,
    manual_prices: scoped(product.manual_prices),
    price_provenance: scoped(product.price_provenance),
  };
}
