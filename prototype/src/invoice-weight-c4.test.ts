import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  addManualLine,
  createInvoice,
  invoiceBlockers,
  postInvoice,
  recalculateInvoice,
  receiveShort,
  lineShort,
} from "./invoice";
import {
  initializeInvoiceWeight,
  invoiceLineCalculation,
  setInvoiceWeightCost,
  setInvoiceWeightQuantity,
  setInvoiceWeightReceived,
} from "./invoice-weight";
import { weightQuantityPerLb } from "./weighed";
import { receivedLog } from "./received";
import {
  invoiceContentCorrectionPreview,
  correctPostedInvoice,
} from "./invoice-corrections";
import { effectiveInvoiceVersion } from "./invoice-version";

function weighted() {
  const state = initialState();
  const product = state.products.find((product) => product.code === "0002")!;
  product.sold_by = "weight";
  product.date_tracking = false;
  state.invoice = createInvoice(state, "Branch 1", true);
  Object.assign(state.invoice, {
    supplier: "Fresh Valley Foods",
    supplier_confirmed: true,
    supplier_invoice_number: "WEIGHT-100",
    file_name: "source.png",
    file_type: "image/png",
    file_data: "data:image/png;base64,c291cmNl",
  });
  addManualLine(state, product.code);
  const line = state.invoice.lines[0];
  setInvoiceWeightQuantity(line, "1.125", "kg", state.config);
  setInvoiceWeightCost(line, "11.0000", "kg", state.config);
  setInvoiceWeightReceived(line, "1.125", state.config);
  recalculateInvoice(state.invoice, state.config);
  line.review_confirmed = true;
  line.date_confirmed = true;
  return state;
}
const context = (state: ReturnType<typeof weighted>) => ({
  company_id: state.config.company.seed_key,
  branch: "Branch 1",
  role: "supervisor" as const,
  actor: "Ali",
});

