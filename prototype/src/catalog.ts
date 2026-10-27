import Decimal from "decimal.js";
import {
  isOfferSuppressed,
  type OfferSuppressionReadState,
} from "./offer-store-scopes";
import {
  effectiveApprovalLocation,
  type InvoiceLocationReadState,
} from "./received";
import { branchSellsToCustomers } from "./settings";
import type { Approval, Branch, Offer, Product } from "./types";
import {
  activeSaleAt,
  saleCanonicalPrice,
  type SaleClockConfig,
  type TemporalSale,
} from "./sales";

/** Aggregates stay aggregates; customer Lookup must choose a concrete Store. */
export function lookupBranch(branch: Branch): Branch {
  return branch;
}
export type PriceProduct = Pick<
  Product,
  "company_id" | "code" | "status" | "selling_price" | "branch_prices"
>;
export type ProductSearchFields = Pick<
  Product,
  "name_en" | "name_fa" | "code" | "barcode" | "unit_size"
>;
export interface CatalogPriceReadState<
  P extends PriceProduct = PriceProduct,
> extends OfferSuppressionReadState {
  config: SaleClockConfig;
  products: readonly P[];
  offers: readonly Offer[];
  sales?: readonly TemporalSale[];
}

function resolveProduct<P extends PriceProduct>(
  state: CatalogPriceReadState<P>,
  productOrCode: P | string,
): P | null {
  const product =
    typeof productOrCode === "string"
      ? state.products.find(
          (item) =>
            item.code === productOrCode &&
            item.company_id === state.config.company.seed_key,
        )
      : productOrCode;
  return product && product.company_id === state.config.company.seed_key
    ? product
    : null;
}

/** Approved branch prices win; pending proposals never become the register price. */
export function regularPrice<P extends PriceProduct>(
  state: CatalogPriceReadState<P>,
  productOrCode: P | string,
  branch: Branch,
): string | null {
  const product = resolveProduct(state, productOrCode);
  if (!product || product.status === "archived") return null;
  return (
    product.branch_prices?.[lookupBranch(branch)] ||
    product.selling_price ||
    null
  );
}

/** Temporary sale overlays never mutate the approved regular basis. */
export function effectivePrice<P extends PriceProduct>(
  state: CatalogPriceReadState<P>,
  productOrCode: P | string,
  branch: Branch,
  now = new Date(),
): string | null {
  const regular = regularPrice(state, productOrCode, branch);
  if (!regular) return null;
  const sale = activeSaleAt(state, productOrCode, lookupBranch(branch), now);
  return sale ? saleCanonicalPrice(sale, state.config) : regular;
}

export function isOfferScheduledNow(
  offer: Offer,
  timezone: string,
  now = new Date(),
): boolean {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    dateParts.find((part) => part.type === type)?.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return (
    (!offer.start_date || offer.start_date <= date) &&
    (!offer.end_date || offer.end_date >= date)
  );
}

/** Resolve one eligible offer, keeping branch pools and approved prices separate. */
export function effectiveOffer<P extends PriceProduct>(
  state: CatalogPriceReadState<P>,
  productOrCode: P | string,
  branch: Branch,
  now = new Date(),
): Offer | null {
  const product = resolveProduct(state, productOrCode);
  if (!product) return null;
  const price = effectivePrice(state, product, branch, now);
  if (!price) return null;
  const selectedBranch = lookupBranch(branch);
  if (!branchSellsToCustomers(state.config, selectedBranch)) return null;
  if (activeSaleAt(state, product, selectedBranch, now)) return null;
  const eligible = state.offers.filter(
    (offer) =>
      offer.company_id === product.company_id &&
      offer.product_code === product.code &&
      !offer.clearance &&
      !offer.lot_id &&
      offer.status === "active" &&
      !isOfferSuppressed(state, offer, selectedBranch) &&
      offer.currency === state.config.company.currency &&
      isOfferScheduledNow(offer, state.config.company.timezone, now) &&
      new Decimal(offer.price).equals(price) &&
      ((offer.scope === "branch" && offer.branch === selectedBranch) ||
        (offer.scope === "all" && offer.branch === "all")),
  );
  return (
    eligible.find((offer) => offer.scope === "branch") ??
    eligible.find((offer) => offer.scope === "all") ??
    null
  );
}

export interface PendingPriceReadState extends InvoiceLocationReadState {
  readonly config: { readonly company: { readonly seed_key: string } };
  readonly approvals: readonly Pick<
    Approval,
    | "company_id"
    | "product_code"
    | "status"
    | "type"
    | "branch"
    | "proposed_price"
    | "source_invoice_id"
    | "invoice_ids"
    | "invoice_number"
  >[];
}
export function pendingPrice(
  state: PendingPriceReadState,
  product: Pick<
    Product,
    | "company_id"
    | "code"
    | "pending_price"
    | "pending_branch"
    | "package_pending_prices"
  >,
  branch: Branch,
): string | null {
  if (product.company_id !== state.config.company.seed_key) return null;
  const selectedBranch = lookupBranch(branch);
  if (product.package_pending_prices) {
    if (branch !== "all")
      return product.package_pending_prices[selectedBranch] ?? null;
    const prices = Object.values(product.package_pending_prices);
    return prices.length && prices.every((price) => price === prices[0])
      ? prices[0]
      : null;
  }
  const proposals = state.approvals.filter(
    (approval) =>
      approval.company_id === product.company_id &&
      approval.product_code === product.code &&
      approval.status === "pending" &&
      (approval.type === "new_product" || approval.type === "price_change"),
  );
  const proposal = proposals.find((approval) => {
    const origin = effectiveApprovalLocation(state, approval);
    return branch === "all" || origin === selectedBranch || origin === "all";
  });
  if (proposal) return proposal.proposed_price;
  if (proposals.length) return null;
  if (
    product.pending_price &&
    (branch === "all" ||
      !product.pending_branch ||
      product.pending_branch === "all" ||
      product.pending_branch === selectedBranch)
  ) {
    return product.pending_price;
  }
  return null;
}

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .trim();
}

export function matchesProduct(
  product: ProductSearchFields,
  query: string,
): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const searchable = normalizeSearch(
    [
      product.name_en,
      product.name_fa,
      product.code,
      product.barcode,
      product.unit_size,
    ].join(" "),
  );
  return words.every((word) => searchable.includes(word));
}

/** A scanned identifier must not select another product's barcode substring. */
export function searchProducts<P extends ProductSearchFields>(
  products: readonly P[],
  query: string,
): P[] {
  const identifier = normalizeSearch(query);
  if (identifier) {
    const exact = products.filter(
      (product) =>
        normalizeSearch(product.code) === identifier ||
        (product.barcode && normalizeSearch(product.barcode) === identifier),
    );
    if (exact.length) return exact;
  }
  return products.filter((product) => matchesProduct(product, query));
}

/** Shared barcode collision rule for catalog edits, invoice proposals and approval. */
export function conflictingBarcodeProduct(
  products: readonly Pick<Product, "company_id" | "code" | "barcode">[],
  companyId: string,
  barcode: string,
  excludingCode?: string,
) {
  const normalized = normalizeSearch(barcode);
  return normalized
    ? products.find(
        (product) =>
          product.company_id === companyId &&
          product.code !== excludingCode &&
          normalizeSearch(product.barcode) === normalized,
      )
    : undefined;
}
