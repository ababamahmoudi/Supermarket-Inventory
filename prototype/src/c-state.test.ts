import { beforeEach, describe, expect, it } from "vitest";
import { AUTH_STORAGE_KEY } from "./auth";
import { C1_BACKUP_KEY, hydrateCState, restoreCState } from "./c-state";
import { branchLabel } from "./settings";
import { initialState } from "./store";

function legacyState() {
  const state = initialState();
  delete state.prototype_c1_schema;
  state.config.branches = state.config.branches.filter(
    (branch) => branch.code !== "W1",
  );
  for (const [index, branch] of state.config.branches.entries()) {
    branch.name = `Branch ${index + 1} (PLACEHOLDER - rename in Settings)`;
    branch.name_en = branch.name;
    branch.name_fa = `شعبه ${index + 1}`;
    delete branch.type;
  }
  state.templates = state.templates.filter((template) => !template.built_in);
  return state;
}

beforeEach(() => localStorage.clear());

describe("verified additive C1 migration", () => {
  it("keeps an exact restorable backup and preserves operational records, custom settings and passwords", () => {
    const state = legacyState();
    state.products[0].name_en = "My retained product";
    state.config.company.branding.primary_color = "#0F766E";
    state.config.branches[1].name_en = "My Richmond location";
    state.config.branches[1].name_fa = "شعبه سفارشی من";
    state.config.branches[1].active = false;
    const before = structuredClone(state);
    const passwordRecord = JSON.stringify({ password: "AlreadyChanged2026!" });
    localStorage.setItem(AUTH_STORAGE_KEY, passwordRecord);

    const migrated = restoreCState(state, localStorage);

    expect(JSON.parse(localStorage.getItem(C1_BACKUP_KEY)!)).toEqual(before);
    expect(state).toEqual(before);
    expect(migrated).not.toBe(state);
    expect(migrated.prototype_c1_schema).toBe(1);
    expect(migrated.products[0].name_en).toBe("My retained product");
    expect(migrated.config.company).toEqual(before.config.company);
    expect(migrated.config.branches[1]).toMatchObject({
      id: "Branch 2",
      name_en: "My Richmond location",
      name_fa: "شعبه سفارشی من",
      active: false,
    });
    for (const key of [
      "invoices",
      "invoice",
      "returns",
      "ledger",
      "stock",
      "stock_movements",
      "notes",
      "notebooks",
      "activity",
    ] as const)
      expect(migrated[key], key).toEqual(before[key]);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(passwordRecord);
  });

  it("renames only placeholders, keeps stable location IDs, and adds Warehouse and both templates once", () => {
    const state = legacyState();
    const migrated = hydrateCState(state);
    expect(branchLabel(migrated.config, "Branch 1", "en")).toBe("North York");
    expect(branchLabel(migrated.config, "Branch 2", "en")).toBe(
      "Richmond Hill",
    );
    expect(branchLabel(migrated.config, "Branch 3", "en")).toBe("Newmarket");
    expect(branchLabel(migrated.config, "Branch 1", "fa")).toBe("نورث یورک");
    expect(migrated.config.branches.map((branch) => branch.id)).toEqual([
      "Branch 1",
      "Branch 2",
      "Branch 3",
      "Warehouse",
    ]);
    expect(migrated.config.branches.at(-1)).toMatchObject({
      code: "W1",
      type: "warehouse",
    });
    expect(
      migrated.templates.filter((template) => template.built_in),
    ).toHaveLength(2);
    const snapshot = structuredClone(migrated);
    expect(hydrateCState(migrated)).toBe(migrated);
    expect(migrated).toEqual(snapshot);
  });

  it("cannot import the customer's location names into another company's configuration", () => {
    const state = legacyState();
    state.config.company.seed_key = "other-supermarket";
    const before = structuredClone(state.config);
    hydrateCState(state);
    expect(state.config).toEqual(before);
    expect(state.config.branches.some((branch) => branch.code === "W1")).toBe(
      false,
    );
    expect(
      state.templates.every(
        (template) => template.company_id === "other-supermarket",
      ),
    ).toBe(true);
  });

  it("leaves legacy records unchanged when the backup is unavailable or cannot be verified", () => {
    for (const storage of [
      {
        setItem: () => {
          throw new Error("quota");
        },
        getItem: () => null,
      },
      { setItem: () => undefined, getItem: () => "different bytes" },
    ]) {
      const state = legacyState();
      const before = structuredClone(state);
      expect(restoreCState(state, storage)).toBe(state);
      expect(state).toEqual(before);
    }
  });

  it("does not replace the original backup on subsequent loads", () => {
    const legacy = legacyState();
    const migrated = restoreCState(legacy, localStorage);
    const backup = localStorage.getItem(C1_BACKUP_KEY);
    migrated.products[0].name_en = "Edited after migration";
    expect(restoreCState(migrated, localStorage)).toBe(migrated);
    expect(localStorage.getItem(C1_BACKUP_KEY)).toBe(backup);
    expect(migrated.products[0].name_en).toBe("Edited after migration");
  });
});
