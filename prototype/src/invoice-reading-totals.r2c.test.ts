import { describe, expect, it } from "vitest";
import typical from "../tests/fixtures/r2c-typical-reading.json";
import {
  actionableReadingChecks,
  type InvoiceReading,
} from "./invoice-readings";
import { fillCalculatedInvoiceTotals } from "./invoice-checks";
import { initialState } from "./e1-bootstrap";

describe("R2c 0.11 totals from complete line evidence", () => {
  it("derives all absent invoice totals from exact item and signed charge amounts", () => {
    const invoice = {
      subtotal: "",
      tax: "",
      final_total: "",
      low_confidence_fields: ["subtotal", "tax", "final_total"],
      calculated_fields: [] as string[],
      calculated_from_lines: false,
      lines: [{ line_total: "13.17" }, { line_total: "2.49" }],
      other_charges: [{ amount: "1.25" }, { amount: "-0.34" }],
    };
    fillCalculatedInvoiceTotals(invoice);
    expect(invoice).toMatchObject({
      subtotal: "16.57",
      tax: "0.00",
      final_total: "16.57",
      calculated_from_lines: true,
      calculated_fields: ["subtotal", "tax", "final_total"],
      low_confidence_fields: [],
    });
  });
  it("does not invent zero totals when any line or charge amount is unresolved", () => {
    for (const evidence of [
      { lines: [{ line_total: "" }], other_charges: [] },
      { lines: [{ line_total: "2.00" }], other_charges: [{ amount: "" }] },
    ]) {
      const invoice = { subtotal: "", tax: "", final_total: "", ...evidence };
      fillCalculatedInvoiceTotals(invoice);
      expect(invoice).toMatchObject({ subtotal: "", tax: "", final_total: "" });
    }
  });
  it("preserves printed totals and arithmetic mismatches for review", () => {
    const invoice = {
      subtotal: "10.00",
      tax: "1.00",
      final_total: "9.00",
      lines: [{ line_total: "12.00" }],
    };
    fillCalculatedInvoiceTotals(invoice);
    expect(invoice).toEqual({
      subtotal: "10.00",
      tax: "1.00",
      final_total: "9.00",
      lines: [{ line_total: "12.00" }],
    });
  });
  it("gives import preview the same calculated line totals and quiet provenance", () => {
    const reading = {
      ...typical.reading,
      final_total: null,
      lines: [
        ...typical.reading.lines,
        {
          line_type: "discount",
          description: "Fictional discount",
          line_total: "0.35",
          taxable: false,
        },
      ],
    } as InvoiceReading;
    const checked = actionableReadingChecks(initialState(), reading, {});
    expect(checked).toMatchObject({
      subtotal: "119.65",
      tax: "0.00",
      final_total: "119.65",
      calculated_from_lines: true,
    });
    expect(checked.low_confidence_fields).not.toContain("final_total");
  });
});
