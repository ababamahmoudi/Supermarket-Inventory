import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import { freshActor } from "./authority";
import { requireCapability } from "./permissions";
import { domainScope } from "./domain-authority";
import { approvalSnapshot } from "./approvals";
import { effectiveOffer, effectivePrice } from "./catalog";
import { sellingBranches } from "./settings";

/** Only the actual reviewed price, offer caption and override effect leave this protected query. */
export function alertPriceEffects(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  proposedPrice: string,
) {
  actor = freshActor(state, actor);
  const product = state.products.find(
    (item) => item.company_id === actor.company_id && item.code === code,
  );
  if (!product) throw new Error("Product is no longer available");
  requireCapability(
    state,
    actor,
    "pricing.regular_manage",
    domainScope(state, product),
  );
  return {
    snapshot: approvalSnapshot(state, actor, code),
    effects: sellingBranches(state.config).map((branch) => {
      const offer = effectiveOffer(state, product, branch);
      return {
        branch,
        price: effectivePrice(state, product, branch),
        offer_label: offer?.label ?? null,
        offer_stops: Boolean(offer && offer.price !== proposedPrice),
        override_removed: Boolean(product.branch_prices?.[branch]),
      };
    }),
  };
}
export type AlertPriceEffects = ReturnType<typeof alertPriceEffects>;
