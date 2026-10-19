import Decimal from "decimal.js";
import { createId } from "./ids";
import { branchId, configuredBranches } from "./settings";
import { en as notesEn, fa as notesFa } from "./c-notes-i18n";
import type { DemoState, Role, Branch, CompanyConfig } from "./types";
import type { AuthenticatedActor, ResourceScope } from "./authority-types";
import { actorAtLocation, freshActor } from "./authority";
import { configuredRoleLabel } from "./role-config";
import { demoSeed } from "./config";
import { can, requireCapability, requireConcreteLocation } from "./permissions";
import {
  appendSeenReceipt,
  doneRuleDecision,
  isNoteAuthor,
  normalizeDoneRule,
  recordNoteCompletion,
  type NoteDoneRule,
  type NoteEngagement,
} from "./note-engagement";
import {
  notifyNotebookEntry,
  markLinkedNoteNotificationsRead,
} from "./note-notifications";

/** The approved author-edit window is independent of transient Undo duration. */
export const NOTEBOOK_EDIT_WINDOW = 10_000;

export interface NotebookFields {
  product: boolean;
  quantity: boolean;
  date: boolean;
  measurement: boolean;
  measurement_unit: string;
}
export interface NotebookDefinition {
  id: string;
  company_id: string;
  branch: Branch;
  name_en: string;
  name_fa: string;
  read_roles: Role[];
  add_roles: Role[];
  fields: NotebookFields;
  status_enabled: boolean;
  notify_supervisor: boolean;
  notify_roles?: Role[];
  /** Who may mark notes done; missing means anyone who can add notes. */
  done_rule?: NoteDoneRule;
  archived: boolean;
  created_at: string;
  updated_at: string;
  by: string;
  by_user_id?: string;
}
export interface NotebookEntry extends NoteEngagement {
  id: string;
  company_id: string;
  branch: Branch;
  notebook_id: string;
  text: string;
  by: string;
  by_user_id?: string;
  created_at: string;
  updated_at: string;
  product_code?: string;
  qty?: number;
  date?: string;
  measurement?: string;
  measurement_unit?: string;
  status: "open" | "done";
  notify_supervisor: boolean;
  archived?: boolean;
}
export type NotebookContext = AuthenticatedActor;
export type NotebookInput = Pick<
  NotebookDefinition,
  | "name_en"
  | "name_fa"
  | "branch"
  | "read_roles"
  | "add_roles"
  | "fields"
  | "status_enabled"
  | "notify_supervisor"
> & { done_rule?: NoteDoneRule };
export type NotebookEntryInput = Pick<
  NotebookEntry,
  "text" | "product_code" | "qty" | "date" | "measurement"
> & { branch?: Branch };

