import { describe, expect, it } from "vitest";
import { initialState } from "./notes-dates-fixture.e1";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  configuredTimesheetDepartments,
  saveTimesheetSettings,
} from "./timesheet-settings";
import { configSeed } from "./config";
import type { TimesheetSettings } from "./timesheet-types";

describe("R2d configurable timesheet departments", () => {
  it("seeds the eight bilingual departments in paper order", () => {
    expect(configSeed.modules.timesheets).toBe(true);
    const departments = configuredTimesheetDepartments(configSeed);
    expect(departments.map((row) => row.name_en)).toEqual([
      "Bakery",
      "Cash",
      "Kitchen",
      "Kebab",
      "Pastry",
      "Buffet",
      "Floor",
      "Butchery",
    ]);
    expect(departments.every((row) => row.name_fa && row.key)).toBe(true);
    departments[0].name_en = "Mutation";
    expect(configSeed.timesheets.departments[0].name_en).toBe("Bakery");
  });
  it("saves another supermarket's departments with identity, before/after and no business side effects", () => {
    const state = initialState();
    state.config.modules.timesheets = false;
    const actor = authenticatedTestActor(state, "manager");
    const before = structuredClone(state.config.timesheets);
    const financial = JSON.stringify([
      state.products,
      state.ledger,
      state.stock,
      state.invoice,
    ]);
    const departments = [
      {
        key: "packing",
        name_en: " Packing ",
        name_fa: " بسته‌بندی ",
        order: 3,
      },
      { key: "service", name_en: "Service", name_fa: "خدمات", order: 0 },
    ];
    saveTimesheetSettings(state, actor, { departments });
    expect(
      configuredTimesheetDepartments(state.config).map((row) => row.key),
    ).toEqual(["service", "packing"]);
    expect(state.config.timesheets?.departments[0].name_en).toBe("Packing");
    expect(state.activity.at(-1)).toMatchObject({
      actor_user_id: actor.user_id,
      entity_id: "timesheets",
      before,
      after: state.config.timesheets,
    });
    expect(
      JSON.stringify([
        state.products,
        state.ledger,
        state.stock,
        state.invoice,
      ]),
    ).toBe(financial);
    const count = state.activity.length;
    saveTimesheetSettings(state, actor, state.config.timesheets!);
    expect(state.activity).toHaveLength(count);
  });
  it("rejects malformed or duplicate departments and non-management settings writes", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager");
    for (const departments of [
      [{ key: "x", name_en: "", name_fa: "ایکس", order: 0 }],
      [{ key: "x", name_en: "X", name_fa: "ایکس", order: -1 }],
      [
        { key: "x", name_en: "X", name_fa: "ایکس", order: 0 },
        { key: "x", name_en: "Y", name_fa: "وای", order: 1 },
      ],
      null,
    ]) {
      const snapshot = JSON.stringify(state);
      expect(() =>
        saveTimesheetSettings(state, actor, {
          departments,
        } as TimesheetSettings),
      ).toThrow();
      expect(JSON.stringify(state)).toBe(snapshot);
    }
    const cashier = authenticatedTestActor(state, "cashier");
    expect(() =>
      saveTimesheetSettings(state, cashier, { departments: [] }),
    ).toThrow();
  });
});
