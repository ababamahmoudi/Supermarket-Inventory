import Decimal from "decimal.js";
import type { AuthenticatedActor, ResourceScope } from "./authority-types";
import { authoritySnapshot, freshActor } from "./authority";
import { can, requireCapability, requireConcreteLocation } from "./permissions";
import { actorAudit } from "./domain-authority";
import { companyDateTime } from "./company-time";
import { validTrackedDate } from "./date-tracking";
import { businessAuditRead } from "./business-audit-read";
import { createId } from "./ids";
import { branchId } from "./settings";
import type { Activity, CompanyConfig, DemoState, Language } from "./types";
import { configuredTimesheetDepartments } from "./timesheet-settings";
import {
  TimesheetError,
  type TimesheetStaff,
  type TimesheetDay,
  type TimesheetRow,
  type TimesheetRowRead,
  type TimesheetDuration,
  type TimesheetDepartmentRead,
  type TimesheetDayRead,
  type TimesheetWeekRead,
} from "./timesheet-types";
export * from "./timesheet-types";
export {
  configuredTimesheetDepartments,
  saveTimesheetSettings,
} from "./timesheet-settings";

export interface TimesheetViewState {
  config: Pick<CompanyConfig, "company" | "branches" | "timesheets">;
  timesheet_staff?: TimesheetStaff[];
  timesheet_days?: TimesheetDay[];
  timesheet_rows?: TimesheetRow[];
  activity?: Activity[];
}

