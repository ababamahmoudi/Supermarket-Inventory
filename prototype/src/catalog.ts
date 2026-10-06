import Decimal from "decimal.js";
import demoSeed from "../../seed/demo-data.json";
import type { Branch, DemoState, Offer, Product } from "./types";

/** The all-branches lookup previews the first configured demo branch. */
export function lookupBranch(branch: Branch): Branch {
  return branch === "all" ? (demoSeed.branches[0] as Branch) : branch;
}

function resolveProduct(
  state: DemoState,
  productOrCode: Product | string,
): Product | null {
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
export function effectivePrice(
  state: DemoState,
  productOrCode: Product | string,
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
export function effectiveOffer(
  state: DemoState,
  productOrCode: Product | string,
  branch: Branch,
): Offer | null {
  const product = resolveProduct(state, productOrCode);
  if (!product) return null;
  const price = effectivePrice(state, product, branch);
  if (!price) return null;
  const selectedBranch = lookupBranch(branch);
  const eligible = state.offers.filter(
    (offer) =>
      offer.company_id === product.company_id &&
      offer.product_code === product.code &&
      offer.status === "active" &&
      offer.currency === state.config.company.currency &&
      isOfferScheduledNow(offer, state.config.company.timezone) &&
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

export function pendingPrice(
  state: DemoState,
  product: Product,
  branch: Branch,
): string | null {
  if (product.company_id !== state.config.company.seed_key) return null;
  const selectedBranch = lookupBranch(branch);
  const proposal = state.approvals.find(
    (approval) =>
      approval.company_id === product.company_id &&
      approval.product_code === product.code &&
      approval.status === "pending" &&
      (approval.type === "new_product" || approval.type === "price_change") &&
      (branch === "all" ||
        approval.branch === selectedBranch ||
        approval.branch === "all"),
  );
  if (proposal) return proposal.proposed_price;
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

export function matchesProduct(product: Product, query: string): boolean {
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
export function searchProducts(products: Product[], query: string): Product[] {
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
