import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import {
  allocateInvoiceCredits,
  invoiceLineCost,
  splitInvoiceCredit,
} from "./invoice-credit-allocation";
import { invoiceCheckCount } from "./invoice-checks";
import { recalculateInvoice } from "./invoice";
import type { DemoState } from "./types";

type Line = DemoState["invoice"]["lines"][number];

function invoiceWith(
  lines: { id: string; qty: number; cost: string }[],
  credit: string,
) {
  const state = initialState();
  const template = structuredClone(state.invoice.lines[0]) as Line;
  const invoice = structuredClone(state.invoice);
  invoice.status = "review";
  delete invoice.reading_record;
  invoice.final_total_manual = false;
  invoice.lines = lines.map(({ id, qty, cost }) => ({
    ...structuredClone(template),
    id,
    product_code: "NEW",
    sold_by: "each",
    quantity_unit: "units",
    quantity_entered: String(qty),
    qty_invoiced: qty,
    qty_received_at_posting: qty,
    refused_units: 0,
    unit_cost_before_tax: cost,
    line_total: new Decimal(cost).times(qty).toFixed(2),
    tax_profile: "non_taxable",
    taxable: false,
    low_confidence_fields: [],
  }));
  invoice.other_charges = [
    {
      line_type: "discount",
      description: "Fictional credit",
      amount: credit,
      taxable: false,
    },
  ];
  return { invoice, config: state.config };
}

describe("PR 29 credits on chosen items", () => {
  it("splits Ali's example: A gets -$12.00 → $4.8000, B -$8.00 → $8.0000", () => {
    const { invoice } = invoiceWith(
      [
        { id: "A", qty: 10, cost: "6.0000" },
        { id: "B", qty: 4, cost: "10.0000" },
      ],
      "-20.00",
    );
    invoice.other_charges![0].applies_to = "chosen_items";
    invoice.other_charges![0].chosen_line_ids = ["A", "B"];
    allocateInvoiceCredits(invoice);
    expect(invoice.other_charges![0].allocations).toEqual([
      {
        line_id: "A",
        amount: "-12.00",
        unit_cost_before: "6.0000",
        unit_cost_after: "4.8000",
      },
      {
        line_id: "B",
        amount: "-8.00",
        unit_cost_before: "10.0000",
        unit_cost_after: "8.0000",
      },
    ]);
    expect(invoiceLineCost(invoice.lines[0])).toBe("4.8000");
    expect(invoiceLineCost(invoice.lines[1])).toBe("8.0000");
    // The paper lines are untouched.
    expect(invoice.lines.map((line) => line.line_total)).toEqual([
      "60.00",
      "40.00",
    ]);
  });

  it("gives the rounding remainder to the last chosen line so shares add up", () => {
    expect(splitInvoiceCredit("-10.00", ["10.00", "10.00", "10.00"])).toEqual([
      "3.33",
      "3.33",
      "3.34",
    ]);
    const shares = splitInvoiceCredit("-7.01", ["3.00", "5.00", "11.00"]);
    expect(Decimal.sum(...shares).toFixed(2)).toBe("7.01");
    expect(shares).toEqual(["1.11", "1.84", "4.06"]);
  });

  it("keeps subtotal, tax, total and payable identical for both choices", () => {
    const totals = (choice: "invoice_total" | "chosen_items") => {
      const { invoice, config } = invoiceWith(
        [
          { id: "A", qty: 10, cost: "6.0000" },
          { id: "B", qty: 4, cost: "10.0000" },
        ],
        "-20.00",
      );
      invoice.other_charges![0].applies_to = choice;
      if (choice === "chosen_items")
        invoice.other_charges![0].chosen_line_ids = ["A", "B"];
      recalculateInvoice(invoice, config);
      return [
        invoice.subtotal,
        invoice.tax,
        invoice.final_total,
        invoice.payable_after_open_shorts,
        invoice.lines.map(invoiceLineCost),
      ];
    };
    const total = totals("invoice_total");
    const chosen = totals("chosen_items");
    expect(chosen.slice(0, 4)).toEqual(total.slice(0, 4));
    expect(total[0]).toBe("80.00");
    expect(total[4]).toEqual(["6.0000", "10.0000"]);
    expect(chosen[4]).toEqual(["4.8000", "8.0000"]);
  });

  it("counts an unanswered credit as a check; fees never ask", () => {
    const { invoice } = invoiceWith(
      [{ id: "A", qty: 1, cost: "5.0000" }],
      "-1.00",
    );
    invoice.other_charges!.push({
      line_type: "fee",
      description: "Fictional fee",
      amount: "2.00",
      taxable: false,
    });
    allocateInvoiceCredits(invoice);
    expect(invoice.other_charges![0].low_confidence_fields).toEqual([
      "applies_to",
    ]);
    expect(invoice.other_charges![1].low_confidence_fields).toBeUndefined();
    expect(invoiceCheckCount(invoice)).toBe(1);
    // Chosen items without any item is still unanswered.
    invoice.other_charges![0].applies_to = "chosen_items";
    invoice.other_charges![0].chosen_line_ids = [];
    allocateInvoiceCredits(invoice);
    expect(invoiceCheckCount(invoice)).toBe(1);
  });
});
