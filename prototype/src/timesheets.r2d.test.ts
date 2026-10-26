import { describe, expect, it } from "vitest";
import { initialState } from "./notes-dates-fixture.e1";
import { authenticatedTestActor } from "./authority-test-fixture";
import { configuredBranches } from "./settings";
import { selectHistory } from "./history";
import { projectTimesheets } from "./timesheets-projections";
import { createReadModel, signedOutReadView } from "./e1-read-model";
import { completeReadModelProjectors } from "./e1-projectors";
import { authoritySnapshot, bindAuthoritySnapshot } from "./authority";
import { removeFictionalData } from "./empty-store";
import type { AuthenticatedActor, RoleId } from "./authority-types";
import {
  addTimesheetStaff,
  editTimesheetStaff,
  archiveTimesheetStaff,
  addTimesheetRow,
  patchTimesheetRow,
  removeTimesheetRow,
  saveTimesheetNotes,
  readTimesheetDay,
  readTimesheetWeek,
  readTimesheetHistory,
  listTimesheetStaff,
  listTimesheetPeople,
  exportTimesheetCsv,
  onShiftNow,
  parseTimesheetTime,
  timesheetDuration,
  timesheetWeekStart,
  timesheetDateAfter,
  timesheetMinutesText,
  saveTimesheetSettings,
  TimesheetError,
} from "./timesheets";

const now = new Date("2026-10-26T18:30:00Z");
function fresh(role: RoleId = "manager") {
  const state = initialState();
  const branches = configuredBranches(state.config);
  const actor = authenticatedTestActor(state, role, {
    locations: [branches[0]],
  });
  return { state, actor, branch: branches[0], other: branches[1] };
}
function seeded() {
  const fixture = fresh();
  const staff = addTimesheetStaff(
    fixture.state,
    fixture.actor,
    {
      branch: fixture.branch,
      name_en: "Iris Linden",
      name_fa: "ایریس",
      usual_department_key: "bakery",
    },
    now,
  );
  const row = addTimesheetRow(
    fixture.state,
    fixture.actor,
    {
      branch: fixture.branch,
      date: "2026-10-26",
      department_key: "bakery",
      staff_id: staff.id,
      in_time: "730",
      out_time: "1530",
    },
    now,
  );
  return { ...fixture, staff, row };
}
const financial = (state: ReturnType<typeof initialState>) =>
  JSON.stringify([
    state.products,
    state.invoice,
    state.invoices,
    state.ledger,
    state.stock,
    state.stock_movements,
    state.returns,
  ]);

describe("R2d time normalization", () => {
  it.each([
    ["730", "07:30"],
    ["7:30", "07:30"],
    ["19", "19:00"],
    ["1915", "19:15"],
    ["14", "14:00"],
    ["0", "00:00"],
    ["0000", "00:00"],
    ["2359", "23:59"],
    ["۷۳۰", "07:30"],
    ["١٩١٥", "19:15"],
    [" ", ""],
  ])("normalizes %s", (input, expected) =>
    expect(parseTimesheetTime(input)).toBe(expected),
  );
  it.each(["2400", "1260", "-7", "7:3", "12:60", "12:345", "9am", "12345"])(
    "rejects %s",
    (input) => expect(parseTimesheetTime(input)).toBeNull(),
  );
  it("calculates overnight, equal endpoints, open shifts, long/missing warnings and Monday weeks", () => {
    expect(
      timesheetDuration(
        { date: "2026-10-25", in_time: "22:00", out_time: "06:00" },
        "2026-10-26",
      ),
    ).toEqual({
      minutes: 480,
      overnight: true,
      on_shift: false,
      warning: null,
    });
    expect(
      timesheetDuration(
        { date: "2026-10-26", in_time: "07:00", out_time: "07:00" },
        "2026-10-26",
      ).minutes,
    ).toBe(0);
    expect(
      timesheetDuration(
        { date: "2026-10-26", in_time: "07:00", out_time: "" },
        "2026-10-26",
      ),
    ).toMatchObject({ minutes: 0, on_shift: true, warning: null });
    expect(
      timesheetDuration(
        { date: "2026-10-25", in_time: "07:00", out_time: "" },
        "2026-10-26",
      ).warning,
    ).toBe("out_missing");
    expect(
      timesheetDuration(
        { date: "2026-10-26", in_time: "01:00", out_time: "18:00" },
        "2026-10-26",
      ).warning,
    ).toBe("long_shift");
    expect(timesheetMinutesText(1290, "en")).toBe("21 h 30 m");
    expect(timesheetMinutesText(1290, "fa")).toContain("ساعت");
    expect(timesheetWeekStart("2027-01-03")).toBe("2026-12-28");
    expect(timesheetDateAfter("2028-02-28", 1)).toBe("2028-02-29");
    expect(() => timesheetDateAfter("2026-02-29", 1)).toThrow();
  });
});

