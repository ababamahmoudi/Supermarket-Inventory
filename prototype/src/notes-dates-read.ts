import type { ScopedReadView } from "./e1-read-model";
import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import type { NotebookDefinition } from "./notebooks";
import { NOTEBOOK_EDIT_WINDOW } from "./notebooks";
import { validTrackedDate } from "./date-tracking";
import { configuredBranches } from "./settings";
import type { BranchRequestStatus } from "./branch-requests";

type Allow = (capability: Capability, scope?: ResourceScope) => boolean;
/** UI choices use the genuine rendered directory/DTO and the private provider's
 * current decision callback. The public view has no canonical SDK binding. */
export function permittedLocationIdsView(
  state: Readonly<Pick<ScopedReadView, "config">>,
  actor: AuthenticatedActor | null,
  allow: Allow,
  capability: Capability,
  options: { includeInactive?: boolean; mutation?: boolean } = {},
): readonly string[] {
  if (!actor) return [];
  return configuredBranches(state.config, options.includeInactive).filter(
    (location) =>
      actor.allowed_branches.includes(location) &&
      allow(capability, {
        company_id: actor.company_id,
        kind: "location_record",
        location_ids: [location],
        mutation: options.mutation,
        location_policy: options.includeInactive ? "retained_read" : undefined,
      }),
  );
}
type NotebookView = Readonly<
  Pick<ScopedReadView, "config" | "notebooks" | "notebook_entries">
>;
type DateView = Readonly<
  Pick<ScopedReadView, "config" | "products" | "expiry">
>;
type RequestView = Readonly<Pick<ScopedReadView, "branch_requests">>;

/** Pure readers consume already guarded DTOs, never canonical business drafts. */
export function visibleNotebookView(
  state: NotebookView,
  options: { includeArchived?: boolean } = {},
) {
  return (state.notebooks ?? []).filter(
    (record) => options.includeArchived || !record.archived,
  );
}
export function readableNotebookEntryView(
  state: NotebookView,
  options: { includeArchived?: boolean } = {},
) {
  return (state.notebook_entries ?? []).filter(
    (entry) => options.includeArchived || !entry.archived,
  );
}
export function canAddNotebookEntryView(
  state: NotebookView,
  record: NotebookDefinition,
  actor: AuthenticatedActor | null,
  allows: Allow,
  location = actor?.branch ?? "",
) {
  if (!actor || record.archived || location === "all") return false;
  return (
    configuredBranches(state.config).includes(location) &&
    record.company_id === actor.company_id &&
    actor.allowed_branches.includes(location) &&
    (actor.branch === "all" || actor.branch === location) &&
    (record.branch === "all" || record.branch === location) &&
    allows("notebooks.entry_add", {
      company_id: record.company_id,
      kind: "location_record",
      location_ids: [location],
      entity_id: record.id,
      mutation: true,
    }) &&
    (allows("notebooks.definition_manage") ||
      (record.read_roles.includes(actor.role) &&
        record.add_roles.includes(actor.role)))
  );
}
export function notebookEntryLocationView(
  state: NotebookView,
  record: NotebookDefinition,
  actor: AuthenticatedActor | null,
  allows: Allow,
) {
  return configuredBranches(state.config).filter((location) =>
    canAddNotebookEntryView(state, record, actor, allows, location),
  );
}
export function canEditNotebookEntryView(
  state: NotebookView,
  actor: AuthenticatedActor | null,
  allows: Allow,
  entryId: string,
  now = new Date(),
) {
  if (!actor) return false;
  const entry = state.notebook_entries?.find((record) => record.id === entryId);
  const definition = state.notebooks?.find(
    (record) => record.id === entry?.notebook_id,
  );
  if (
    !entry ||
    !definition ||
    definition.archived ||
    entry.archived ||
    entry.company_id !== actor.company_id
  )
    return false;
  const active = configuredBranches(state.config).includes(entry.branch);
  const scope: ResourceScope = {
    company_id: entry.company_id,
    kind: "location_record",
    location_ids: [entry.branch],
    entity_id: entry.id,
    mutation: true,
    location_policy: active ? "active_only" : "retained_correction",
  };
  if (allows("notebooks.entry_edit_any", scope)) return true;
  const elapsed = now.getTime() - Date.parse(entry.created_at);
  return (
    active &&
    !definition.archived &&
    entry.by_user_id === actor.user_id &&
    elapsed >= 0 &&
    elapsed < NOTEBOOK_EDIT_WINDOW &&
    allows("notebooks.entry_edit_own", {
      ...scope,
      owner_user_id: entry.by_user_id,
    }) &&
    canAddNotebookEntryView(state, definition, actor, allows, entry.branch)
  );
}
export function trackedDateView(state: DateView, includeRemoved = false) {
  return state.expiry.filter(
    (entry) => includeRemoved || entry.status === "active",
  );
}
export function activeTrackedDateView(state: DateView) {
  return trackedDateView(state).filter((entry) =>
    state.products.some(
      (product) =>
        product.code === entry.product_code &&
        product.company_id === entry.company_id &&
        product.status !== "archived" &&
        product.date_tracking === true,
    ),
  );
}
export function nextTrackedDateView(state: DateView, productCode: string) {
  return trackedDateView(state)
    .filter(
      (entry) =>
        entry.product_code === productCode && validTrackedDate(entry.date),
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
    )[0];
}
export function branchRequestView(
  state: RequestView,
  actor: AuthenticatedActor | null,
  filters: {
    tab?: "incoming" | "outgoing";
    status?: BranchRequestStatus | "open" | "all";
    query?: string;
  } = {},
) {
  if (!actor) return [];
  const query = filters.query?.trim().toLocaleLowerCase() ?? "";
  return (state.branch_requests ?? [])
    .filter((request) => {
      if (filters.tab) {
        const location =
          filters.tab === "incoming" ? request.to_branch : request.from_branch;
        if (
          actor.branch !== location &&
          !(actor.branch === "all" && actor.allowed_branches.includes(location))
        )
          return false;
        if (filters.tab === "incoming" && !request.requested_at) return false;
      }
      if (
        filters.status === "open" &&
        ["closed", "cancelled"].includes(request.status)
      )
        return false;
      if (
        filters.status &&
        !["all", "open"].includes(filters.status) &&
        request.status !== filters.status
      )
        return false;
      return (
        !query ||
        `${request.reference} ${request.items.map((item) => `${item.name_en} ${item.name_fa} ${item.free_text ?? ""} ${item.product_code ?? ""} ${item.note ?? ""}`).join(" ")}`
          .toLocaleLowerCase()
          .includes(query)
      );
    })
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}
