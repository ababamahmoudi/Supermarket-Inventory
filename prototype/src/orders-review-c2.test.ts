import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { configuredBranches } from "./settings";
import { supplierRecords } from "./supplier-editor";
import { saveSupplierItem } from "./supplier-items";
import {
  applyInvoiceToOrder,
  compareInvoiceOrder,
  createOrder,
  orderCandidates,
  placeOrder,
  validateOrderReceipt,
  type OrderContext,
  type OrderReceiptInput,
} from "./orders";

function fixture() {
  const state = initialState();
  state.orders = [];
  state.supplier_items = [];
  state.invoices = [];
  state.invoice.status = "empty";
  const branches = configuredBranches(state.config);
  const context: OrderContext = {
    company_id: state.config.company.seed_key,
    role: "supervisor",
    branch: "all",
    allowed_branches: branches,
    actor: "Demo Supervisor",
  };
  const supplier = supplierRecords(state).find(
    (item) => item.active && item.status === "confirmed",
  )!;
  const product = state.products.find(
    (item) =>
      item.status === "active" && item.company_id === context.company_id,
  )!;
  const item = saveSupplierItem(state, context, supplier.name, {
    product_code: product.code,
    supplier_item_code: "C2-REVIEW-1",
    units_per_case: 12,
    quoted_unit_cost_before_tax: "2.0000",
  });
  const order = createOrder(state, context, {
    branch: branches[0],
    supplier: supplier.name,
    lines: [{ supplier_item_id: item.id, cases: "2" }],
  });
  placeOrder(state, context, order.id, order.version);
  state.invoice = {
    ...structuredClone(state.invoice),
    id: "c2-review-posted-invoice",
    company_id: context.company_id,
    branch: order.branch,
    handling_branch: order.branch,
    supplier: supplier.name,
    supplier_invoice_number: "C2-REVIEW-INV-1",
    status: "posted",
    received_at: "2026-10-09T17:00:00Z",
    receiving_employee: "Demo Floor Worker",
    posted_at: "2026-10-09T17:01:00Z",
    order_id: order.id,
    order_review_version: order.version,
    lines: [
      {
        ...structuredClone(state.invoice.lines[0]),
        company_id: context.company_id,
        product_code: product.code,
        supplier_item_id: item.id,
        supplier_item_code: "C2-REVIEW-1",
        units_per_case: 12,
        qty_invoiced: 24,
        qty_received_at_posting: 12,
        qty_later_received: 0,
        refused_units: 0,
        unit_cost_before_tax: "2.0000",
        case_cost_before_tax: "24.0000",
      },
    ],
  };
  state.invoice.order_comparison = compareInvoiceOrder(order, state.invoice);
  state.invoice.order_missing_decisions = {
    [order.lines[0].id]: "back_ordered",
  };
  state.invoices = [state.invoice];
  const initial: OrderReceiptInput = {
    invoice_id: state.invoice.id,
    event_key: `${state.invoice.id}:order:posted`,
    kind: "invoice",
    lines: [
      {
        order_line_id: order.lines[0].id,
        invoice_line_index: 0,
        accepted_units: 12,
      },
    ],
    residual: [{ order_line_id: order.lines[0].id, decision: "back_ordered" }],
  };
  const later = (units: number): OrderReceiptInput => ({
    invoice_id: state.invoice.id,
    event_key: `${state.invoice.id}:order:short:review-1`,
    kind: "short_delivery",
    lines: [
      {
        order_line_id: order.lines[0].id,
        invoice_line_index: 0,
        accepted_units: units,
      },
    ],
    residual: [],
  });
  return { state, context, order, initial, later, branches };
}