export function newNotebookInput(): NotebookInput {
  return {
    name_en: "",
    name_fa: "",
    branch: "all",
    read_roles: ["owner", "manager", "floor_worker"],
    add_roles: ["owner", "manager", "floor_worker"],
    fields: {
      product: false,
      quantity: false,
      date: false,
      measurement: false,
      measurement_unit: "",
    },
    status_enabled: true,
    notify_supervisor: false,
  };
}
export class NotebookError extends Error {
  constructor(public key: string) {
    super(key);
    this.name = "NotebookError";
  }
}
function fail(key: string): never {
  throw new NotebookError(key);
}
const roles: Role[] = [
  "owner",
  "manager",
  "branch_supervisor",
  "floor_worker",
  "cashier",
];
const companyRoles: Role[] = ["owner", "manager"];
function notebookScope(
  record: Pick<NotebookDefinition, "company_id" | "branch" | "id">,
  mutation = false,
): ResourceScope {
  return {
    company_id: record.company_id,
    kind: record.branch === "all" ? "company_shared" : "location_record",
    location_ids: record.branch === "all" ? [] : [record.branch],
    entity_id: record.id,
    mutation,
    ...(mutation ? {} : { location_policy: "retained_read" as const }),
  };
}
function inBranch(state: DemoState, branch: Branch, context: NotebookContext) {
  try {
    const actor = freshActor(state, context);
    return (
      branch === "all" ||
      (actor.allowed_branches.includes(branch) &&
        (actor.branch === "all" || branch === actor.branch))
    );
  } catch {
    return false;
  }
}
function company(state: DemoState, context: NotebookContext) {
  if (
    state.config.company.seed_key !== context.company_id ||
    !can(state, context, "notebooks.read").allowed
  )
    fail("scope");
}
function hasNotebookACL(
  state: DemoState,
  record: NotebookDefinition,
  context: NotebookContext,
  adding = false,
) {
  const actor = freshActor(state, context);
  return (
    can(state, actor, "notebooks.definition_manage", notebookScope(record))
      .allowed ||
    (record.read_roles.includes(actor.role) &&
      (!adding || record.add_roles.includes(actor.role)))
  );
}
function definition(
  state: DemoState,
  context: NotebookContext,
  notebookId: string,
) {
  company(state, context);
  const record = state.notebooks?.find(
    (item) =>
      item.id === notebookId &&
      item.company_id === context.company_id &&
      inBranch(state, item.branch, context),
  );
  if (!record) fail("scope");
  return record;
}
export function visibleNotebooks(
  state: DemoState,
  context: NotebookContext | null,
  options: { includeArchived?: boolean } = {},
) {
  if (
    !context ||
    context.company_id !== state.config.company.seed_key ||
    !can(state, context, "notebooks.read").allowed
  )
    return [];
  return (state.notebooks ?? []).filter(
    (item) =>
      item.company_id === context.company_id &&
      inBranch(state, item.branch, context) &&
      can(state, context, "notebooks.read", notebookScope(item)).allowed &&
      hasNotebookACL(state, item, context) &&
      (options.includeArchived || !item.archived),
  );
}
export function canAccessNotebooks(
  state: DemoState,
  context: NotebookContext | null,
) {
  return (
    can(state, context, "notes.read").allowed ||
    visibleNotebooks(state, context, { includeArchived: true }).length > 0
  );
}
export function canAddNotebookEntry(
  state: DemoState,
  record: NotebookDefinition,
  context: NotebookContext | null,
  location = context?.branch ?? "",
) {
  try {
    if (!context) return false;
    const actor = freshActor(state, context);
    const concrete = requireConcreteLocation(state, actor, location);
    if (actor.branch !== "all" && actor.branch !== concrete) return false;
    const scopedActor = actorAtLocation(state, actor, concrete);
    return (
      !record.archived &&
      record.company_id === state.config.company.seed_key &&
      (record.branch === "all" || record.branch === concrete) &&
      can(state, scopedActor, "notebooks.entry_add", {
        company_id: record.company_id,
        kind: "location_record",
        location_ids: [concrete],
        entity_id: record.id,
        mutation: true,
      }).allowed &&
      hasNotebookACL(state, record, scopedActor, true)
    );
  } catch {
    return false;
  }
}

