import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { supplierRecords } from "./supplier-editor";
import { updateNoteStatus } from "./operations";
import {
  addToOrderNote,
  applyInvoiceToOrder,
  cancelOrder,
  compareInvoiceOrder,
  createOrder,
  orderCandidates,
  placeOrder,
  saveOrderDraft,
  scopedOrders,
  suggestOpenOrders,
  validateOrderReceipt,
  type OrderContext,
  type OrderReceiptInput,
} from "./orders";
import type { DemoInvoice } from "./types";

const supervisor: OrderContext = {
  company_id: "super-arzon",
  branch: "all",
  role: "supervisor",
  actor: "Order Supervisor",
  allowed_branches: ["Branch 1", "Branch 2", "Branch 3", "warehouse"],
};
function fixture(quote: string | undefined = "2.5000") {
  const state = initialState();
  const supplier = supplierRecords(state).find(
    (item) => item.status === "confirmed" && item.active,
  )!;
  const product = state.products[0];
  state.supplier_items = [
    {
      id: "item-c2-1",
      company_id: supervisor.company_id,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      product_code: product.code,
      supplier_item_code: "SKU-1",
      units_per_case: 12,
      quoted_unit_cost_before_tax: quote,
      quoted_by: supervisor.actor,
      quoted_at: "2026-10-09T10:00:00Z",
      created_at: "2026-10-09T10:00:00Z",
      created_by: supervisor.actor,
    },
  ];
  const input = {
    branch: "Branch 1",
    supplier: supplier.name,
    lines: [{ supplier_item_id: "item-c2-1", cases: "1" }],
  };
  return { state, supplier, product, input };
}
function receiptFixture(
  received = 8,
  decision: "short" | "back_ordered" | "cancelled" = "short",
) {
  const { state, supplier, input } = fixture();
  const order = createOrder(state, supervisor, input);
  placeOrder(state, supervisor, order.id);
  const invoice: DemoInvoice = {
    ...structuredClone(state.invoice),
    id: "order-invoice-1",
    company_id: supervisor.company_id,
    branch: "Branch 1",
    handling_branch: "Branch 1",
    supplier: supplier.name,
    status: "posted",
    order_id: order.id,
    lines: [
      {
        ...structuredClone(state.invoice.lines[0]),
        company_id: supervisor.company_id,
        product_code: order.lines[0].product_code,
        supplier_item_id: "item-c2-1",
        supplier_item_code: "SKU-1",
        units_per_case: 12,
        qty_invoiced: 12,
        qty_received_at_posting: received,
        unit_cost_before_tax: "2.5000",
        case_cost_before_tax: "30.0000",
        qty_later_received: 0,
        refused_units: 0,
      },
    ],
  };
  invoice.order_comparison = compareInvoiceOrder(order, invoice);
  invoice.order_missing_decisions =
    received < 12 ? { [order.lines[0].id]: decision } : {};
  state.invoice = invoice;
  state.invoices = [];
  const receipt: OrderReceiptInput = {
    invoice_id: invoice.id,
    event_key: `${invoice.id}:initial`,
    kind: "invoice",
    lines: [
      {
        order_line_id: order.lines[0].id,
        invoice_line_index: 0,
        accepted_units: received,
      },
    ],
    residual:
      received < 12 ? [{ order_line_id: order.lines[0].id, decision }] : [],
  };
  return { state, order, invoice, receipt };
}

