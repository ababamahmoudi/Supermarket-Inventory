import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import { initialState as emptyFixture } from "./notes-dates-fixture.e1";
import { hydrateTimesheetDemo } from "./timesheet-demo";
import { initializeTimesheetState } from "./timesheet-state";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  readTimesheetDay,
  readTimesheetWeek,
  onShiftNow,
  exportTimesheetCsv,
} from "./timesheets";
import { removeFictionalData } from "./empty-store";

const now = new Date("2026-10-28T18:30:00Z");
afterEach(() => vi.useRealTimers());
function demo() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  const state = initialState();
  const actor = authenticatedTestActor(state, "manager");
  return { state, actor };
}
describe("R2d independent fictional practice sheets", () => {
  it("fresh demo has three days, all configured departments and no staff login requirement", () => {
    const { state, actor } = demo();
    expect(state.timesheet_staff).toHaveLength(8);
    expect(state.timesheet_days?.map((day) => day.date)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
    expect(state.timesheet_rows).toHaveLength(24);
    expect(
      state.timesheet_staff?.every(
        (staff) =>
          !staff.app_person_id &&
          staff.company_id === actor.company_id &&
          staff.branch_id === "Branch 1",
      ),
    ).toBe(true);
    expect(
      new Set(state.timesheet_rows?.map((row) => row.department_key)).size,
    ).toBe(8);
  });
  it("shows the overnight eight hours, old missing Out and truthful unclosed shift count", () => {
    const { state, actor } = demo();
    const day = readTimesheetDay(state, actor, "Branch 1", "2026-10-27", now);
    expect(
      day.departments.find((department) => department.key === "floor")?.rows[0],
    ).toMatchObject({
      in_time: "22:00",
      out_time: "06:00",
      minutes: 480,
      overnight: true,
    });
    expect(
      day.departments.find((department) => department.key === "kitchen")
        ?.rows[0],
    ).toMatchObject({ out_time: "", on_shift: true, warning: "out_missing" });
    expect(onShiftNow(state, "Branch 1", now)).toBe(2);
  });
  it("day, department, week and CSV payroll totals agree on integer minutes", () => {
    const { state, actor } = demo();
    const week = readTimesheetWeek(state, actor, "Branch 1", "2026-10-28", now);
    expect(week.days).toEqual([3750, 3300, 3300, 0, 0, 0, 0]);
    expect(week.minutes).toBe(10350);
    expect(week.staff.reduce((sum, staff) => sum + staff.minutes, 0)).toBe(
      10350,
    );
    expect(
      week.departments.reduce((sum, department) => sum + department.minutes, 0),
    ).toBe(10350);
    const csv = exportTimesheetCsv(
      state,
      actor,
      { branch: "Branch 1", date: "2026-10-28", view: "week" },
      now,
    );
    expect(csv.text.split("\r\n").filter(Boolean)).toHaveLength(25);
    expect(csv.text).toContain(
      '"Iris Cedar","Floor","2026-10-27","22:00","06:00","8.0000"',
    );
  });
  it("does not seed during existing-store initialization, overwrite customized data, or repopulate empty-store", () => {
    const state = emptyFixture();
    initializeTimesheetState(state);
    expect(state.timesheet_staff).toEqual([]);
    expect(state.timesheet_days).toEqual([]);
    hydrateTimesheetDemo(state, now);
    const snapshot = JSON.stringify(state);
    hydrateTimesheetDemo(state, now);
    expect(JSON.stringify(state)).toBe(snapshot);
    const actor = authenticatedTestActor(state, "manager");
    removeFictionalData(state, actor, now);
    hydrateTimesheetDemo(state, now);
    expect(state.timesheet_staff).toEqual([]);
    expect(state.timesheet_days).toEqual([]);
    expect(state.timesheet_rows).toEqual([]);
  });
  it("uses configured department captions/order and omits removed departments from new fixture rows", () => {
    const state = emptyFixture();
    state.config.timesheets = {
      departments: [
        {
          key: "floor",
          name_en: "Service team",
          name_fa: "گروه خدمات",
          order: 0,
        },
      ],
    };
    hydrateTimesheetDemo(state, now);
    expect(state.timesheet_staff).toHaveLength(1);
    expect(state.timesheet_rows).toHaveLength(3);
    expect(
      state.timesheet_rows?.every(
        (row) => row.department_name_en === "Service team",
      ),
    ).toBe(true);
  });
  it("does not install one company's fictional staff in another company", () => {
    const state = emptyFixture();
    state.config.company.seed_key = "different-company";
    hydrateTimesheetDemo(state, now);
    expect(state.timesheet_staff).toEqual([]);
    expect(state.timesheet_days).toEqual([]);
    expect(state.timesheet_rows).toEqual([]);
  });
});
