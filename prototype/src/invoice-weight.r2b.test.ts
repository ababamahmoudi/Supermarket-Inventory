import { expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { mapReadingLine } from "./invoice-readings";
import {
  selectInvoiceWeightUnit,
  setInvoiceWeightQuantity,
  setInvoiceWeightReceived,
  setInvoiceWeightCost,
} from "./invoice-weight";
import { validInvoiceLineQuantity, validInvoiceLineReceived } from "./invoice";

it("does not let an unrelated legacy case cost replace a normal unit-price reading", () => {
  const state = initialState();
  const line = mapReadingLine(
    state,
    undefined,
    {
      description: "Fictional Orchard Tea",
      unit: "each",
      quantity: "3",
      units_per_case: "6",
      unit_cost_before_tax: "2.0000",
      cost_basis: "each",
      cost_per_case_before_tax: "999.0000",
      taxable: false,
    },
    0,
  );
  expect(line).toMatchObject({
    quantity_unit: "units",
    unit_cost_before_tax: "2.0000",
    line_total: "6.00",
  });
  expect(line.case_cost_before_tax).toBeUndefined();
});

it("switches a fully delivered case count to weight without interpreting delivered units as kilograms", () => {
  const state = initialState();
  const line = mapReadingLine(
    state,
    undefined,
    {
      description: "Fictional Loose Tea 10 kg / CASE",
      unit: "CTN",
      quantity: "2",
      units_per_case: "8",
      unit_cost_before_tax: "32.0000",
      cost_basis: "case",
      taxable: false,
    },
    0,
  );
  expect(line.qty_received_at_posting).toBe(16);
  expect(() => selectInvoiceWeightUnit(line, "kg", state.config)).not.toThrow();
  setInvoiceWeightQuantity(line, "20", "kg", state.config);
  expect(line).toMatchObject({
    sold_by: "weight",
    source_quantity: "20",
    source_received_quantity: "20",
    source_quantity_unit: "kg",
    source_cost_unit: "kg",
    source_cost_before_tax: "3.2000",
    line_total: "64.00",
  });
  expect(validInvoiceLineQuantity(line)).toBe(true);
  expect(validInvoiceLineReceived(line)).toBe(true);
});

it("uses the edited case basis after a per-unit cost edit and ignores leftover case cost for a unit quantity", () => {
  const state = initialState();
  const line = mapReadingLine(
    state,
    undefined,
    {
      description: "Fictional Loose Tea 10 kg / CASE",
      unit: "case",
      quantity: "2",
      units_per_case: "8",
      unit_cost_before_tax: "32.0000",
      cost_basis: "case",
      taxable: false,
    },
    0,
  );
  // The real per-unit editor keeps the case field in sync with its explicit edit.
  line.unit_cost_before_tax = "6.0000";
  line.case_cost_before_tax = "48.0000";
  selectInvoiceWeightUnit(line, "kg", state.config);
  expect(line).toMatchObject({
    source_cost_before_tax: "4.8000",
    source_quantity: "20",
    line_total: "96.00",
  });
  const each = mapReadingLine(
    state,
    undefined,
    {
      description: "Fictional Loose Tea",
      unit: "each",
      quantity: "2",
      unit_cost_before_tax: "6.0000",
      taxable: false,
    },
    0,
  );
  each.case_cost_before_tax = "999.0000";
  each.case_weight = "1";
  each.case_weight_unit = "kg";
  selectInvoiceWeightUnit(each, "kg", state.config);
  expect(each).toMatchObject({
    source_cost_before_tax: "6.0000",
    source_quantity: "2",
    line_total: "12.00",
  });
});

it("keeps a partial receipt unresolved when its source unit changes to weight, until a real delivered weight is entered", () => {
  const state = initialState();
  const line = mapReadingLine(
    state,
    undefined,
    {
      description: "Fictional Loose Tea",
      unit: "CTN",
      quantity: "2",
      units_received: "8",
      units_per_case: "8",
      unit_cost_before_tax: "32.0000",
      cost_basis: "case",
      taxable: false,
    },
    0,
  );
  expect(() => selectInvoiceWeightUnit(line, "kg", state.config)).not.toThrow();
  setInvoiceWeightQuantity(line, "2", "kg", state.config);
  expect(line.source_received_quantity).toBe("");
  setInvoiceWeightCost(line, "32.0000", "kg", state.config);
  expect(validInvoiceLineReceived(line)).toBe(false);
  setInvoiceWeightReceived(line, "1.125", state.config);
  expect(validInvoiceLineQuantity(line)).toBe(true);
  expect(validInvoiceLineReceived(line)).toBe(true);
  expect(line.source_received_quantity).toBe("1.125");
});