/** Concrete, active entry locations; All branches is a view, never an entry. */
export function notebookEntryLocations(
  state: DemoState,
  record: NotebookDefinition,
  context: NotebookContext | null,
): Branch[] {
  if (!context || state.config.company.seed_key !== context.company_id)
    return [];
  return configuredBranches(state.config).filter((location) =>
    canAddNotebookEntry(state, record, context, location),
  );
}
export function readableNotebookEntries(
  state: DemoState,
  context: NotebookContext | null,
  options: { includeArchived?: boolean } = {},
) {
  if (!context) return [];
  const readable = new Set(
    visibleNotebooks(state, context, { includeArchived: true }).map(
      (item) => item.id,
    ),
  );
  return (state.notebook_entries ?? []).filter(
    (item) =>
      item.company_id === context.company_id &&
      readable.has(item.notebook_id) &&
      inBranch(state, item.branch, context) &&
      (options.includeArchived || !item.archived),
  );
}
function recordAction(
  state: DemoState,
  context: NotebookContext,
  action: string,
  record: NotebookDefinition | NotebookEntry,
  before: unknown,
  after: unknown,
  entity_type: "notebook" | "notebook_entry",
  now = new Date(),
) {
  state.activity.unshift({
    id: createId("activity"),
    company_id: context.company_id,
    branch: record.branch,
    action,
    by: context.actor,
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role: context.role,
    at: now.toISOString(),
    reversible: true,
    before: structuredClone(before),
    after: structuredClone(after),
    entity_type,
    entity_id: record.id,
  });
}
function validateDefinition(
  state: DemoState,
  context: NotebookContext,
  input: NotebookInput,
  excludeId?: string,
): NotebookInput {
  company(state, context);
  requireCapability(state, context, "notebooks.definition_manage", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
    mutation: true,
  });
  if (
    context.allowed_branches &&
    input.branch !== "all" &&
    !context.allowed_branches.includes(input.branch)
  )
    fail("scope");
  if (
    input.branch !== "all" &&
    !configuredBranches(state.config).includes(input.branch)
  )
    fail("branch");
  const name_en = input.name_en.trim(),
    name_fa = input.name_fa.trim();
  if (!name_en) fail("name");
  if (
    (state.notebooks ?? []).some(
      (item) =>
        item.id !== excludeId &&
        item.company_id === context.company_id &&
        (item.name_en.toLocaleLowerCase() === name_en.toLocaleLowerCase() ||
          (Boolean(name_fa) && item.name_fa === name_fa)),
    )
  )
    fail("duplicate");
  if (
    [...input.read_roles, ...input.add_roles].some(
      (role) => !roles.includes(role),
    )
  )
    fail("roles");
  if (
    input.add_roles.some(
      (role) =>
        !companyRoles.includes(role) && !input.read_roles.includes(role),
    )
  )
    fail("roles");
  const measurement_unit = input.fields.measurement_unit.trim();
  if (input.fields.measurement && !measurement_unit) fail("unit");
  const done_rule = normalizeDoneRule(input.done_rule);
  if (
    done_rule &&
    (done_rule.roles.some((role) => !roles.includes(role)) ||
      (!done_rule.roles.length && !done_rule.user_ids.length))
  )
    fail("done_rule");
  return {
    ...structuredClone(input),
    done_rule,
    name_en,
    name_fa,
    read_roles: [...new Set([...companyRoles, ...input.read_roles])],
    add_roles: [...new Set([...companyRoles, ...input.add_roles])],
    fields: { ...input.fields, measurement_unit },
  };
}
export function createNotebook(
  state: DemoState,
  context: NotebookContext,
  input: NotebookInput,
): NotebookDefinition {
  context = freshActor(state, context);
  const validated = validateDefinition(state, context, input);
  const at = new Date().toISOString();
  const record = {
    ...validated,
    id: createId("notebook"),
    company_id: context.company_id,
    archived: false,
    created_at: at,
    updated_at: at,
    by: context.actor,
    by_user_id: context.user_id,
  };
  (state.notebooks ??= []).push(record);
  recordAction(
    state,
    context,
    "notebook_created",
    record,
    null,
    record,
    "notebook",
  );
  return record;
}
export function editNotebook(
  state: DemoState,
  context: NotebookContext,
  notebookId: string,
  input: NotebookInput,
) {
  context = freshActor(state, context);
  const record = definition(state, context, notebookId);
  const validated = validateDefinition(state, context, input, notebookId);
  const before = structuredClone(record);
  Object.assign(record, validated, {
    updated_at: new Date().toISOString(),
    by: context.actor,
    by_user_id: context.user_id,
  });
  recordAction(
    state,
    context,
    "notebook_updated",
    record,
    before,
    record,
    "notebook",
  );
}
export function archiveNotebook(
  state: DemoState,
  context: NotebookContext,
  notebookId: string,
  archived = true,
) {
  context = freshActor(state, context);
  const record = definition(state, context, notebookId);
  requireCapability(state, context, "notebooks.definition_manage", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
    mutation: true,
  });
  if (record.archived === archived) return;
  const before = structuredClone(record);
  record.archived = archived;
  record.updated_at = new Date().toISOString();
  record.by = context.actor;
  record.by_user_id = context.user_id;
  recordAction(
    state,
    context,
    archived ? "notebook_archived" : "notebook_restored",
    record,
    before,
    record,
    "notebook",
  );
}
function entryValues(
  state: DemoState,
  context: NotebookContext,
  notebook: NotebookDefinition,
  input: NotebookEntryInput,
  editingExisting = false,
) {
  if (!editingExisting && !canAddNotebookEntry(state, notebook, context))
    fail(
      notebook.archived
        ? "archived"
        : context.branch === "all"
          ? "branch"
          : "add_permission",
    );
  const text = input.text.trim();
  if (!text) fail("text");
  const result: NotebookEntryInput = { text };
  if (notebook.fields.product && input.product_code) {
    if (
      !state.products.some(
        (item) =>
          item.company_id === context.company_id &&
          item.code === input.product_code,
      )
    )
      fail("product");
    result.product_code = input.product_code;
  }
  if (notebook.fields.quantity && input.qty !== undefined) {
    if (!Number.isFinite(input.qty) || input.qty <= 0) fail("quantity");
    result.qty = input.qty;
  }
  if (notebook.fields.date && input.date) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
      Number.isNaN(Date.parse(`${input.date}T12:00:00Z`)) ||
      new Date(`${input.date}T12:00:00Z`).toISOString().slice(0, 10) !==
        input.date
    )
      fail("date");
    result.date = input.date;
  }
  if (notebook.fields.measurement && input.measurement?.trim()) {
    try {
      const value = new Decimal(input.measurement);
      if (!value.isFinite()) fail("measurement");
      result.measurement = value.toString();
    } catch {
      fail("measurement");
    }
  }
  return result;
}
export function addNotebookEntry(
  state: DemoState,
  context: NotebookContext,
  notebookId: string,
  input: NotebookEntryInput,
) {
  context = freshActor(state, context);
  const notebook = definition(state, context, notebookId);
  if (notebook.archived) fail("archived");
  const location = input.branch ?? context.branch;
  if (!location || location === "all") fail("branch");
  if (
    (context.branch !== "all" && context.branch !== location) ||
    (context.allowed_branches &&
      !context.allowed_branches.includes(location)) ||
    (notebook.branch !== "all" && notebook.branch !== location)
  )
    fail("scope");
  requireCapability(state, context, "notebooks.entry_add", {
    company_id: notebook.company_id,
    kind: "location_record",
    location_ids: [requireConcreteLocation(state, context, location)],
    entity_id: notebook.id,
    mutation: true,
  });
  const scopedContext = actorAtLocation(state, context, location);
  const values = entryValues(state, scopedContext, notebook, input);
  const at = new Date().toISOString();
  const record: NotebookEntry = {
    ...values,
    id: createId("notebook-entry"),
    company_id: context.company_id,
    branch: location,
    notebook_id: notebook.id,
    by: context.actor,
    by_user_id: context.user_id,
    created_at: at,
    updated_at: at,
    status: "open",
    seen_receipts: [],
    notify_supervisor: notebook.notify_supervisor,
    ...(values.measurement !== undefined
      ? { measurement_unit: notebook.fields.measurement_unit }
      : {}),
  };
  (state.notebook_entries ??= []).unshift(record);
  notifyNotebookEntry(state, record, notebook);
  recordAction(
    state,
    context,
    "notebook_entry_added",
    record,
    null,
    record,
    "notebook_entry",
  );
  return record;
}

