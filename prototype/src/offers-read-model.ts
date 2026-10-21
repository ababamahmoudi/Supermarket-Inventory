import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { allowedLocationIds, can } from "./permissions";
import type { DemoState, Offer, OfferStoreSuppression } from "./types";
import type { SaleSchedule, SaleRequest } from "./sales";

export type OfferReadDTO = Pick<
  Offer,
  | "id"
  | "version"
  | "company_id"
  | "branch"
  | "branch_id"
  | "product_code"
  | "label"
  | "price"
  | "pool"
  | "mix_and_match"
  | "status"
  | "scope"
  | "currency"
  | "start_date"
  | "end_date"
  | "created_at"
  | "stopped_at"
  | "lot_id"
  | "expiry_date"
  | "clearance"
>;
export type SaleReadDTO = Pick<
  SaleSchedule,
  | "id"
  | "company_id"
  | "branch"
  | "branch_id"
  | "product_code"
  | "group_id"
  | "sale_price"
  | "price_unit"
  | "starts_on"
  | "last_day"
  | "status"
  | "revision"
  | "created_at"
  | "created_by"
  | "add_promo_labels"
  | "started_at"
  | "changed_at"
  | "ended_at"
  | "ended_reason"
  | "source_request_id"
  | "regular_price_snapshot"
  | "deferred_regular_labels"
>;
/** Public pending-price display never carries another person's request metadata. */
export type SaleRequestReadDTO = Pick<
  SaleRequest,
  | "id"
  | "company_id"
  | "branch"
  | "branch_id"
  | "product_code"
  | "requested_price"
  | "price_unit"
  | "starts_on"
  | "last_day"
  | "revision"
  | "status"
> &
  Partial<
    Pick<
      SaleRequest,
      | "why"
      | "requester"
      | "requester_user_id"
      | "requester_username"
      | "requested_at"
      | "add_promo_labels"
      | "existing_sale_id"
      | "expected_sale_revision"
      | "decided_at"
      | "decision_reason"
      | "approved_sale_id"
      | "approved_terms"
      | "decided_by"
      | "decided_by_user_id"
      | "decided_by_role_snapshot"
      | "decision_attribution"
    >
  >;
export function projectOfferReadDTO(offer: Offer): OfferReadDTO {
  return {
    id: offer.id,
    version: offer.version ?? 1,
    company_id: offer.company_id,
    branch: offer.branch,
    branch_id: offer.branch_id,
    product_code: offer.product_code,
    label: offer.label,
    price: offer.price,
    pool: offer.pool,
    mix_and_match: offer.mix_and_match,
    status: offer.status,
    scope: offer.scope,
    currency: offer.currency,
    start_date: offer.start_date,
    end_date: offer.end_date,
    created_at: offer.created_at,
    stopped_at: offer.stopped_at,
    lot_id: offer.lot_id,
    expiry_date: offer.expiry_date,
    clearance: offer.clearance,
  };
}
export function projectSaleReadDTO(sale: SaleSchedule): SaleReadDTO {
  return {
    id: sale.id,
    company_id: sale.company_id,
    branch: sale.branch,
    branch_id: sale.branch_id,
    product_code: sale.product_code,
    group_id: sale.group_id,
    sale_price: sale.sale_price,
    price_unit: sale.price_unit,
    starts_on: sale.starts_on,
    last_day: sale.last_day,
    status: sale.status,
    revision: sale.revision,
    created_at: sale.created_at,
    created_by: sale.created_by,
    add_promo_labels: sale.add_promo_labels,
    started_at: sale.started_at,
    changed_at: sale.changed_at,
    ended_at: sale.ended_at,
    ended_reason: sale.ended_reason,
    source_request_id: sale.source_request_id,
    regular_price_snapshot: sale.regular_price_snapshot,
    deferred_regular_labels: sale.deferred_regular_labels,
  };
}
export function projectSaleRequestReadDTO(
  request: SaleRequest,
  includePrivateDetails = false,
): SaleRequestReadDTO {
  const visible: SaleRequestReadDTO = {
    id: request.id,
    company_id: request.company_id,
    branch: request.branch,
    branch_id: request.branch_id,
    product_code: request.product_code,
    requested_price: request.requested_price,
    price_unit: request.price_unit,
    starts_on: request.starts_on,
    last_day: request.last_day,
    revision: request.revision,
    status: request.status,
  };
  return includePrivateDetails
    ? {
        ...visible,
        why: request.why,
        requester: request.requester,
        requester_user_id: request.requester_user_id,
        requester_username: request.requester_username,
        requested_at: request.requested_at,
        add_promo_labels: request.add_promo_labels,
        existing_sale_id: request.existing_sale_id,
        expected_sale_revision: request.expected_sale_revision,
        decided_at: request.decided_at,
        decision_reason: request.decision_reason,
        approved_sale_id: request.approved_sale_id,
        approved_terms: request.approved_terms && { ...request.approved_terms },
        decided_by: request.decided_by,
        decided_by_user_id: request.decided_by_user_id,
        decided_by_role_snapshot: request.decided_by_role_snapshot,
        decision_attribution: request.decision_attribution,
      }
    : visible;
}
export type OfferStoreSuppressionReadDTO = Pick<
  OfferStoreSuppression,
  | "id"
  | "company_id"
  | "branch"
  | "offer_id"
  | "offer_version"
  | "status"
  | "stopped_at"
  | "cleared_at"