describe("R2d daily records and audit", () => {
  it("reads without writes and applies sequential per-field patches, including clearing Out", () => {
    const { state, actor, branch } = fresh("cashier");
    const before = JSON.stringify(state);
    expect(
      readTimesheetDay(state, actor, branch, "2026-10-26", now).day,
    ).toBeNull();
    expect(JSON.stringify(state)).toBe(before);
    const staff = addTimesheetStaff(
      state,
      actor,
      { branch, name_en: "Aster Finch", usual_department_key: "cash" },
      now,
    );
    const row = addTimesheetRow(
      state,
      actor,
      {
        branch,
        date: "2026-10-26",
        department_key: "cash",
        staff_id: staff.id,
      },
      now,
    );
    patchTimesheetRow(state, actor, row.id, { in_time: "730" }, now);
    patchTimesheetRow(state, actor, row.id, { out_time: "1915" }, now);
    expect(state.timesheet_rows?.[0]).toMatchObject({
      in_time: "07:30",
      out_time: "19:15",
      version: 3,
    });
    expect(readTimesheetDay(state, actor, branch, row.date, now)).toMatchObject(
      { people_count: 1, minutes: 705 },
    );
    expect(state.activity.at(-1)).toMatchObject({
      actor_user_id: actor.user_id,
      actor_username: actor.username,
      company_id: actor.company_id,
      branch,
      action: "Edit timesheet row",
      before: { out_time: "" },
      after: { out_time: "19:15" },
      reversible: false,
      at: now.toISOString(),
    });
    const count = state.activity.length;
    patchTimesheetRow(state, actor, row.id, { in_time: "7:30" }, now);
    expect(state.activity).toHaveLength(count);
    patchTimesheetRow(state, actor, row.id, { out_time: "" }, now);
    expect(
      readTimesheetDay(state, actor, branch, row.date, now).departments.find(
        (d) => d.key === "cash",
      )?.rows[0].on_shift,
    ).toBe(true);
  });
  it("archives staff, retains soft-removed rows and audits each change without financial effects", () => {
    const { state, actor, branch, staff, row } = seeded();
    const money = financial(state);
    editTimesheetStaff(
      state,
      actor,
      staff.id,
      { name_en: "Iris Linden Edited" },
      now,
    );
    archiveTimesheetStaff(state, actor, staff.id, true, now);
    expect(listTimesheetStaff(state, actor, branch)).toEqual([]);
    expect(
      readTimesheetDay(state, actor, branch, row.date, now).departments[0]
        .rows[0].name_en,
    ).toBe("Iris Linden Edited");
    expect(() =>
      addTimesheetRow(
        state,
        actor,
        {
          branch,
          date: row.date,
          department_key: "bakery",
          staff_id: staff.id,
        },
        now,
      ),
    ).toThrow();
    patchTimesheetRow(state, actor, row.id, { out_time: "1600" }, now);
    removeTimesheetRow(state, actor, row.id, now);
    expect(state.timesheet_rows?.[0]).toMatchObject({
      id: row.id,
      removed_at: now.toISOString(),
      removed_by_user_id: actor.user_id,
    });
    expect(readTimesheetDay(state, actor, branch, row.date, now).minutes).toBe(
      0,
    );
    expect(
      readTimesheetHistory(state, actor, branch, row.date).some(
        (entry) => entry.action === "Remove timesheet row",
      ),
    ).toBe(true);
    expect(
      selectHistory(state, actor).some(
        (entry) => entry.action === "Remove timesheet row",
      ),
    ).toBe(true);
    archiveTimesheetStaff(state, actor, staff.id, false, now);
    expect(listTimesheetStaff(state, actor, branch)).toHaveLength(1);
    const snapshot = JSON.stringify(state);
    expect(() => removeTimesheetRow(state, actor, row.id, now)).toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(financial(state)).toBe(money);
  });
  it("sums split shifts/weeks and preserves removed department snapshots and multiline notes", () => {
    const { state, actor, branch, staff } = seeded();
    addTimesheetRow(
      state,
      actor,
      {
        branch,
        date: "2026-10-27",
        department_key: "bakery",
        staff_id: staff.id,
        in_time: "22",
        out_time: "6",
      },
      now,
    );
    addTimesheetRow(
      state,
      actor,
      {
        branch,
        date: "2026-10-26",
        department_key: "bakery",
        staff_id: staff.id,
        in_time: "18",
        out_time: "19",
      },
      now,
    );
    saveTimesheetNotes(
      state,
      actor,
      {
        branch,
        date: "2026-10-26",
        notes: "Keep the side gate clear.\nFictional practice.",
      },
      now,
    );
    const week = readTimesheetWeek(state, actor, branch, "2026-10-29", now);
    expect(week.dates).toHaveLength(7);
    expect(week.start_date).toBe("2026-10-26");
    expect(week.end_date).toBe("2026-11-01");
    expect(week.minutes).toBe(1020);
    expect(week.staff[0].minutes).toBe(1020);
    expect(week.departments[0].minutes).toBe(1020);
    expect(
      readTimesheetDay(state, actor, branch, "2026-10-26", now).people_count,
    ).toBe(1);
    saveTimesheetSettings(state, actor, { departments: [] }, now);
    const day = readTimesheetDay(state, actor, branch, "2026-10-26", now);
    expect(day.departments[0]).toMatchObject({
      key: "bakery",
      name_en: "Bakery",
      retained: true,
      minutes: 540,
    });
    expect(day.day?.notes).toContain("side gate");
  });
  it("exports precise formula-safe payroll CSV without writes", () => {
    const { state, actor, branch, staff } = seeded();
    editTimesheetStaff(
      state,
      actor,
      staff.id,
      { name_en: "=Invented, Name" },
      now,
    );
    const snapshot = JSON.stringify(state);
    const csv = exportTimesheetCsv(
      state,
      actor,
      { branch, date: "2026-10-26", view: "week" },
      now,
    );
    expect(csv.filename).toBe("timesheets-week-2026-10-26.csv");
    expect(csv.text).toContain(
      '"\'=Invented, Name","Bakery","2026-10-26","07:30","15:30","8.0000"',
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it("counts unique valid nonfuture unclosed staff, including past shifts", () => {
    const { state, actor, branch, staff, row } = seeded();
    patchTimesheetRow(state, actor, row.id, { out_time: "" }, now);
    addTimesheetRow(
      state,
      actor,
      {
        branch,
        date: "2026-10-25",
        department_key: "bakery",
        staff_id: staff.id,
        in_time: "22",
      },
      now,
    );
    const other = addTimesheetStaff(
      state,
      actor,
      { branch, name_en: "Vale Morgan", usual_department_key: "cash" },
      now,
    );
    addTimesheetRow(
      state,
      actor,
      {
        branch,
        date: "2026-10-26",
        department_key: "cash",
        staff_id: other.id,
        in_time: "23",
      },
      now,
    );
    expect(onShiftNow(state, branch, now)).toBe(1);
    expect(onShiftNow(state, "all", now)).toBe(0);
    removeTimesheetRow(state, actor, row.id, now);
    expect(onShiftNow(state, branch, now)).toBe(1);
  });
  it("offers only safe active app-person DTOs and rejects nonexistent links", () => {
    const { state, actor, branch, staff } = seeded();
    const people = listTimesheetPeople(state, actor, branch);
    expect(people.some((person) => person.id === actor.user_id)).toBe(true);
    for (const person of people)
      expect(Object.keys(person).sort()).toEqual([
        "id",
        "name_en",
        "name_fa",
        "username",
      ]);
    editTimesheetStaff(
      state,
      actor,
      staff.id,
      { app_person_id: actor.user_id },
      now,
    );
    expect(state.timesheet_staff?.[0].app_person_id).toBe(actor.user_id);
    const snapshot = JSON.stringify(state);
    expect(() =>
      editTimesheetStaff(
        state,
        actor,
        staff.id,
        { app_person_id: "foreign-person" },
        now,
      ),
    ).toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it("rejects malformed changes before modifying any record or audit", () => {
    const { state, actor, branch, staff, row } = seeded();
    for (const action of [
      () => patchTimesheetRow(state, actor, row.id, { in_time: "2460" }, now),
      () =>
        addTimesheetRow(
          state,
          actor,
          {
            branch,
            date: "2026-02-29",
            department_key: "bakery",
            staff_id: staff.id,
          },
          now,
        ),
      () =>
        addTimesheetRow(
          state,
          actor,
          {
            branch,
            date: "2026-10-28",
            department_key: "unknown",
            staff_id: staff.id,
          },
          now,
        ),
      () =>
        addTimesheetStaff(
          state,
          actor,
          { branch, name_en: " ", usual_department_key: "cash" },
          now,
        ),
    ]) {
      const snapshot = JSON.stringify(state);
      expect(action).toThrow(TimesheetError);
      expect(JSON.stringify(state)).toBe(snapshot);
    }
  });
});

describe("R2d direct domain and projection security", () => {
  it.each(["owner", "manager", "branch_supervisor", "cashier"] as RoleId[])(
    "permits actual read/edit/export for %s",
    (role) => {
      const { state, actor, branch } = fresh(role);
      const staff = addTimesheetStaff(
        state,
        actor,
        { branch, name_en: `Invented ${role}`, usual_department_key: "cash" },
        now,
      );
      addTimesheetRow(
        state,
        actor,
        {
          branch,
          date: "2026-10-26",
          department_key: "cash",
          staff_id: staff.id,
          in_time: "14",
        },
        now,
      );
      expect(
        readTimesheetDay(state, actor, branch, "2026-10-26", now).people_count,
      ).toBe(1);
      expect(
        exportTimesheetCsv(
          state,
          actor,
          { branch, date: "2026-10-26", view: "day" },
          now,
        ).text,
      ).toContain(`Invented ${role}`);
    },
  );
  it("denies Floor Worker APIs, CSV, shell DTO and even own-attributed timesheet History", () => {
    const { state, branch, staff, row } = seeded();
    const floor = authenticatedTestActor(state, "floor_worker", {
      locations: [branch],
    });
    state.activity.at(-1)!.actor_user_id = floor.user_id;
    state.activity.at(-1)!.by = floor.actor;
    const snapshot = JSON.stringify(state);
    for (const action of [
      () => readTimesheetDay(state, floor, branch, row.date, now),
      () => listTimesheetStaff(state, floor, branch),
      () => readTimesheetWeek(state, floor, branch, row.date, now),
      () => readTimesheetHistory(state, floor, branch),
      () => listTimesheetPeople(state, floor, branch),
      () => patchTimesheetRow(state, floor, row.id, { in_time: "10" }, now),
      () => archiveTimesheetStaff(state, floor, staff.id),
      () =>
        exportTimesheetCsv(
          state,
          floor,
          { branch, date: row.date, view: "day" },
          now,
        ),
    ])
      expect(action).toThrow();
    expect(projectTimesheets(state, floor)).toEqual({
      timesheet_staff: [],
      timesheet_days: [],
      timesheet_rows: [],
    });
    expect(JSON.stringify(selectHistory(state, floor))).not.toContain(
      "Iris Linden",
    );
    expect(
      JSON.stringify(
        createReadModel(completeReadModelProjectors())(state, floor),
      ),
    ).not.toContain("Iris Linden");
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it("denies module-off read/edit/export even to Owner but allows settings", () => {
    const { state, branch, row } = seeded();
    const owner = authenticatedTestActor(state, "owner");
    state.config.modules.timesheets = false;
    const snapshot = JSON.stringify(state);
    expect(() =>
      readTimesheetDay(state, owner, branch, row.date, now),
    ).toThrow();
    expect(() =>
      patchTimesheetRow(state, owner, row.id, { in_time: "12" }, now),
    ).toThrow();
    expect(() =>
      exportTimesheetCsv(
        state,
        owner,
        { branch, date: row.date, view: "day" },
        now,
      ),
    ).toThrow();
    expect(JSON.stringify(selectHistory(state, owner))).not.toContain(
      "Iris Linden",
    );
    expect(JSON.stringify(state)).toBe(snapshot);
    saveTimesheetSettings(state, owner, { departments: [] }, now);
  });
  it("denies other branches, companies, fabricated actors and cross-branch/foreign staff links atomically", () => {
    const { state, actor, branch, other, staff, row } = seeded();
    const cashier = authenticatedTestActor(state, "cashier", {
      locations: [other],
    });
    const foreign = initialState();
    foreign.config.company.seed_key = "another-company";
    const foreignActor = authenticatedTestActor(foreign, "owner");
    for (const denied of [
      cashier,
      foreignActor,
      { ...actor, role: "owner" } as AuthenticatedActor,
    ]) {
      const snapshot = JSON.stringify(state);
      expect(() =>
        readTimesheetDay(state, denied, branch, row.date, now),
      ).toThrow();
      expect(() =>
        patchTimesheetRow(state, denied, row.id, { in_time: "8" }, now),
      ).toThrow();
      expect(() =>
        exportTimesheetCsv(
          state,
          denied,
          { branch, date: row.date, view: "day" },
          now,
        ),
      ).toThrow();
      expect(JSON.stringify(state)).toBe(snapshot);
    }
    const otherStaff = addTimesheetStaff(
      state,
      actor,
      { branch: other, name_en: "Wren Other", usual_department_key: "cash" },
      now,
    );
    let snapshot = JSON.stringify(state);
    expect(() =>
      patchTimesheetRow(state, actor, row.id, { staff_id: otherStaff.id }, now),
    ).toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(() =>
      addTimesheetRow(
        state,
        actor,
        {
          branch: other,
          date: row.date,
          department_key: "cash",
          staff_id: staff.id,
        },
        now,
      ),
    ).toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
    state.timesheet_staff!.push({
      ...staff,
      id: "foreign-id",
      company_id: "another-company",
    });
    snapshot = JSON.stringify(state);
    expect(() =>
      patchTimesheetRow(state, actor, row.id, { staff_id: "foreign-id" }, now),
    ).toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it("rejects revoked sessions and filters foreign/inconsistent records with copied DTOs", () => {
    const { state, actor, branch, staff, row } = seeded();
    state.timesheet_staff!.push({
      ...staff,
      id: "foreign-staff",
      company_id: "foreign",
      name_en: "Private Foreign Name",
    });
    state.timesheet_rows!.push({
      ...row,
      id: "inconsistent-row",
      branch_id: "forged",
      name_en: "Private Inconsistent",
    });
    const projected = projectTimesheets(state, actor);
    expect(JSON.stringify(projected)).not.toContain("Private Foreign");
    expect(JSON.stringify(projected)).not.toContain("Private Inconsistent");
    projected.timesheet_staff![0].name_en = "Attempted mutation";
    expect(state.timesheet_staff![0].name_en).toBe("Iris Linden");
    expect(JSON.stringify(signedOutReadView(state.config))).not.toContain(
      "Iris Linden",
    );
    const snapshot = structuredClone(authoritySnapshot(state));
    snapshot.people.find((person) => person.id === actor.user_id)!.status =
      "deactivated";
    bindAuthoritySnapshot(state, snapshot);
    expect(() =>
      readTimesheetDay(state, actor, branch, row.date, now),
    ).toThrow();
    expect(() =>
      patchTimesheetRow(state, actor, row.id, { in_time: "10" }, now),
    ).toThrow();
  });
  it("empty-store clears only the current company's staff/day/rows and retains schema", () => {
    const { state, actor, staff, row } = seeded();
    state.timesheet_staff!.push({
      ...staff,
      id: "foreign-staff",
      company_id: "foreign",
    });
    state.timesheet_rows!.push({
      ...row,
      id: "foreign-row",
      company_id: "foreign",
    });
    removeFictionalData(state, actor, now);
    expect(state.timesheet_staff?.map((record) => record.id)).toEqual([
      "foreign-staff",
    ]);
    expect(state.timesheet_rows?.map((record) => record.id)).toEqual([
      "foreign-row",
    ]);
    expect(state.timesheet_days).toEqual([]);
    expect(state.prototype_r2d_timesheet_schema).toBe(1);
  });
});
