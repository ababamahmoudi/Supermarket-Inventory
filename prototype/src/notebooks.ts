import Decimal from "decimal.js";
import { createId } from "./ids";
import { branchId, configuredBranches } from "./settings";
import { UNDO_DURATION } from "./undo-queue";
import { en as notesEn, fa as notesFa } from "./c-notes-i18n";
import type { DemoState, Role, Branch } from "./types";
import type { OperationsContext } from "./operations";

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
  archived: boolean;
  created_at: string;
  updated_at: string;
  by: string;
}
export interface NotebookEntry {
  id: string;
  company_id: string;
  branch: Branch;
  notebook_id: string;
  text: string;
  by: string;
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
export type NotebookContext = OperationsContext & {
  allowed_branches?: Branch[];
};
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
>;
export type NotebookEntryInput = Pick<
  NotebookEntry,
  "text" | "product_code" | "qty" | "date" | "measurement"
> & { branch?: Branch };

export function newNotebookInput(): NotebookInput {
  return {
    name_en: "",
    name_fa: "",
    branch: "all",
    read_roles: ["supervisor", "floor_worker"],
    add_roles: ["supervisor", "floor_worker"],
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
const roles: Role[] = ["supervisor", "floor_worker", "cashier"];
const inBranch = (branch: Branch, context: NotebookContext) =>
  (branch === "all" || context.branch === "all" || branch === context.branch) &&
  (!context.allowed_branches ||
    branch === "all" ||
    context.allowed_branches.includes(branch));
function company(state: DemoState, context: NotebookContext) {
  if (state.config.company.seed_key !== context.company_id) fail("scope");
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
      inBranch(item.branch, context),
  );
  if (!record) fail("scope");
  return record;
}
export function visibleNotebooks(
  state: DemoState,
  context: NotebookContext,
  options: { includeArchived?: boolean } = {},
) {
  if (context.company_id !== state.config.company.seed_key) return [];
  return (state.notebooks ?? []).filter(
    (item) =>
      item.company_id === context.company_id &&
      inBranch(item.branch, context) &&
      (context.role === "supervisor" ||
        item.read_roles.includes(context.role)) &&
      (options.includeArchived || !item.archived),
  );
}
export function canAccessNotebooks(state: DemoState, context: NotebookContext) {
  return (
    context.role !== "cashier" ||
    visibleNotebooks(state, context, { includeArchived: true }).length > 0
  );
}
export function canAddNotebookEntry(
  record: NotebookDefinition,
  context: NotebookContext,
  location = context.branch,
) {
  const scopedContext = { ...context, branch: location };
  return (
    !record.archived &&
    record.company_id === context.company_id &&
    location !== "all" &&
    (context.branch === location ||
      (context.branch === "all" && context.role === "supervisor")) &&
    (!context.allowed_branches ||
      context.allowed_branches.includes(location)) &&
    inBranch(record.branch, scopedContext) &&
    (context.role === "supervisor" ||
      (record.read_roles.includes(context.role) &&
        record.add_roles.includes(context.role)))
  );
}

/** Concrete, active entry locations; All branches is a view, never an entry. */
export function notebookEntryLocations(
  state: DemoState,
  record: NotebookDefinition,
  context: NotebookContext,
): Branch[] {
  if (state.config.company.seed_key !== context.company_id) return [];
  return configuredBranches(state.config).filter((location) =>
    canAddNotebookEntry(record, context, location),
  );
}
export function readableNotebookEntries(
  state: DemoState,
  context: NotebookContext,
  options: { includeArchived?: boolean } = {},
) {
  const readable = new Set(
    visibleNotebooks(state, context, { includeArchived: true }).map(
      (item) => item.id,
    ),
  );
  return (state.notebook_entries ?? []).filter(
    (item) =>
      item.company_id === context.company_id &&
      readable.has(item.notebook_id) &&
      inBranch(item.branch, context) &&
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
  if (context.role !== "supervisor") fail("supervisor");
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
  if (!name_en || !name_fa) fail("name");
  if (
    (state.notebooks ?? []).some(
      (item) =>
        item.id !== excludeId &&
        item.company_id === context.company_id &&
        (item.name_en.toLocaleLowerCase() === name_en.toLocaleLowerCase() ||
          item.name_fa === name_fa),
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
      (role) => role !== "supervisor" && !input.read_roles.includes(role),
    )
  )
    fail("roles");
  const measurement_unit = input.fields.measurement_unit.trim();
  if (input.fields.measurement && !measurement_unit) fail("unit");
  return {
    ...structuredClone(input),
    name_en,
    name_fa,
    read_roles: [...new Set(["supervisor" as Role, ...input.read_roles])],
    add_roles: [...new Set(["supervisor" as Role, ...input.add_roles])],
    fields: { ...input.fields, measurement_unit },
  };
}
export function createNotebook(
  state: DemoState,
  context: NotebookContext,
  input: NotebookInput,
): NotebookDefinition {
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
  const record = definition(state, context, notebookId);
  const validated = validateDefinition(state, context, input, notebookId);
  const before = structuredClone(record);
  Object.assign(record, validated, {
    updated_at: new Date().toISOString(),
    by: context.actor,
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
  const record = definition(state, context, notebookId);
  if (context.role !== "supervisor") fail("supervisor");
  if (record.archived === archived) return;
  const before = structuredClone(record);
  record.archived = archived;
  record.updated_at = new Date().toISOString();
  record.by = context.actor;
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
) {
  if (!canAddNotebookEntry(notebook, context))
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
  if (context.branch === "all" && context.role !== "supervisor")
    fail("add_permission");
  if (!configuredBranches(state.config).includes(location))
    fail("location_unavailable");
  const scopedContext = { ...context, branch: location };
  const values = entryValues(state, scopedContext, notebook, input);
  const at = new Date().toISOString();
  const record: NotebookEntry = {
    ...values,
    id: createId("notebook-entry"),
    company_id: context.company_id,
    branch: location,
    notebook_id: notebook.id,
    by: context.actor,
    created_at: at,
    updated_at: at,
    status: "open",
    notify_supervisor: notebook.notify_supervisor,
    ...(values.measurement !== undefined
      ? { measurement_unit: notebook.fields.measurement_unit }
      : {}),
  };
  (state.notebook_entries ??= []).unshift(record);
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
  const scopedContext =
    context.role === "supervisor" && context.branch === "all"
      ? { ...context, branch: record.branch }
      : context;
  if (
    !configuredBranches(state.config, true).includes(record.branch) ||
    !canAddNotebookEntry(notebook, scopedContext)
  )
    fail(notebook.archived ? "archived" : "add_permission");
  if (context.role !== "supervisor") {
    if (record.by !== context.actor) fail("edit_permission");
    const elapsed = now.getTime() - Date.parse(record.created_at);
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= UNDO_DURATION)
      fail("expired");
  }
  return { record, notebook, scopedContext };
}

/** Author edits expire with the original five-second window; edits never reset it. */
export function canEditNotebookEntry(
  state: DemoState,
  context: NotebookContext,
  entryId: string,
  now = new Date(),
): boolean {
  try {
    editableEntry(state, context, entryId, now);
    return true;
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
  const values = entryValues(state, scopedContext, notebook, input);
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
export function updateNotebookEntryStatus(
  state: DemoState,
  context: NotebookContext,
  entryId: string,
  status: NotebookEntry["status"],
) {
  company(state, context);
  const record = readableNotebookEntries(state, context).find(
    (item) => item.id === entryId,
  );
  if (!record) fail("scope");
  const notebook = definition(state, context, record.notebook_id);
  if (!canAddNotebookEntry(notebook, context)) fail("add_permission");
  if (!notebook.status_enabled || !["open", "done"].includes(status))
    fail("status");
  if (record.status === status) return;
  const before = structuredClone(record);
  record.status = status;
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
      read_roles: ["supervisor", "floor_worker"],
      add_roles: ["supervisor", "floor_worker"],
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
      by: "Demo Supervisor",
    },
  ];
  state.notebook_entries = [
    {
      id: "demo-deli-temperature-1",
      company_id,
      branch,
      notebook_id: "demo-deli-temperatures",
      text: "Morning fridge check",
      by: "Demo Floor Worker",
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
) {
  const key = error instanceof NotebookError ? error.key : "scope";
  const messages: Record<string, [string, string]> = {
    scope: [notesEn.scope, notesFa.scope],
    supervisor: [
      "Only the Supervisor can change notebook settings.",
      "فقط سرپرست می‌تواند تنظیمات دفترچه را تغییر دهد.",
    ],
    branch: [notesEn.chooseLocation, notesFa.chooseLocation],
    location_unavailable: [
      notesEn.unavailableLocation,
      notesFa.unavailableLocation,
    ],
    name: [
      "Enter the notebook name in English and Persian.",
      "نام دفترچه را به انگلیسی و فارسی وارد کنید.",
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
      "Only the author or Supervisor can edit this note.",
      "فقط نویسنده یا سرپرست می‌تواند این یادداشت را ویرایش کند.",
    ],
    expired: [
      "The five-second edit window has ended. Ask the Supervisor to edit this note.",
      "مهلت پنج‌ثانیه‌ای ویرایش پایان یافته است. از سرپرست بخواهید این یادداشت را ویرایش کند.",
    ],
    stale: [
      "This note changed. Open it again before editing.",
      "این یادداشت تغییر کرده است. پیش از ویرایش، آن را دوباره باز کنید.",
    ],
  };
  return t(...(messages[key] ?? messages.scope));
}
