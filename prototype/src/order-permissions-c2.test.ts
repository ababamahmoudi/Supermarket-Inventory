import { describe, expect, it } from "vitest";
import { saveOrderSettings } from "./settings";
import { initialState } from "./store";
import type { AuthenticatedActor } from "./authority-types";
import { authenticatedTestActor } from "./authority-test-fixture";

const actors = new WeakMap<
  ReturnType<typeof initialState>,
  AuthenticatedActor
>();
function manager(state: ReturnType<typeof initialState>) {
  let actor = actors.get(state);
  if (!actor) {
    actor = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
      name_en: "Permissions Manager",
    });
    actors.set(state, actor);
  }
  return actor;
}

describe("explicit company permission for Floor Worker Orders", () => {
  it("audits an explicit opt-in without changing purchases, prices or operational records, and avoids duplicate history on repeat saves", () => {
    const state = initialState();
    const before = structuredClone(state);
    saveOrderSettings(state, { allow_floor_worker: true }, manager(state));
    expect(state.config.orders).toEqual({ allow_floor_worker: true });
    expect(state.activity[0]).toMatchObject({
      company_id: manager(state).company_id,
      by: manager(state).actor,
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
    saveOrderSettings(state, { allow_floor_worker: true }, manager(state));
    expect(state).toEqual(optedIn);
    saveOrderSettings(state, { allow_floor_worker: false }, manager(state));
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
            authenticatedTestActor(state, role, { locations: ["Branch 1"] }),
          ),
        ).toThrow("permission");
        expect(state).toEqual(before);
      }
    },
  );

  it("rejects a Manager from another company before creating a permission setting or audit entry", () => {
    const state = initialState();
    delete state.config.orders;
    const before = structuredClone(state);
    const foreign = initialState();
    foreign.config.company.seed_key = "foreign-company";
    expect(() =>
      saveOrderSettings(
        state,
        { allow_floor_worker: true },
        authenticatedTestActor(foreign, "manager", { locations: ["Branch 1"] }),
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
          manager(state),
        ),
      ).toThrow("mapping");
      expect(state).toEqual(before);
    }
  });
});
