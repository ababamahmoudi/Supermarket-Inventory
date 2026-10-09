import { describe, expect, it } from "vitest";
import {
  branchAllowsRole,
  branchId,
  branchLabel,
  saveBranchSettings,
  newBranch,
} from "./settings";
import { initialState } from "./store";

const actor = {
  role: "supervisor" as const,
  company_id: "super-arzon",
  by: "Location Supervisor",
};

describe("configured store and warehouse locations", () => {
  it("permits receiving roles at Warehouse and prevents Cashier access at the domain guard", () => {
    const state = initialState();
    expect(branchAllowsRole(state.config, "Warehouse", "supervisor")).toBe(
      true,
    );
    expect(branchAllowsRole(state.config, "Warehouse", "floor_worker")).toBe(
      true,
    );
    expect(branchAllowsRole(state.config, "Warehouse", "cashier")).toBe(false);
    expect(branchAllowsRole(state.config, "Branch 1", "cashier")).toBe(true);
    expect(branchAllowsRole(state.config, "missing", "supervisor")).toBe(false);
    expect(branchAllowsRole(state.config, "all", "floor_worker")).toBe(false);
  });

  it("allows Supervisor location type changes without changing the ID or deleting invoices", () => {
    const state = initialState();
    const before = structuredClone(state.invoices);
    const location = state.config.branches[0];
    const originalId = branchId(location);
    saveBranchSettings(
      state,
      {
        ...location,
        id: originalId,
        type: "warehouse",
        name_en: "Receiving Depot",
        name_fa: "مرکز دریافت",
      },
      actor,
    );
    expect(branchId(state.config.branches[0])).toBe(originalId);
    expect(branchLabel(state.config, originalId, "en")).toBe("Receiving Depot");
    expect(branchAllowsRole(state.config, originalId, "cashier")).toBe(false);
    expect(state.invoices).toEqual(before);
    expect(state.activity[0]).toMatchObject({
      company_id: actor.company_id,
      entity_type: "settings",
      entity_id: "branches",
      reversible: true,
    });
    saveBranchSettings(
      state,
      { ...state.config.branches[0], type: "store" },
      actor,
    );
    expect(branchAllowsRole(state.config, originalId, "cashier")).toBe(true);
  });

  it("adds a warehouse as configured data and rejects invalid types atomically", () => {
    const state = initialState();
    const location = {
      ...newBranch(state.config),
      name_en: "East Depot",
      name_fa: "انبار شرق",
      type: "warehouse" as const,
    };
    saveBranchSettings(state, location, actor);
    expect(branchAllowsRole(state.config, location.id!, "cashier")).toBe(false);
    expect(branchAllowsRole(state.config, location.id!, "floor_worker")).toBe(
      true,
    );
    const before = structuredClone(state);
    expect(() =>
      saveBranchSettings(
        state,
        { ...location, type: "unsupported" as "store" },
        actor,
      ),
    ).toThrow("branch");
    expect(state).toEqual(before);
  });
});
