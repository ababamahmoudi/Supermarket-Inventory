import { notificationReadable } from "./notification-access";
import { notificationGroupIdentity } from "./notification-identity";
import { freshActor } from "./authority";
import { businessAuditRead } from "./business-audit-read";
import type {
  SaleLifecycleEvent,
  SaleDeliveryHold,
  NotificationRecord,
} from "./sales";
import type { AuthenticatedActor } from "./authority-types";
import { can, requireCapability } from "./permissions";
import { domainScope, selectedLocations } from "./domain-authority";
import { effectiveApprovalLocation } from "./received";
import type { Approval, Alert, DemoState } from "./types";
import {
  projectSaleReadDTO,
  projectSaleRequestReadDTO,
  type SaleReadDTO,
  type SaleRequestReadDTO,
} from "./offers-read-model";

const privateFields = new Set([
  "unit_cost",
  "cost_snapshot",
  "previous_cost",
  "new_cost",
  "prior_cost",
  "received_cost",
  "margin",
  "prior_margin",
  "new_margin",
  "minimum_margin",
  "threshold",
  "below_cost_reason",
  "acknowledgment_reason",
  "reason",
  "minimum_margin_accepted",
  "manual_price_review",
]);
function safeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !privateFields.has(key))
      .map(([key, item]) => [key, safeValue(item)]),
  );
}

export function approvalViews(
  state: DemoState,
  actor: AuthenticatedActor,
): Approval[] {
  requireCapability(state, actor, "approvals.read", domainScope(state));
  const selected = new Set(selectedLocations(state, actor, true));
  const decides = can(
    state,
    actor,
    "approvals.decide",
    domainScope(state),
  ).allowed;
  return state.approvals
    .filter((approval) => {
      const origin = effectiveApprovalLocation(state, approval);
      return (
        approval.company_id === state.config.company.seed_key &&
        approval.type !== "new_supplier" &&
        (origin === "all" ? decides : selected.has(origin)) &&
        (decides || approval.status === "pending") &&
        can(
          state,
          actor,
          "approvals.read",
          domainScope(state, { ...approval, branch: origin }),
        ).allowed
      );
    })
    .map((approval) => ({
      ...businessAuditRead(
        decides ? approval : (safeValue(approval) as Approval),
      ),
      branch: effectiveApprovalLocation(state, approval),
    }));
}

export function alertViews(
  state: DemoState,
  actor: AuthenticatedActor,
): Alert[] {
  requireCapability(state, actor, "alerts.read", domainScope(state));
  const selected = new Set(selectedLocations(state, actor, true));
  const decides = can(
    state,
    actor,
    "alerts.decide",
    domainScope(state),
  ).allowed;
  return state.alerts
    .filter(
      (alert) =>
        alert.company_id === state.config.company.seed_key &&
        (alert.branch === "all" ? decides : selected.has(alert.branch)) &&
        can(state, actor, "alerts.read", domainScope(state, alert)).allowed,
    )
    .map((alert) =>
      businessAuditRead(decides ? alert : (safeValue(alert) as Alert)),
    );
}

export function saleViews(
  state: DemoState,
  actor: AuthenticatedActor,
): SaleReadDTO[] {
  requireCapability(state, actor, "sales.read", domainScope(state));
  const selected = new Set(selectedLocations(state, actor));
  return (state.sales ?? [])
    .filter(
      (sale) =>
        sale.company_id === state.config.company.seed_key &&
        selected.has(sale.branch) &&
        can(state, actor, "sales.read", domainScope(state, sale)).allowed,
    )
    .map((sale) => businessAuditRead(projectSaleReadDTO(sale)));
}

export function saleRequestViews(
  state: DemoState,
  actor: AuthenticatedActor,
): SaleRequestReadDTO[] {
  requireCapability(state, actor, "sales.read", domainScope(state));
  const selected = new Set(selectedLocations(state, actor));
  return (state.sale_requests ?? [])
    .filter(
      (request) =>
        request.company_id === state.config.company.seed_key &&
        selected.has(request.branch) &&
        can(state, actor, "sales.read", domainScope(state, request)).allowed,
    )
    .map((request) =>
      businessAuditRead(
        projectSaleRequestReadDTO(
          request,
          can(state, actor, "approvals.decide", domainScope(state, request))
            .allowed || request.requester_user_id === actor.user_id,
        ),
      ),
    );
}

/** Read-only lifecycle prices carry no receipt costs, margins or prior private snapshots. */
export type SaleEventReadDTO = Pick<
  SaleLifecycleEvent,
  | "id"
  | "company_id"
  | "branch"
  | "sale_id"
  | "product_code"
  | "revision"
  | "kind"
  | "occurred_at"
  | "local_boundary"
  | "effective_price_before"
  | "effective_price_after"