describe("C2 order drafts and placement", () => {
  it("uses exact positive Cases conversion and Decimal expected totals without changing payables or physical movements", () => {
    const { state, input } = fixture("0.1234");
    const ledger = structuredClone(state.ledger),
      stock = structuredClone(state.stock),
      movements = structuredClone(state.stock_movements);
    const order = createOrder(state, supervisor, {
      ...input,
      lines: [{ ...input.lines[0], cases: "0.5" }],
    });
    expect(order.lines[0]).toMatchObject({
      ordered_cases: "0.5",
      ordered_units: 6,
      expected_unit_cost: "0.1234",
      expected_case_cost: "1.4808",
      expected_line_total: "0.74",
    });
    expect(order.expected_total_before_tax).toBe("0.74");
    placeOrder(state, supervisor, order.id);
    expect(state.ledger).toEqual(ledger);
    expect(state.stock).toEqual(stock);
    expect(state.stock_movements).toEqual(movements);
    const before = structuredClone(state);
    for (const cases of ["0.1", "0", "-1", "Infinity", "bad"]) {
      expect(() =>
        createOrder(state, supervisor, {
          ...input,
          lines: [{ ...input.lines[0], cases }],
        }),
      ).toThrow("quantity");
      expect(state).toEqual(before);
    }
  });
  it("does not invent a purchased cost from catalog prices, and blocks placement until Expected unit cost is explicit", () => {
    const { state, input } = fixture(undefined);
    delete state.supplier_items![0].quoted_unit_cost_before_tax;
    const candidate = orderCandidates(state, supervisor, input.supplier).find(
      (item) => item.id === "item-c2-1",
    )!;
    expect(candidate.expected_unit_cost).toBeNull();
    expect(candidate.expected_case_cost).toBeNull();
    expect(candidate).not.toHaveProperty("history");
    expect(candidate).not.toHaveProperty("last_bought_date");
    const order = createOrder(state, supervisor, input);
    expect(order.expected_total_before_tax).toBeNull();
    const before = structuredClone(state);
    expect(() => placeOrder(state, supervisor, order.id)).toThrow("cost");
    expect(state).toEqual(before);
    saveOrderDraft(
      state,
      supervisor,
      order.id,
      {
        ...input,
        lines: [{ ...input.lines[0], expected_unit_cost: "1.2345" }],
      },
      order.version,
    );
    placeOrder(state, supervisor, order.id);
    expect(order.expected_total_before_tax).toBe("14.81");
    expect(order.lines[0].expected_cost_source).toBe("entered");
    expect(state.supplier_items![0]).not.toHaveProperty(
      "last_bought_unit_cost",
    );
  });
  it("retains placed pack, bilingual names and cost snapshots across future supplier-item edits", () => {
    const { state, input } = fixture();
    const order = createOrder(state, supervisor, input);
    placeOrder(state, supervisor, order.id);
    const captured = structuredClone(order);
    state.supplier_items![0].units_per_case = 24;
    state.supplier_items![0].quoted_unit_cost_before_tax = "3.0000";
    state.products[0].name_en = "Renamed later";
    expect(order).toEqual(captured);
    expect(
      orderCandidates(state, supervisor, input.supplier).find(
        (item) => item.id === "item-c2-1",
      ),
    ).toMatchObject({ units_per_case: 24, expected_unit_cost: "3.0000" });
    expect(() => saveOrderDraft(state, supervisor, order.id, input)).toThrow(
      "status",
    );
  });
  it("links a free-text To order note in one click without inventing demand; only explicit selected mappings become ordered once", () => {
    const { state, input } = fixture();
    const note = state.notes.find(
      (item) => item.type === "to_order" && item.branch === "Branch 1",
    )!;
    delete note.product_code;
    delete note.qty;
    const unrelated = {
      ...structuredClone(note),
      id: "unselected-reminder",
      text: "Another reminder",
    };
    state.notes.push(unrelated);
    const order = createOrder(state, supervisor, { ...input, lines: [] });
    addToOrderNote(state, supervisor, order.id, note.id);
    const linked = structuredClone(state);
    addToOrderNote(state, supervisor, order.id, note.id);
    expect(state).toEqual(linked);
    expect(order.lines).toEqual([]);
    expect(note.status).toBe("open");
    saveOrderDraft(state, supervisor, order.id, {
      ...input,
      source_note_ids: [note.id],
    });
    const before = structuredClone(state);
    expect(() => placeOrder(state, supervisor, order.id)).toThrow("notes");
    expect(state).toEqual(before);
    saveOrderDraft(state, supervisor, order.id, {
      ...input,
      source_note_ids: [note.id],
      lines: [{ ...input.lines[0], cases: "0.5", source_note_ids: [note.id] }],
    });
    placeOrder(state, supervisor, order.id);
    expect(note.status).toBe("ordered");
    expect(note.text).toEqual(
      linked.notes.find((item) => item.id === note.id)!.text,
    );
    expect(unrelated.status).toBe("open");
    expect(order.lines[0].ordered_units).toBe(6);
    const after = structuredClone(state);
    expect(() => placeOrder(state, supervisor, order.id)).toThrow("status");
    expect(state).toEqual(after);
    expect(() =>
      updateNoteStatus(
        state,
        { ...supervisor, branch: "Branch 1" },
        note.id,
        "open",
      ),
    ).toThrow("status");
  });
  it("scopes every read and transition and grants opted-in workers costs only inside their own Orders", () => {
    const { state, input } = fixture();
    const first = createOrder(state, supervisor, input);
    createOrder(state, supervisor, { ...input, branch: "Branch 2" });
    const worker: OrderContext = {
      ...supervisor,
      branch: "Branch 1",
      role: "floor_worker",
      allowed_branches: ["Branch 1"],
    };
    expect(() => scopedOrders(state, worker)).toThrow("permission");
    state.config.orders = { allow_floor_worker: true };
    expect(scopedOrders(state, worker).map((item) => item.id)).toEqual([
      first.id,
    ]);
    expect(
      orderCandidates(state, worker, input.supplier)[0],
    ).not.toHaveProperty("history");
    const before = structuredClone(state);
    for (const context of [
      { ...worker, role: "cashier" as const },
      { ...worker, company_id: "other" },
      { ...worker, branch: "all" },
    ]) {
      expect(() => scopedOrders(state, context)).toThrow();
      expect(state).toEqual(before);
    }
    expect(() =>
      createOrder(state, worker, { ...input, branch: "Branch 2" }),
    ).toThrow("location");
    expect(() =>
      cancelOrder(
        state,
        { ...supervisor, allowed_branches: ["Branch 2"] },
        first.id,
        "Wrong scope",
      ),
    ).toThrow("scope");
    expect(state).toEqual(before);
  });
  it("cancels with a reason without deleting records or reusing references, and rejects stale or repeated edits", () => {
    const { state, input } = fixture();
    const order = createOrder(state, supervisor, input);
    const before = structuredClone(state);
    expect(() =>
      saveOrderDraft(state, supervisor, order.id, input, 99),
    ).toThrow("stale");
    expect(() => cancelOrder(state, supervisor, order.id, "")).toThrow(
      "reason",
    );
    expect(state).toEqual(before);
    cancelOrder(
      state,
      supervisor,
      order.id,
      "Supplier unavailable",
      order.version,
    );
    expect(state.orders).toContain(order);
    expect(order).toMatchObject({
      status: "cancelled",
      cancellation_reason: "Supplier unavailable",
    });
    expect(createOrder(state, supervisor, input).reference).toBe("ORD-0002");
    expect(() => cancelOrder(state, supervisor, order.id, "Retry")).toThrow(
      "status",
    );
  });
});