function editableEntry(
  state: DemoState,
  context: NotebookContext,
  entryId: string,
  now: Date,
) {
  company(state, context);
  const record = readableNotebookEntries(state, context).find(
    (entry) => entry.id === entryId,
  );
  if (!record) fail("scope");
  const notebook = definition(state, context, record.notebook_id);
  const activeLocation = configuredBranches(state.config).includes(
    record.branch,
  );
  const scopedContext = activeLocation
    ? actorAtLocation(state, context, record.branch)
    : freshActor(state, context);
  if (!configuredBranches(state.config, true).includes(record.branch))
    fail("scope");
  if (notebook.archived) fail("archived");
  if (!hasNotebookACL(state, notebook, scopedContext, true))
    fail("add_permission");
  const resource: ResourceScope = {
    company_id: record.company_id,
    kind: "location_record",
    location_ids: [record.branch],
    entity_id: record.id,
    owner_user_id: record.by_user_id,
    mutation: true,
    location_policy: activeLocation ? "active_only" : "retained_correction",
  };
  if (
    !can(state, scopedContext, "notebooks.entry_edit_any", resource).allowed
  ) {
    if (!activeLocation || !canAddNotebookEntry(state, notebook, scopedContext))
      fail("add_permission");
    if (
      !record.by_user_id ||
      record.by_user_id !== scopedContext.user_id ||
      !can(state, scopedContext, "notebooks.entry_edit_own", resource).allowed
    )
      fail("edit_permission");
    const elapsed = now.getTime() - Date.parse(record.created_at);
    if (
      !Number.isFinite(elapsed) ||
      elapsed < 0 ||
      elapsed >= NOTEBOOK_EDIT_WINDOW
    )
      fail("expired");
  }
  return { record, notebook, scopedContext };
}

