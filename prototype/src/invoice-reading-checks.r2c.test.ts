import { describe, expect, it } from "vitest";
import fixture from "../tests/fixtures/r2c-typical-reading.json";
import { initialState } from "./e1-bootstrap";
import {
  actionableReadingChecks,
  mapReadingLine,
  type InvoiceReading,
} from "./invoice-readings";
import {
  fillCalculatedInvoiceTotals,
  invoiceCheckCount,
  visibleInvoiceCheckFields,
} from "./invoice-checks";

describe("R2c 0.10 quiet provenance and genuine checks", () => {
  it("keeps typical fictional import below one highlighted check per line", () => {
    const invoice = actionableReadingChecks(
      initialState(),
      fixture.reading as InvoiceReading,
      fixture.statuses as Record<string, "check">,
    );
    expect(invoiceCheckCount(invoice)).toBe(1);
    expect(invoiceCheckCount(invoice)).toBeLessThan(invoice.lines.length);
    expect(invoice.low_confidence_fields).not.toContain("received_at");
    expect(invoice.low_confidence_fields).not.toContain("branch_hint");
    expect(invoice.lines[3].low_confidence_fields).toEqual(["barcode"]);
    expect(invoice.calculated_fields).toEqual(["subtotal", "tax"]);
    expect(invoice.subtotal).toBe("120.00");
    expect(invoice.tax).toBe("0.00");
  });
  it("retains handwriting and explicitly flagged optional fields as real checks", () => {
    const invoice = actionableReadingChecks(
      initialState(),
      {
        ...fixture.reading,
        handwritten_notes: ["Jul 13 2:15"],
      } as InvoiceReading,
      { "header.order_reference": "check", "lines[0].barcode": "check" },
    );
    expect(invoice.low_confidence_fields).toContain("received_at");
    expect(invoice.low_confidence_fields).toContain("order_reference");
    expect(invoice.lines[0].low_confidence_fields).toContain("barcode");
  });
  it.each(["0", "-2", "1.5"])(
    "keeps invalid printed pack %s as a visible one-unit unresolved check",
    (units_per_case) => {
      const line = mapReadingLine(
        initialState(),
        undefined,
        {
          description: "Cedar Preserve",
          unit: "CS",
          quantity: "2",
          units_per_case,
          line_total: "16.00",
          taxable: false,
        },
        0,
      );
      expect(line.units_per_case).toBe(1);
      expect(line.qty_invoiced).toBe(2);
      expect(line.unit_cost_before_tax).toBe("8.0000");
      expect(line.low_confidence_fields).toContain("units_per_case");
    },
  );
  it("retains legacy calculated provenance without requiring a fabricated checker", () => {
    const invoice = {
      subtotal: "12.00",
      tax: "0.00",
      final_total: "12.00",
      low_confidence_fields: [
        "calculated:subtotal",
        "calculated:tax",
        "supplier_tax_number",
      ],
      calculated_fields: [] as string[],
    };
    fillCalculatedInvoiceTotals(invoice);
    expect(invoice.calculated_fields).toEqual(["subtotal", "tax"]);
    expect(visibleInvoiceCheckFields(invoice)).toEqual(["supplier_tax_number"]);
    expect(invoice.low_confidence_fields).toEqual(["supplier_tax_number"]);
  });
});
