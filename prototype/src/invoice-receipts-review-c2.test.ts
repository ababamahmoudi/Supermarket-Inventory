import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { configuredBranches } from "./settings";
import { supplierRecords } from "./supplier-editor";
import { saveSupplierItem, supplierItemFacts } from "./supplier-items";
import { createOrder, placeOrder, type OrderContext } from "./orders";
import {
  addManualLine,
  createInvoice,
  invoiceBlockers,
  postInvoice,
  recalculateInvoice,
  receiveShort,
  setInvoiceLineQuantity,
} from "./invoice";
import { setInvoiceOrder } from "./invoice-orders";
import { receivedLog } from "./received";

function fixture(firstReceived: number, secondReceived: number) {
  const state = initialState();
  state.orders = [];
  state.supplier_items = [];
  state.invoices = [];
  const branch = configuredBranches(state.config)[0];
  const context: OrderContext = {
    company_id: state.config.company.seed_key,
    role: "supervisor",
    branch,
    allowed_branches: [branch],
    actor: "Demo Supervisor",
  };
  const supplier = supplierRecords(state).find(
    (item) => item.name === "Fresh Valley Foods",
  )!;
  const productCode = "0002";
  const first = saveSupplierItem(state, context, supplier.name, {
    product_code: productCode,
    supplier_item_code: "SAME-PRODUCT-SMALL",
    units_per_case: 6,
    quoted_unit_cost_before_tax: "0.9800",
  });
  const second = saveSupplierItem(state, context, supplier.name, {
    product_code: productCode,
    supplier_item_code: "SAME-PRODUCT-LARGE",
    units_per_case: 12,
    quoted_unit_cost_before_tax: "0.9800",
  });
  const order = createOrder(state, context, {
    branch,
    supplier: supplier.name,
    lines: [
      { supplier_item_id: first.id, cases: "1" },
      { supplier_item_id: second.id, cases: "1" },
    ],
  });
  placeOrder(state, context, order.id, order.version);
  state.invoice = createInvoice(state, branch, true);
  state.invoice.supplier = supplier.name;
  state.invoice.supplier_confirmed = true;
  state.invoice.supplier_invoice_number = "C2-DUPLICATE-PRODUCT-REVIEW";
  state.invoice.file_name = "fictional-invoice.png";
  state.invoice.file_data = "data:image/png;base64,ZGVtbw==";
  for (const [index, item] of [first, second].entries()) {
    addManualLine(state, productCode, item.id);
    const line = state.invoice.lines[index];
    line.unit_cost_before_tax = "0.9800";
    setInvoiceLineQuantity(line, "1", "cases", item.units_per_case);
    line.qty_received_at_posting = [firstReceived, secondReceived][index];
    line.review_confirmed = true;
    line.date_confirmed = true;
  }
  recalculateInvoice(state.invoice, state.config);
  setInvoiceOrder(state, "supervisor", branch, order.id);
  state.invoice.order_missing_decisions = Object.fromEntries(
    order.lines
      .filter(
        (line, index) =>
          [firstReceived, secondReceived][index] < line.ordered_units,
      )
      .map((line) => [line.id, "short"]),
  );
  for (const line of state.invoice.lines) {
    line.review_confirmed = true;
    line.date_confirmed = true;
  }
  expect(invoiceBlockers(state, "supervisor", branch)).toEqual([]);
  postInvoice(state, "supervisor", branch, context.actor);
  return { state, context, branch, order, productCode, first, second };
}

describe("independent same-product supplier SKU delivery review", () => {
  it("receives the second SKU's Short without touching a fully delivered first SKU", () => {
    const { state, branch, order, productCode, context, first, second } =
      fixture(6, 6);
    const firstSnapshot = structuredClone(state.invoice.lines[0]);
    const before = structuredClone(state);
    expect(() =>
      receiveShort(state, productCode, 2, "AMBIGUOUS", "supervisor", branch),
    ).toThrow();
    expect(state).toEqual(before);
    expect(
      receiveShort(
        state,
        productCode,
        2,
        "C2-LARGE-PACK-DELIVERY",
        "supervisor",
        branch,
        1,
      ),
    ).toBe("1.96");
    expect(state.invoice.lines[0]).toEqual(firstSnapshot);
    expect(state.invoice.lines[1].qty_later_received).toBe(2);
    expect(order.lines.map((line) => line.received_units)).toEqual([6, 8]);
    expect(order.receipts.at(-1)?.lines).toMatchObject([
      {
        order_line_id: order.lines[1].id,
        invoice_line_index: 1,
        credited_units: 2,
      },
    ]);
    expect(state.invoice.payable_after_open_shorts).toBe("13.72");
    const actual = receivedLog(state, context).filter(
      (row) =>
        row.invoice_id === state.invoice.id && row.kind === "short_delivery",
    );
    expect(actual).toMatchObject([
      { line_index: 1, units: 2, units_per_case: 12 },
    ]);
    const facts = supplierItemFacts(
      state,
      context.company_id,
      state.invoice.supplier,
      branch,
    );
    expect(
      facts.find((item) => item.id === first.id)?.history[0].received_units,
    ).toBe(6);
    expect(
      facts.find((item) => item.id === second.id)?.history[0].received_units,
    ).toBe(8);
  });

  it("uses one delivery document for separate SKU lines once each, with unique audit and physical evidence", () => {
    const { state, branch, order, productCode } = fixture(4, 10);
    const document = "C2-ONE-DOCUMENT-TWO-SKUS";
    expect(
      receiveShort(state, productCode, 2, document, "supervisor", branch, 0),
    ).toBe("1.96");
    expect(
      receiveShort(state, productCode, 2, document, "supervisor", branch, 1),
    ).toBe("1.96");
    expect(state.invoice.lines.map((line) => line.qty_later_received)).toEqual([
      2, 2,
    ]);
    expect(order.lines.map((line) => line.received_units)).toEqual([6, 12]);
    expect(order.status).toBe("received");
    expect(order.receipts).toHaveLength(3);
    expect(state.invoice.payable_after_open_shorts).toBe("17.64");
    const ledger = state.ledger.filter(
      (entry) =>
        entry.invoice_id === state.invoice.id &&
        entry.type === "short_restoration",
    );
    const movements =
      state.stock_movements?.filter(
        (entry) =>
          entry.invoice_id === state.invoice.id &&
          entry.type === "short_resolved_received",
      ) ?? [];
    const activity = state.activity.filter(
      (entry) =>
        entry.action === "Received short delivery" &&
        entry.id.startsWith(state.invoice.id),
    );
    for (const records of [ledger, movements, activity]) {
      expect(records).toHaveLength(2);
      expect(new Set(records.map((entry) => entry.id)).size).toBe(2);
    }
    expect(movements.map((entry) => entry.line_index)).toEqual([0, 1]);
    const saved = structuredClone(state);
    for (const index of [0, 1])
      expect(
        receiveShort(
          state,
          productCode,
          2,
          document,
          "supervisor",
          branch,
          index,
        ),
      ).toBe("0.00");
    expect(state).toEqual(saved);
  });
});
