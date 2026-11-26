import source from "../../seed/timesheets-demo.json";
import { configSeed } from "./config";
import { initializeTimesheetState } from "./timesheet-state";
import {
  configuredTimesheetDepartments,
  timesheetClock,
  timesheetDateAfter,
} from "./timesheets";
import { branchId } from "./settings";
import type { DemoState } from "./types";
import type {
  TimesheetDay,
  TimesheetStaff,
  TimesheetRow,
} from "./timesheet-types";

/** Fresh demo/reset only. Startup migration never calls this function. */
export function hydrateTimesheetDemo(
  state: DemoState,
  now = new Date(),
): DemoState {
  initializeTimesheetState(state);
  if (state.prototype_r2d_timesheet_demo === 1) return state;
  state.prototype_r2d_timesheet_demo = 1;
  if (
    state.config.company.seed_key !== configSeed.company.seed_key ||
    state.timesheet_staff?.length ||
    state.timesheet_days?.length ||
    state.timesheet_rows?.length
  )
    return state;
  const location = state.config.branches.find(
    (branch) => branch.code === source.branch_code,
  );
  if (!location || location.active === false) return state;
  const branch = branchId(location),
    company_id = state.config.company.seed_key;
  const departments = configuredTimesheetDepartments(state.config);
  const actor = "demo-person-owner";
  const today = timesheetClock(state.config, branch, now).date;
  const stamp = {
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    created_by_user_id: actor,
    updated_by_user_id: actor,
    version: 1,
  };
  const staff: TimesheetStaff[] = source.staff.flatMap((person) =>
    departments.some((department) => department.key === person.department_key)
      ? [
          {
            id: `demo-timesheet-staff-${person.key}`,
            company_id,
            branch,
            branch_id: branch,
            name_en: person.name_en,
            name_fa: person.name_fa,
            usual_department_key: person.department_key,
            status: "active" as const,
            ...stamp,
          },
        ]
      : [],
  );
  const days: TimesheetDay[] = [];
  const rows: TimesheetRow[] = [];
  for (const paper of source.days) {
    const date = timesheetDateAfter(today, paper.relative_days);
    const day: TimesheetDay = {
      id: `demo-timesheet-day-${date}`,
      company_id,
      branch,
      branch_id: branch,
      date,
      notes: paper.notes,
      ...stamp,
    };
    days.push(day);
    for (const shift of paper.shifts) {
      const person = staff.find(
        (person) => person.id === `demo-timesheet-staff-${shift.staff_key}`,
      );
      const department = departments.find(
        (department) => department.key === person?.usual_department_key,
      );
      if (!person || !department) continue;
      rows.push({
        id: `demo-timesheet-row-${date}-${shift.staff_key}`,
        company_id,
        branch,
        branch_id: branch,
        date,
        day_id: day.id,
        staff_id: person.id,
        name_en: person.name_en,
        name_fa: person.name_fa,
        department_key: department.key,
        department_name_en: department.name_en,
        department_name_fa: department.name_fa,
        in_time: shift.in,
        out_time: shift.out,
        ...stamp,
      });
    }
  }
  state.timesheet_staff = staff;
  state.timesheet_days = days;
  state.timesheet_rows = rows;
  return state;
}
