import { beforeEach, describe, expect, it } from "vitest";
import { AUTH_STORAGE_KEY, SESSION_KEY } from "./auth";
import { C2_BACKUP_KEY, hydrateC2State, restoreC2State } from "./c2-state";
import { initialState } from "./store";
import type { SupplierItemDefinition } from "./supplier-items";

function savedC1State() {
  const state = initialState();
  delete state.prototype_c2_schema;
  delete state.config.orders;
  delete state.supplier_items;
  delete state.orders;
  delete state.branch_requests;
  delete state.request_transfer_events;
  return state;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("verified C2 migration without invented business records", () => {
  it("backs up the exact C1 demo before cloning and adds empty collections with Orders restricted to Supervisors", () => {
    const state = savedC1State();
    const original = structuredClone(state);
    const migrated = restoreC2State(state, localStorage);
    expect(localStorage.getItem(C2_BACKUP_KEY)).toBe(JSON.stringify(original));
    expect(JSON.parse(localStorage.getItem(C2_BACKUP_KEY)!)).toEqual(original);
    expect(state).toEqual(original);
    expect(migrated).not.toBe(state);
    expect(migrated.prototype_c2_schema).toBe(1);
    expect(migrated.config.orders).toEqual({ allow_floor_worker: false });
    for (const key of [
      "supplier_items",
      "orders",
      "branch_requests",
      "request_transfer_events",
    ] as const)
      expect(migrated[key], key).toEqual([]);
    for (const key of [
      "products",
      "invoices",
      "invoice",
      "returns",
      "ledger",
      "stock",
      "stock_movements",
      "expiry",
      "notes",
      "notebooks",
      "activity",
      "templates",
      "invoice_location_corrections",
    ] as const)
      expect(migrated[key], key).toEqual(original[key]);
  });

  it("preserves chosen role permissions, passwords, sessions, manual prices and edited company/location settings", () => {
    const state = savedC1State();
    state.config.orders = { allow_floor_worker: true };
    state.config.branches[0].name_en = "My retained store name";
    state.config.branches[0].name_fa = "نام حفظ‌شدهٔ فروشگاه من";
    state.config.branches[0].active = false;
    state.config.company.branding.primary_color = "#0F766E";
    state.config.pricing_categories[0].cost_divisor = "0.72";
    state.products[0].manual_prices = {
      all: {
        price: "1.29",
        rule_price: "1.49",
        set_at: "2026-10-08T12:00:00Z",
        set_by: "My Supervisor",
      },
    };
    state.products[0].selling_price = "1.29";
    const before = structuredClone(state);
    const savedPassword = JSON.stringify({
      accounts: {
        newemployee: {
          password: "RetainedPassword2026!",
          mustChangePassword: false,
        },
      },
    });
    const savedSession = JSON.stringify({
      username: "supervisor",
      branch: "Warehouse",
      lang: "fa",
      locked: true,
      authenticatedAt: Date.now(),
    });
    localStorage.setItem(AUTH_STORAGE_KEY, savedPassword);
    sessionStorage.setItem(SESSION_KEY, savedSession);
    const migrated = restoreC2State(state, localStorage);
    expect(migrated.config).toEqual(before.config);
    expect(migrated.products).toEqual(before.products);
    expect(migrated.activity).toEqual(before.activity);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(savedPassword);
    expect(sessionStorage.getItem(SESSION_KEY)).toBe(savedSession);
  });

  it("retains existing associations and foreign-company evidence without importing the customer's names or prices", () => {
    const state = savedC1State();
    state.config.company.seed_key = "independent-market";
    state.config.company.name_en = "Independent Market";
    const item: SupplierItemDefinition = {
      id: "foreign-item",
      company_id: "foreign-market",
      supplier_id: "foreign-supplier",
      supplier_name: "Foreign supplier",
      product_code: "FOREIGN",
      supplier_item_code: "PACK-12",
      units_per_case: 12,
      created_at: "2026-10-08T12:00:00Z",
      created_by: "Foreign Supervisor",
      archived: true,
    };
    state.supplier_items = [item];
    state.invoices!.push({
      ...structuredClone(state.invoices![0]),
      id: "foreign-invoice",
      company_id: "foreign-market",
    });
    const before = structuredClone(state);
    hydrateC2State(state);
    expect(state.supplier_items).toEqual(before.supplier_items);
    expect(state.invoices).toEqual(before.invoices);
    expect(state.config.company).toEqual(before.config.company);
    expect(state.config.branches).toEqual(before.config.branches);
    expect(state.products).toEqual(before.products);
  });

  it("is idempotent and does not overwrite the original verified backup after subsequent edits", () => {
    const original = savedC1State();
    const migrated = restoreC2State(original, localStorage);
    const backup = localStorage.getItem(C2_BACKUP_KEY);
    const collections = [
      migrated.supplier_items,
      migrated.orders,
      migrated.branch_requests,
      migrated.request_transfer_events,
    ];
    migrated.config.orders!.allow_floor_worker = true;
    migrated.products[0].name_en = "Edited after C2 migration";
    const before = structuredClone(migrated);
    expect(hydrateC2State(migrated)).toBe(migrated);
    expect(restoreC2State(migrated, localStorage)).toBe(migrated);
    expect(migrated).toEqual(before);
    expect([
      migrated.supplier_items,
      migrated.orders,
      migrated.branch_requests,
      migrated.request_transfer_events,
    ]).toEqual(collections);
    expect(localStorage.getItem(C2_BACKUP_KEY)).toBe(backup);
  });

  it("does not publish a partial migration when backup writes or read verification fail", () => {
    for (const storage of [
      {
        setItem: () => {
          throw new Error("quota");
        },
        getItem: () => null,
      },
      { setItem: () => undefined, getItem: () => "different bytes" },
      {
        setItem: () => undefined,
        getItem: () => {
          throw new Error("storage unavailable");
        },
      },
    ]) {
      const state = savedC1State();
      const before = structuredClone(state);
      expect(restoreC2State(state, storage)).toBe(state);
      expect(state).toEqual(before);
      expect(state.prototype_c2_schema).toBeUndefined();
    }
  });
});
