import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "./store";
import { supplierRecords } from "./supplier-editor";
import { configuredBranches } from "./settings";
import { attachReversals, reverseActivity } from "./history";
import { productCostHistory } from "./product-costs";
import {
  costPerCase,
  costPerUnit,
  packUnits,
  resolveSupplierItem,
  saveSupplierItem,
  supplierItemFacts,
  supplierItems,
} from "./supplier-items";
import type { DemoInvoice, DemoState } from "./types";
import type { OperationsContext } from "./operations";

let state: DemoState;
const supplier = "Fresh Valley Foods";
const time = new Date("2026-10-09T18:00:00Z");
const supervisor: OperationsContext = {
  company_id: "super-arzon",
  role: "supervisor",
  branch: "all",
  actor: "Demo Supervisor",
};
beforeEach(() => {
  state = initialState();
  state.invoices = [];
  state.invoice.status = "empty";
  state.stock_movements = [];
  state.invoice_location_corrections = [];
  state.supplier_items = [];
});
function purchase(
  patch: Partial<DemoInvoice> = {},
  line: Partial<DemoInvoice["lines"][number]> = {},
): DemoInvoice {
  return {
    ...structuredClone(state.invoice),
    company_id: supervisor.company_id,
    id: "purchase-1",
    branch: "Branch 1",
    supplier,
    supplier_invoice_number: "F-101",
    status: "posted",
    received_at: "2026-10-09T18:00:00Z",
    receiving_employee: "Demo Floor Worker",
    posted_at: "2026-10-09T18:01:00Z",
    lines: [
      {
        ...structuredClone(state.invoice.lines[0]),
        company_id: supervisor.company_id,
        product_code: "0009",
        supplier_item_code: "SKU-9",
        description: "Fictional product receipt",
        units_per_case: 12,
        qty_invoiced: 36,
        qty_received_at_posting: 36,
        unit_cost_before_tax: "1.6658",
        case_cost_before_tax: "19.99",
        ...line,
      },
    ],
    ...patch,
  };
}
function facts(branch = "all") {
  return supplierItemFacts(state, supervisor.company_id, supplier, branch);
}
function add(code = "HAND-9", quote?: string) {
  return saveSupplierItem(
    state,
    supervisor,
    supplier,
    {
      product_code: "0009",
      supplier_item_code: code,
      units_per_case: 12,
      quoted_unit_cost_before_tax: quote,
    },
    undefined,
    time,
  );
}
const historyContext = () => ({
  ...supervisor,
  username: "supervisor",
  allowed_branches: configuredBranches(state.config, true),
});

