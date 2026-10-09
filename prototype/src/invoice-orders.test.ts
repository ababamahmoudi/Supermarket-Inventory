import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  addManualLine,
  createInvoice,
  invoiceBlockers,
  postInvoice,
  recalculateInvoice,
  rememberInvoiceSupplierItem,
  receiveShort,
  refusedTotals,
  setInvoiceLineQuantity,
  shortTotals,
} from "./invoice";
import {
  compatibleInvoiceOrders,
  currentInvoiceOrderComparison,
  invoiceOrderIssues,
  setInvoiceExtraDecision,
  setInvoiceOrder,
} from "./invoice-orders";
import { supplierRecords } from "./supplier-editor";
import { costPerUnit, saveSupplierItem } from "./supplier-items";
import { receivedLog, setInvoiceLocation } from "./received";
import { setManualPriceMarker } from "./manual-prices";
import type { DemoState, InvoiceLine } from "./types";
import type { Order, OrderLine } from "./orders";

function draft(): DemoState {
  const state = initialState();
  state.invoice = createInvoice(state, "Branch 1", true);
  state.invoice.supplier = "Fresh Valley Foods";
  state.invoice.supplier_confirmed = true;
  state.invoice.supplier_invoice_number = "FICTIONAL-C2-100";
  state.invoice.file_name = "fictional-original.png";
  state.invoice.file_data = "data:image/png;base64,ZGVtbw==";
  addManualLine(state, "0002");
  state.invoice.lines[0].unit_cost_before_tax = "0.9800";
  setInvoiceLineQuantity(state.invoice.lines[0], "12", "units", 12);
  recalculateInvoice(state.invoice, state.config);
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Fictional previous label unavailable.",
  };
  return state;
}
function confirm(state: DemoState) {
  for (const line of state.invoice.lines) {
    if (!line.short_dated) line.date_tracking = false;
    line.review_confirmed = true;
    line.date_confirmed = true;
  }
}
function orderLine(
  state: DemoState,
  patch: Partial<OrderLine> = {},
): OrderLine {
  const line = state.invoice.lines[0];
  const product = state.products.find(
    (item) => item.code === line.product_code,
  )!;
  return {
    id: "order-line-1",
    company_id: state.invoice.company_id,
    supplier_item_id: line.supplier_item_id ?? "supplier-item-1",
    product_code: line.product_code,
    supplier_item_code: line.supplier_item_code ?? "",
    name_en: product.name_en,
    name_fa: product.name_fa,
    unit_size: product.unit_size,
    units_per_case: 12,
    ordered_cases: "1",
    ordered_units: 12,
    expected_unit_cost: "0.9800",
    expected_case_cost: "11.7600",
    expected_line_total: "11.76",
    expected_cost_source: "entered",
    received_units: 0,
    cancelled_units: 0,
    source_note_ids: [],
    ...patch,
  };
}
function addOrder(
  state: DemoState,
  lines = [orderLine(state)],
  patch: Partial<Order> = {},
): Order {
  const supplier = supplierRecords(state).find(
    (item) => item.name === state.invoice.supplier,
  )!;
  const order: Order = {
    id: "order-1",
    company_id: state.invoice.company_id,
    branch: state.invoice.branch,
    supplier: supplier.name,
    supplier_id: supplier.id,
    reference: "ORD-FICTIONAL-1",
    date: state.invoice.invoice_date!,
    currency: state.config.company.currency,
    status: "ordered",
    created_at: state.invoice.received_at!,
    created_by: "Ali",
    expected_total_before_tax: "11.76",
    source_note_ids: [],
    linked_invoice_ids: [],
    version: 2,
    lines,
    receipts: [],
    ...patch,
  };
  state.orders = [order];
  return order;
}
function link(state: DemoState) {
  setInvoiceOrder(state, "supervisor", "Branch 1", "order-1");
}
function postingEntries(state: DemoState) {
  return state.ledger.filter((row) => row.invoice_id === state.invoice.id);
}
const receipts = (state: DemoState) =>
  receivedLog(state, {
    company_id: state.invoice.company_id,
    role: "supervisor",
    branch: "all",
    actor: "Ali",
  }).filter((row) => row.invoice_id === state.invoice.id);