describe("C2 order comparison and cumulative receipt evidence", () => {
  it("classifies billed shortage, unbilled partial residual and absent item without generating payable amounts", () => {
    const { order, invoice } = receiptFixture(8);
    const cmp = compareInvoiceOrder(order, invoice);
    expect(cmp.lines[0]).toMatchObject({
      short_units: 4,
      extra_units: 0,
      price_changed: false,
    });
    expect(cmp.residual[0]).toMatchObject({ missing_units: 4, absent: false });
    invoice.lines[0].qty_invoiced = 8;
    expect(compareInvoiceOrder(order, invoice).lines[0].short_units).toBe(0);
    expect(compareInvoiceOrder(order, invoice).residual[0].missing_units).toBe(
      4,
    );
    invoice.lines = [];
    expect(compareInvoiceOrder(order, invoice).residual[0]).toMatchObject({
      missing_units: 12,
      absent: true,
    });
  });
  it("aggregates duplicate same-SKU rows, isolates different SKUs, allocates extras and retains unit/case quote changes", () => {
    const { order, invoice } = receiptFixture(8);
    invoice.lines.push({
      ...structuredClone(invoice.lines[0]),
      qty_invoiced: 7,
      qty_received_at_posting: 7,
      unit_cost_before_tax: "3.0000",
      case_cost_before_tax: "36.0000",
    });
    const cmp = compareInvoiceOrder(order, invoice);
    expect(cmp.residual).toEqual([]);
    expect(cmp.lines.map((row) => row.extra_units)).toEqual([0, 3]);
    expect(cmp.lines[1]).toMatchObject({
      price_changed: true,
      new_case_cost: "36.0000",
    });
    invoice.lines[1].refused_units = 3;
    expect(compareInvoiceOrder(order, invoice).residual).toEqual([]);
    delete invoice.lines[1].supplier_item_id;
    invoice.lines[1].supplier_item_code = "OTHER-SKU";
    const separate = compareInvoiceOrder(order, invoice);
    expect(separate.lines[1].order_line_id).toBeUndefined();
    expect(separate.lines[1].extra_units).toBe(7);
    expect(separate.residual[0].missing_units).toBe(4);
    invoice.lines[0].case_cost_before_tax = "30.0001";
    expect(compareInvoiceOrder(order, invoice).lines[0].price_changed).toBe(
      true,
    );
  });
  it("credits each posted invoice once, retains pre-post comparison, and applies only evidence-matched later Short deltas", () => {
    const { state, order, invoice, receipt } = receiptFixture();
    const snapshot = structuredClone(invoice.order_comparison);
    applyInvoiceToOrder(state, supervisor, order.id, receipt);
    expect(order).toMatchObject({
      status: "partially_received",
      linked_invoice_ids: [invoice.id],
    });
    expect(order.lines[0].received_units).toBe(8);
    expect(invoice.order_comparison).toEqual(snapshot);
    const initial = structuredClone(state);
    applyInvoiceToOrder(state, supervisor, order.id, {
      ...receipt,
      event_key: "another-retry-key",
    });
    expect(state).toEqual(initial);
    invoice.lines[0].qty_later_received = 4;
    const later: OrderReceiptInput = {
      ...receipt,
      event_key: "actual-short-event-1",
      kind: "short_delivery",
      lines: [{ ...receipt.lines[0], accepted_units: 4 }],
      residual: [],
    };
    applyInvoiceToOrder(state, supervisor, order.id, later);
    expect(order.lines[0].received_units).toBe(12);
    expect(order.status).toBe("received");
    expect(order.receipts).toHaveLength(2);
    const after = structuredClone(state);
    applyInvoiceToOrder(state, supervisor, order.id, later);
    expect(state).toEqual(after);
    expect(() =>
      applyInvoiceToOrder(state, supervisor, order.id, {
        ...later,
        event_key: "fake-new-event",
      }),
    ).toThrow("receipt");
    expect(state).toEqual(after);
  });
  it("keeps extra accepted units as evidence while credits never exceed ordered units, including later arrivals of cancelled residuals", () => {
    const full = receiptFixture(15);
    applyInvoiceToOrder(full.state, supervisor, full.order.id, full.receipt);
    expect(full.order.lines[0].received_units).toBe(12);
    expect(full.order.receipts[0].lines[0]).toMatchObject({
      accepted_units: 15,
      credited_units: 12,
      extra_units: 3,
    });
    const partial = receiptFixture(8, "cancelled");
    applyInvoiceToOrder(
      partial.state,
      supervisor,
      partial.order.id,
      partial.receipt,
    );
    expect(partial.order).toMatchObject({ status: "received" });
    expect(partial.order.lines[0]).toMatchObject({
      received_units: 8,
      cancelled_units: 4,
    });
    partial.invoice.lines[0].qty_later_received = 4;
    applyInvoiceToOrder(partial.state, supervisor, partial.order.id, {
      ...partial.receipt,
      kind: "short_delivery",
      event_key: "late-after-cancel",
      lines: [{ ...partial.receipt.lines[0], accepted_units: 4 }],
      residual: [],
    });
    expect(partial.order.lines[0]).toMatchObject({
      received_units: 8,
      cancelled_units: 4,
    });
    expect(partial.order.receipts[1].lines[0].extra_units).toBe(4);
  });
  it("preflights without mutation, rejects stale/tampered receipts, and allows authorized invoice reviewer when worker Orders is disabled", () => {
    const { state, order, invoice, receipt } = receiptFixture();
    const worker: OrderContext = {
      ...supervisor,
      role: "floor_worker",
      branch: "Branch 1",
      allowed_branches: ["Branch 1"],
    };
    const before = structuredClone(state);
    validateOrderReceipt(state, worker, order.id, receipt);
    expect(state).toEqual(before);
    expect(() =>
      validateOrderReceipt(
        state,
        { ...worker, branch: "Branch 2" },
        order.id,
        receipt,
      ),
    ).toThrow("scope");
    expect(() =>
      validateOrderReceipt(state, worker, order.id, {
        ...receipt,
        lines: [{ ...receipt.lines[0], accepted_units: 9 }],
      }),
    ).toThrow("receipt");
    expect(state).toEqual(before);
    order.version++;
    expect(() =>
      validateOrderReceipt(state, worker, order.id, receipt),
    ).toThrow("stale");
    order.version--;
    invoice.lines[0].refused_units = 2;
    expect(() =>
      validateOrderReceipt(state, worker, order.id, receipt),
    ).toThrow("receipt");
    invoice.lines[0].refused_units = 0;
    applyInvoiceToOrder(state, worker, order.id, receipt);
    expect(order.lines[0].received_units).toBe(8);
  });
  it("suggests only open orders sharing company, supplier and effective receiving location", () => {
    const { state, order, invoice } = receiptFixture();
    expect(suggestOpenOrders(state, invoice).map((item) => item.id)).toEqual([
      order.id,
    ]);
    for (const changed of [
      { ...invoice, company_id: "foreign" },
      { ...invoice, id: "other-invoice-location", branch: "Branch 2" },
      { ...invoice, supplier: "Other supplier" },
    ])
      expect(suggestOpenOrders(state, changed)).toEqual([]);
    order.status = "received";
    expect(suggestOpenOrders(state, invoice)).toEqual([]);
  });
});
