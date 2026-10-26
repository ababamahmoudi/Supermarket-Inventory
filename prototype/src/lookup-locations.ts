import { actorAtLocation, freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { effectivePrice } from "./catalog";
import { allowedLocationIds, can, requireCapability } from "./permissions";
import { lookupLastReceipt } from "./receipt-lots";
import { effectiveExpiryLocation } from "./received";
import { validTrackedDate } from "./date-tracking";
import type { DemoState } from "./types";

export interface LookupLocationRow {
  location: string;
  price: string | null;
  delivered?: string;
  dates: { date: string; type: "expiry" | "best_before" }[];
}

/** Public location facts only. Costs, invoice identities and staff never leave this query. */
export function lookupLocationRows(
  state: DemoState,
  actor: AuthenticatedActor,
  productCode: string,
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
    return {
      location,
      price: effectivePrice(state, product, location),
      ...(delivered ? { delivered } : {}),
      dates,
    };
  });
}