describe("invoice pack snapshots and payable precision", () => {
  it("remembers a unique uploaded supplier item's pack without changing parsed quantities, costs or explicit metadata", () => {
    const state = initialState();
    state.invoice.status = "empty";
    state.invoices = [];
    state.supplier_items = [];
    const original = createInvoice(state, "Branch 1");
    const parsed = original.lines.find((line) => line.product_code === "0002")!;
    const item = saveSupplierItem(
      state,
      {
        company_id: original.company_id,
        role: "supervisor",
        branch: "all",
        actor: "Ali",
      },
      original.supplier,
      {
        product_code: "0002",
        supplier_item_code: "UPLOAD-PACK-12",
        units_per_case: 12,
      },
    );
    const uploaded = createInvoice(state, "Branch 1");
    const remembered = uploaded.lines.find(
      (line) => line.product_code === "0002",
    )!;
    expect(remembered).toEqual({
      ...parsed,
      supplier_item_id: item.id,
      supplier_item_code: "UPLOAD-PACK-12",
      units_per_case: 12,
    });
    const explicit = {
      ...parsed,
      supplier_item_code: "UPLOAD-PACK-12",
      units_per_case: 6,
    };
    expect(rememberInvoiceSupplierItem(state, uploaded, explicit)).toEqual({
      ...explicit,
      supplier_item_id: item.id,
    });
    const differentSku = {
      ...parsed,
      supplier_item_code: "PARSED-DIFFERENT-SKU",
      units_per_case: 24,
    };
    expect(rememberInvoiceSupplierItem(state, uploaded, differentSku)).toEqual(
      differentSku,
    );
  });
  it("declines ambiguous uploaded SKU packs and never borrows another company or supplier's pack", () => {
    const state = initialState();
    state.invoice.status = "empty";
    state.invoices = [];
    state.supplier_items = [];
    const original = createInvoice(state, "Branch 1");
    const parsed = original.lines.find((line) => line.product_code === "0002")!;
    const context = {
      company_id: original.company_id,
      role: "supervisor" as const,
      branch: "all",
      actor: "Ali",
    };
    const first = saveSupplierItem(state, context, original.supplier, {
      product_code: "0002",
      supplier_item_code: "UPLOAD-6",
      units_per_case: 6,
    });
    saveSupplierItem(state, context, original.supplier, {
      product_code: "0002",
      supplier_item_code: "UPLOAD-12",
      units_per_case: 12,
    });
    expect(
      createInvoice(state, "Branch 1").lines.find(
        (line) => line.product_code === "0002",
      ),
    ).toEqual(parsed);
    state.supplier_items = [
      { ...first, company_id: "another-company", units_per_case: 48 },
    ];
    expect(
      createInvoice(state, "Branch 1").lines.find(
        (line) => line.product_code === "0002",
      ),
    ).toEqual(parsed);
    const otherSupplier = supplierRecords(state).find(
      (supplier) => supplier.name !== original.supplier,
    )!;
    state.supplier_items = [
      {
        ...first,
        supplier_id: otherSupplier.id,
        supplier_name: otherSupplier.name,
        units_per_case: 48,
      },
    ];
    expect(
      createInvoice(state, "Branch 1").lines.find(
        (line) => line.product_code === "0002",
      ),
    ).toEqual(parsed);
  });
  it("bills the retained $19.99 case quote exactly across 500 cases rather than reconstructing rounded unit cost", () => {
    const state = draft();
    const line = state.invoice.lines[0];
    line.case_cost_before_tax = "19.9900";
    setInvoiceLineQuantity(line, "500", "cases", 12);
    expect(line.unit_cost_before_tax).toBe("1.6658");
    expect(line.qty_invoiced).toBe(6000);
    recalculateInvoice(state.invoice, state.config);
    confirm(state);
    expect(state.invoice.subtotal).toBe("9995.00");
    expect(
      new Decimal(line.unit_cost_before_tax)
        .times(line.qty_invoiced)
        .toFixed(2),
    ).toBe("9994.80");
    postInvoice(state, "supervisor", "Branch 1", "Ali");
    expect(postingEntries(state)[0].amount).toBe("9995.00");
    expect(receipts(state)[0]).toMatchObject({
      units: 6000,
      cases: "500",
      units_per_case: 12,
    });
  });
  it("converts fractional cases exactly, keeps Unit entry unscaled, and rejects invalid or stale pack snapshots", () => {
    const state = draft();
    const line = state.invoice.lines[0];
    setInvoiceLineQuantity(line, "0.5", "cases", 12);
    recalculateInvoice(state.invoice, state.config);
    confirm(state);
    expect(line.qty_invoiced).toBe(6);
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toEqual([]);
    setInvoiceLineQuantity(line, "7", "units", 12);
    recalculateInvoice(state.invoice, state.config);
    confirm(state);
    expect(line.qty_invoiced).toBe(7);
    expect(line.case_cost_before_tax).toBeUndefined();
    setInvoiceLineQuantity(line, "0.5", "cases", 3);
    recalculateInvoice(state.invoice, state.config);
    confirm(state);
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toContain(
      "quantity",
    );
    const before = structuredClone(state);
    expect(() => postInvoice(state, "supervisor", "Branch 1")).toThrow();
    expect(state).toEqual(before);
  });
});