describe("Supplier packs and exact costs", () => {
  it("converts integer and fractional cases exactly while unit entry stays units", () => {
    expect(packUnits("3", "cases", 12)).toBe(36);
    expect(packUnits("0.5", "cases", 12)).toBe(6);
    expect(packUnits("0.1", "cases", 10)).toBe(1);
    expect(packUnits(5, "units", 12)).toBe(5);
    expect(() => packUnits("0.5", "cases", 3)).toThrow("quantity");
    expect(() => packUnits("1.5", "units", 12)).toThrow("quantity");
    expect(() => packUnits("0", "cases", 12)).toThrow("quantity");
    expect(() => packUnits("Infinity", "cases", 12)).toThrow("quantity");
    expect(() => packUnits("9007199254740992", "units", 1)).toThrow("quantity");
  });
  it("requires positive safe integer packs and retains four-decimal half-up unit costs", () => {
    for (const pack of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(() => packUnits("1", "cases", pack)).toThrow("pack");
    expect(costPerUnit("19.99", 12)).toBe("1.6658");
    expect(costPerUnit("10.0001", 2)).toBe("5.0001");
    expect(costPerCase("1.6658", 12)).toBe("19.9896");
    expect(() => costPerUnit("1.23456", 1)).toThrow("cost");
    expect(() => costPerCase("-1", 12)).toThrow("cost");
  });
});

describe("Supplier actual purchase facts", () => {
  it("derives once from posted invoices, retaining exact case quotes and no read mutation", () => {
    const posted = purchase();
    state.invoices = [posted];
    state.invoice = structuredClone(posted);
    const before = structuredClone(state);
    expect(facts()).toHaveLength(1);
    expect(facts()[0]).toMatchObject({
      units_per_case: 12,
      last_bought_unit_cost: "1.6658",
      last_bought_case_cost: "19.9900",
      last_bought_units_per_case: 12,
      last_bought_date: "2026-10-09",
      last_invoice_number: "F-101",
      regular_unit_cost: "1.6658",
    });
    expect(facts()[0].history).toHaveLength(1);
    expect(
      resolveSupplierItem(state, supervisor.company_id, supplier, "all", {}),
    ).toBeNull();
    expect(facts()).toEqual(facts());
    expect(state).toEqual(before);
  });
  it("keeps different supplier codes separate and refuses ambiguous product matching", () => {
    state.invoices = [
      purchase(),
      purchase({ id: "purchase-2" }, { supplier_item_code: "SKU-OTHER" }),
    ];
    expect(facts()).toHaveLength(2);
    expect(
      resolveSupplierItem(state, supervisor.company_id, supplier, "all", {
        product_code: "0009",
      }),
    ).toBeNull();
    expect(
      resolveSupplierItem(state, supervisor.company_id, supplier, "all", {
        product_code: "0009",
        supplier_item_code: "SKU-OTHER",
      })?.supplier_item_code,
    ).toBe("SKU-OTHER");
    expect(
      resolveSupplierItem(state, supervisor.company_id, supplier, "all", {
        id: facts()[0].id,
      })?.id,
    ).toBe(facts()[0].id);
  });
  it("shows latest short-dated purchase but preserves the earlier regular cost basis", () => {
    state.invoices = [
      purchase(),
      purchase(
        {
          id: "discount",
          received_at: "2026-10-10T18:00:00Z",
          posted_at: "2026-10-10T18:01:00Z",
        },
        {
          short_dated: true,
          unit_cost_before_tax: "0.7500",
          case_cost_before_tax: "9.00",
        },
      ),
    ];
    const item = facts()[0];
    expect(item.last_bought_unit_cost).toBe("0.7500");
    expect(item.last_bought_case_cost).toBe("9.0000");
    expect(item.regular_unit_cost).toBe("1.6658");
    expect(item.history.map((record) => record.short_dated)).toEqual([
      true,
      false,
    ]);
  });
  it("omits fully refused lines and records only accepted portions in history and catalog costs", () => {
    state.invoices = [
      purchase({}, { refused_units: 36 }),
      purchase({ id: "partial" }, { refused_units: 12 }),
    ];
    expect(facts()).toHaveLength(1);
    expect(facts()[0].history).toHaveLength(1);
    expect(facts()[0].history[0].received_units).toBe(24);
    const product = state.products.find((record) => record.code === "0009")!;
    expect(
      productCostHistory(state, supervisor, product).map(
        (record) => record.invoice_id,
      ),
    ).toEqual(["partial"]);
  });
  it("retains company associations at an unreceived Warehouse without exposing other location history", () => {
    state.invoices = [purchase()];
    expect(facts("Warehouse")[0]).toMatchObject({
      units_per_case: 12,
      last_bought_unit_cost: null,
      last_bought_date: null,
      last_invoice_number: null,
      history: [],
    });
    expect(facts("Branch 1")[0].history).toHaveLength(1);
  });
  it("moves history scope through append-only invoice corrections without rewriting posted origin", () => {
    const invoice = purchase();
    state.invoices = [invoice];
    state.invoice_location_corrections = [
      {
        id: "correction",
        company_id: supervisor.company_id,
        invoice_id: invoice.id,
        from_branch: "Branch 1",
        to_branch: "Warehouse",
        reason: "Correct receipt location",
        by: supervisor.actor,
        at: time.toISOString(),
        outstanding_amount: "0.00",
        currency: "CAD",
        allocations: [],
        receipt_ids: [],
        approval_ids: [],
        ledger_out_id: "out",
        ledger_in_id: "in",
      },
    ];
    expect(facts("Branch 1")[0].history).toEqual([]);
    expect(facts("Warehouse")[0].history[0]).toMatchObject({
      original_branch: "Branch 1",
      branch: "Warehouse",
    });
    expect(invoice.branch).toBe("Branch 1");
  });
  it("uses actual later-short receipt date and actor, not an order or quote date", () => {
    state.invoices = [
      purchase({}, { qty_received_at_posting: 24, qty_later_received: 12 }),
    ];
    state.stock_movements = [
      {
        id: "purchase-1:delivery:later",
        company_id: supervisor.company_id,
        invoice_id: "purchase-1",
        line_index: 0,
        product_code: "0009",
        branch: "Branch 1",
        type: "short_resolved_received",
        qty: 12,
        reference: "Short delivery",
        by: "Demo Supervisor",
        at: "2026-10-12T18:00:00Z",
      },
    ];
    expect(facts()[0]).toMatchObject({ last_bought_date: "2026-10-12" });
    expect(facts()[0].history[0]).toMatchObject({
      received_units: 36,
      by: "Demo Supervisor",
    });
  });
  it("honours supplier aliases and ignores drafts, foreign invoice lines and companies", () => {
    const record = supplierRecords(state).find(
      (item) => item.name === supplier,
    )!;
    state.suppliers = supplierRecords(state).map((item) =>
      item.id === record.id
        ? { ...item, name: "Fresh Valley Renamed", previous_names: [supplier] }
        : item,
    );
    state.invoices = [
      purchase(),
      purchase({ id: "foreign", company_id: "other-company" }),
      purchase({ id: "draft", status: "review" }),
      purchase({ id: "foreign-line" }, { company_id: "other-company" }),
    ];
    const renamed = supplierItemFacts(
      state,
      supervisor.company_id,
      "Fresh Valley Renamed",
      "all",
    );
    expect(renamed).toHaveLength(1);
    expect(renamed[0].supplier_name).toBe("Fresh Valley Renamed");
    expect(renamed[0].history[0].supplier).toBe(supplier);
    expect(() =>
      supplierItemFacts(state, "other-company", supplier, "all"),
    ).toThrow("scope");
  });
  it("keeps supplier identities separate even when edited metadata carries another supplier's name", () => {
    const item = add();
    state.supplier_items!.push({
      ...structuredClone(item),
      id: "wrong-supplier",
      supplier_id: "another-supplier",
      quoted_unit_cost_before_tax: "99.0000",
    });
    state.invoices = [
      purchase(),
      purchase(
        {
          id: "other-supplier-purchase",
          supplier: "Golden Grain Distributors",
        },
        { unit_cost_before_tax: "99.0000", case_cost_before_tax: "1188.00" },
      ),
    ];
    expect(facts()).toHaveLength(2);
    expect(facts().some((record) => record.id === "wrong-supplier")).toBe(
      false,
    );
    expect(
      facts().find((record) => record.history.length)?.last_bought_unit_cost,
    ).toBe("1.6658");
  });
});

describe("Supplier item maintenance and permission boundaries", () => {
  it("adds a hand-entered quote without invented purchase prices, dates, invoices or movements", () => {
    const item = add("HAND", "3.55");
    expect(item).toMatchObject({
      quoted_unit_cost_before_tax: "3.5500",
      quoted_by: supervisor.actor,
      quoted_at: time.toISOString(),
    });
    expect(facts()[0]).toMatchObject({
      last_bought_unit_cost: null,
      last_bought_case_cost: null,
      last_bought_date: null,
      last_invoice_number: null,
      history: [],
    });
    expect(state.stock_movements).toEqual([]);
    expect(state.activity.at(-1)?.action).toBe("Add supplier item");
  });
  it("keeps historical pack/cost snapshots after current pack, SKU and product association edits", () => {
    const invoice = purchase();
    state.invoices = [invoice];
    const original = structuredClone(invoice);
    const id = facts()[0].id;
    saveSupplierItem(
      state,
      supervisor,
      supplier,
      {
        product_code: "0004",
        supplier_item_code: "NEW-SKU",
        units_per_case: 6,
      },
      id,
      time,
    );
    expect(facts()).toHaveLength(1);
    expect(facts()[0]).toMatchObject({
      id,
      product_code: "0004",
      supplier_item_code: "NEW-SKU",
      units_per_case: 6,
      last_bought_units_per_case: 12,
      last_bought_case_cost: "19.9900",
    });
    expect(facts()[0].history[0]).toMatchObject({
      product_code: "0009",
      supplier_item_code: "SKU-9",
      units_per_case: 12,
    });
    expect(invoice).toEqual(original);
  });
  it("honours an explicit item ID before old SKU aliases when a code is used by a new item", () => {
    state.invoices = [purchase()];
    const first = facts()[0].id;
    saveSupplierItem(
      state,
      supervisor,
      supplier,
      {
        product_code: "0009",
        supplier_item_code: "REVISED",
        units_per_case: 12,
      },
      first,
      time,
    );
    const second = add("SKU-9");
    state.invoices.push(
      purchase({ id: "new-binding" }, { supplier_item_id: second.id }),
    );
    expect(
      facts()
        .find((record) => record.id === first)
        ?.history.map((record) => record.invoice_id),
    ).toEqual(["purchase-1"]);
    expect(
      facts()
        .find((record) => record.id === second.id)
        ?.history.map((record) => record.invoice_id),
    ).toEqual(["new-binding"]);
  });
  it("rejects worker/cashier mutations and returns no financial or history keys for workers", () => {
    state.invoices = [purchase()];
    add("HAND", "3.55");
    const worker = {
      ...supervisor,
      role: "floor_worker" as const,
      branch: "Branch 1",
    };
    const visible = supplierItems(state, worker, supplier);
    expect(visible).toHaveLength(2);
    expect(JSON.stringify(visible)).not.toMatch(
      /financial|cost|history|quoted|regular_unit/,
    );
    expect(() =>
      supplierItems(state, { ...worker, branch: "all" }, supplier),
    ).toThrow("scope");
    expect(() =>
      supplierItems(state, { ...worker, role: "cashier" }, supplier),
    ).toThrow("permission");
    const before = structuredClone(state);
    expect(() =>
      saveSupplierItem(state, worker, supplier, {
        product_code: "0009",
        supplier_item_code: "W",
        units_per_case: 12,
      }),
    ).toThrow("permission");
    expect(state).toEqual(before);
  });
  it("rejects invalid metadata, ambiguous duplicate associations and foreign product references", () => {
    add();
    const edits = {
      product_code: "0009",
      supplier_item_code: "OTHER",
      units_per_case: 12,
    };
    for (const patch of [{ units_per_case: 0 }, { units_per_case: 1.5 }])
      expect(() =>
        saveSupplierItem(state, supervisor, supplier, { ...edits, ...patch }),
      ).toThrow("pack");
    expect(() => add()).toThrow("duplicate");
    expect(() => add("INVALID", "3.12345")).toThrow("cost");
    expect(() =>
      saveSupplierItem(state, supervisor, supplier, {
        ...edits,
        product_code: "FOREIGN",
      }),
    ).toThrow("product");
    expect(() =>
      saveSupplierItem(state, supervisor, "Corner Spice Co.", edits),
    ).toThrow("supplier");
  });
  it("archives an unused manual creation on Revert, retaining the record and audit trail", () => {
    const before = structuredClone(state);
    const item = add();
    attachReversals(before, state, historyContext());
    const activity = state.activity.at(-1)!;
    reverseActivity(state, historyContext(), activity.id, "revert", time);
    expect(
      state.supplier_items?.find((record) => record.id === item.id)?.archived,
    ).toBe(true);
    expect(facts()).toEqual([]);
    expect(state.activity).toContainEqual(
      expect.objectContaining({ id: activity.id }),
    );
  });
  it("rejects creation Revert after an invoice references it with no partial mutation", () => {
    const before = structuredClone(state);
    const item = add();
    attachReversals(before, state, historyContext());
    const activity = state.activity.at(-1)!;
    state.invoices = [purchase({}, { supplier_item_id: item.id })];
    const snapshot = structuredClone(state);
    expect(() =>
      reverseActivity(state, historyContext(), activity.id, "revert", time),
    ).toThrow("conflict");
    expect(state).toEqual(snapshot);
  });
  it("rejects a stale metadata Revert after another edit without losing either audit record", () => {
    const item = add();
    const before = structuredClone(state);
    saveSupplierItem(
      state,
      supervisor,
      supplier,
      {
        product_code: "0009",
        supplier_item_code: "CHANGED",
        units_per_case: 6,
      },
      item.id,
      time,
    );
    attachReversals(before, state, historyContext());
    const activity = state.activity.at(-1)!;
    saveSupplierItem(
      state,
      supervisor,
      supplier,
      {
        product_code: "0009",
        supplier_item_code: "LATER",
        units_per_case: 3,
      },
      item.id,
      new Date("2026-10-10T18:00:00Z"),
    );
    const snapshot = structuredClone(state);
    expect(() =>
      reverseActivity(state, historyContext(), activity.id, "revert", time),
    ).toThrow("conflict");
    expect(state).toEqual(snapshot);
    expect(state.activity).toContainEqual(
      expect.objectContaining({ id: activity.id }),
    );
  });
  it("reverts the first automatic-item metadata edit by restoring invoice-derived facts", () => {
    state.invoices = [purchase()];
    const id = facts()[0].id;
    const before = structuredClone(state);
    saveSupplierItem(
      state,
      supervisor,
      supplier,
      {
        product_code: "0009",
        supplier_item_code: "SKU-9",
        units_per_case: 6,
        quoted_unit_cost_before_tax: "4",
      },
      id,
      time,
    );
    attachReversals(before, state, historyContext());
    reverseActivity(
      state,
      historyContext(),
      state.activity.at(-1)!.id,
      "revert",
      time,
    );
    expect(facts()[0]).toMatchObject({
      id,
      units_per_case: 12,
      last_bought_case_cost: "19.9900",
    });
    expect(facts()[0].quoted_unit_cost_before_tax).toBeUndefined();
    expect(state.supplier_items).toHaveLength(1);
  });
});
