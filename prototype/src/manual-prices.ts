import Decimal from "decimal.js";
import { effectivePrice, lookupBranch } from "./catalog";
import { calculatePrice } from "./pricing";
import type { Branch, DemoState, Product } from "./types";

export interface ManualPriceMarker {
  price: string;
  rule_price: string;
  set_by: string;
  set_at: string;
}

/** The rule is a comparison value; a changing rule never changes price provenance. */
export function rulePrice(
  state: DemoState,
  product: Product,
  cost = product.last_cost_before_tax,
): string | null {
  if (product.company_id !== state.config.company.seed_key) return null;
  try {
    return calculatePrice(cost, product.pricing_category, state.config)
      .selling_price;
  } catch {
    return null;
  }
}

function legacyMarker(
  state: DemoState,
  product: Product,
  branch: Branch,
): ManualPriceMarker | null {
  const price =
    branch === "all"
      ? product.selling_price
      : effectivePrice(state, product, branch);
  if (!price) return null;
  const applicable = state.approvals
    .map((approval, index) => ({ approval, index }))
    .filter(
      ({ approval }) =>
        approval.company_id === product.company_id &&
        approval.product_code === product.code &&
        approval.status === "approved" &&
        ["price_change", "new_product"].includes(approval.type) &&
        (approval.scope === "all" ||
          approval.branch === "all" ||
          (branch !== "all" && approval.branch === branch)),
    )
    .sort((left, right) => {
      const time = (entry: typeof left) =>
        entry.approval.posted_at ?? entry.approval.created_at ?? "";
      return time(right).localeCompare(time(left)) || right.index - left.index;
    });
  const last = applicable[0]?.approval;
  if (last) {
    if (!last.manual_override || !new Decimal(last.proposed_price).eq(price))
      return null;
    return {
      price,
      rule_price: rulePrice(state, product, last.unit_cost) ?? price,
      set_by: last.triggered_by ?? "",
      set_at: last.posted_at ?? last.created_at ?? "",
    };
  }
  const source =
    product.price_provenance?.[branch] ?? product.price_provenance?.all;
  if (
    source?.changed_price &&
    new Decimal(source.changed_price).eq(price) &&
    !new Decimal(source.calculated_price).eq(price)
  )
    return {
      price,
      rule_price: source.calculated_price,
      set_by: source.changed_by ?? "",
      set_at: source.changed_at ?? "",
    };
  return null;
}

export function hydrateProductManualPriceMarkers(
  state: DemoState,
  product: Product,
): void {
  if (
    product.company_id !== state.config.company.seed_key ||
    product.manual_prices !== undefined
  )
    return;
  const markers: Record<Branch, ManualPriceMarker> = {};
  const company = legacyMarker(state, product, "all");
  if (company) markers.all = company;
  for (const branch of Object.keys(product.branch_prices ?? {})) {
    const marker = legacyMarker(state, product, branch);
    if (marker) markers[branch] = marker;
  }
  product.manual_prices = markers;
}

/** Read old B decisions once, without fabricating an invoice or touching prices. */
export function hydrateManualPriceMarkers(state: DemoState): void {
  for (const product of state.products)
    hydrateProductManualPriceMarkers(state, product);
}

/** Only the marker belonging to the effective, approved scope follows the price. */
export function manualPrice(
  state: DemoState,
  product: Product,
  branch: Branch,
): ManualPriceMarker | null {
  const price = effectivePrice(state, product, branch);
  if (!price) return null;
  const location = lookupBranch(branch);
  const marker =
    product.manual_prices === undefined
      ? legacyMarker(state, product, location)
      : product.branch_prices?.[location]
        ? (product.manual_prices[location] ?? null)
        : (product.manual_prices.all ?? null);
  return marker && new Decimal(marker.price).eq(price) ? marker : null;
}

/** Capture provenance in the same product snapshot as the approved price. */
export function setManualPriceMarker(
  state: DemoState,
  product: Product,
  branch: Branch,
  price: string,
  actor: string,
  now = new Date(),
  cost = product.last_cost_before_tax,
): void {
  if (product.company_id !== state.config.company.seed_key) return;
  hydrateProductManualPriceMarkers(state, product);
  const calculated = rulePrice(state, product, cost);
  const marker =
    calculated && !new Decimal(price).eq(calculated)
      ? {
          price: new Decimal(price).toFixed(2),
          rule_price: calculated,
          set_by: actor,
          set_at: now.toISOString(),
        }
      : null;
  if (branch === "all") product.manual_prices = marker ? { all: marker } : {};
  else {
    product.manual_prices ??= {};
    if (marker) product.manual_prices[branch] = marker;
    else delete product.manual_prices[branch];
  }
}

/** An explicit empty map prevents a prior manual decision from resurfacing. */
export function clearManualPriceMarker(product: Product, branch: Branch): void {
  if (branch === "all") product.manual_prices = {};
  else {
    product.manual_prices ??= {};
    delete product.manual_prices[branch];
  }
}

export function sellingMargin(
  price: string | null,
  cost: string,
): string | null {
  if (!price) return null;
  try {
    const selling = new Decimal(price);
    const basis = new Decimal(cost);
    return selling.isFinite() &&
      selling.gt(0) &&
      basis.isFinite() &&
      basis.gte(0)
      ? selling
          .minus(basis)
          .div(selling)
          .times(100)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toFixed(2)
      : null;
  } catch {
    return null;
  }
}
