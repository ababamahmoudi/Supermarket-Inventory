import { describe, expect, it } from "vitest";
import { saveOrderSettings } from "./settings";
import { initialState } from "./store";

const supervisor = {
  role: "supervisor" as const,
  company_id: "super-arzon",
  by: "Permissions Supervisor",
};

describe("explicit company permission for Floor Worker Orders", () => {
  it("audits an explicit opt-in without changing purchases, prices or operational records, and avoids duplicate history on repeat saves", () => {
    const state = initialState();
    const before = structuredClone(state);
    saveOrderSettings(state, { allow_floor_worker: true }, supervisor);
    expect(state.config.orders).toEqual({ allow_floor_worker: true });
    expect(state.activity[0]).toMatchObject({
      company_id: supervisor.company_id,
      by: supervisor.by,
      branch: "all",
      reversible: true,
      entity_type: "settings",
      entity_id: "orders",
      before: { allow_floor_worker: false },
      after: { allow_floor_worker: true },
    });
    for (const key of [
      "products",
      "orders",
      "branch_requests",
      "supplier_items",
      "invoices",
      "ledger",
      "stock_movements",
      "notes",
    ] as const)
      expect(state[key], key).toEqual(before[key]);
    const optedIn = structuredClone(state);
    saveOrderSettings(state, { allow_floor_worker: true }, supervisor);
    expect(state).toEqual(optedIn);
    saveOrderSettings(state, { allow_floor_worker: false }, supervisor);
    expect(state.config.orders).toEqual({ allow_floor_worker: false });
    expect(state.activity[0]).toMatchObject({
      before: { allow_floor_worker: true },
      after: { allow_floor_worker: false },
    });
  });

  it.each(["floor_worker", "cashier"] as const)(
    "prevents %s from granting or removing their own Orders permission",
    (role) => {
      for (const initialPermission of [false, true]) {
        const state = initialState();
        state.config.orders = { allow_floor_worker: initialPermission };
        const before = structuredClone(state);
        expect(() =>
          saveOrderSettings(
            state,
            { allow_floor_worker: !initialPermission },
            { ...supervisor, role },
          ),
        ).toThrow("permission");
        expect(state).toEqual(before);
      }
    },
  );

  it("rejects a Supervisor from another company before creating a permission setting or audit entry", () => {
    const state = initialState();
    delete state.config.orders;
    const before = structuredClone(state);
    expect(() =>
      saveOrderSettings(
        state,
        { allow_floor_worker: true },
        { ...supervisor, company_id: "foreign-company" },
      ),
    ).toThrow("company");
    expect(state).toEqual(before);
  });

  it("rejects values that could accidentally grant permission through string truthiness", () => {
    for (const value of ["false", "true", null, undefined, 0, 1]) {
      const state = initialState();
      const before = structuredClone(state);
      expect(() =>
        saveOrderSettings(
          state,
          { allow_floor_worker: value as unknown as boolean },
          supervisor,
        ),
      ).toThrow("mapping");
      expect(state).toEqual(before);
    }
  });
});
