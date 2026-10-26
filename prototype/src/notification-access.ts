import type { AuthenticatedActor, Capability } from "./authority-types";
import type { DemoState } from "./types";
import type { NotificationRecord } from "./sales";
import { can } from "./permissions";
import { domainScope } from "./domain-authority";
import { readableNotebookEntries } from "./notebooks";
import { supplierRecords } from "./supplier-editor";
import { missingSupplierProfileDetails } from "./supplier-profiles";
/** Retained notification rows never retain authority after a person's role/locations change. */
export function notificationReadable(
  state: DemoState,
  actor: AuthenticatedActor,
  row: NotificationRecord,
): boolean {
  if (
    row.dismissed_at ||
    row.company_id !== actor.company_id ||
    row.recipient_user_id !== actor.user_id ||
    (row.branch !== "all" && !actor.allowed_branches.includes(row.branch))
  )
    return false;
  let capability: Capability;
  switch (row.kind) {
    case "supplier_profile_incomplete": {
      const supplier = supplierRecords(state).find(
        (record) =>
          record.company_id === actor.company_id &&
          record.id === row.supplier_id,
      );
      if (
        !supplier ||
        !supplier.active ||
        !missingSupplierProfileDetails(supplier).length
      )
        return false;
      capability = "suppliers.manage";
      break;
    }
    case "note_added":
      if (
        !state.notes.some(
          (note) =>
            note.company_id === row.company_id &&
            note.id === row.note_id &&
            note.branch === row.branch &&
            !note.archived,
        )
      )
        return false;
      capability = "notes.read";
      break;
    case "notebook_entry_added":
      if (
        !readableNotebookEntries(state, actor).some(
          (entry) =>
            entry.id === row.notebook_entry_id && entry.branch === row.branch,
        )
      )
        return false;
      capability = "notebooks.read";
      break;
    case "price_update_created":
    case "price_update_reminder":
      if (
        !state.price_update_tasks?.some(
          (task) =>
            task.company_id === row.company_id &&
            task.id === row.task_id &&
            task.branch === row.branch &&
            task.product_code === row.product_code &&
            task.status === "pending",
        )
      )
        return false;
      capability = "price_updates.read";
      break;
    case "price_update_escalation":
      if (
        !state.price_update_tasks?.some(
          (task) =>
            task.company_id === row.company_id &&
            task.branch === row.branch &&
            task.status === "pending",
        )
      )
        return false;
      capability = "dashboard.company";
      break;
    case "sale_request_decision":
      if (
        !state.sale_requests?.some(
          (request) =>
            request.company_id === row.company_id &&
            request.id === row.request_id &&
            request.branch === row.branch &&
            request.status !== "pending",
        )
      )
        return false;
      capability = "dashboard.company";
      break;
    case "approval_waiting":
      if (
        !state.approvals.some(
          (approval) =>
            approval.company_id === actor.company_id &&
            approval.branch === row.branch &&
            approval.type !== "new_supplier" &&
            approval.status === "pending" &&
            row.event_key === `approval:${approval.id}:${actor.user_id}`,
        )
      )
        return false;
      capability = "approvals.read";
      break;
    case "sale_request_submitted":
      capability = "approvals.read";
      break;
    case "branch_request_waiting":
      capability = "branch_requests.read";
      break;
    case "return_waiting_credit":
      capability = "supplier_balances.read";
      break;
    case "expiry_date_waiting":
      capability = "dates.read";
      break;
    case "sale_cost_increase":
    case "sale_regular_not_above_sale":
      capability = "sales.cost_alert_decide";
      break;
    case "sale_no_end_reminder":
      capability = "sales.manage";
      break;
    case "sale_delivery_release":
      capability = "notes.read";
      break;
    case "sale_request_approved":
    case "sale_request_rejected":
    case "sale_request_expired":
    case "sale_request_withdrawn":
      if (
        !state.sale_requests?.some(
          (request) =>
            request.company_id === row.company_id &&
            request.id === row.request_id &&
            request.requester_user_id === actor.user_id &&
            request.branch === row.branch,
        )
      )
        return false;
      capability = "sales.read";
      break;
    default:
      return false;
  }
  return can(state, actor, capability, domainScope(state, row)).allowed;
}

/** Related routes are rebuilt from the current authorized source, never from a cached href. */
export function notificationDestination(
  state: DemoState,
  actor: AuthenticatedActor,
  row: NotificationRecord,
): { branch: string; href: string } | null {
  if (!notificationReadable(state, actor, row)) return null;
  const query = encodeURIComponent;
  const location = { branch: row.branch };
  switch (row.kind) {
    case "supplier_profile_incomplete": {
      const supplier = supplierRecords(state).find(
        (record) =>
          record.company_id === actor.company_id &&
          record.id === row.supplier_id,
      );
      return supplier
        ? { ...location, href: `suppliers?name=${query(supplier.name)}&edit=1` }
        : null;
    }
    case "note_added":
      return row.note_id
        ? { ...location, href: `notes?note=${query(row.note_id)}` }
        : null;
    case "notebook_entry_added":
      return row.notebook_entry_id
        ? { ...location, href: `notes?entry=${query(row.notebook_entry_id)}` }
        : null;
    case "price_update_created":
    case "price_update_reminder":
      return row.task_id
        ? { ...location, href: `price-update?id=${query(row.task_id)}` }
        : null;
    case "price_update_escalation":
      return {
        ...location,
        href: `price-updates?location=${query(row.branch)}&status=pending`,
      };
    case "approval_waiting":
      return { ...location, href: "approvals" };
    case "sale_request_submitted": {
      const request = state.sale_requests?.find(
        (request) =>
          request.company_id === actor.company_id &&
          request.id === row.request_id &&
          request.branch === row.branch,
      );
      return request
        ? { ...location, href: `approvals?sale-request=${query(request.id)}` }
        : null;
    }
    case "sale_request_decision":
    case "sale_request_approved":
    case "sale_request_rejected":
    case "sale_request_expired":
    case "sale_request_withdrawn": {
      const request = state.sale_requests?.find(
        (request) =>
          request.company_id === actor.company_id &&
          request.id === row.request_id &&
          request.branch === row.branch,
      );
      return request
        ? { ...location, href: `product?code=${query(request.product_code)}` }
        : null;
    }
    case "branch_request_waiting": {
      const request = state.branch_requests?.find(
        (request) =>
          request.company_id === actor.company_id &&
          request.to_branch === row.branch &&
          row.event_key === `branch-request:${request.id}:${actor.user_id}`,
      );
      return request
        ? { ...location, href: `requests?id=${query(request.id)}` }
        : null;
    }
    case "return_waiting_credit": {
      const record = state.returns.find(
        (record) =>
          record.company_id === actor.company_id &&
          record.branch === row.branch &&
          row.event_key === `return-credit:${record.id}:${actor.user_id}`,
      );
      return record
        ? { ...location, href: `returns?id=${query(record.id)}` }
        : null;
    }
    case "expiry_date_waiting":
      return { ...location, href: "expiry" };
    case "sale_no_end_reminder":
    case "sale_cost_increase":
    case "sale_regular_not_above_sale":
    case "sale_delivery_release": {
      const alert = state.alerts.find(
        (alert) =>
          alert.company_id === actor.company_id &&
          alert.branch === row.branch &&
          alert.id === row.alert_id,
      );
      return alert
        ? { ...location, href: `alerts?alert=${query(alert.id)}` }
        : null;
    }
  }
}