/** Author edits expire with the original ten-second window; edits never reset it. */
export function canEditNotebookEntry(
  state: DemoState,
  context: NotebookContext | null,
  entryId: string,
  now = new Date(),
): boolean {
  if (!context) return false;
  try {
    editableEntry(state, context, entryId, now);
    return true;
  } catch {
    return false;
  }
}

/** History keeps its own action deadline and immutable-version checks.
 * This guard checks the current canonical notebook/entry authority without
 * resetting or reusing the separate editor deadline on entry.created_at.
 */
export function canApplyNotebookEntryHistory(
  state: DemoState,
  context: NotebookContext | null,
  entryId: string,
): boolean {
  try {
    if (!context) return false;
    const actor = freshActor(state, context);
    const entry = readableNotebookEntries(state, actor, {
      includeArchived: true,
    }).find((record) => record.id === entryId);
    if (!entry) return false;
    const notebook = definition(state, actor, entry.notebook_id);
    if (notebook.archived || !hasNotebookACL(state, notebook, actor, true))
      return false;
    const active = configuredBranches(state.config).includes(entry.branch);
    const scope: ResourceScope = {
      company_id: entry.company_id,
      kind: "location_record",
      location_ids: [entry.branch],
      entity_id: entry.id,
      owner_user_id: entry.by_user_id,
      mutation: true,
      location_policy: active ? "active_only" : "retained_correction",
    };
    if (can(state, actor, "notebooks.entry_edit_any", scope).allowed)
      return true;
    return Boolean(
      active &&
      entry.by_user_id &&
      entry.by_user_id === actor.user_id &&
      can(state, actor, "notebooks.entry_edit_own", scope).allowed &&
      canAddNotebookEntry(state, notebook, actor, entry.branch),
    );
  } catch {
    return false;
  }
}

/** Resolve the committed canonical action; callers cannot choose a status mode. */
export function canApplyNotebookHistoryActivity(
  state: DemoState,
  context: NotebookContext | null,
  activityId: string,
): boolean {
  try {
    if (!context) return false;
    const actor = freshActor(state, context);
    const activity = state.activity.find(
      (record) =>
        record.id === activityId &&
        record.company_id === actor.company_id &&
        record.entity_type === "notebook_entry",
    );
    if (!activity?.entity_id) return false;
    if (activity.action === "notebook_entry_seen") {
      const entry = readableNotebookEntries(state, actor).find(
        (record) => record.id === activity.entity_id,
      );
      if (!entry || entry.archived) return false;
      const notebook = definition(state, actor, entry.notebook_id);
      return (
        !notebook.archived &&
        notebook.status_enabled &&
        (can(state, actor, "notebooks.entry_edit_any", notebookScope(notebook))
          .allowed ||
          activity.actor_user_id === actor.user_id) &&
        can(state, actor, "notebooks.mark_seen", {
          company_id: entry.company_id,
          kind: "location_record",
          location_ids: [entry.branch],
          entity_id: entry.id,
          mutation: true,
        }).allowed
      );
    }
    if (
      ["notebook_entry_added", "notebook_entry_updated"].includes(
        activity.action,
      )
    ) {
      if (!canApplyNotebookEntryHistory(state, actor, activity.entity_id))
        return false;
      const entry = state.notebook_entries?.find(
        (record) =>
          record.id === activity.entity_id &&
          record.company_id === actor.company_id,
      );
      if (!entry) return false;
      return (
        can(state, actor, "notebooks.entry_edit_any", {
          company_id: entry.company_id,
          kind: "location_record",
          location_ids: [entry.branch],
          entity_id: entry.id,
          mutation: true,
          location_policy: configuredBranches(state.config).includes(
            entry.branch,
          )
            ? "active_only"
            : "retained_correction",
        }).allowed || activity.actor_user_id === actor.user_id
      );
    }
    if (
      !["notebook_entry_done", "notebook_entry_reopened"].includes(
        activity.action,
      )
    )
      return false;
    const entry = readableNotebookEntries(state, actor, {
      includeArchived: true,
    }).find((record) => record.id === activity.entity_id);
    if (!entry) return false;
    const notebook = definition(state, actor, entry.notebook_id);
    if (entry.archived || notebook.archived || !notebook.status_enabled)
      return false;
    if (!canAddNotebookEntry(state, notebook, actor, entry.branch))
      return false;
    const scope: ResourceScope = {
      company_id: entry.company_id,
      kind: "location_record",
      location_ids: [entry.branch],
      entity_id: entry.id,
      mutation: true,
    };
    // 'Own' status Undo means the actor's audited status action. The original
    // entry author can be another contributor, including in a Cashier notebook.
    return (
      can(state, actor, "notebooks.entry_edit_any", scope).allowed ||
      Boolean(
        activity.actor_user_id === actor.user_id &&
        can(state, actor, "notebooks.entry_add", scope).allowed,
      )
    );
  } catch {
    return false;
  }
}

