import { projectHistoryEntry } from "./history";
import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { initialState } from "./e1-bootstrap";
import { mapReadingLine } from "./invoice-readings";
import { invoicePackWeight } from "./invoice-case-weight";
import {
  invoiceLineAmount,
  invoiceLineCalculation,
  invoicePaperTotalMismatch,
  invoiceWeightDisplayedCost,
  invoiceWeightDisplayedQuantity,
  selectInvoiceLineUnit,
  setInvoiceCaseWeight,
  setInvoiceWeightCaseCost,
  setInvoiceWeightCost,
  setInvoiceWeightQuantity,
  setInvoiceWeightReceived,
} from "./invoice-weight";
import {
  validInvoiceLineQuantity,
  validInvoiceLineReceived,
  invoiceBlockers,
  postInvoice,
  createInvoice,
  recalculateInvoice,
} from "./invoice";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  acknowledgeInvoicePaperTotal,
  confirmInvoiceLineChecks,
} from "./invoice-checks";
function example(pack = "10 lb / CASE", cost = "25.0000", quantity = "4") {
  const state = initialState();
  const line = mapReadingLine(
    state,
    undefined,
    {
      description: "Fictional Alder Spice",
      pack_size: pack,
      unit: "case",
      quantity,
      cost_basis: "case",
      unit_cost_before_tax: cost,
      line_total: new Decimal(cost).times(quantity).toFixed(2),
      taxable: false,
    },
    0,
  );
  return { state, line };
}
describe("R2e A measured weight cases preserve money", () => {
  it.each([
    ["10 LB/CASE", "10", "lb", 1],
    ["2 KG", "2", "kg", 1],
    ["500G", "0.5", "kg", 1],
    ["10 LB/BAG", "10", "lb", 1],
    ["4 x 10 LB / CASE", "40", "lb", 4],
  ])(
    "reads %s without confusing a unit count with weight",
    (pack, weight, unit, units) => {
      expect(invoicePackWeight(pack)).toEqual({ weight, unit, units });
    },
  );
  it("converts both quantity and cost and returns through lb, kg, cases and units with exact paper cents", () => {
    const { state, line } = example();
    expect(line).toMatchObject({
      case_weight: "10",
      case_weight_unit: "lb",
      quantity_unit: "cases",
      sold_by: "each",
    });
    selectInvoiceLineUnit(line, "lb", state.config);
    expect(line).toMatchObject({
      qty_invoiced: 40,
      qty_received_at_posting: 40,
      unit_cost_before_tax: "2.5000",
      line_total: "100.00",
    });
    expect(
      invoiceLineCalculation(line, "grocery", state.config).selling_price,
    ).toBe("3.99");
    expect(invoiceWeightDisplayedCost(line)).toBe("2.5000");
    selectInvoiceLineUnit(line, "kg", state.config);
    expect(invoiceWeightDisplayedQuantity(line)).toBe("18.144");
    expect(invoiceWeightDisplayedCost(line)).toBe("5.5116");
    expect(invoiceLineAmount(line)).toBe("100.00");
    expect(validInvoiceLineQuantity(line)).toBe(true);
    selectInvoiceLineUnit(line, "cases", state.config);
    expect(line).toMatchObject({
      quantity_entered: "4",
      case_cost_before_tax: "25.0000",
      line_total: "100.00",
    });
    selectInvoiceLineUnit(line, "units", state.config);
    expect(line).toMatchObject({
      quantity_entered: "4",
      unit_cost_before_tax: "25.0000",
      qty_invoiced: 4,
      line_total: "100.00",
    });
    selectInvoiceLineUnit(line, "cases", state.config);
    selectInvoiceLineUnit(line, "lb", state.config);
    expect(invoiceLineAmount(line)).toBe("100.00");
    expect(invoicePaperTotalMismatch(line)).toBeUndefined();
  });
  it("retains a 4 by 10 lb pack as four units until weight is explicitly selected", () => {
    const { state, line } = example("4 x 10 LB / CASE");
    expect(line).toMatchObject({
      units_per_case: 4,
      qty_invoiced: 16,
      sold_by: "each",
      case_weight: "40",
    });
    selectInvoiceLineUnit(line, "lb", state.config);
    expect(line).toMatchObject({
      qty_invoiced: 160,
      unit_cost_before_tax: "0.6250",
      line_total: "100.00",
    });
  });
  it("does not guess an unstated or zero weight, and an explicit weight resolves the actual case facts", () => {
    const { state, line } = example("Unknown bag");
    selectInvoiceLineUnit(line, "lb", state.config);
    expect(line.source_quantity).toBe("");
    expect(line.source_cost_before_tax).toBe("");
    expect(validInvoiceLineQuantity(line)).toBe(false);
    setInvoiceCaseWeight(line, "0", "lb", state.config);
    expect(validInvoiceLineQuantity(line)).toBe(false);
    setInvoiceCaseWeight(line, "10", "lb", state.config);
    expect(line).toMatchObject({
      qty_invoiced: 40,
      qty_received_at_posting: 40,
      unit_cost_before_tax: "2.5000",
      line_total: "100.00",
    });
  });
  it("can cancel an unknown-mass weight choice without losing original cases, cost or a partial receipt", () => {
    const { state, line } = example("Unknown case mass");
    line.qty_received_at_posting = 2;
    selectInvoiceLineUnit(line, "kg", state.config);
    expect(validInvoiceLineQuantity(line)).toBe(false);
    selectInvoiceLineUnit(line, "units", state.config);
    expect(line).toMatchObject({
      sold_by: "each",
      quantity_unit: "units",
      qty_invoiced: 4,
      qty_received_at_posting: 2,
      unit_cost_before_tax: "25.0000",
      line_total: "100.00",
    });
    selectInvoiceLineUnit(line, "cases", state.config);
    expect(line).toMatchObject({
      quantity_entered: "4",
      case_cost_before_tax: "25.0000",
      line_total: "100.00",
    });
  });
  it("derives a native weight line's case quote after mass is supplied, while requiring an explicit unresolved delivered quantity", () => {
    const state = initialState();
    const line = mapReadingLine(
      state,
      undefined,
      {
        description: "Fictional loose seed",
        unit: "kg",
        quantity: "10",
        unit_cost_before_tax: "11.0000",
        cost_basis: "kg",
        line_total: "110.00",
        taxable: false,
      },
      0,
    );
    line.source_received_quantity = "5";
    line.qty_received_at_posting = 11.0231;
    selectInvoiceLineUnit(line, "cases", state.config);
    setInvoiceWeightQuantity(line, "2", "cases", state.config);
    setInvoiceCaseWeight(line, "5", "kg", state.config);
    expect(line).toMatchObject({
      quantity_entered: "2",
      case_cost_before_tax: "55.00",
      source_cost_before_tax: "11.0000",
      source_quantity: "10",
      line_total: "110.00",
    });
    expect(validInvoiceLineReceived(line)).toBe(false);
    setInvoiceWeightReceived(line, "5", state.config);
    expect(validInvoiceLineReceived(line)).toBe(true);
    expect(line.qty_received_at_posting).toBe(11.0231);
  });
  it("preserves exact case cents when division repeats, including after a case-cost edit", () => {
    const { state, line } = example("3 lb/CASE", "1.0000", "100");
    selectInvoiceLineUnit(line, "lb", state.config);
    expect(line.unit_cost_before_tax).toBe("0.3333");
    expect(invoiceLineAmount(line)).toBe("100.00");
    selectInvoiceLineUnit(line, "kg", state.config);
    expect(invoiceLineAmount(line)).toBe("100.00");
    selectInvoiceLineUnit(line, "cases", state.config);
    setInvoiceWeightCaseCost(line, "2.0000", state.config);
    expect(line.unit_cost_before_tax).toBe("0.6667");
    expect(invoiceLineAmount(line)).toBe("200.00");
    expect(invoicePaperTotalMismatch(line)).toEqual({
      paper: "100.00",
      calculated: "200.00",
    });
  });
  it("keeps exact case-derived fractional mass valid when switching weight displays", () => {
    const { state, line } = example("10.125 kg/CASE", "25.0000", "0.5");
    selectInvoiceLineUnit(line, "kg", state.config);
    expect(line.source_quantity).toBe("5.0625");
    expect(line.line_total).toBe("12.50");
    expect(validInvoiceLineQuantity(line)).toBe(true);
    expect(validInvoiceLineReceived(line)).toBe(true);
    selectInvoiceLineUnit(line, "lb", state.config);
    expect(invoiceLineAmount(line)).toBe("12.50");
    selectInvoiceLineUnit(line, "cases", state.config);
    expect(line.quantity_entered).toBe("0.5");
    expect(invoiceLineAmount(line)).toBe("12.50");
  });
  it("keeps partial physical receipts when converting known packs and never promotes a partial receipt to full", () => {
    const { state, line } = example();
    line.qty_received_at_posting = 2;
    selectInvoiceLineUnit(line, "lb", state.config);
    expect(line.qty_received_at_posting).toBe(20);
    expect(validInvoiceLineReceived(line)).toBe(true);
    selectInvoiceLineUnit(line, "kg", state.config);
    selectInvoiceLineUnit(line, "cases", state.config);
    expect(line.source_received_quantity).toBe("20");
    selectInvoiceLineUnit(line, "units", state.config);
    expect(line.qty_received_at_posting).toBe(2);
  });
  it("derives missing case costs from a weight-origin price and its explicit cost unit", () => {
    const state = initialState();
    const line = mapReadingLine(
      state,
      undefined,
      {
        description: "Fictional loose seed",
        unit: "kg",
        quantity: "10",
        unit_cost_before_tax: "11.0000",
        cost_basis: "kg",
        line_total: "110.00",
        taxable: false,
      },
      0,
    );
    line.case_weight = "5";
    line.case_weight_unit = "kg";
    line.units_per_case = 1;
    line.source_received_quantity = "5";
    line.qty_received_at_posting = 11.0231;
    selectInvoiceLineUnit(line, "cases", state.config);
    expect(line).toMatchObject({
      case_cost_before_tax: "55.00",
      quantity_entered: "2",
      source_received_quantity: "5",
      line_total: "110.00",
    });
    selectInvoiceLineUnit(line, "units", state.config);
    expect(line).toMatchObject({
      qty_invoiced: 2,
      qty_received_at_posting: 1,
      unit_cost_before_tax: "55.0000",
      line_total: "110.00",
    });
  });
  it("blocks Confirm and posting on a paper mismatch, requires a separate acknowledgement and invalidates it after another cost edit", () => {
    const { state, line } = example();
    const actor = authenticatedTestActor(state, "manager");
    state.invoice = createInvoice(state, actor, "Branch 1", true);
    state.invoice.lines = [line];
    line.pricing_category = "grocery";
    selectInvoiceLineUnit(line, "lb", state.config);
    setInvoiceWeightCost(line, "25.0000", "lb", state.config);
    expect(invoicePaperTotalMismatch(line)).toEqual({
      paper: "100.00",
      calculated: "1000.00",
    });
    expect(() => confirmInvoiceLineChecks(state, actor, 0)).toThrow(
      /paper total/,
    );
    expect(invoiceBlockers(state, actor)).toContain("cost");
    acknowledgeInvoicePaperTotal(state, actor, 0);
    expect(invoicePaperTotalMismatch(line)).toBeUndefined();
    expect(state.activity.at(-1)?.action).toBe(
      "Invoice paper total acknowledged as wrong",
    );
    confirmInvoiceLineChecks(state, actor, 0);
    setInvoiceWeightCost(line, "20.0000", "lb", state.config);
    expect(invoicePaperTotalMismatch(line)?.calculated).toBe("800.00");
    expect(() => confirmInvoiceLineChecks(state, actor, 0)).toThrow(
      /paper total/,
    );
  });
  it("keeps paper-total acknowledgement money private in a worker's own History entry", () => {
    const { state, line } = example();
    const actor = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
    });
    state.invoice = createInvoice(state, actor, "Branch 1", false);
    state.invoice.lines = [line];
    selectInvoiceLineUnit(line, "lb", state.config);
    setInvoiceWeightCost(line, "25.0000", "lb", state.config);
    acknowledgeInvoicePaperTotal(state, actor, 0);
    const entry = state.activity.at(-1)!;
    expect(entry.after).toHaveProperty("paper_total_acknowledgement");
    expect(projectHistoryEntry(state, actor, entry).after).not.toHaveProperty(
      "paper_total_acknowledgement",
    );
  });
  it("posts the converted line and creates the real first-price approval from the canonical per-lb cost", () => {
    const { state, line } = example();
    const actor = authenticatedTestActor(state, "manager");
    state.invoice = createInvoice(state, actor, "Branch 1", true);
    Object.assign(state.invoice, {
      supplier: "Fresh Valley Foods",
      supplier_confirmed: true,
      supplier_invoice_number: "ALDER-WEIGHT-01",
      file_name: "fictional-original.png",
      file_type: "image/png",
      file_data: "data:image/png;base64,c291cmNl",
    });
    state.invoice.lines = [line];
    line.pricing_category = "grocery";
    selectInvoiceLineUnit(line, "lb", state.config);
    recalculateInvoice(state.invoice, state.config);
    confirmInvoiceLineChecks(state, actor, 0);
    expect(invoiceBlockers(state, actor)).toEqual([]);
    expect(postInvoice(state, actor)).toBe(true);
    expect(
      state.approvals.find((row) => row.product_code === line.product_code),
    ).toMatchObject({
      type: "new_product",
      unit_cost: "2.5000",
      proposed_price: "3.99",
      status: "pending",
    });
  });
});
