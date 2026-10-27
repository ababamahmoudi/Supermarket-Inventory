import { describe, expect, it } from "vitest";
import { initialState } from "../e1-bootstrap";
import { authenticatedTestActor } from "../authority-test-fixture";
import {
  addTimesheetRow,
  addTimesheetStaff,
  exportTimesheetCsv,
  readTimesheetDay,
  readTimesheetWeek,
} from "../timesheets";
import {
  timesheetDisplaySummary,
  timesheetRowDisplay,
} from "./timesheet-display";

const clock = { date: "2026-10-27", time: "13:42" };
describe("R2f D1 elapsed display preserves completed payroll", () => {
  it.each([
    [
      { date: "2026-10-27", in_time: "07:00", out_time: "", minutes: 0 },
      { minutes: 402, so_far: true },
    ],
    [
      { date: "2026-10-27", in_time: "13:42", out_time: "", minutes: 0 },
      { minutes: 0, so_far: true },
    ],
    [
      { date: "2026-10-27", in_time: "14:00", out_time: "", minutes: 0 },
      { minutes: 0, so_far: false },
    ],
    [
      { date: "2026-10-26", in_time: "22:00", out_time: "", minutes: 0 },
      { minutes: 0, so_far: false },
    ],
    [
      { date: "2026-10-28", in_time: "07:00", out_time: "", minutes: 0 },
      { minutes: 0, so_far: false },
    ],
    [
      { date: "2026-10-27", in_time: "22:00", out_time: "06:00", minutes: 480 },
      { minutes: 480, so_far: false },
    ],
    [
      { date: "2026-10-27", in_time: "", out_time: "", minutes: 0 },
      { minutes: 0, so_far: false },
    ],
  ])("displays %j as %j", (row, expected) => {
    const before = structuredClone(row);
    expect(timesheetRowDisplay(row, clock)).toEqual(expected);
    expect(row).toEqual(before);
  });

  it("counts split-shift people once while adding completed and current elapsed display", () => {
    expect(
      timesheetDisplaySummary(
        [
          {
            staff_id: "cedar",
            date: clock.date,
            in_time: "06:00",
            out_time: "10:00",
            minutes: 240,
          },
          {
            staff_id: "cedar",
            date: clock.date,
            in_time: "11:42",
            out_time: "",
            minutes: 0,
          },
          {
            staff_id: "linden",
            date: clock.date,
            in_time: "15:00",
            out_time: "",
            minutes: 0,
          },
        ],
        clock,
      ),
    ).toEqual({ minutes: 360, on_shift: 1 });
  });

  it("leaves the canonical day, week, CSV and blank Out unchanged after calculating live display", () => {
    const state = initialState();
    state.timesheet_staff = [];
    state.timesheet_rows = [];
    state.timesheet_days = [];
    const actor = authenticatedTestActor(state, "manager");
    const now = new Date("2026-10-27T17:42:00Z");
    const person = addTimesheetStaff(
      state,
      actor,
      {
        branch: "Branch 1",
        name_en: "Avery Linden",
        usual_department_key: "bakery",
      },
      now,
    );
    addTimesheetRow(
      state,
      actor,
      {
        branch: "Branch 1",
        date: clock.date,
        department_key: "bakery",
        staff_id: person.id,
        in_time: "07:00",
        out_time: "",
      },
      now,
    );
    const before = JSON.stringify(state);
    const day = readTimesheetDay(state, actor, "Branch 1", clock.date, now);
    const rows = day.departments.flatMap((department) => department.rows);
    expect(timesheetDisplaySummary(rows, clock)).toEqual({
      minutes: 402,
      on_shift: 1,
    });
    expect(day.minutes).toBe(0);
    expect(
      readTimesheetWeek(state, actor, "Branch 1", clock.date, now).minutes,
    ).toBe(0);
    expect(
      exportTimesheetCsv(
        state,
        actor,
        { branch: "Branch 1", date: clock.date, view: "day" },
        now,
      ).text,
    ).toContain('"07:00","","0.0000"');
    expect(JSON.stringify(state)).toBe(before);
    expect(state.timesheet_rows[0].out_time).toBe("");
  });
});
