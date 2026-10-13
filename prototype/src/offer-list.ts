import { businessDate } from "./approvals";
import { branchSellsToCustomers } from "./settings";
import type { Branch, Offer } from "./types";
import type { SaleClockConfig } from "./sales";
import {
  isOfferSuppressed,
  type OfferSuppressionReadState,
} from "./offer-store-scopes";
interface OfferListReadState extends OfferSuppressionReadState {
  config: SaleClockConfig;
  offers: readonly Offer[];
}

/** Retain every historical version; visibility follows the existing price scope. */
export function scopedOffers(
  state: OfferListReadState,
  branch: Branch,
): Offer[] {
  return state.offers
    .filter(
      (offer) =>
        offer.company_id === state.config.company.seed_key &&
        (offer.scope === "all" ||
          branchSellsToCustomers(state.config, offer.branch)) &&
        (offer.scope === "all" ||
          branch === "all" ||
          offer.branch === branch) &&
        !(
          branch !== "all" &&
          offer.scope === "all" &&
          offer.status === "suggested" &&
          state.offers.some(
            (local) =>
              local.company_id === offer.company_id &&
              local.product_code === offer.product_code &&
              local.scope === "branch" &&
              local.branch === branch &&
              local.status === "active" &&
              local.label === offer.label &&
              local.price === offer.price,
          )
        ),
    )
    .map((offer) => {
      if (branch === "all" || !isOfferSuppressed(state, offer, branch))
        return offer;
      const stop = state.offer_store_suppressions?.find(
        (record) =>
          record.offer_id === offer.id &&
          record.branch === branch &&
          record.company_id === offer.company_id &&
          record.status === "active",
      );
      return {
        ...offer,
        scope: "branch" as const,
        branch,
        status: "stopped" as const,
        stopped_at:
          stop && "stopped_at" in stop && typeof stop.stopped_at === "string"
            ? stop.stopped_at
            : offer.stopped_at,
      };
    });
}

export function isPastOffer(offer: Offer, timezone: string): boolean {
  return (
    offer.status === "stopped" ||
    (offer.status === "active" &&
      Boolean(offer.end_date && offer.end_date < businessDate(timezone)))
  );
}

/** One product row, without discarding legitimate default/branch definitions. */
export function currentOfferGroups(offers: Offer[], timezone: string) {
  const groups = new Map<string, Offer[]>();
  for (const offer of offers) {
    if (offer.status !== "active" || isPastOffer(offer, timezone)) continue;
    const key = `${offer.company_id}:${offer.product_code}`;
    const members = groups.get(key) ?? [];
    members.push(offer);
    groups.set(key, members);
  }
  return [...groups.values()];
}

/** Old records have no timestamps: retain their insertion order as the fallback. */
export function pastOffers(offers: Offer[], timezone: string): Offer[] {
  return offers
    .map((offer, index) => ({ offer, index }))
    .filter(({ offer }) => isPastOffer(offer, timezone))
    .sort((left, right) => {
      const time = (offer: Offer) =>
        offer.stopped_at ?? offer.end_date ?? offer.created_at ?? "";
      const leftTime = time(left.offer);
      const rightTime = time(right.offer);
      // Recorded dates precede undated historic versions; equal or absent dates
      // keep newest retained insertion first without inventing a timestamp.
      return rightTime.localeCompare(leftTime) || right.index - left.index;
    })
    .map(({ offer }) => offer);
}
