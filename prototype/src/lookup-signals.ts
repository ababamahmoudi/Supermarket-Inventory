import { actorAtLocation, freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { effectiveOffer } from "./catalog";
import { dateIsDueSoon } from "./date-tracking";
import { companyDate } from "./invoice";
import { allowedLocationIds, can, requireCapability } from "./permissions";
import { effectiveClearanceOffers, lookupLastReceipt } from "./receipt-lots";
import { effectiveExpiryLocation } from "./received";
import { activeSaleAt } from "./sales";
import type { DemoState } from "./types";

export interface LookupProductSignals {
  code: string;
  onOffer: boolean;
  expiringSoon: boolean;
  arrivedToday: boolean;
  priceChangedRecently: boolean;
}

/** Public yes/no facts only; never return receipt, decision, staff or cost evidence. */
export function lookupProductSignals(
  state: DemoState,
  actor: AuthenticatedActor,
  now = new Date(),
): LookupProductSignals[] {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "lookup.read");
  const locations = allowedLocationIds(state, actor).filter(
    (location) => actor.branch === "all" || location === actor.branch,
  );
  const today = companyDate(state.config, now);
  const earliest =
    now.getTime() - (state.label_settings?.recent_price_days ?? 3) * 86_400_000;
  const isRecent = (at: string | undefined) => {
    const time = at ? Date.parse(at) : NaN;
    return Number.isFinite(time) && time >= earliest && time <= now.getTime();
  };
  return state.products
    .filter(
      (product) =>
        product.company_id === actor.company_id &&
        product.status !== "archived",
    )
    .map((product) => {
      const flags = locations.map((location) => {
        const scoped = actorAtLocation(state, actor, location);
        const resource = {
          company_id: actor.company_id,
          kind: "location_record" as const,
          location_ids: [location],
        };
        const receipt = can(state, scoped, "lookup.receipt_hint", resource)
          .allowed
          ? lookupLastReceipt(state, scoped, product.code)
          : undefined;
        return {
          onOffer: Boolean(
            effectiveOffer(state, product, location, now) ||
            activeSaleAt(state, product, location, now) ||
            effectiveClearanceOffers(state, product, location).length > 0,
          ),
          expiringSoon: state.expiry.some(
            (entry) =>
              entry.company_id === actor.company_id &&
              entry.product_code === product.code &&
              effectiveExpiryLocation(state, entry) === location &&
              dateIsDueSoon(state, entry, now),
          ),
          arrivedToday: receipt?.date === today,
          priceChangedRecently:
            (state.price_update_tasks ?? []).some(
              (task) =>
                task.company_id === actor.company_id &&
                task.product_code === product.code &&
                task.branch === location &&
                task.status !== "cancelled" &&
                isRecent(task.effective_at),
            ) ||
            isRecent(product.price_provenance?.[location]?.changed_at) ||
            isRecent(product.price_provenance?.all?.changed_at),
        };
      });
      return {
        code: product.code,
        onOffer: flags.some((value) => value.onOffer),
        expiringSoon: flags.some((value) => value.expiringSoon),
        arrivedToday: flags.some((value) => value.arrivedToday),
        priceChangedRecently: flags.some((value) => value.priceChangedRecently),
      };
    });
}
