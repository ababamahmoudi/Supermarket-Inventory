import { describe, expect, it } from "vitest";
import { invoiceTotalsAlertFacts } from "./alert-totals";

describe("PR 29 totals alert facts", () => {
  it("works out the difference with Decimal, including charges", () => {
    const facts = invoiceTotalsAlertFacts({
      subtotal: "1204.50",
      tax: "26.00",
      final_total: "1230.50",
      lines: [{ line_total: "0.10" }, { line_total: "1100.20" }],
      other_charges: [{ amount: "4.20" }],
    });
    expect(facts).toEqual({
      paperSubtotal: "1204.50",
      calculated: "1104.50",
      difference: "100.00",
      tax: "26.00",
      total: "1230.50",
      kind: "totals",
    });
  });

  it("keeps exact cents where floats would drift", () => {
    const facts = invoiceTotalsAlertFacts({
      subtotal: "0.30",
      tax: "0.00",
      final_total: "0.30",
      lines: [{ line_total: "0.10" }, { line_total: "0.20" }],
    });
    expect(facts.difference).toBe("0.00");
    expect(facts.kind).toBe("tax");
  });

  it("says tax only when the lines agree with the paper subtotal", () => {
    expect(
      invoiceTotalsAlertFacts({
        subtotal: "50.00",
        tax: "9.00",
        final_total: "56.50",
        lines: [{ line_total: "50.00" }],
      }).kind,
    ).toBe("tax");
    const short = invoiceTotalsAlertFacts({
      subtotal: "40.00",
      tax: "5.20",
      final_total: "45.20",
      lines: [{ line_total: "50.00" }],
    });
    expect(short.kind).toBe("totals");
    expect(short.difference).toBe("-10.00");
  });

  it("treats missing or invalid amounts as zero instead of failing", () => {
    expect(
      invoiceTotalsAlertFacts({
        subtotal: "",
        lines: [{ line_total: "abc" }, {}],
      }),
    ).toMatchObject({ paperSubtotal: "0.00", calculated: "0.00", tax: "0.00" });
  });
});
