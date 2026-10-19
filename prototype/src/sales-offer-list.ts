import { activeSaleAt, saleStoreDate, sellingSaleBranches } from "./sales";
import { isOfferScheduledNow } from "./catalog";
import type { SaleRequest, SaleSchedule, SalesContext } from "./sales";
import type { Branch, DemoState, Offer, Product } from "./types";

export type SalesOfferFilters = {
  tab: "offers" | "past";
  search: string;
  status: string;
  category: string;
  supplier: string;
  type: string;
};
export type SalesOfferRow =
  | { kind: "sale"; key: string; product: Product; sales: SaleSchedule[] }
  | { kind: "request"; key: string; product: Product; request: SaleRequest };

export function saleListStatus(
  state: DemoState,
  sale: SaleSchedule,
  now = new Date(),
): "active" | "scheduled" | "ended" | "expired" {
  const today = saleStoreDate(state.config, sale.branch, now);
  if (sale.status === "ended")
    return sale.last_day && sale.last_day < today ? "expired" : "ended";
  if (sale.last_day && sale.last_day < today) return "expired";
  return sale.starts_on > today ? "scheduled" : "active";
}

/** The list keeps authorized stores together without turning a sale into an offer. */
export function salesOfferRows(
  state: DemoState,
  context: SalesContext | null,
  branch: Branch,
  filters: SalesOfferFilters,
  now = new Date(),
): SalesOfferRow[] {
  if (
    !context ||
    context.company_id !== state.config.company.seed_key ||
    (filters.type && filters.type !== "sale")
  )
    return [];
  const allowed = sellingSaleBranches(state).filter(
    (store) =>
      context.allowed_branches.includes(store) &&
      (context.role === "supervisor" || store === context.branch) &&
      (branch === "all" || branch === store),
  );
  const needle = filters.search.trim().toLocaleLowerCase();
  const productMatches = (product: Product) =>
    product.company_id === context.company_id &&
    product.status === "active" &&
    (!needle ||
      [product.code, product.name_en, product.name_fa].some((value) =>
        value?.toLocaleLowerCase().includes(needle),
      )) &&
    (!filters.category || product.ai_category === filters.category) &&
    (!filters.supplier || product.main_supplier === filters.supplier);
  const groups = new Map<string, Extract<SalesOfferRow, { kind: "sale" }>>();
  for (const sale of state.sales ?? []) {
    if (
      sale.company_id !== context.company_id ||
      !allowed.includes(sale.branch)
    )
      continue;
    const product = state.products.find(
      (item) =>
        item.company_id === sale.company_id && item.code === sale.product_code,
    );
    if (!product || !productMatches(product)) continue;
    const status = saleListStatus(state, sale, now);
    const past = status === "ended" || status === "expired";
    if ((filters.tab === "past") !== past) continue;
    if (filters.status && filters.status !== status) continue;
    const key =
      filters.tab === "past"
        ? `sale:${sale.group_id}:${sale.ended_at ?? sale.last_day ?? ""}`
        : `sale:${sale.product_code}`;
    const group = groups.get(key) ?? {
      kind: "sale" as const,
      key,
      product,
      sales: [],
    };
    group.sales.push(sale);
    groups.set(key, group);
  }
  const rows: SalesOfferRow[] = [...groups.values()];
  if (filters.tab === "past") {
    rows.sort((left, right) => {
      if (left.kind !== "sale" || right.kind !== "sale") return 0;
      const timestamp = (row: Extract<SalesOfferRow, { kind: "sale" }>) =>
        row.sales.reduce(
          (latest, sale) =>
            (sale.ended_at ?? sale.last_day ?? sale.created_at) > latest
              ? (sale.ended_at ?? sale.last_day ?? sale.created_at)
              : latest,
          "",
        );
      return timestamp(right).localeCompare(timestamp(left));
    });
    return rows;
  }
  if (filters.status && filters.status !== "requested") return rows;
  for (const request of state.sale_requests ?? []) {
    if (
      request.company_id !== context.company_id ||
      request.status !== "pending" ||
      !allowed.includes(request.branch) ||
      (context.role !== "supervisor" &&
        request.requester_username !== context.username) ||
      (request.last_day &&
        request.last_day < saleStoreDate(state.config, request.branch, now))
    )
      continue;
    const product = state.products.find(
      (item) =>
        item.company_id === request.company_id &&
        item.code === request.product_code,
    );
    if (product && productMatches(product))
      rows.push({
        kind: "request",
        key: `request:${request.id}`,
        product,
        request,
      });
  }
  return rows;
}

/** A company multi-buy may pause at one store and remain active at another. */
export function offerPausedStores(
  state: DemoState,
  offer: Offer,
  branch: Branch,
  allowedBranches: Branch[],
  now = new Date(),
): Branch[] {
  if (
    offer.company_id !== state.config.company.seed_key ||
    offer.clearance ||
    offer.status !== "active" ||
    !isOfferScheduledNow(offer, state.config.company.timezone, now)
  )
    return [];
  return sellingSaleBranches(state).filter(
    (store) =>
      allowedBranches.includes(store) &&
      (branch === "all" || store === branch) &&
      (offer.scope === "all" || offer.branch === store) &&
      Boolean(activeSaleAt(state, offer.product_code, store, now)),
  );
}
