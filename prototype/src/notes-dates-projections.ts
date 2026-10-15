import type { DemoState, ExpiryRecord } from "./types";
import type { AuthenticatedActor } from "./authority-types";
import type { ScopedReadView } from "./e1-read-model";
import { freshActor } from "./authority";
import { can } from "./permissions";
import { projectExpiryLocation } from "./received";
import { scopedTrackedDates } from "./date-tracking";
import { visibleNotebooks, readableNotebookEntries } from "./notebooks";
import { listBranchRequests } from "./branch-requests";

export type NotesDatesRequestsRead = Pick<
  ScopedReadView,
  | "notes"
  | "expiry"
  | "notebooks"
  | "notebook_entries"
  | "branch_requests"
  | "request_transfer_events"
>;

/** Canonical family projection. No role, ACL or location claims come from a form. */
export function projectNotesDatesRequests(
  state: DemoState,
  actor: AuthenticatedActor,
): NotesDatesRequestsRead {
  actor = freshActor(state, actor);
  const selected = (location: string) =>
    actor.branch === "all" || location === actor.branch;
  const notes = state.notes.filter(
    (entry) =>
      selected(entry.branch) &&
      can(state, actor, "notes.read", {
        company_id: entry.company_id,
        kind: "location_record",
        location_ids: [entry.branch],
        entity_id: entry.id,
        location_policy: "retained_read",
      }).allowed,
  );
  // Cashier Lookup receives only the retained date hint. Operational evidence
  // such as quantities, notes, lots and source invoices never enters that view.
  const expiry = can(state, actor, "dates.read").allowed
    ? scopedTrackedDates(state, actor, true)
    : state.expiry
        .filter((entry) => entry.status === "active")
        .map((entry) => projectExpiryLocation(state, entry))
        .filter(
          (entry) =>
            selected(entry.branch) &&
            can(state, actor, "lookup.read", {
              company_id: entry.company_id,
              kind: "location_record",
              location_ids: [entry.branch],
              entity_id: entry.id,
            }).allowed,
        )
        .map((entry): ExpiryRecord => ({
          id: entry.id,
          company_id: entry.company_id,
          branch: entry.branch,
          product_code: entry.product_code,
          date: entry.date,
          date_type: entry.date_type,
          expires_in_days: entry.expires_in_days,
          status: entry.status,
        }));
  const notebooks = visibleNotebooks(state, actor, { includeArchived: true });
  const notebook_entries = readableNotebookEntries(state, actor, {
    includeArchived: true,
  });
  const branch_requests = listBranchRequests(state, actor);
  const readableRequests = new Set(branch_requests.map((entry) => entry.id));
  const request_transfer_events = (state.request_transfer_events ?? []).filter(
    (event) =>
      event.company_id === actor.company_id &&
      readableRequests.has(event.request_id),
  );
  return structuredClone({
    notes,
    expiry,
    notebooks,
    notebook_entries,
    branch_requests,
    request_transfer_events,
  });
}
