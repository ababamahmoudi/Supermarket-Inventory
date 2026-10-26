import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { can } from "./permissions";
import type { DemoState } from "./types";
import type { ScopedReadView } from "./e1-read-model";
import { timesheetRecordReadable } from "./timesheets";

/** Only scoped copies cross the private canonical boundary. */
export function projectTimesheets(
  state: DemoState,
  actor: AuthenticatedActor,
): Pick<
  ScopedReadView,
  "timesheet_staff" | "timesheet_days" | "timesheet_rows"
> {
  actor = freshActor(state, actor);
  if (!can(state, actor, "timesheets.read").allowed)
    return { timesheet_staff: [], timesheet_days: [], timesheet_rows: [] };
  const timesheet_staff = (state.timesheet_staff ?? []).filter((record) =>
    timesheetRecordReadable(state, actor, record),
  );
  const timesheet_days = (state.timesheet_days ?? []).filter((record) =>
    timesheetRecordReadable(state, actor, record),
  );
  const days = new Set(timesheet_days.map((day) => day.id));
  const timesheet_rows = (state.timesheet_rows ?? []).filter(
    (record) =>
      timesheetRecordReadable(state, actor, record) &&
      timesheet_days.some(
        (day) =>
          days.has(record.day_id) &&
          day.id === record.day_id &&
          day.branch === record.branch &&
          day.date === record.date,
      ) &&
      timesheet_staff.some(
        (staff) =>
          staff.id === record.staff_id && staff.branch === record.branch,
      ),
  );
  return structuredClone({ timesheet_staff, timesheet_days, timesheet_rows });
}
