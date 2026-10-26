import { describe, expect, it } from "vitest";
import typical from "../tests/fixtures/r2c-typical-reading.json";
import {
  actionableReadingChecks,
  type InvoiceReading,
} from "./invoice-readings";
import { fillCalculatedInvoiceTotals } from "./invoice-checks";
import { initialState } from "./e1-bootstrap";

describe("R2c 0.11 totals from complete line evidence", () => {
  it("derives the absent subtotal from lines while keeping unknown tax and total unresolved", () => {
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
      tax: "",
      final_total: "",
      calculated_from_lines: true,
      calculated_fields: ["subtotal"],
      low_confidence_fields: ["tax", "final_total"],
    });
  });
  it("derives the total once a person supplies the missing tax", () => {
    const invoice = {
      subtotal: "",
      tax: "",
      final_total: "",
      lines: [{ line_total: "16.57" }],
    };
    fillCalculatedInvoiceTotals(invoice);
    expect(invoice).toMatchObject({
      subtotal: "16.57",
      tax: "",
      final_total: "",
    });
    invoice.tax = "2.15";
    fillCalculatedInvoiceTotals(invoice);
    expect(invoice).toMatchObject({
      subtotal: "16.57",
      tax: "2.15",
      final_total: "18.72",
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
      tax: "",
      final_total: "",
      calculated_from_lines: true,
    });
    expect(checked.low_confidence_fields).not.toContain("subtotal");
    expect(checked.low_confidence_fields).toEqual(
      expect.arrayContaining(["tax", "final_total"]),
    );
  });
});