>;
export type SaleHoldReadDTO = Pick<
  SaleDeliveryHold,
  | "id"
  | "company_id"
  | "branch"
  | "product_code"
  | "sale_id"
  | "invoice_id"
  | "invoice_number"
  | "line_index"
  | "note_id"
  | "held_at"
  | "planned_last_day"
  | "released_reminder_at"
  | "released_sale_revision"
>;
export type NotificationReadDTO = Pick<
  NotificationRecord,
  | "id"
  | "company_id"
  | "branch"
  | "kind"
  | "task_id"
  | "count"
  | "product_code"
  | "sale_id"
  | "request_id"
  | "alert_id"
  | "invoice_id"
  | "supplier_id"
  | "href"
  | "created_at"
  | "read_at"
> & { reason?: string; group_key: string };
export interface SalesReadProjection {
  sales: SaleReadDTO[];
  sale_requests: SaleRequestReadDTO[];
  sale_events: SaleEventReadDTO[];
  sale_delivery_holds: SaleHoldReadDTO[];
  notifications: NotificationReadDTO[];
}
/** Canonical query only: every family is explicitly copied and individually scoped. */
export function projectSalesReadView(
  state: DemoState,
  actor: AuthenticatedActor,
): SalesReadProjection {
  const current = freshActor(state, actor);
  const locations = new Set(selectedLocations(state, current, true));
  const scope = domainScope(state);
  const readsSales = can(state, current, "sales.read", scope).allowed;
  const sales = readsSales ? saleViews(state, current) : [];
  const saleIds = new Set(sales.map((sale) => sale.id));
  const sale_requests = readsSales ? saleRequestViews(state, current) : [];
  const sale_events = readsSales
    ? (state.sale_events ?? [])
        .filter(
          (event) =>
            event.company_id === current.company_id &&
            locations.has(event.branch) &&
            saleIds.has(event.sale_id),
        )
        .map((event) => ({
          id: event.id,
          company_id: event.company_id,
          branch: event.branch,
          sale_id: event.sale_id,
          product_code: event.product_code,
          revision: event.revision,
          kind: event.kind,
          occurred_at: event.occurred_at,
          local_boundary: event.local_boundary,
          effective_price_before: event.effective_price_before,
          effective_price_after: event.effective_price_after,
        }))
    : [];
  const sale_delivery_holds = readsSales
    ? (state.sale_delivery_holds ?? [])
        .filter(
          (hold) =>
            hold.company_id === current.company_id &&
            locations.has(hold.branch) &&
            saleIds.has(hold.sale_id),
        )
        .map((hold) => ({
          id: hold.id,
          company_id: hold.company_id,
          branch: hold.branch,
          product_code: hold.product_code,
          sale_id: hold.sale_id,
          invoice_id: hold.invoice_id,
          invoice_number: hold.invoice_number,
          line_index: hold.line_index,
          note_id: hold.note_id,
          held_at: hold.held_at,
          planned_last_day: hold.planned_last_day,
          released_reminder_at: hold.released_reminder_at,
          released_sale_revision: hold.released_sale_revision,
        }))
    : [];
  const notificationScope = { ...scope, owner_user_id: current.user_id };
  const notificationLocations = new Set(current.allowed_branches);
  const notifications = can(
    state,
    current,
    "notifications.read",
    notificationScope,
  ).allowed
    ? (state.notifications ?? [])
        .filter(
          (item) =>
            item.company_id === current.company_id &&
            item.recipient_user_id === current.user_id &&
            (item.branch === "all" || notificationLocations.has(item.branch)) &&
            notificationReadable(state, current, item) &&
            can(state, current, "notifications.read", {
              ...domainScope(state, item),
              owner_user_id: item.recipient_user_id,
            }).allowed,
        )
        .map((item) => {
          const rejectedRequest =
            item.kind === "sale_request_rejected" &&
            (state.sale_requests ?? []).find(
              (request) =>
                request.id === item.request_id &&
                request.company_id === current.company_id &&
                request.branch === item.branch &&
                request.product_code === item.product_code &&
                request.requester_user_id === current.user_id &&
                request.status === "rejected" &&
                request.decided_at === item.created_at &&
                request.decision_reason === item.reason,
            );
          return {
            id: item.id,
            group_key: notificationGroupIdentity(state, item),
            company_id: item.company_id,
            branch: item.branch,
            kind: item.kind,
            task_id: item.task_id,
            count: item.count,
            product_code: item.product_code,
            sale_id: item.sale_id,
            request_id: item.request_id,
            alert_id: item.alert_id,
            invoice_id: item.invoice_id,
            supplier_id: item.supplier_id,
            href: item.href,
            created_at: item.created_at,
            read_at: item.read_at,
            ...(rejectedRequest && rejectedRequest.decision_reason
              ? { reason: rejectedRequest.decision_reason }
              : {}),
          };
        })
    : [];
  return {
    sales,
    sale_requests,
    sale_events,
    sale_delivery_holds,
    notifications,
  };
}
