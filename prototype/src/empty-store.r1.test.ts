import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { authoritySnapshot } from "./authority";
import { authenticatedTestActor } from "./authority-test-fixture";
import { removeFictionalData } from "./empty-store";
import type { DemoState } from "./types";

const removedLists = [
  "products",
  "suppliers",
  "supplier_items",
  "invoices",
  "approvals",
  "alerts",
  "offers",
  "offer_store_suppressions",
  "sales",
  "sale_requests",
  "sale_events",
  "sale_delivery_holds",
  "returns",
  "orders",
  "branch_requests",
  "request_transfer_events",
  "ledger",
  "notes",
  "notebook_entries",
  "expiry",
  "receipt_lots",
  "stock_movements",
  "invoice_content_corrections",
  "invoice_location_corrections",
  "price_update_tasks",
  "price_task_prints",
  "notifications",
  "label_waitlist",
] as const satisfies readonly (keyof DemoState)[];

describe("R1 explicit empty store", () => {
  it.each(["owner", "manager"] as const)(
    "%s preserves settings and sign-in and clears all business collections",
    (role) => {
      const state = initialState();
      const actor = authenticatedTestActor(state, role);
      // Populate every collection, including newer optional records, to ensure a
      // forgotten collection cannot silently pass because its seed happens empty.
      for (const key of removedLists) {
        const rows = state[key] as
          { company_id: string; id: string }[] | undefined;
        Object.assign(state, {
          [key]: [
            ...(rows ?? []),
            { company_id: actor.company_id, id: `clear-${key}` },
          ],
        });
      }
      const keep = structuredClone({
        config: state.config,
        templates: state.templates,
        label_settings: state.label_settings,
        notebooks: state.notebooks,
        product_code_high_water: state.product_code_high_water,
        authority: authoritySnapshot(state),
      });
      const now = new Date("2026-10-21T17:00:00Z");
      removeFictionalData(state, actor, now);
      for (const key of removedLists) expect(state[key], key).toEqual([]);
      expect(state.stock).toEqual({});
      expect(state.price_update_baseline).toEqual({});
      expect(state.sale_label_effects).toEqual([]);
      expect(state.invoice).toMatchObject({
        status: "empty",
        supplier: "",
        supplier_invoice_number: "",
        lines: [],
        short_lines: [],
        final_total: "0.00",
      });
      expect(state.invoice).not.toHaveProperty("file_data");
      expect({
        config: state.config,
        templates: state.templates,
        label_settings: state.label_settings,
        notebooks: state.notebooks,
        product_code_high_water: state.product_code_high_water,
        authority: authoritySnapshot(state),
      }).toEqual(keep);
      expect(state.activity).toHaveLength(1);
      expect(state.activity[0]).toMatchObject({
        action: "Removed fictional data",
        actor_user_id: actor.user_id,
        at: now.toISOString(),
        reversible: false,
      });
      expect(state.demo_fixture_schema).toBe(2);
    },
  );

  it.each(["cashier", "floor_worker", "branch_supervisor"] as const)(
    "denies %s without changing any business record",
    (role) => {
      const state = initialState();
      const actor = authenticatedTestActor(state, role);
      const before = structuredClone(state);
      expect(() => removeFictionalData(state, actor)).toThrow();
      expect(state).toEqual(before);
    },
  );

  it("keeps another company's records and History", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "owner");
    const foreignProduct = {
      ...state.products[0],
      company_id: "other-company",
    };
    const foreignHistory = {
      ...state.activity[0],
      id: "foreign-history",
      company_id: "other-company",
    };
    state.products.push(foreignProduct);
    state.activity.push(foreignHistory);
    removeFictionalData(state, actor);
    expect(state.products).toEqual([foreignProduct]);
    expect(state.activity).toContainEqual(foreignHistory);
    expect(state.activity).toHaveLength(2);
  });

  it("does not affect a fresh full fictional demo", () => {
    const state = initialState();
    removeFictionalData(state, authenticatedTestActor(state, "owner"));
    const restored = initialState();
    expect(restored.products.length).toBeGreaterThan(0);
    expect(restored.suppliers?.length).toBeGreaterThan(0);
    expect(restored.invoice.lines.length).toBeGreaterThan(0);
  });
});