describe("invoice source weight quantities and exact costs", () => {
  it("creates a new weighed product with the receiver's quantity basis and date choice", () => {
    const state = weighted();
    const line = state.invoice.lines[0];
    line.product_code = "NEW";
    line.new_name_en = "Fictional loose weighed product";
    line.new_name_fa = "کالای وزنی نمایشی";
    line.pricing_category = "grocery";
    line.supplier_item_id = undefined;
    line.supplier_item_code = undefined;
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toEqual([]);
    expect(postInvoice(state, "supervisor", "Branch 1")).toBe(true);
    const product = state.products.find(
      (product) => product.code === line.product_code,
    )!;
    expect(product).toMatchObject({
      sold_by: "weight",
      date_tracking: false,
      unit_size: "",
      last_cost_before_tax: "4.9895",
      status: "pending_approval",
    });
    expect(
      state.approvals.find(
        (approval) => approval.product_code === product.code,
      ),
    ).toMatchObject({
      type: "new_product",
      proposed_price: "7.49",
      unit_cost: "4.9895",
      status: "pending",
    });
  });
  it("retains source kilograms and canonical pounds, exact invoice cents, pricing and Received evidence", () => {
    const state = weighted();
    const line = state.invoice.lines[0];
    expect(line.unit_cost_before_tax).toBe("4.9895");
    expect(line.qty_invoiced).toBe(2.4801975);
    expect(line.line_total).toBe("12.38");
    expect(
      invoiceLineCalculation(line, "grocery", state.config).selling_price,
    ).toBe("7.49");
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toEqual([]);
    postInvoice(state, "supervisor", "Branch 1");
    expect(state.invoice.final_total).toBe("12.38");
    expect(
      state.products.find((product) => product.code === "0002")!
        .last_cost_before_tax,
    ).toBe("4.9895");
    expect(
      receivedLog(state, context(state)).find(
        (row) => row.invoice_id === state.invoice.id,
      ),
    ).toMatchObject({
      sold_by: "weight",
      source_quantity: "1.125",
      source_quantity_unit: "kg",
      units: 2.4801975,
    });
    state.config.weighed_items!.conversion_factor = "2.5";
    expect(
      initializeInvoiceWeight(structuredClone(line), state.config),
    ).toMatchObject({
      line_total: "12.38",
      qty_invoiced: 2.4801975,
      weight_conversion_factor: "2.20462",
    });
  });
  it("uses source arithmetic before rounded canonical cost so large weights do not lose cents", () => {
    const state = weighted();
    const line = state.invoice.lines[0];
    setInvoiceWeightQuantity(line, "1000", "kg", state.config);
    setInvoiceWeightCost(line, "11.0000", "kg", state.config);
    recalculateInvoice(state.invoice, state.config);
    expect(line.line_total).toBe("11000.00");
    expect(
      new Decimal(line.unit_cost_before_tax)
        .times(line.qty_invoiced)
        .toFixed(2),
    ).not.toBe(line.line_total);
  });
  it("supports retained Case of 10 kg, source cost per kg and exact derived fractional-case weights", () => {
    const state = weighted();
    const line = state.invoice.lines[0];
    line.case_weight = "10";
    line.case_weight_unit = "kg";
    setInvoiceWeightQuantity(line, "3", "cases", state.config);
    recalculateInvoice(state.invoice, state.config);
    expect(line.source_quantity).toBe("30");
    expect(line.qty_invoiced).toBe(66.1386);
    expect(line.case_cost_before_tax).toBe("110.00");
    expect(line.line_total).toBe("330.00");
    line.case_weight = "10.125";
    setInvoiceWeightQuantity(line, "1.125", "cases", state.config);
    recalculateInvoice(state.invoice, state.config);
    expect(line.source_quantity).toBe("11.390625");
    expect(line.line_total).toBe("125.30");
    line.review_confirmed = true;
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).not.toContain(
      "quantity",
    );
  });
  it("rejects fourth decimal source input, invalid source cost and delivered weights above invoiced quantities without posting", () => {
    const state = weighted();
    const line = state.invoice.lines[0];
    setInvoiceWeightQuantity(line, "1.1234", "kg", state.config);
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toContain(
      "quantity",
    );
    const next = weighted();
    setInvoiceWeightReceived(next.invoice.lines[0], "1.126", next.config);
    expect(invoiceBlockers(next, "supervisor", "Branch 1")).toContain(
      "quantity",
    );
    const third = weighted();
    setInvoiceWeightCost(
      third.invoice.lines[0],
      "11.00001",
      "kg",
      third.config,
    );
    expect(invoiceBlockers(third, "supervisor", "Branch 1")).toContain("cost");
  });
  it("posts actual partial weights and restores the original short cents exactly through later deliveries", () => {
    const state = weighted();
    const line = state.invoice.lines[0];
    setInvoiceWeightReceived(line, "0.625", state.config);
    line.review_confirmed = true;
    const missing = lineShort(line);
    expect(missing.total).toBe("5.50");
    postInvoice(state, "supervisor", "Branch 1");
    const quantity = new Decimal(
      weightQuantityPerLb("0.5", "kg", line.weight_conversion_factor),
    ).toNumber();
    expect(
      receiveShort(
        state,
        line.product_code,
        quantity,
        "WEIGHT-SHORT",
        "supervisor",
        "Branch 1",
        0,
        "Ali",
      ),
    ).toBe("5.50");
    const receipts = receivedLog(state, context(state)).filter(
      (row) => row.invoice_id === state.invoice.id,
    );
    expect(receipts.map((row) => row.source_quantity).sort()).toEqual([
      "0.5",
      "0.625",
    ]);
  });
  it("corrects source weight/cost with exact delta while keeping the original source evidence", () => {
    const state = weighted();
    postInvoice(state, "supervisor", "Branch 1");
    const original = structuredClone(state.invoice);
    const lines = structuredClone(state.invoice.lines);
    setInvoiceWeightQuantity(lines[0], "1.5", "kg", state.config);
    setInvoiceWeightCost(lines[0], "12.0000", "kg", state.config);
    const proposal = {
      lines,
      reason: "Correct the recorded source weight and cost.",
    };
    const preview = invoiceContentCorrectionPreview(
      state,
      context(state),
      state.invoice.id,
      proposal,
    );
    expect(preview.payable_delta).toBe("5.62");
    correctPostedInvoice(
      state,
      context(state),
      state.invoice.id,
      proposal,
      preview.snapshot,
      "weight-correction",
    );
    expect(state.invoice).toEqual(original);
    expect(effectiveInvoiceVersion(state, state.invoice).final_total).toBe(
      "18.00",
    );
  });
  it("retains a weighed order's case snapshot while allowing a cost correction and blocks a pack rewrite", () => {
    const state = weighted();
    const line = state.invoice.lines[0];
    line.case_weight = "10";
    line.case_weight_unit = "kg";
    setInvoiceWeightQuantity(line, "3", "cases", state.config);
    recalculateInvoice(state.invoice, state.config);
    line.review_confirmed = true;
    postInvoice(state, "supervisor", "Branch 1");
    // This retained link is protected downstream receipt evidence, not a new order.
    state.invoice.lines[0].order_item_id = "retained-weight-order-line";
    state.invoices!.find(
      (row) => row.id === state.invoice.id,
    )!.lines[0].order_item_id = "retained-weight-order-line";
    const original = structuredClone(state.invoice);
    const lines = structuredClone(original.lines);
    setInvoiceWeightCost(lines[0], "12.0000", "kg", state.config);
    const proposal = {
      lines,
      reason: "Correct the cost on the retained case receipt.",
    };
    const preview = invoiceContentCorrectionPreview(
      state,
      context(state),
      original.id,
      proposal,
    );
    expect(preview.blockers).toEqual([]);
    expect(preview.payable_delta).toBe("30.00");
    correctPostedInvoice(
      state,
      context(state),
      original.id,
      proposal,
      preview.snapshot,
      "case-cost-correction",
    );
    expect(state.invoice).toEqual(original);
    const effective = effectiveInvoiceVersion(state, original);
    expect(effective.lines[0]).toMatchObject({
      quantity_unit: "cases",
      quantity_entered: "3",
      case_weight: "10",
      case_weight_unit: "kg",
      source_quantity: "30",
      source_quantity_unit: "kg",
      line_total: "360.00",
      order_item_id: "retained-weight-order-line",
    });
    const altered = structuredClone(effective.lines);
    altered[0].case_weight = "9";
    setInvoiceWeightQuantity(altered[0], "3", "cases", state.config);
    const blocked = invoiceContentCorrectionPreview(
      state,
      context(state),
      original.id,
      { lines: altered, reason: "Try changing the retained pack." },
    );
    expect(blocked.blockers).toContainEqual(
      expect.stringMatching(/retained order receipt/),
    );
    const before = structuredClone(state);
    expect(() =>
      correctPostedInvoice(
        state,
        context(state),
        original.id,
        { lines: altered, reason: "Try changing the retained pack." },
        blocked.snapshot,
        "unsafe-pack-rewrite",
      ),
    ).toThrow(/retained order receipt/);
    expect(state).toEqual(before);
  });
  it("initializes explicit Yes and No date preferences and leaves an unset preference for the receiver", () => {
    const state = initialState();
    for (const [preference, tracking, confirmed] of [
      [true, true, true],
      [false, false, true],
      [undefined, false, false],
    ] as const) {
      const product = state.products.find(
        (product) => product.code === "0002",
      )!;
      product.date_tracking = preference;
      state.invoice = createInvoice(state, "Branch 1", true);
      addManualLine(state, "0002");
      expect(state.invoice.lines[0]).toMatchObject({
        date_tracking: tracking,
        date_confirmed: confirmed,
      });
    }
  });
});
