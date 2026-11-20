import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { mapReadingLine } from "./invoice-readings";
import { recalculateInvoice, validInvoiceLineQuantity } from "./invoice";
import { splitInvoiceProductDescription } from "./invoice-reading-products";

describe("R2c 0.8 complete pack parsing and exact amounts", () => {
  it.each([
    ["CTN24", "Cedar Preserve", 24],
    ["CTN16", "Cedar Preserve", 16],
    ["Cs15", "Cedar Preserve", 15],
    ["CS", "Cedar Preserve (12/box)", 12],
    ["CS", "Cedar Preserve (20 in box)", 20],
    ["CS", "Cedar Preserve Pieces in Carton: 32", 32],
    ["CS", "Cedar Oil Box of 6*2 lit", 6],
    ["CS", "Cedar Preserve 12x640 gr", 12],
    ["CS", "Cedar Rice 4 x 10 LB / CASE", 4],
    ["CS", "Cedar Rice 5 lb / CASE", 1],
  ])("parses %s / %s", (unit, description, count) => {
    const state = initialState();
    const line = mapReadingLine(
      state,
      undefined,
      { unit, description, quantity: "2", line_total: "48.00", taxable: false },
      0,
    );
    expect(line.units_per_case).toBe(count);
    expect(line.qty_invoiced).toBe(2 * count);
    expect(line.qty_received_at_posting).toBe(2 * count);
    expect(line.unit_cost_before_tax).toBe((48 / (2 * count)).toFixed(4));
    expect(validInvoiceLineQuantity(line)).toBe(true);
    expect(line.low_confidence_fields).not.toContain("units_per_case");
  });
  it("retains a visible one-unit fallback and the unknown-pack question", () => {
    const line = mapReadingLine(
      initialState(),
      undefined,
      {
        unit: "CS",
        description: "Cedar Unknown Pack",
        quantity: "2",
        line_total: "19.00",
        taxable: false,
      },
      0,
    );
    expect(line).toMatchObject({
      units_per_case: 1,
      units_per_case_inferred: true,
      qty_invoiced: 2,
      unit_cost_before_tax: "9.5000",
    });
    expect(line.low_confidence_fields).toContain("units_per_case");
  });
  it("accepts a rounded printed fraction within 0.01 units and preserves its exact money on recalculation", () => {
    const state = initialState();
    const line = mapReadingLine(
      state,
      undefined,
      {
        unit: "CS",
        description: "Cedar Preserve",
        units_per_case: "12",
        quantity: "2.8333",
        line_total: "47.00",
        taxable: false,
      },
      0,
    );
    expect(line).toMatchObject({
      quantity_unit: "units",
      quantity_entered: "34",
      qty_invoiced: 34,
      qty_received_at_posting: 34,
      unit_cost_before_tax: "1.3824",
      line_total: "47.00",
    });
    state.invoice.lines = [line];
    recalculateInvoice(state.invoice, state.config);
    expect(line.line_total).toBe("47.00");
    expect(validInvoiceLineQuantity(line)).toBe(true);
  });
  it("flags a non-whole fraction without claiming zero delivered units or dropping its cost", () => {
    const line = mapReadingLine(
      initialState(),
      undefined,
      {
        unit: "CS",
        description: "Cedar Preserve",
        units_per_case: "3",
        quantity: "0.5",
        line_total: "9.00",
        taxable: false,
      },
      0,
    );
    expect(line.qty_invoiced).toBe(1.5);
    expect(line.qty_received_at_posting).toBe(1.5);
    expect(line.unit_cost_before_tax).toBe("6.0000");
    expect(validInvoiceLineQuantity(line)).toBe(false);
    expect(line.low_confidence_fields).toContain("quantity_entered");
  });
  it("recognizes supplied pack patterns as well as descriptions", () => {
    expect(
      splitInvoiceProductDescription({
        description: "Cedar Rice",
        packSize: "5 lb / CASE",
      }).units_per_case,
    ).toBe(1);
    expect(
      splitInvoiceProductDescription({
        description: "Cedar Preserve",
        packSize: "(20 in box)",
      }).units_per_case,
    ).toBe(20);
  });
});