export function editNotebookEntry(
  state: DemoState,
  context: NotebookContext,
  entryId: string,
  input: NotebookEntryInput,
  expectedSnapshot?: string,
  now = new Date(),
): NotebookEntry {
  context = freshActor(state, context);
  const { record, notebook, scopedContext } = editableEntry(
    state,
    context,
    entryId,
    now,
  );
  if (input.branch !== undefined && input.branch !== record.branch)
    fail("scope");
  if (
    expectedSnapshot !== undefined &&
    expectedSnapshot !== JSON.stringify(record)
  )
    fail("stale");
  const values = entryValues(state, scopedContext, notebook, input, true);
  const before = structuredClone(record);
  const editableFields = [
    ["product_code", notebook.fields.product],
    ["qty", notebook.fields.quantity],
    ["date", notebook.fields.date],
    ["measurement", notebook.fields.measurement],
  ] as const;
  for (const [field, enabled] of editableFields)
    if (enabled) delete record[field];
  Object.assign(record, values, { updated_at: now.toISOString() });
  if (notebook.fields.measurement) {
    if (values.measurement === undefined) delete record.measurement_unit;
    else
      record.measurement_unit =
        before.measurement_unit || notebook.fields.measurement_unit;
  }
  recordAction(
    state,
    context,
    "notebook_entry_updated",
    record,
    before,
    record,
    "notebook_entry",
    now,
  );
  return record;
}
export function markNotebookEntrySeen(
  state: DemoState,
  context: NotebookContext,
  entryId: string,
  at = new Date(),
) {
  context = freshActor(state, context);
  company(state, context);
  const record = readableNotebookEntries(state, context).find(
    (item) => item.id === entryId,
  );
  if (!record || record.archived) fail("scope");
  const notebook = definition(state, context, record.notebook_id);
  if (notebook.archived || !notebook.status_enabled) fail("status");
  requireCapability(state, context, "notebooks.mark_seen", {
    company_id: record.company_id,
    kind: "location_record",
    location_ids: [record.branch],
    entity_id: record.id,
    mutation: true,
  });
  // Seen tells the author that someone else read it; authors cannot mark their own.
  if (isNoteAuthor(record, context)) fail("own_note");
  const receipt = appendSeenReceipt(record, context, at);
  markLinkedNoteNotificationsRead(state, context, record, at);
  if (!receipt) return;
  recordAction(
    state,
    context,
    "notebook_entry_seen",
    record,
    { receipt: null },
    { receipt },
    "notebook_entry",
    at,
  );
}

