import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { initialState } from "./store";
import { configuredBranches } from "./settings";
import { saveSupplier, supplierRecords } from "./supplier-editor";
import { saveSupplierItem, supplierItemFacts } from "./supplier-items";
import { createOrder, placeOrder, type OrderContext } from "./orders";
import {
  addManualLine,
  createInvoice,
  dateAfter,
  invoiceBlockers,
  lowerPriceLines,
  postInvoice,
  previousReceiptCost,
  recalculateInvoice,
  receiveShort,
  setInvoiceLineQuantity,
} from "./invoice";
import { setInvoiceExtraDecision, setInvoiceOrder } from "./invoice-orders";
import {
  effectiveInvoiceLocation,
  invoiceLocationMovePreview,
  movePostedInvoice,
  receivedLog,
} from "./received";
import { supplierBalanceSummary } from "./supplier-balances";

function fixture(
  firstReceived: number,
  secondReceived: number,
  options: {
    firstRefused?: boolean;
    costs?: readonly [string, string];
  } = {},
) {
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
  const costs = options.costs ?? ["0.9800", "0.9800"];
  const first = saveSupplierItem(state, context, supplier.name, {
    product_code: productCode,
    supplier_item_code: "SAME-PRODUCT-SMALL",
    units_per_case: 6,
    quoted_unit_cost_before_tax: costs[0],
  });
  const second = saveSupplierItem(state, context, supplier.name, {
    product_code: productCode,
    supplier_item_code: "SAME-PRODUCT-LARGE",
    units_per_case: 12,
    quoted_unit_cost_before_tax: costs[1],
  });
  const order = createOrder(state, context, {
    branch,
    supplier: supplier.name,
    lines: [
      ...(!options.firstRefused
        ? [{ supplier_item_id: first.id, cases: "1" }]
        : []),
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
    line.unit_cost_before_tax = costs[index];
    setInvoiceLineQuantity(line, "1", "cases", item.units_per_case);
    line.qty_received_at_posting = [firstReceived, secondReceived][index];
    line.review_confirmed = true;
    line.date_confirmed = true;
    if (line.date_tracking) {
      line.date_type = "best_before";
      line.date_value = dateAfter(state.invoice.invoice_date!, 180);
    }
  }
  recalculateInvoice(state.invoice, state.config);
  setInvoiceOrder(state, "supervisor", branch, order.id);
  if (options.firstRefused)
    setInvoiceExtraDecision(state, "supervisor", branch, 0, "refuse");
  state.invoice.order_missing_decisions = Object.fromEntries(
    order.lines
      .filter((line) => {
        expect(line.new_item).toBeUndefined();
        expect(line.ordered_units).not.toBeNull();
        if (line.ordered_units === null)
          throw new Error(
            "This receipt fixture requires a normal packed supplier item.",
          );
        return (
          state.invoice.lines.find(
            (received) => received.supplier_item_id === line.supplier_item_id,
          )!.qty_received_at_posting < line.ordered_units
        );
      })
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
  it("receives a linked later Short at the corrected Warehouse without moving the original order or replaying liability", () => {
    const { state, context, branch, order, productCode } = fixture(6, 6);
    const originalInvoice = structuredClone(state.invoice);
    const originalOrder = structuredClone(order);
    const supervisor = {
      ...context,
      branch: "all",
      allowed_branches: configuredBranches(state.config, true),
    };
    const preview = invoiceLocationMovePreview(
      state,
      supervisor,
      state.invoice.id,
      "Warehouse",
    );
    movePostedInvoice(
      state,
      supervisor,
      state.invoice.id,
      "Warehouse",
      "Fictional correction of the receiving location",
      preview.snapshot,
    );
    expect(state.invoice).toEqual(originalInvoice);
    expect(order).toEqual(originalOrder);
    expect(effectiveInvoiceLocation(state, state.invoice)).toBe("Warehouse");
    const before = structuredClone(state);
    expect(() =>
      receiveShort(
        state,
        productCode,
        2,
        "C2-CORRECTED-LOCATION-DELIVERY",
        "floor_worker",
        branch,
        1,
      ),
    ).toThrow("permitted");
    expect(state).toEqual(before);
    const balance = (location: string) =>
      supplierBalanceSummary(
        state,
        { ...context, branch: location },
        state.invoice.supplier,
      ).balance;
    const originalBranchBalance = balance(branch);
    const warehouseBalance = balance("Warehouse");
    const receiver = "Fictional Warehouse receiver";
    expect(
      receiveShort(
        state,
        productCode,
        2,
        "C2-CORRECTED-LOCATION-DELIVERY",
        "floor_worker",
        "Warehouse",
        1,
        receiver,
      ),
    ).toBe("1.96");
    expect(balance(branch)).toBe(originalBranchBalance);
    expect(balance("Warehouse")).toBe(
      new Decimal(warehouseBalance).plus("1.96").toFixed(2),
    );
    expect(order.branch).toBe(originalOrder.branch);
    expect(order.lines[1].received_units).toBe(8);
    expect(order.receipts.at(-1)).toMatchObject({
      by: receiver,
      receiving_branch: "Warehouse",
    });
    expect(order.lines[1]).toMatchObject({
      units_per_case: originalOrder.lines[1].units_per_case,
      ordered_units: originalOrder.lines[1].ordered_units,
      expected_case_cost: originalOrder.lines[1].expected_case_cost,
      expected_unit_cost: originalOrder.lines[1].expected_unit_cost,
    });
    expect({
      ...state.invoice,
      payable_after_open_shorts: originalInvoice.payable_after_open_shorts,
      short_receipt_keys: originalInvoice.short_receipt_keys,
      lines: state.invoice.lines.map((line, index) => ({
        ...line,
        qty_later_received: originalInvoice.lines[index].qty_later_received,
      })),
    }).toEqual(originalInvoice);
    expect(
      receivedLog(state, { ...context, branch: "Warehouse" }).filter(
        (entry) =>
          entry.invoice_id === state.invoice.id &&
          entry.kind === "short_delivery",
      ),
    ).toMatchObject([
      {
        branch: "Warehouse",
        line_index: 1,
        units: 2,
        received_by: receiver,
      },
    ]);
    expect(state.ledger).toContainEqual(
      expect.objectContaining({
        invoice_id: state.invoice.id,
        type: "short_restoration",
        branch: "Warehouse",
        amount: "1.96",
      }),
    );
    expect(state.activity).toContainEqual(
      expect.objectContaining({
        action: "Received short delivery",
        branch: "Warehouse",
        by: receiver,
      }),
    );
    expect(state.activity).toContainEqual(
      expect.objectContaining({
        action: "Receive order Short delivery",
        branch: "Warehouse",
        by: receiver,
      }),
    );
    const saved = structuredClone(state);
    expect(
      receiveShort(
        state,
        productCode,
        2,
        "C2-CORRECTED-LOCATION-DELIVERY",
        "floor_worker",
        "Warehouse",
        1,
        receiver,
      ),
    ).toBe("0.00");
    expect(state).toEqual(saved);
  });

  it.each([false, true])(
    "uses the accepted matching supplier SKU as the lower-price baseline with first SKU refused=%s",
    (firstRefused) => {
      const { state, branch, productCode, second } = fixture(6, 12, {
        firstRefused,
        costs: ["1.0000", "2.0000"],
      });
      const original = structuredClone(state.invoices![0]);
      state.invoice = createInvoice(state, branch, true);
      state.invoice.supplier = original.supplier;
      addManualLine(state, productCode, second.id);
      const line = state.invoice.lines[0];
      line.unit_cost_before_tax = "1.5000";
      expect(previousReceiptCost(state, productCode, line)).toMatchObject({
        cost: "2.0000",
        reference: original.supplier_invoice_number,
      });
      expect(lowerPriceLines(state)).toEqual([line]);
      expect(state.invoices![0]).toEqual(original);
    },
  );

  it("retains actual previous purchase history through an audited supplier rename", () => {
    const { state, branch, productCode, second, context } = fixture(6, 12, {
      costs: ["1.0000", "2.0000"],
    });
    const original = structuredClone(state.invoices![0]);
    const supplier = supplierRecords(state).find(
      (item) => item.name === original.supplier,
    )!;
    const renamed = saveSupplier(
      state,
      context,
      {
        name: "Fictional renamed supplier for C2 review",
        phone: supplier.phone,
        email: supplier.email,
        sales_rep_name: supplier.sales_rep_name,
        sales_rep_phone: supplier.sales_rep_phone,
        payment_terms: supplier.payment_terms,
        address: supplier.address ?? "",
        notes: supplier.notes ?? "",
        similar_name_confirmed: true,
      },
      { id: supplier.id },
    );
    expect(renamed.previous_names).toContain(original.supplier);
    state.invoice = createInvoice(state, branch, true);
    state.invoice.supplier = renamed.name;
    addManualLine(state, productCode, second.id);
    const line = state.invoice.lines[0];
    line.unit_cost_before_tax = "1.5000";
    expect(previousReceiptCost(state, productCode, line)).toMatchObject({
      cost: "2.0000",
      reference: original.supplier_invoice_number,
    });
    expect(lowerPriceLines(state)).toEqual([line]);
    expect(state.invoices![0]).toEqual(original);
    expect(state.activity).toContainEqual(
      expect.objectContaining({
        entity_id: supplier.id,
        action: "Save supplier",
      }),
    );
  });

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