describe("independent Orders receipt regression review", () => {
  it("uses the exact historical case quote with the current pack instead of multiplying a rounded unit cost", () => {
    const { state, context, order } = fixture();
    const purchase = state.invoice;
    purchase.order_id = undefined;
    purchase.order_comparison = undefined;
    purchase.order_missing_decisions = undefined;
    purchase.lines[0].units_per_case = 3;
    purchase.lines[0].unit_cost_before_tax = "3.3333";
    purchase.lines[0].case_cost_before_tax = "10.0000";
    const retainedPurchase = structuredClone(purchase);
    const candidates = orderCandidates(state, context, purchase.supplier);
    expect(candidates).toMatchObject([
      {
        id: order.lines[0].supplier_item_id,
        units_per_case: 12,
        expected_unit_cost: "3.3333",
        expected_case_cost: "40.0000",
        expected_cost_source: "last_bought",
      },
    ]);
    const next = createOrder(state, context, {
      branch: order.branch,
      supplier: purchase.supplier,
      lines: [
        {
          supplier_item_id: candidates[0].id,
          cases: "0.5",
        },
      ],
    });
    expect(next.lines[0]).toMatchObject({
      units_per_case: 12,
      ordered_cases: "0.5",
      ordered_units: 6,
      expected_case_cost: "40.0000",
      expected_line_total: "20.00",
    });
    expect(next.expected_total_before_tax).toBe("20.00");
    expect(purchase).toEqual(retainedPurchase);
  });

  it("rejects an empty later receipt and injected residual decisions without cancelling any outstanding units", () => {
    const { state, context, order, initial, later } = fixture();
    applyInvoiceToOrder(state, context, order.id, initial);
    const empty = later(0);
    empty.lines = [];
    const cancelled = {
      order_line_id: order.lines[0].id,
      decision: "cancelled" as const,
    };
    for (const input of [empty, { ...empty, residual: [cancelled] }]) {
      const before = structuredClone(state);
      expect(() =>
        applyInvoiceToOrder(state, context, order.id, input),
      ).toThrow("receipt");
      expect(state).toEqual(before);
    }
    state.invoice.lines[0].qty_later_received = 2;
    const forged = { ...later(2), residual: [cancelled] };
    const before = structuredClone(state);
    expect(() => applyInvoiceToOrder(state, context, order.id, forged)).toThrow(
      "receipt",
    );
    expect(state).toEqual(before);
    expect(order.lines[0]).toMatchObject({
      received_units: 12,
      cancelled_units: 0,
      outstanding_decision: "back_ordered",
    });
    expect(order.status).toBe("partially_received");
  });

  it.each([
    "accepted quantity",
    "negative quantity",
    "unsafe quantity",
    "line identity",
    "invoice index",
    "duplicate line",
    "missing line",
    "missing decision",
    "different decision",
  ])("rejects tampered initial receipt: %s, atomically", (kind) => {
    const { state, context, order, initial } = fixture();
    const input = structuredClone(initial);
    if (kind === "accepted quantity") input.lines[0].accepted_units = 13;
    if (kind === "negative quantity") input.lines[0].accepted_units = -1;
    if (kind === "unsafe quantity")
      input.lines[0].accepted_units = Number.MAX_SAFE_INTEGER + 1;
    if (kind === "line identity") input.lines[0].order_line_id = "foreign-line";
    if (kind === "invoice index") input.lines[0].invoice_line_index = 99;
    if (kind === "duplicate line") input.lines.push({ ...input.lines[0] });
    if (kind === "missing line") input.lines = [];
    if (kind === "missing decision") input.residual = [];
    if (kind === "different decision") input.residual[0].decision = "cancelled";
    const before = structuredClone(state);
    expect(() =>
      applyInvoiceToOrder(state, context, order.id, input),
    ).toThrow();
    expect(state).toEqual(before);
    expect(order.receipts).toEqual([]);
  });

  it("enforces the authenticated company, allowed locations, and receiving role even when invoice evidence exists", () => {
    const { state, context, order, initial, branches } = fixture();
    const contexts: OrderContext[] = [
      { ...context, company_id: "foreign-company" },
      { ...context, role: "cashier", branch: order.branch },
      { ...context, allowed_branches: [] },
      {
        ...context,
        role: "floor_worker",
        branch: order.branch,
        allowed_branches: [],
      },
      {
        ...context,
        role: "floor_worker",
        branch: branches[1],
        allowed_branches: [branches[1]],
      },
    ];
    for (const actor of contexts) {
      const before = structuredClone(state);
      expect(() =>
        applyInvoiceToOrder(state, actor, order.id, initial),
      ).toThrow();
      expect(state).toEqual(before);
    }
    const ownWorker: OrderContext = {
      ...context,
      role: "floor_worker",
      branch: order.branch,
      allowed_branches: [order.branch],
    };
    // Receiving an invoice is available without granting general Orders access.
    expect(state.config.orders?.allow_floor_worker).toBe(false);
    validateOrderReceipt(state, ownWorker, order.id, initial);
    expect(order.receipts).toEqual([]);
  });

  it.each(["supplier", "location", "company", "order link"])(
    "rejects a retained invoice graft with a different %s",
    (field) => {
      const { state, context, order, initial, branches } = fixture();
      if (field === "supplier") state.invoice.supplier = "Another supplier";
      if (field === "location") {
        state.invoice.branch = branches[1];
        state.invoice.handling_branch = branches[1];
      }
      if (field === "company") state.invoice.company_id = "foreign-company";
      if (field === "order link") state.invoice.order_id = "foreign-order";
      const before = structuredClone(state);
      expect(() =>
        applyInvoiceToOrder(state, context, order.id, initial),
      ).toThrow();
      expect(state).toEqual(before);
    },
  );

  it("credits each retained delivery once, preserves snapshots and decisions, and changes no invoice money or physical records", () => {
    const { state, context, order, initial, later } = fixture();
    const orderedSnapshot = structuredClone(order.lines[0]);
    const invoiceSnapshot = structuredClone(state.invoice);
    const ledger = structuredClone(state.ledger);
    const movements = structuredClone(state.stock_movements);
    applyInvoiceToOrder(state, context, order.id, initial);
    const afterInitial = structuredClone(state);
    applyInvoiceToOrder(state, context, order.id, initial);
    applyInvoiceToOrder(state, context, order.id, {
      ...initial,
      event_key: "another-key-for-the-same-initial-receipt",
    });
    expect(state).toEqual(afterInitial);
    expect(state.invoice).toEqual(invoiceSnapshot);
    state.invoice.lines[0].qty_later_received = 2;
    const followup = later(2);
    applyInvoiceToOrder(state, context, order.id, followup);
    const afterLater = structuredClone(state);
    applyInvoiceToOrder(state, context, order.id, followup);
    expect(state).toEqual(afterLater);
    expect(order.lines[0]).toMatchObject({
      ordered_cases: orderedSnapshot.ordered_cases,
      ordered_units: orderedSnapshot.ordered_units,
      units_per_case: orderedSnapshot.units_per_case,
      expected_case_cost: orderedSnapshot.expected_case_cost,
      received_units: 14,
      cancelled_units: 0,
      outstanding_decision: "back_ordered",
    });
    expect(order.receipts).toHaveLength(2);
    expect(order.linked_invoice_ids).toEqual([state.invoice.id]);
    expect(state.ledger).toEqual(ledger);
    expect(state.stock_movements).toEqual(movements);
    const before = structuredClone(state);
    expect(() =>
      applyInvoiceToOrder(state, context, order.id, {
        ...followup,
        event_key: "duplicate-evidence-with-a-new-key",
      }),
    ).toThrow("receipt");
    expect(state).toEqual(before);
  });
});