export function updateNotebookEntryStatus(
  state: DemoState,
  context: NotebookContext,
  entryId: string,
  status: NotebookEntry["status"],
) {
  context = freshActor(state, context);
  company(state, context);
  const record = readableNotebookEntries(state, context).find(
    (item) => item.id === entryId,
  );
  if (!record) fail("scope");
  const notebook = definition(state, context, record.notebook_id);
  const decision = doneRuleDecision(notebook.done_rule, context);
  if (decision === "denied") fail("done_permission");
  if (decision === "allowed")
    // Chosen people may mark done wherever they can read the note.
    requireCapability(state, context, "notebooks.read", {
      company_id: record.company_id,
      kind: "location_record",
      location_ids: [record.branch],
      entity_id: record.id,
      mutation: true,
    });
  else {
    if (!canAddNotebookEntry(state, notebook, context, record.branch))
      fail("add_permission");
    requireCapability(state, context, "notebooks.entry_add", {
      company_id: record.company_id,
      kind: "location_record",
      location_ids: [record.branch],
      entity_id: record.id,
      mutation: true,
    });
  }
  if (!notebook.status_enabled || !["open", "done"].includes(status))
    fail("status");
  if (record.status === status) return;
  const before = structuredClone(record);
  record.status = status;
  recordNoteCompletion(record, context, status === "done");
  record.updated_at = new Date().toISOString();
  recordAction(
    state,
    context,
    status === "done" ? "notebook_entry_done" : "notebook_entry_reopened",
    record,
    before,
    record,
    "notebook_entry",
  );
}
/** Add fictional notebook fixtures once; preserving an intentionally empty saved list. */
export function hydrateNotebooks(state: DemoState): DemoState {
  if (state.notebooks !== undefined) {
    state.notebook_entries ??= [];
    return state;
  }
  const at = new Date().toISOString(),
    company_id = state.config.company.seed_key;
  const branch = branchId(state.config.branches[0]);
  state.notebooks = [
    {
      id: "demo-deli-temperatures",
      company_id,
      branch: "all",
      name_en: "Deli temperatures",
      name_fa: "دمای اغذیه",
      read_roles: ["owner", "manager", "branch_supervisor", "floor_worker"],
      add_roles: ["owner", "manager", "branch_supervisor", "floor_worker"],
      fields: {
        product: false,
        quantity: false,
        date: true,
        measurement: true,
        measurement_unit: "°C",
      },
      status_enabled: true,
      notify_supervisor: true,
      archived: false,
      created_at: at,
      updated_at: at,
      by: demoSeed.demo_users.find(
        (person) => person.id === "demo-person-owner",
      )!.name_en,
      by_user_id: "demo-person-owner",
    },
  ];
  state.notebook_entries = [
    {
      id: "demo-deli-temperature-1",
      company_id,
      branch,
      notebook_id: "demo-deli-temperatures",
      text: "Morning fridge check",
      by: demoSeed.demo_users.find(
        (person) => person.id === "demo-person-ny-floor",
      )!.name_en,
      by_user_id: "demo-person-ny-floor",
      created_at: at,
      updated_at: at,
      date: state.demo_fixture_anchor_date ?? at.slice(0, 10),
      measurement: "3.2",
      measurement_unit: "°C",
      status: "open",
      notify_supervisor: true,
    },
  ];
  return state;
}
export function notebookError(
  error: unknown,
  t: (en: string, fa: string) => string,
  config?: Pick<CompanyConfig, "roles">,
) {
  const key = error instanceof NotebookError ? error.key : "scope";
  const ownerEn = config
    ? configuredRoleLabel(config.roles, "owner", "en")
    : "Owner";
  const ownerFa = config
    ? configuredRoleLabel(config.roles, "owner", "fa")
    : "مالک";
  const managerEn = config
    ? configuredRoleLabel(config.roles, "manager", "en")
    : "Manager";
  const managerFa = config
    ? configuredRoleLabel(config.roles, "manager", "fa")
    : "مدیر";
  const messages: Record<string, [string, string]> = {
    scope: [notesEn.scope, notesFa.scope],
    supervisor: [
      `Only an ${ownerEn} or ${managerEn} can change notebook settings.`,
      `فقط ${ownerFa} یا ${managerFa} می‌تواند تنظیمات دفترچه را تغییر دهد.`,
    ],
    branch: [notesEn.chooseLocation, notesFa.chooseLocation],
    location_unavailable: [
      notesEn.unavailableLocation,
      notesFa.unavailableLocation,
    ],
    name: [
      "Enter the notebook name in English.",
      "نام دفترچه را به انگلیسی وارد کنید.",
    ],
    duplicate: [
      "A notebook with this name already exists. Choose a different name.",
      "دفترچه‌ای با این نام وجود دارد. نام دیگری انتخاب کنید.",
    ],
    roles: [
      "Allow a role to read before allowing it to add notes.",
      "پیش از اجازه افزودن یادداشت، اجازه خواندن را برای نقش فعال کنید.",
    ],
    unit: [
      "Enter a unit for the measurement field.",
      "واحد اندازه‌گیری را وارد کنید.",
    ],
    archived: [
      "Restore this notebook before adding notes.",
      "پیش از افزودن یادداشت، دفترچه را بازیابی کنید.",
    ],
    add_permission: [
      "You can read this notebook but cannot add or change its notes.",
      "می‌توانید این دفترچه را بخوانید، اما اجازه افزودن یا تغییر یادداشت‌ها را ندارید.",
    ],
    text: [
      "Enter a note before saving.",
      "پیش از ذخیره، یادداشت را وارد کنید.",
    ],
    product: [
      "Choose a product from this company's catalog.",
      "یک کالا از فهرست این شرکت انتخاب کنید.",
    ],
    quantity: [
      "Enter a quantity greater than zero.",
      "تعداد بزرگ‌تر از صفر وارد کنید.",
    ],
    date: ["Choose a valid date.", "تاریخ معتبر انتخاب کنید."],
    measurement: [
      "Enter a valid measurement number.",
      "عدد اندازه‌گیری معتبر وارد کنید.",
    ],
    status: [
      "This notebook does not use note statuses.",
      "این دفترچه از وضعیت یادداشت استفاده نمی‌کند.",
    ],
    edit_permission: [
      `Only the author, ${ownerEn} or ${managerEn} can edit this note.`,
      `فقط نویسنده، ${ownerFa} یا ${managerFa} می‌تواند این یادداشت را ویرایش کند.`,
    ],
    expired: [
      `The ten-second edit window has ended. Ask an ${ownerEn} or ${managerEn} to edit this note.`,
      `مهلت ده‌ثانیه‌ای ویرایش پایان یافته است. از ${ownerFa} یا ${managerFa} بخواهید این یادداشت را ویرایش کند.`,
    ],
    stale: [
      "This note changed. Open it again before editing.",
      "این یادداشت تغییر کرده است. پیش از ویرایش، آن را دوباره باز کنید.",
    ],
    own_note: [
      "You wrote this note. Seen is for the people who read it.",
      "این یادداشت را خودتان نوشته‌اید. «دیده‌شده» برای خوانندگان آن است.",
    ],
    done_permission: [
      "Only the people chosen in this notebook's settings can mark its notes done.",
      "فقط افرادی که در تنظیمات این دفترچه انتخاب شده‌اند می‌توانند یادداشت‌ها را انجام‌شده علامت بزنند.",
    ],
    done_rule: [
      "Choose at least one role or person who can mark notes done.",
      "دست‌کم یک نقش یا فرد را برای علامت‌گذاری انجام‌شده انتخاب کنید.",
    ],
  };
  return t(...(messages[key] ?? messages.scope));
}