describe("invoice compared with its order", () => {
  it("keeps an unfinished cost or pack edit reviewable instead of throwing while the form is typed", () => {
    const state = draft();
    addOrder(state);
    link(state);
    state.invoice.lines[0].unit_cost_before_tax = "";
    expect(() => currentInvoiceOrderComparison(state)).not.toThrow();
    expect(currentInvoiceOrderComparison(state)).toBeNull();
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toContain("cost");
    expect(() =>
      setInvoiceOrder(state, "supervisor", "Branch 1", "order-1"),
    ).not.toThrow();
    state.invoice.lines[0].unit_cost_before_tax = "0.9800";
    expect(currentInvoiceOrderComparison(state)?.order_id).toBe("order-1");
    state.invoice.lines[0].units_per_case = 0;
    expect(currentInvoiceOrderComparison(state)).toBeNull();
  });
  it("records an as-ordered invoice once with an immutable comparison, no invented alert, and Received status", () => {
    const state = draft();
    const order = addOrder(state);
    link(state);
    confirm(state);
    expect(invoiceOrderIssues(state, "supervisor", "Branch 1")).toEqual([]);
    postInvoice(state, "supervisor", "Branch 1", "Ali");
    expect(order).toMatchObject({
      status: "received",
      linked_invoice_ids: [state.invoice.id],
    });
    expect(order.lines[0].received_units).toBe(12);
    expect(order.receipts).toHaveLength(1);
    expect(state.invoice.order_comparison?.lines[0]).toMatchObject({
      expected_remaining_units: 12,
      extra_units: 0,
      price_changed: false,
    });
    expect(
      currentInvoiceOrderComparison(state)?.lines[0].expected_remaining_units,
    ).toBe(12);
    expect(
      state.alerts.filter((alert) => alert.invoice_id === state.invoice.id),
    ).toEqual([]);
    const after = structuredClone(state);
    expect(postInvoice(state, "supervisor", "Branch 1", "Ali")).toBe(false);
    expect(state).toEqual(after);
  });
  it("uses invoice Shorts for billed missing units and updates later physical deliveries cumulatively without replay", () => {
    const state = draft();
    const order = addOrder(state);
    state.invoice.lines[0].qty_received_at_posting = 8;
    link(state);
    confirm(state);
    expect(invoiceOrderIssues(state, "supervisor", "Branch 1")).toEqual([
      "order_decisions",
    ]);
    state.invoice.order_missing_decisions = { "order-line-1": "short" };
    postInvoice(state, "supervisor", "Branch 1", "Ali");
    expect(order.status).toBe("partially_received");
    expect(order.lines[0].received_units).toBe(8);
    expect(state.invoice.payable_after_open_shorts).toBe("7.84");
    expect(
      receiveShort(
        state,
        "0002",
        2,
        "FICTITIOUS-LATER-1",
        "supervisor",
        "Branch 1",
      ),
    ).toBe("1.96");
    expect(order.lines[0].received_units).toBe(10);
    const after = structuredClone(state);
    expect(
      receiveShort(
        state,
        "0002",
        2,
        "FICTITIOUS-LATER-1",
        "supervisor",
        "Branch 1",
      ),
    ).toBe("0.00");
    expect(state).toEqual(after);
    receiveShort(
      state,
      "0002",
      2,
      "FICTITIOUS-LATER-2",
      "supervisor",
      "Branch 1",
    );
    expect(order.lines[0].received_units).toBe(12);
    expect(order.status).toBe("received");
    expect(order.receipts).toHaveLength(3);
    expect(state.invoice.payable_after_open_shorts).toBe("11.76");
    expect(receipts(state).reduce((total, row) => total + row.units, 0)).toBe(
      12,
    );
    expect(
      state.alerts.filter((alert) => alert.invoice_id === state.invoice.id),
    ).toHaveLength(1);
  });
  it.each(["short", "back_ordered", "cancelled"] as const)(
    "requires %s on an absent ordered item without inventing invoice money",
    (decision) => {
      const state = draft();
      const absent = orderLine(state, {
        id: "absent",
        product_code: "0005",
        supplier_item_id: "juice-item",
        supplier_item_code: "JUICE",
        ordered_units: 24,
        ordered_cases: "2",
      });
      const order = addOrder(state, [orderLine(state), absent]);
      link(state);
      confirm(state);
      expect(invoiceBlockers(state, "supervisor", "Branch 1")).toContain(
        "order_decisions",
      );
      state.invoice.order_missing_decisions = { absent: decision };
      postInvoice(state, "supervisor", "Branch 1", "Ali");
      expect(postingEntries(state).map((row) => row.type)).toEqual(["invoice"]);
      expect(state.invoice.payable_after_open_shorts).toBe("11.76");
      expect(order.lines[1].received_units).toBe(0);
      expect(order.lines[1].cancelled_units).toBe(
        decision === "cancelled" ? 24 : 0,
      );
      expect(order.status).toBe(
        decision === "cancelled" ? "received" : "partially_received",
      );
      expect(
        state.alerts.find((alert) => alert.invoice_id === state.invoice.id)
          ?.order_differences,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "not_delivered",
            units: 24,
            decision,
          }),
        ]),
      );
    },
  );
  it("keeps an uninvoiced partial order remainder separate from a financial Short", () => {
    const state = draft();
    const order = addOrder(state, [
      orderLine(state, { ordered_units: 48, ordered_cases: "4" }),
    ]);
    setInvoiceLineQuantity(state.invoice.lines[0], "3", "cases", 12);
    recalculateInvoice(state.invoice, state.config);
    link(state);
    confirm(state);
    expect(currentInvoiceOrderComparison(state)?.residual[0]).toMatchObject({
      missing_units: 12,
      absent: false,
    });
    state.invoice.order_missing_decisions = { "order-line-1": "back_ordered" };
    postInvoice(state, "supervisor", "Branch 1", "Ali");
    expect(shortTotals(state.invoice).total).toBe("0.00");
    expect(postingEntries(state).map((row) => row.type)).toEqual(["invoice"]);
    expect(state.invoice.payable_after_open_shorts).toBe("35.28");
    expect(order.lines[0].received_units).toBe(36);
  });
  it.each(["keep", "refuse"] as const)(
    "requires an explicit extra delivery %s decision and credits only the ordered quantity",
    (decision) => {
      const state = draft();
      const order = addOrder(state);
      setInvoiceLineQuantity(state.invoice.lines[0], "18", "units", 12);
      recalculateInvoice(state.invoice, state.config);
      link(state);
      confirm(state);
      expect(invoiceOrderIssues(state, "supervisor", "Branch 1")).toEqual([
        "order_decisions",
      ]);
      setInvoiceExtraDecision(state, "supervisor", "Branch 1", 0, decision);
      confirm(state);
      postInvoice(state, "supervisor", "Branch 1", "Ali");
      expect(order.lines[0].received_units).toBe(12);
      expect(order.receipts[0].lines[0].extra_units).toBe(
        decision === "keep" ? 6 : 0,
      );
      expect(receipts(state)[0].units).toBe(decision === "keep" ? 18 : 12);
      expect(state.invoice.lines[0].qty_received_at_posting).toBe(18);
      expect(state.invoice.payable_after_open_shorts).toBe(
        decision === "keep" ? "17.64" : "11.76",
      );
      expect(refusedTotals(state.invoice).total).toBe(
        decision === "refuse" ? "5.88" : "0.00",
      );
      expect(
        state.alerts.filter((alert) => alert.invoice_id === state.invoice.id),
      ).toHaveLength(1);
    },
  );
  it("does not create a catalog record, price proposal, date entry or receipt for a fully refused NEW line", () => {
    const state = draft();
    const order = addOrder(state);
    const extra: InvoiceLine = {
      ...structuredClone(state.invoice.lines[0]),
      product_code: "NEW",
      supplier_item_id: undefined,
      supplier_item_code: "UNKNOWN",
      new_name_en: undefined,
      new_name_fa: undefined,
      qty_invoiced: 2,
      qty_received_at_posting: 2,
      quantity_entered: "2",
      unit_cost_before_tax: "1.0000",
    };
    state.invoice.lines.push(extra);
    recalculateInvoice(state.invoice, state.config);
    link(state);
    setInvoiceExtraDecision(state, "supervisor", "Branch 1", 1, "refuse");
    confirm(state);
    const products = structuredClone(state.products);
    const expiry = structuredClone(state.expiry);
    const proposals = structuredClone(state.approvals);
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toEqual([]);
    postInvoice(state, "supervisor", "Branch 1", "Ali");
    expect(state.products.map((product) => product.code)).toEqual(
      products.map((product) => product.code),
    );
    expect(state.approvals).toEqual(proposals);
    expect(state.expiry).toEqual(expiry);
    expect(state.invoice.lines[1].product_code).toBe("NEW");
    expect(receipts(state)).toHaveLength(1);
    expect(order.status).toBe("received");
    expect(state.invoice.payable_after_open_shorts).toBe("11.76");
  });
  it("conserves a one-cent original tax across a billed Short and refused extra, then restores only the actual Short", () => {
    const state = draft();
    const line = state.invoice.lines[0];
    setInvoiceLineQuantity(line, "2", "units", 12);
    line.qty_received_at_posting = 1;
    line.unit_cost_before_tax = "0.0100";
    recalculateInvoice(state.invoice, state.config);
    line.line_tax = "0.01";
    state.invoice.tax = "0.01";
    state.invoice.final_total = "0.03";
    addOrder(state, [
      orderLine(state, {
        id: "absent",
        product_code: "0005",
        supplier_item_id: "different",
        supplier_item_code: "JUICE",
      }),
    ]);
    link(state);
    setInvoiceExtraDecision(state, "supervisor", "Branch 1", 0, "refuse");
    state.invoice.order_missing_decisions = { absent: "back_ordered" };
    confirm(state);
    expect(shortTotals(state.invoice)).toMatchObject({
      beforeTax: "0.01",
      tax: "0.01",
      total: "0.02",
    });
    expect(refusedTotals(state.invoice)).toMatchObject({
      beforeTax: "0.01",
      tax: "0.00",
      total: "0.01",
    });
    postInvoice(state, "supervisor", "Branch 1", "Ali");
    expect(state.invoice.payable_after_open_shorts).toBe("0.00");
    expect(receipts(state)).toHaveLength(0);
    receiveShort(
      state,
      "0002",
      1,
      "FICTITIOUS-MISSING-1",
      "supervisor",
      "Branch 1",
    );
    expect(state.invoice.payable_after_open_shorts).toBe("0.02");
    expect(receipts(state)[0].units).toBe(1);
    expect(
      Decimal.sum(
        ...postingEntries(state).map((entry) => entry.amount),
      ).toFixed(2),
    ).toBe("0.02");
  });
  it("blocks a changed cost until acceptance and consolidates all differences into one Supervisor alert", () => {
    const state = draft();
    addOrder(state);
    state.invoice.lines[0].unit_cost_before_tax = "0.9000";
    recalculateInvoice(state.invoice, state.config);
    link(state);
    confirm(state);
    expect(invoiceOrderIssues(state, "supervisor", "Branch 1")).toEqual([
      "order_decisions",
    ]);
    state.invoice.lines[0].order_price_decision = "accept";
    postInvoice(state, "supervisor", "Branch 1", "Ali");
    const alerts = state.alerts.filter(
      (alert) =>
        alert.invoice_id === state.invoice.id ||
        alert.id.startsWith(`${state.invoice.id}:lower:`),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: "order_differences",
      same_expiry: "unknown",
    });
    expect(alerts[0].order_differences?.[0]).toMatchObject({
      kind: "price_change",
      previous_unit_cost: "0.9800",
      new_unit_cost: "0.9000",
      decision: "accept",
    });
  });
  it("rejects stale, foreign-company, supplier and receiving-location links before any financial or receipt mutation", () => {
    for (const change of [
      "version",
      "company",
      "supplier",
      "location",
    ] as const) {
      const state = draft();
      const order = addOrder(state);
      link(state);
      confirm(state);
      if (change === "version") order.version++;
      if (change === "company") order.company_id = "other-company";
      if (change === "supplier") order.supplier_id = "other-supplier";
      if (change === "location") order.branch = "Branch 2";
      const before = structuredClone(state);
      expect(() => postInvoice(state, "supervisor", "Branch 1")).toThrow();
      expect(state).toEqual(before);
    }
  });
  it("allows the authorized Worker to reconcile their own Warehouse draft while standalone Orders stays disabled", () => {
    const state = draft();
    const order = addOrder(state, undefined, { branch: "Warehouse" });
    expect(state.config.orders?.allow_floor_worker ?? false).toBe(false);
    setInvoiceLocation(state, "floor_worker", "Branch 1", "Warehouse");
    expect(compatibleInvoiceOrders(state, "floor_worker", "Branch 2")).toEqual(
      [],
    );
    expect(compatibleInvoiceOrders(state, "cashier", "Branch 1")).toEqual([]);
    setInvoiceOrder(state, "floor_worker", "Branch 1", order.id);
    confirm(state);
    postInvoice(state, "floor_worker", "Branch 1", "Demo Floor Worker");
    expect(order.status).toBe("received");
    expect(state.invoice).toMatchObject({
      branch: "Warehouse",
      handling_branch: "Branch 1",
    });
    expect(
      receivedLog(state, {
        company_id: state.invoice.company_id,
        role: "floor_worker",
        branch: "Branch 1",
        actor: "Demo Floor Worker",
      }).some((row) => row.invoice_id === state.invoice.id),
    ).toBe(false);
  });
});