>;
export interface OffersReadProjection {
  offer_store_suppressions: OfferStoreSuppressionReadDTO[];
  offers: OfferReadDTO[];
  sales: SaleReadDTO[];
  sale_requests: SaleRequestReadDTO[];
}
export function projectOffersReadView(
  state: DemoState,
  actor: AuthenticatedActor,
): OffersReadProjection {
  const current = freshActor(state, actor);
  const allowed = allowedLocationIds(state, current, { includeInactive: true });
  const locations = new Set(
    current.branch === "all"
      ? allowed
      : allowed.filter((id) => id === current.branch),
  );
  const lookup = can(state, current, "lookup.read").allowed;
  const offersAllowed = can(state, current, "offers.read").allowed;
  const scope = (branch: string, id: string, owner_user_id?: string) => ({
    company_id: current.company_id,
    kind: "location_record" as const,
    location_ids: [branch],
    entity_id: id,
    owner_user_id,
    location_policy: "retained_read" as const,
  });
  return {
    offer_store_suppressions: (state.offer_store_suppressions ?? [])
      .filter(
        (record) =>
          record.company_id === current.company_id &&
          locations.has(record.branch),
      )
      .map((record) => ({
        id: record.id,
        company_id: record.company_id,
        branch: record.branch,
        offer_id: record.offer_id,
        offer_version: record.offer_version,
        status: record.status,
        stopped_at: record.stopped_at,
        cleared_at: record.cleared_at,
      })),
    offers: state.offers
      .filter(
        (offer) =>
          offer.company_id === current.company_id &&
          (offer.scope === "all" || locations.has(offer.branch)) &&
          (offersAllowed || (lookup && offer.status === "active")),
      )
      .map(projectOfferReadDTO),
    sales: (state.sales ?? [])
      .filter(
        (sale) =>
          sale.company_id === current.company_id &&
          locations.has(sale.branch) &&
          (can(state, current, "sales.read", scope(sale.branch, sale.id))
            .allowed ||
            (lookup && sale.status !== "ended")),
      )
      .map(projectSaleReadDTO),
    sale_requests: (state.sale_requests ?? []).flatMap((request) => {
      if (
        request.company_id !== current.company_id ||
        !locations.has(request.branch)
      )
        return [];
      const locationScope = scope(
        request.branch,
        request.id,
        request.requester_user_id,
      );
      const privateDetails =
        can(state, current, "approvals.decide", locationScope).allowed ||
        (request.requester_user_id === current.user_id &&
          can(state, current, "sales.request_edit_own", locationScope).allowed);
      const publicPending =
        request.status === "pending" &&
        (lookup || can(state, current, "sales.read", locationScope).allowed);
      return privateDetails || publicPending
        ? [projectSaleRequestReadDTO(request, privateDetails)]
        : [];
    }),
  };
}
