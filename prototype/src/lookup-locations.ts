import { hasApprovedPriceAtLocation } from "./lookup-branch";
import { branchSellsToCustomers } from "./settings";
import { activeSaleAt } from "./sales";
import { actorAtLocation, freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { effectiveOffer, effectivePrice } from "./catalog";
import { allowedLocationIds, can, requireCapability } from "./permissions";
import { lookupLastReceipt } from "./receipt-lots";
import { effectiveExpiryLocation } from "./received";
import { validTrackedDate, dateIsDueSoon } from "./date-tracking";
import type { DemoState } from "./types";

export interface LookupLocationRow {
  location: string;
  price: string | null;
  sells_here: boolean;
  offer_label: string | null;
  on_sale: boolean;
  sale_last_day: string | null;
  next_expiry: { date: string; soon: boolean } | null;
  delivered?: string;
  dates: { date: string; type: "expiry" | "best_before" }[];
}

/** Public location facts only. Costs, invoice identities and staff never leave this query. */
export function lookupLocationRows(
  state: DemoState,
  actor: AuthenticatedActor,
  productCode: string,
  now = new Date(),
): LookupLocationRow[] {
  const current = freshActor(state, actor);
  requireCapability(state, current, "lookup.read");
  const product = state.products.find(
    (row) =>
      row.company_id === current.company_id &&
      row.code === productCode &&
      row.status !== "archived",
  );
  if (!product) throw new Error("Product not found in this company");
  return allowedLocationIds(state, current).map((location) => {
    const scoped = actorAtLocation(state, current, location);
    const scope = {
      company_id: current.company_id,
      kind: "location_record" as const,
      location_ids: [location],
    };
    const delivered = can(state, scoped, "lookup.receipt_hint", scope).allowed
      ? lookupLastReceipt(state, scoped, productCode)?.date
      : undefined;
    const dates = can(state, scoped, "lookup.read", scope).allowed
      ? state.expiry
          .filter(
            (row) =>
              row.company_id === current.company_id &&
              row.product_code === productCode &&
              row.status === "active" &&
              validTrackedDate(row.date) &&
              effectiveExpiryLocation(state, row) === location,
          )
          .map((row) => ({ date: row.date, type: row.date_type ?? "expiry" }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];
    const approved = hasApprovedPriceAtLocation(state, product, location, now);
    const selling = branchSellsToCustomers(state.config, location);
    const price =
      selling && approved
        ? effectivePrice(state, product, location, now)
        : null;
    const sale = price ? activeSaleAt(state, product, location, now) : null;
    const nextExpiry = state.expiry
      .filter(
        (row) =>
          row.company_id === current.company_id &&
          row.product_code === productCode &&
          row.status === "active" &&
          (row.date_type ?? "expiry") === "expiry" &&
          validTrackedDate(row.date) &&
          effectiveExpiryLocation(state, row) === location,
      )
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      location,
      price,
      sells_here:
        selling &&
        Boolean(
          approved ||
          delivered ||
          product.last_received_relative_days?.[location] !== undefined ||
          (state.stock[`${location}:${product.code}`] ?? 0) > 0,
        ),
      offer_label: price
        ? (effectiveOffer(state, product, location, now)?.label ?? null)
        : null,
      on_sale: Boolean(sale),
      sale_last_day: sale?.last_day ?? null,
      next_expiry: nextExpiry
        ? { date: nextExpiry.date, soon: dateIsDueSoon(state, nextExpiry, now) }
        : null,
      ...(delivered ? { delivered } : {}),
      dates,
    };
  });
}
