import type { AuthenticatedActor } from "./authority-types";
import { actorAudit, guardDomain } from "./domain-authority";
import { createId } from "./ids";
import type { CompanyConfig, DemoState } from "./types";
import {
  TimesheetError,
  type TimesheetDepartment,
  type TimesheetSettings,
} from "./timesheet-types";

export function configuredTimesheetDepartments(
  config: Pick<CompanyConfig, "timesheets">,
): TimesheetDepartment[] {
  return structuredClone(config.timesheets?.departments ?? []).sort(
    (a, b) => a.order - b.order || a.key.localeCompare(b.key),
  );
}

export function validTimesheetSettings(settings: TimesheetSettings): boolean {
  return Boolean(
    settings &&
    Array.isArray(settings.departments) &&
    settings.departments.every(
      (department) =>
        department &&
        /^[a-z][a-z0-9_-]{0,63}$/.test(department.key) &&
        typeof department.name_en === "string" &&
        department.name_en.trim().length > 0 &&
        department.name_en.trim().length <= 200 &&
        typeof department.name_fa === "string" &&
        department.name_fa.trim().length > 0 &&
        department.name_fa.trim().length <= 200 &&
        Number.isSafeInteger(department.order) &&
        department.order >= 0,
    ) &&
    new Set(settings.departments.map((department) => department.key)).size ===
      settings.departments.length,
  );
}

/** Settings remains configurable while the operational module is switched off. */
export function saveTimesheetSettings(
  state: DemoState,
  actor: AuthenticatedActor,
  settings: TimesheetSettings,
  now = new Date(),
): void {
  actor = guardDomain(state, actor, "settings.manage", undefined, true);
  if (!validTimesheetSettings(settings)) throw new TimesheetError("settings");
  const after = {
    departments: settings.departments.map((department) => ({
      key: department.key,
      name_en: department.name_en.trim(),
      name_fa: department.name_fa.trim(),
      order: department.order,
    })),
  };
  const before = state.config.timesheets;
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  state.config.timesheets = after;
  state.activity.push({
    id: createId("timesheet-settings"),
    company_id: actor.company_id,
    branch: "all",
    scope: "all",
    action: "Timesheet settings changed",
    by: actor.actor,
    at: now.toISOString(),
    ...actorAudit(state, actor, now),
    entity_type: "settings",
    entity_id: "timesheets",
    before: structuredClone(before),
    after: structuredClone(after),
    reversible: false,
  });
}