export function parseTimesheetTime(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660);
  });
  if (!value) return "";
  let hour: number;
  let minute: number;
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    [hour, minute] = value.split(":").map(Number);
  } else if (/^\d{1,2}$/.test(value)) {
    hour = Number(value);
    minute = 0;
  } else if (/^\d{3,4}$/.test(value)) {
    hour = Number(value.slice(0, -2));
    minute = Number(value.slice(-2));
  } else return null;
  return hour < 24 && minute < 60
    ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    : null;
}
function timeMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
export function timesheetDuration(
  row: Pick<TimesheetRow, "in_time" | "out_time" | "date">,
  today: string,
): TimesheetDuration {
  const start = parseTimesheetTime(row.in_time),
    end = parseTimesheetTime(row.out_time);
  const on_shift = Boolean(start && !end);
  if (!start || !end)
    return {
      minutes: 0,
      overnight: false,
      on_shift,
      warning: on_shift && row.date < today ? "out_missing" : null,
    };
  const delta = timeMinutes(end) - timeMinutes(start);
  const minutes = delta < 0 ? delta + 1440 : delta;
  return {
    minutes,
    overnight: delta < 0,
    on_shift: false,
    warning: minutes > 960 ? "long_shift" : null,
  };
}
export function timesheetMinutesText(minutes: number, lang: Language): string {
  const value = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  return lang === "fa"
    ? `${Math.floor(value / 60)} ساعت و ${String(value % 60).padStart(2, "0")} دقیقه`
    : `${Math.floor(value / 60)} h ${String(value % 60).padStart(2, "0")} m`;
}
/** Compact, direction-stable operational hours; bilingual wording remains on paper. */
export function timesheetCompactHours(minutes: number): string {
  const value = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
export function timesheetClock(
  config: Pick<CompanyConfig, "company" | "branches">,
  branch: string,
  now = new Date(),
): { date: string; time: string } {
  const location = config.branches.find(
    (item, index) => branchId(item, index) === branch,
  );
  return companyDateTime(
    {
      company: {
        ...config.company,
        timezone: location?.timezone || config.company.timezone,
      },
    },
    now,
  );
}
function requireDate(date: string): void {
  if (!validTrackedDate(date)) throw new TimesheetError("date");
}
export function timesheetDateAfter(date: string, deltaDays: number): string {
  requireDate(date);
  if (!Number.isSafeInteger(deltaDays)) throw new TimesheetError("date");
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + deltaDays);
  return instant.toISOString().slice(0, 10);
}
export function timesheetWeekStart(date: string): string {
  requireDate(date);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return timesheetDateAfter(date, -(weekday === 0 ? 6 : weekday - 1));
}
export function timesheetScope(
  companyId: string,
  branch: string,
  mutation = false,
  entityId?: string,
): ResourceScope {
  return {
    company_id: companyId,
    kind: "location_record",
    location_ids: branch && branch !== "all" ? [branch] : [],
    entity_id: entityId,
    mutation,
    location_policy: mutation ? "active_only" : "retained_read",
  };
}
function requireTimesheets(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
  mutation = false,
) {
  actor = freshActor(state, actor);
  if (state.config.company.seed_key !== actor.company_id)
    throw new TimesheetError("company");
  if (state.config.modules.timesheets === false)
    throw new TimesheetError("module");
  if (!branch || branch === "all") throw new TimesheetError("location");
  const capability = mutation ? "timesheets.edit" : "timesheets.read";
  requireCapability(
    state,
    actor,
    capability,
    timesheetScope(actor.company_id, branch, mutation),
  );
  if (mutation) requireConcreteLocation(state, actor, branch);
  return actor;
}
function recordScope(record: { branch: string; branch_id: string }): string {
  if (record.branch !== record.branch_id) throw new TimesheetError("location");
  return record.branch;
}
function departmentFor(state: Pick<DemoState, "config">, key: string) {
  const department = configuredTimesheetDepartments(state.config).find(
    (item) => item.key === key,
  );
  if (!department) throw new TimesheetError("department");
  return department;
}
function personLink(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
  id?: string,
): string | undefined {
  if (!id?.trim()) return undefined;
  const person = authoritySnapshot(state).people.find(
    (item) =>
      item.id === id &&
      item.company_id === actor.company_id &&
      item.status === "active",
  );
  if (
    !person ||
    (person.location_scope.kind === "assigned" &&
      !person.location_scope.location_ids.includes(branch)) ||
    (person.role === "cashier" &&
      state.config.branches.some(
        (item, index) =>
          branchId(item, index) === branch && item.type === "warehouse",
      ))
  )
    throw new TimesheetError("person");
  return person.id;
}
export function listTimesheetPeople(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
): { id: string; name_en: string; name_fa?: string; username: string }[] {
  actor = requireTimesheets(state, actor, branch);
  return authoritySnapshot(state)
    .people.filter(
      (person) =>
        person.company_id === actor.company_id &&
        person.status === "active" &&
        (person.location_scope.kind === "company" ||
          person.location_scope.location_ids.includes(branch)) &&
        !(
          person.role === "cashier" &&
          state.config.branches.some(
            (item, index) =>
              branchId(item, index) === branch && item.type === "warehouse",
          )
        ),
    )
    .map((person) => ({
      id: person.id,
      name_en: person.name_en,
      name_fa: person.name_fa,
      username: person.username,
    }))
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}
function names(input: { name_en: string; name_fa?: string }) {
  if (
    typeof input.name_en !== "string" ||
    !input.name_en.trim() ||
    input.name_en.trim().length > 200 ||
    (input.name_fa !== undefined &&
      (typeof input.name_fa !== "string" || input.name_fa.trim().length > 200))
  )
    throw new TimesheetError("name");
  return {
    name_en: input.name_en.trim(),
    name_fa: input.name_fa?.trim() || undefined,
  };
}
function stamp(actor: AuthenticatedActor, now: Date) {
  return {
    created_at: now.toISOString(),
    created_by_user_id: actor.user_id,
    updated_at: now.toISOString(),
    updated_by_user_id: actor.user_id,
    version: 1,
  };
}
function touch(
  record: { version: number; updated_at: string; updated_by_user_id: string },
  actor: AuthenticatedActor,
  now: Date,
) {
  record.version++;
  record.updated_at = now.toISOString();
  record.updated_by_user_id = actor.user_id;
}
function audit(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
  entityType: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  now: Date,
) {
  state.activity.push({
    id: createId("timesheet-activity"),
    company_id: actor.company_id,
    branch,
    branch_id: branch,
    scope: "branch",
    entity_type: entityType,
    entity_id: entityId,
    action,
    by: actor.actor,
    at: now.toISOString(),
    ...actorAudit(state, actor, now),
    before: structuredClone(before),
    after: structuredClone(after),
    reversible: false,
  });
}
function staffFor(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  mutation: boolean,
) {
  actor = freshActor(state, actor);
  const staff = state.timesheet_staff?.find(
    (item) => item.company_id === actor.company_id && item.id === id,
  );
  if (!staff) throw new TimesheetError("staff");
  actor = requireTimesheets(state, actor, recordScope(staff), mutation);
  return { staff, actor };
}
function uniqueName(
  state: DemoState,
  company: string,
  branch: string,
  name: string,
  except?: string,
) {
  if (
    state.timesheet_staff?.some(
      (item) =>
        item.id !== except &&
        item.company_id === company &&
        item.branch === branch &&
        item.name_en.trim().toLocaleLowerCase() ===
          name.trim().toLocaleLowerCase(),
    )
  )
    throw new TimesheetError("conflict");
}
export function addTimesheetStaff(
  state: DemoState,
  actor: AuthenticatedActor,
  input: {
    branch: string;
    name_en: string;
    name_fa?: string;
    usual_department_key: string;
    app_person_id?: string;
  },
  now = new Date(),
): TimesheetStaff {
  actor = requireTimesheets(state, actor, input.branch, true);
  const name = names(input);
  departmentFor(state, input.usual_department_key);
  uniqueName(state, actor.company_id, input.branch, name.name_en);
  const app_person_id = personLink(
    state,
    actor,
    input.branch,
    input.app_person_id,
  );
  const staff: TimesheetStaff = {
    id: createId("timesheet-staff"),
    company_id: actor.company_id,
    branch: input.branch,
    branch_id: input.branch,
    ...name,
    usual_department_key: input.usual_department_key,
    app_person_id,
    status: "active",
    ...stamp(actor, now),
  };
  (state.timesheet_staff ??= []).push(staff);
  audit(
    state,
    actor,
    staff.branch,
    "timesheet_staff",
    staff.id,
    "Add timesheet staff",
    undefined,
    staff,
    now,
  );
  return structuredClone(staff);
}
export function editTimesheetStaff(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  patch: {
    name_en?: string;
    name_fa?: string;
    usual_department_key?: string;
    app_person_id?: string;
  },
  now = new Date(),
): TimesheetStaff {
  const found = staffFor(state, actor, id, true);
  actor = found.actor;
  const staff = found.staff;
  const name = names({
    name_en: patch.name_en ?? staff.name_en,
    name_fa: patch.name_fa ?? staff.name_fa,
  });
  const key = patch.usual_department_key ?? staff.usual_department_key;
  if (patch.usual_department_key !== undefined) departmentFor(state, key);
  uniqueName(state, actor.company_id, staff.branch, name.name_en, id);
  const app_person_id =
    patch.app_person_id === undefined
      ? staff.app_person_id
      : personLink(state, actor, staff.branch, patch.app_person_id);
  const after = { ...staff, ...name, usual_department_key: key, app_person_id };
  if (JSON.stringify(after) === JSON.stringify(staff))
    return structuredClone(staff);
  const before = structuredClone(staff);
  Object.assign(staff, after);
  touch(staff, actor, now);
  audit(
    state,
    actor,
    staff.branch,
    "timesheet_staff",
    id,
    "Edit timesheet staff",
    before,
    staff,
    now,
  );
  return structuredClone(staff);
}
export function archiveTimesheetStaff(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  archived = true,
  now = new Date(),
): TimesheetStaff {
  const found = staffFor(state, actor, id, true);
  actor = found.actor;
  const staff = found.staff;
  const status = archived ? "archived" : "active";
  if (staff.status === status) return structuredClone(staff);
  const before = structuredClone(staff);
  staff.status = status;
  touch(staff, actor, now);
  audit(
    state,
    actor,
    staff.branch,
    "timesheet_staff",
    id,
    archived ? "Archive timesheet staff" : "Restore timesheet staff",
    before,
    staff,
    now,
  );
  return structuredClone(staff);
}
function ensureDay(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
  date: string,
  now: Date,
): TimesheetDay {
  const matches = (state.timesheet_days ?? []).filter(
    (day) =>
      day.company_id === actor.company_id &&
      day.branch === branch &&
      day.date === date,
  );
  if (matches.length > 1) throw new TimesheetError("conflict");
  if (matches[0]) {
    recordScope(matches[0]);
    return matches[0];
  }
  const day: TimesheetDay = {
    id: createId("timesheet-day"),
    company_id: actor.company_id,
    branch,
    branch_id: branch,
    date,
    notes: "",
    ...stamp(actor, now),
  };
  (state.timesheet_days ??= []).push(day);
  audit(
    state,
    actor,
    branch,
    "timesheet_day",
    day.id,
    "Add timesheet day",
    undefined,
    day,
    now,
  );
  return day;
}
function normalizedTime(value: string): string {
  const normalized = parseTimesheetTime(value);
  if (normalized === null) throw new TimesheetError("time");
  return normalized;
}
export function addTimesheetRow(
  state: DemoState,
  actor: AuthenticatedActor,
  input: {
    branch: string;
    date: string;
    department_key: string;
    staff_id: string;
    in_time?: string;
    out_time?: string;
  },
  now = new Date(),
): TimesheetRow {
  actor = requireTimesheets(state, actor, input.branch, true);
  requireDate(input.date);
  const department = departmentFor(state, input.department_key);
  const staff = staffFor(state, actor, input.staff_id, true).staff;
  if (staff.branch !== input.branch || staff.status !== "active")
    throw new TimesheetError("staff");
  const in_time = normalizedTime(input.in_time ?? ""),
    out_time = normalizedTime(input.out_time ?? "");
  const day = ensureDay(state, actor, input.branch, input.date, now);
  const row: TimesheetRow = {
    id: createId("timesheet-row"),
    company_id: actor.company_id,
    branch: input.branch,
    branch_id: input.branch,
    day_id: day.id,
    date: input.date,
    department_key: department.key,
    department_name_en: department.name_en,
    department_name_fa: department.name_fa,
    staff_id: staff.id,
    name_en: staff.name_en,
    name_fa: staff.name_fa,
    in_time,
    out_time,
    ...stamp(actor, now),
  };
  (state.timesheet_rows ??= []).push(row);
  audit(
    state,
    actor,
    row.branch,
    "timesheet_row",
    row.id,
    "Add timesheet row",
    undefined,
    row,
    now,
  );
  return structuredClone(row);
}
function rowFor(state: DemoState, actor: AuthenticatedActor, id: string) {
  actor = freshActor(state, actor);
  const row = state.timesheet_rows?.find(
    (item) => item.company_id === actor.company_id && item.id === id,
  );
  if (!row || row.removed_at) throw new TimesheetError("row");
  actor = requireTimesheets(state, actor, recordScope(row), true);
  const day = state.timesheet_days?.find(
    (item) =>
      item.id === row.day_id &&
      item.company_id === row.company_id &&
      item.branch === row.branch &&
      item.date === row.date &&
      item.branch_id === row.branch,
  );
  if (
    !day ||
    !state.timesheet_staff?.some(
      (staff) =>
        staff.id === row.staff_id &&
        staff.company_id === row.company_id &&
        staff.branch === row.branch &&
        staff.branch_id === row.branch,
    )
  )
    throw new TimesheetError("row");
  return { row, actor };
}
export function patchTimesheetRow(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  patch: {
    in_time?: string;
    out_time?: string;
    staff_id?: string;
    department_key?: string;
  },
  now = new Date(),
): TimesheetRow {
  const found = rowFor(state, actor, id);
  actor = found.actor;
  const row = found.row;
  const next = { ...row };
  if (patch.in_time !== undefined) next.in_time = normalizedTime(patch.in_time);
  if (patch.out_time !== undefined)
    next.out_time = normalizedTime(patch.out_time);
  if (patch.staff_id !== undefined) {
    const staff = staffFor(state, actor, patch.staff_id, true).staff;
    if (staff.branch !== row.branch || staff.status !== "active")
      throw new TimesheetError("staff");
    next.staff_id = staff.id;
    next.name_en = staff.name_en;
    next.name_fa = staff.name_fa;
  }
  if (patch.department_key !== undefined) {
    const department = departmentFor(state, patch.department_key);
    next.department_key = department.key;
    next.department_name_en = department.name_en;
    next.department_name_fa = department.name_fa;
  }
  if (JSON.stringify(row) === JSON.stringify(next)) return structuredClone(row);
  const before = structuredClone(row);
  Object.assign(row, next);
  touch(row, actor, now);
  audit(
    state,
    actor,
    row.branch,
    "timesheet_row",
    row.id,
    "Edit timesheet row",
    before,
    row,
    now,
  );
  return structuredClone(row);
}
export function removeTimesheetRow(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  now = new Date(),
): TimesheetRow {
  const found = rowFor(state, actor, id);
  actor = found.actor;
  const row = found.row;
  const before = structuredClone(row);
  row.removed_at = now.toISOString();
  row.removed_by_user_id = actor.user_id;
  touch(row, actor, now);
  audit(
    state,
    actor,
    row.branch,
    "timesheet_row",
    row.id,
    "Remove timesheet row",
    before,
    row,
    now,
  );
  return structuredClone(row);
}
export function saveTimesheetNotes(
  state: DemoState,
  actor: AuthenticatedActor,
  input: { branch: string; date: string; notes: string },
  now = new Date(),
): TimesheetDay {
  actor = requireTimesheets(state, actor, input.branch, true);
  requireDate(input.date);
  if (typeof input.notes !== "string" || input.notes.length > 20000)
    throw new TimesheetError("name");
  const prior = state.timesheet_days?.find(
    (item) =>
      item.company_id === actor.company_id &&
      item.branch === input.branch &&
      item.date === input.date,
  );
  const before = prior ? structuredClone(prior) : undefined;
  const day = ensureDay(state, actor, input.branch, input.date, now);
  if (day.notes === input.notes) return structuredClone(day);
  day.notes = input.notes;
  touch(day, actor, now);
  audit(
    state,
    actor,
    day.branch,
    "timesheet_day",
    day.id,
    "Edit timesheet notes",
    before,
    day,
    now,
  );
  return structuredClone(day);
}
export function listTimesheetStaff(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
  options: { includeArchived?: boolean; department_key?: string } = {},
): TimesheetStaff[] {
  actor = requireTimesheets(state, actor, branch);
  return structuredClone(
    (state.timesheet_staff ?? []).filter(
      (staff) =>
        staff.company_id === actor.company_id &&
        staff.branch === branch &&
        staff.branch_id === branch &&
        (options.includeArchived || staff.status === "active"),
    ),
  ).sort(
    (a, b) =>
      (a.status === "archived" ? 1 : 0) -
        (b.status === "archived" ? 1 : 0) +
        (options.department_key
          ? Number(b.usual_department_key === options.department_key) -
            Number(a.usual_department_key === options.department_key)
          : 0) || a.name_en.localeCompare(b.name_en),
  );
}
function auditDate(entry: Activity): string | undefined {
  for (const value of [entry.after, entry.before])
    if (
      value &&
      typeof value === "object" &&
      "date" in value &&
      typeof value.date === "string"
    )
      return value.date;
  return undefined;
}
export function isTimesheetActivity(entry: Activity): boolean {
  return ["timesheet_staff", "timesheet_day", "timesheet_row"].includes(
    entry.entity_type ?? "",
  );
}
function historyView(
  state: TimesheetViewState,
  branch: string,
  date?: string,
): Activity[] {
  return businessAuditRead(
    structuredClone(
      (state.activity ?? [])
        .filter(
          (entry) =>
            entry.company_id === state.config.company.seed_key &&
            entry.branch === branch &&
            isTimesheetActivity(entry) &&
            (!date || !auditDate(entry) || auditDate(entry) === date),
        )
        .sort((a, b) => b.at.localeCompare(a.at)),
    ),
  );
}
export function readTimesheetHistory(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
  date?: string,
): Activity[] {
  requireTimesheets(state, actor, branch);
  if (date) requireDate(date);
  return historyView(state, branch, date);
}
export function readTimesheetDayView(
  state: TimesheetViewState,
  branch: string,
  date: string,
  now = new Date(),
): TimesheetDayRead {
  requireDate(date);
  const company_id = state.config.company.seed_key;
  const staff = structuredClone(
    (state.timesheet_staff ?? []).filter(
      (item) =>
        item.company_id === company_id &&
        item.branch === branch &&
        item.branch_id === branch,
    ),
  );
  const day =
    (state.timesheet_days ?? []).find(
      (item) =>
        item.company_id === company_id &&
        item.branch === branch &&
        item.branch_id === branch &&
        item.date === date,
    ) ?? null;
  const today = timesheetClock(state.config, branch, now).date;
  const rows: TimesheetRowRead[] = (state.timesheet_rows ?? [])
    .filter(
      (row) =>
        !row.removed_at &&
        row.company_id === company_id &&
        row.branch === branch &&
        row.branch_id === branch &&
        row.date === date &&
        row.day_id === day?.id &&
        staff.some((person) => person.id === row.staff_id),
    )
    .map((row) => {
      const person = staff.find((item) => item.id === row.staff_id);
      return {
        ...structuredClone(row),
        name_en: person?.name_en ?? row.name_en,
        name_fa: person?.name_fa ?? row.name_fa,
        ...timesheetDuration(row, today),
      };
    });
  const departments: TimesheetDepartmentRead[] = configuredTimesheetDepartments(
    state.config,
  ).map((department) => ({
    ...department,
    rows: [],
    people_count: 0,
    minutes: 0,
  }));
  for (const row of rows)
    if (!departments.some((item) => item.key === row.department_key))
      departments.push({
        key: row.department_key,
        name_en: row.department_name_en,
        name_fa: row.department_name_fa,
        order: departments.length,
        rows: [],
        people_count: 0,
        minutes: 0,
        retained: true,
      });
  for (const department of departments) {
    department.rows = rows.filter(
      (row) => row.department_key === department.key,
    );
    department.people_count = new Set(
      department.rows.map((row) => row.staff_id),
    ).size;
    department.minutes = department.rows.reduce(
      (sum, row) => sum + row.minutes,
      0,
    );
  }
  return {
    company_id,
    branch,
    date,
    day: day ? structuredClone(day) : null,
    staff,
    departments,
    people_count: new Set(rows.map((row) => row.staff_id)).size,
    minutes: rows.reduce((sum, row) => sum + row.minutes, 0),
    history: historyView(state, branch, date),
  };
}
export function readTimesheetWeekView(
  state: TimesheetViewState,
  branch: string,
  date: string,
  now = new Date(),
): TimesheetWeekRead {
  const start_date = timesheetWeekStart(date);
  const dates = Array.from({ length: 7 }, (_, index) =>
    timesheetDateAfter(start_date, index),
  );
  const sheets = dates.map((day) =>
    readTimesheetDayView(state, branch, day, now),
  );
  const all = sheets.flatMap((sheet) =>
    sheet.departments.flatMap((department) => department.rows),
  );
  const people = [...new Set(all.map((row) => row.staff_id))];
  const departments: TimesheetWeekRead["departments"] = [];
  for (const sheet of sheets)
    for (const department of sheet.departments)
      if (!departments.some((item) => item.key === department.key))
        departments.push({
          key: department.key,
          name_en: department.name_en,
          name_fa: department.name_fa,
          minutes: 0,
          days: Array<number>(7).fill(0),
        });
  const staff: TimesheetWeekRead["staff"] = people
    .map((id) => {
      const rows = all.filter((row) => row.staff_id === id);
      const person = state.timesheet_staff?.find(
        (item) =>
          item.company_id === state.config.company.seed_key &&
          item.branch === branch &&
          item.id === id,
      );
      const department =
        departments.find(
          (item) =>
            item.key ===
            (person?.usual_department_key ?? rows[0].department_key),
        ) ?? departments.find((item) => item.key === rows[0].department_key)!;
      const days = dates.map((date) => {
        const matching = rows.filter((row) => row.date === date);
        return {
          date,
          rows: matching,
          minutes: matching.reduce((sum, row) => sum + row.minutes, 0),
        };
      });
      return {
        staff_id: id,
        name_en: person?.name_en ?? rows[0].name_en,
        name_fa: person?.name_fa ?? rows[0].name_fa,
        department_key: department.key,
        department_name_en: department.name_en,
        department_name_fa: department.name_fa,
        days,
        minutes: days.reduce((sum, day) => sum + day.minutes, 0),
      };
    })
    .sort(
      (a, b) =>
        departments.findIndex((item) => item.key === a.department_key) -
          departments.findIndex((item) => item.key === b.department_key) ||
        a.name_en.localeCompare(b.name_en),
    );
  departments.forEach((department) => {
    department.days = dates.map((date) =>
      all
        .filter(
          (row) => row.date === date && row.department_key === department.key,
        )
        .reduce((sum, row) => sum + row.minutes, 0),
    );
    department.minutes = department.days.reduce((sum, value) => sum + value, 0);
  });
  const days = sheets.map((sheet) => sheet.minutes);
  return {
    company_id: state.config.company.seed_key,
    branch,
    start_date,
    end_date: dates[6],
    dates,
    staff,
    departments,
    days,
    minutes: days.reduce((sum, value) => sum + value, 0),
  };
}
export function readTimesheetDay(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
  date: string,
  now = new Date(),
): TimesheetDayRead {
  requireTimesheets(state, actor, branch);
  return readTimesheetDayView(state, branch, date, now);
}
export function readTimesheetWeek(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
  date: string,
  now = new Date(),
): TimesheetWeekRead {
  requireTimesheets(state, actor, branch);
  return readTimesheetWeekView(state, branch, date, now);
}
function csvCell(value: string): string {
  const safe = /^[\s]*[=+@-]|^[\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportTimesheetCsv(
  state: DemoState,
  actor: AuthenticatedActor,
  input: { branch: string; date: string; view: "day" | "week" },
  now = new Date(),
): { filename: string; text: string } {
  requireTimesheets(state, actor, input.branch);
  requireDate(input.date);
  if (input.view !== "day" && input.view !== "week")
    throw new TimesheetError("date");
  const dates =
    input.view === "week"
      ? readTimesheetWeek(state, actor, input.branch, input.date, now).dates
      : [input.date];
  const records = [["staff", "department", "date", "in", "out", "hours"]];
  for (const date of dates)
    for (const department of readTimesheetDay(
      state,
      actor,
      input.branch,
      date,
      now,
    ).departments)
      for (const row of department.rows)
        records.push([
          row.name_en,
          department.name_en,
          date,
          row.in_time,
          row.out_time,
          new Decimal(row.minutes).div(60).toFixed(4),
        ]);
  return {
    filename: `timesheets-${input.view}-${dates[0]}.csv`,
    text:
      "\uFEFF" +
      records.map((record) => record.map(csvCell).join(",")).join("\r\n") +
      "\r\n",
  };
}
export function onShiftNow(
  state: TimesheetViewState,
  branch: string,
  now = new Date(),
): number {
  if (!branch || branch === "all") return 0;
  const local = timesheetClock(state.config, branch, now);
  const days = (state.timesheet_days ?? []).filter(
    (day) =>
      day.company_id === state.config.company.seed_key &&
      day.branch === branch &&
      day.branch_id === branch &&
      day.date <= local.date,
  );
  return new Set(
    (state.timesheet_rows ?? [])
      .filter((row) => {
        const start = parseTimesheetTime(row.in_time);
        return (
          !row.removed_at &&
          row.company_id === state.config.company.seed_key &&
          row.branch === branch &&
          row.branch_id === branch &&
          start &&
          !row.out_time &&
          days.some((day) => day.id === row.day_id && day.date === row.date) &&
          `${row.date}T${start}` <= `${local.date}T${local.time}`
        );
      })
      .map((row) => row.staff_id),
  ).size;
}
/** Shell projection helper; every canonical record is checked independently. */
export function timesheetRecordReadable(
  state: DemoState,
  actor: AuthenticatedActor,
  record: { company_id: string; branch: string; branch_id: string },
): boolean {
  return (
    record.branch === record.branch_id &&
    (actor.branch === "all" || record.branch === actor.branch) &&
    can(
      state,
      actor,
      "timesheets.read",
      timesheetScope(record.company_id, record.branch),
    ).allowed
  );
}