describe("short-dated expiry discounts", () => {
  it.each([false, true])(
    "requires an expiry date, retains actual discounted payable and keeps regular cost/price/manual provenance with linked order=%s",
    (linked) => {
      const state = draft();
      const product = state.products.find((item) => item.code === "0002")!;
      setManualPriceMarker(
        state,
        product,
        "all",
        "2.49",
        "Ali",
        new Date("2026-10-09T10:00:00Z"),
      );
      product.selling_price = "2.49";
      const prior = structuredClone(product);
      const approvals = structuredClone(state.approvals);
      if (linked) {
        addOrder(state);
        link(state);
      }
      const line = state.invoice.lines[0];
      line.unit_cost_before_tax = "0.8000";
      line.short_dated = true;
      line.order_price_decision = "short_dated";
      line.date_tracking = true;
      line.date_type = "expiry";
      recalculateInvoice(state.invoice, state.config);
      confirm(state);
      state.invoice.lower_price_answers = undefined;
      expect(invoiceBlockers(state, "supervisor", "Branch 1")).toContain(
        "date",
      );
      const before = structuredClone(state);
      expect(() => postInvoice(state, "supervisor", "Branch 1")).toThrow();
      expect(state).toEqual(before);
      line.date_value = "2030-12-01";
      expect(invoiceBlockers(state, "supervisor", "Branch 1")).toEqual([]);
      postInvoice(state, "supervisor", "Branch 1", "Ali");
      expect(product).toEqual(prior);
      expect(state.approvals).toEqual(approvals);
      expect(state.invoice.payable_after_open_shorts).toBe("9.60");
      expect(
        state.expiry.find((entry) => entry.invoice_id === state.invoice.id),
      ).toMatchObject({ date: "2030-12-01", product_code: "0002" });
      expect(receipts(state)[0].units).toBe(12);
      expect(
        state.alerts.filter((alert) =>
          alert.id.startsWith(`${state.invoice.id}:lower:`),
        ),
      ).toEqual([]);
      if (linked)
        expect(
          state.alerts.find((alert) => alert.invoice_id === state.invoice.id)
            ?.order_differences?.[0],
        ).toMatchObject({ kind: "short_dated", expiry_date: "2030-12-01" });
    },
  );
  it("does not accept short-dated as an explanation for a cost that is not lower than an actual supplier purchase", () => {
    const state = draft();
    const line = state.invoice.lines[0];
    line.short_dated = true;
    line.date_tracking = true;
    line.date_value = "2030-12-01";
    line.unit_cost_before_tax = costPerUnit("19.99", 12);
    recalculateInvoice(state.invoice, state.config);
    confirm(state);
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toContain("date");
  });
});
