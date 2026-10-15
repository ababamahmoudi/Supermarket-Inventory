import { manualPrice, rulePrice, sellingMargin } from "./manual-prices";
import { productStoreCost } from "./product-costs";
import { actorAtLocation } from "./authority";
import { requireCapability } from "./permissions";
import type { Branch, DemoState } from "./types";
import type { AuthenticatedActor } from "./authority-types";
export interface ManualPricePresentationDTO {
  rule_price: string;
  manual_price: string;
  margin: string | null;
}
/** Called only inside a fresh protected private query; no canonical product escapes. */
export function queryManualPricePresentation(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  location: Branch,
): ManualPricePresentationDTO | null {
  const product = state.products.find(
    (item) => item.code === code && item.company_id === actor.company_id,
  );
  if (!product) return null;
  requireCapability(state, actor, "catalog.cost_read", {
    company_id: product.company_id,
    kind: "company_shared",
    entity_id: product.code,
  });
  const marker = manualPrice(state, product, location);
  if (!marker) return null;
  const cost =
    location === "all"
      ? product.last_cost_before_tax
      : productStoreCost(
          state,
          actorAtLocation(state, actor, location),
          product,
        );
  return {
    rule_price:
      (cost ? rulePrice(state, product, cost) : null) ?? marker.rule_price,
    manual_price: marker.price,
    margin: cost ? sellingMargin(marker.price, cost) : null,
  };
}
