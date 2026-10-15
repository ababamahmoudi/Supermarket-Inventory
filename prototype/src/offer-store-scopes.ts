import { createId } from "./ids";
import { freshActor } from "./authority";
import { requireCapability, requireConcreteLocation } from "./permissions";
import type { AuthenticatedActor } from "./authority-types";
import type { Branch, DemoState, Offer, OfferStoreSuppression } from "./types";
export type SuppressionPriceRecord = Pick<
  OfferStoreSuppression,
  "company_id" | "branch" | "offer_id" | "offer_version" | "status"
> & { stopped_at?: string };
export interface OfferSuppressionReadState {
  offer_store_suppressions?: readonly SuppressionPriceRecord[];
}
export function offerVersion(offer: Pick<Offer, "version">): number {
  const value = offer.version;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 1;
}
export function suppressedOfferStores(
  state: OfferSuppressionReadState,
  offer: Pick<Offer, "id" | "company_id" | "version">,
  allowedBranches: readonly Branch[],
): Branch[] {
  return [
    ...new Set(
      (state.offer_store_suppressions ?? [])
        .filter(
          (record) =>
            record.company_id === offer.company_id &&
            record.offer_id === offer.id &&
            record.offer_version === offerVersion(offer) &&
            record.status === "active" &&
            allowedBranches.includes(record.branch),
        )
        .map((record) => record.branch),
    ),
  ];
}
/** Both canonical and explicitly redacted selectors use the same store stop rule. */
export function isOfferSuppressed(
  state: OfferSuppressionReadState,
  offer: Pick<Offer, "id" | "company_id" | "version">,
  branch: Branch,
): boolean {
  return (state.offer_store_suppressions ?? []).some(
    (record) =>
      record.company_id === offer.company_id &&
      record.branch === branch &&
      record.offer_id === offer.id &&
      record.offer_version === offerVersion(offer) &&
      record.status === "active",
  );
}
/** Assigned staff stop only the actual selected store; the company source is untouched. */
export function stopCompanyOfferAtStore(
  state: DemoState,
  actor: AuthenticatedActor,
  offerId: string,
  expectedVersion: number,
): OfferStoreSuppression | null {
  actor = freshActor(state, actor);
  const branch = requireConcreteLocation(state, actor);
  const offer = state.offers.find(
    (item) => item.id === offerId && item.company_id === actor.company_id,
  );
  if (
    !offer ||
    offer.scope !== "all" ||
    offer.branch !== "all" ||
    offer.clearance ||
    offer.lot_id
  )
    throw new Error("Offer not found in this company");
  if (offerVersion(offer) !== expectedVersion)
    throw new Error("Offer changed before stopping it");
  requireCapability(state, actor, "offers.multibuy_manage", {
    company_id: offer.company_id,
    kind: "location_record",
    location_ids: [branch],
    entity_id: offer.id,
    version: offerVersion(offer),
    mutation: true,
    location_policy: "active_only",
  });
  if (offer.status === "stopped" || isOfferSuppressed(state, offer, branch))
    return null;
  const suppression: OfferStoreSuppression = {
    id: createId("offer-store-stop"),
    company_id: offer.company_id,
    branch,
    offer_id: offer.id,
    offer_version: offerVersion(offer),
    status: "active",
    stopped_at: new Date().toISOString(),
    stopped_by_user_id: actor.user_id,
    stopped_by: actor.actor,
  };
  state.offer_store_suppressions ??= [];
  state.offer_store_suppressions.push(suppression);
  return suppression;
}
/** Undo retains the stop evidence and clears only its current exact store/version. */
export function clearOfferStoreSuppression(
  state: DemoState,
  actor: AuthenticatedActor,
  suppressionId: string,
): void {
  actor = freshActor(state, actor);
  const record = state.offer_store_suppressions?.find(
    (item) => item.id === suppressionId && item.company_id === actor.company_id,
  );
  const offer =
    record &&
    state.offers.find(
      (item) =>
        item.id === record.offer_id && item.company_id === actor.company_id,
    );
  if (!record || !offer || offerVersion(offer) !== record.offer_version)
    throw new Error("Offer changed before stopping it");
  requireCapability(state, actor, "offers.multibuy_manage", {
    company_id: record.company_id,
    kind: "location_record",
    location_ids: [record.branch],
    entity_id: offer.id,
    version: record.offer_version,
    mutation: true,
    location_policy: "active_only",
  });
  if (record.status === "cleared") return;
  record.status = "cleared";
  record.cleared_at = new Date().toISOString();
  record.cleared_by_user_id = actor.user_id;
}
