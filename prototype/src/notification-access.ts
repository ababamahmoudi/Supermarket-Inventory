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
            task.branch === row.branch,
        )
      )
        return false;
      capability = "price_updates.read";
      break;
    case "price_update_escalation":
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
        state.approvals.some(
          (approval) =>
            approval.company_id === actor.company_id &&
            approval.type === "new_supplier" &&
            row.event_key.startsWith(`approval:${approval.id}:`),
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