/**
 * Owners and Managers choose who may mark a built-in notebook's notes done
 * (for example only Supervisors, or named people). Stored in company config.
 */
export function saveBuiltInNoteDoneRule(
  state: DemoState,
  context: NotebookContext,
  kind: string,
  rule: NoteDoneRule | undefined,
) {
  context = freshActor(state, context);
  company(state, context);
  requireCapability(state, context, "notebooks.definition_manage", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
    mutation: true,
  });
  const entry = state.config.notebooks?.built_in?.find(
    (item) => item.kind === kind,
  );
  if (!entry) fail("scope");
  const done_rule = normalizeDoneRule(rule);
  if (
    done_rule &&
    (done_rule.roles.some((role) => !roles.includes(role)) ||
      (!done_rule.roles.length && !done_rule.user_ids.length))
  )
    fail("done_rule");
  const before = structuredClone(entry);
  if (done_rule) entry.done_rule = done_rule;
  else delete entry.done_rule;
  state.activity.unshift({
    id: createId("activity"),
    company_id: context.company_id,
    branch: "all",
    action: "notebook_updated",
    by: context.actor,
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role: context.role,
    at: new Date().toISOString(),
    reversible: false,
    before,
    after: structuredClone(entry),
    entity_type: "notebook",
    entity_id: kind,
  });
}
