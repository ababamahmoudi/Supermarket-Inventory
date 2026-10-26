import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  acknowledgeInvoiceCheck,
  acknowledgeInvoiceOtherChargeCheck,
  confirmInvoiceLineChecks,
  invoiceCheckCount,
  invoiceCheckField,
} from "./invoice-checks";
import { invoiceView } from "./invoice-projections";
import { nextInvoiceAttention } from "./screens/invoice-review/review-attention";
function fixture() {
  const state = initialState();
  const actor = authenticatedTestActor(state, "owner");
  state.invoice.status = "review";
  state.invoice.lines.forEach((entry) => {
    entry.low_confidence_fields = [];
  });
  state.invoice.low_confidence_fields = [];
  const line = state.invoice.lines[0];
  Object.assign(line, {
    quantity_unit: "units",
    quantity_entered: "2",
    qty_invoiced: 2,
    qty_received_at_posting: 2,
    unit_cost_before_tax: "1.0000",
    date_tracking: false,
    review_confirmed: false,
  });
  return { state, actor, line };
}
describe("R2b persisted check receipts", () => {
  it.each([
    [
      "description",
      "new_name_en",
      "english_name",
      "name_en",
      "product_name",
      "printed_description",
    ],
    [
      "quantity_entered",
      "quantity",
      "qty_invoiced",
      "quantity_invoiced",
      "source_quantity",
    ],
    [
      "unit_cost_before_tax",
      "cost_per_unit_before_tax",
      "source_cost_before_tax",
    ],
    ["quantity_unit", "unit", "source_quantity_unit"],
    ["supplier_item_code", "supplier_sku"],
    [
      "qty_received_at_posting",
      "qty_received",
      "delivered_quantity",
      "source_received_quantity",
    ],
  ])(
    "editing %s clears every saved alias and records one receipt",
    (...aliases) => {
      const { state, actor, line } = fixture();
      line.low_confidence_fields = [...aliases, "taxable"];
      acknowledgeInvoiceCheck(state, actor, aliases.at(-1)!, 0);
      expect(line.low_confidence_fields).toEqual(["taxable"]);
      expect(line.checked_fields).toEqual({
        [invoiceCheckField(aliases[0])]: {
          checked_by_user_id: actor.user_id,
          checked_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
        },
      });
      expect(
        invoiceView(state, actor, state.invoice.id).lines[0].checked_fields,
      ).toEqual(line.checked_fields);
    },
  );
  it("whole-line confirmation acknowledges known and unknown checks, without changing another line", () => {
    const { state, actor, line } = fixture();
    line.low_confidence_fields = [
      "description",
      "new_name_en",
      "cost_per_unit_before_tax",
      "unfamiliar_evidence",
    ];
    const before = structuredClone(state.invoice.lines[1]);
    confirmInvoiceLineChecks(state, actor, 0);
    expect(line.low_confidence_fields).toEqual([]);
    expect(Object.keys(line.checked_fields!)).toEqual([
      "description",
      "unit_cost_before_tax",
      "unfamiliar_evidence",
    ]);
    expect(
      Object.values(line.checked_fields!).every(
        (receipt) => receipt.checked_by_user_id === actor.user_id,
      ),
    ).toBe(true);
    expect(state.invoice.lines[1]).toEqual(before);
  });
  it("records details, calculated totals and charge checks and does not rewrite an existing receipt", () => {
    const { state, actor } = fixture();
    state.invoice.low_confidence_fields = [
      "invoice_number",
      "supplier_invoice_number",
      "calculated:tax",
    ];
    acknowledgeInvoiceCheck(state, actor, "supplier_invoice_number");
    const saved = state.invoice.checked_fields!.supplier_invoice_number;
    acknowledgeInvoiceCheck(state, actor, "invoice_number");
    expect(state.invoice.checked_fields!.supplier_invoice_number).toBe(saved);
    acknowledgeInvoiceCheck(state, actor, "tax");
    state.invoice.other_charges = [
      {
        line_type: "deposit",
        description: "Invented crate",
        amount: "1.00",
        taxable: false,
        low_confidence_fields: ["taxable"],
      },
    ];
    acknowledgeInvoiceOtherChargeCheck(state, actor, 0, "taxable");
    expect(
      state.invoice.other_charges[0].checked_fields!.taxable.checked_by_user_id,
    ).toBe(actor.user_id);
    state.invoice.lines.forEach((line) => {
      line.low_confidence_fields = [];
    });
    expect(invoiceCheckCount(state.invoice)).toBe(0);
  });
  it("counts one open question per alias family and navigates details, lines and totals to real controls", () => {
    const { state, actor, line } = fixture();
    state.invoice.low_confidence_fields = [
      "supplier_invoice_number",
      "subtotal",
    ];
    line.low_confidence_fields = ["description", "new_name_en"];
    expect(invoiceCheckCount(state.invoice)).toBe(3);
    expect(
      nextInvoiceAttention(invoiceView(state, actor, state.invoice.id)),
    ).toEqual({
      target: "invoice-number",
    });
    acknowledgeInvoiceCheck(state, actor, "invoice_number");
    expect(
      nextInvoiceAttention(invoiceView(state, actor, state.invoice.id)),
    ).toEqual({
      target: "invoice-line-0-name-en",
      line: 0,
    });
    state.invoice.lines.forEach((entry) => {
      entry.low_confidence_fields = [];
      entry.review_confirmed = true;
    });
    expect(
      nextInvoiceAttention(invoiceView(state, actor, state.invoice.id)),
    ).toEqual({
      target: "invoice-subtotal",
    });
  });
  it("keeps legacy calculated provenance quiet without inventing check receipts", () => {
    const { state, actor } = fixture();
    state.invoice.low_confidence_fields = ["calculated:subtotal"];
    state.invoice.lines.forEach((entry) => {
      entry.review_confirmed = true;
    });
    expect(invoiceCheckCount(state.invoice)).toBe(0);
    expect(
      nextInvoiceAttention(invoiceView(state, actor, state.invoice.id)),
    ).toBeUndefined();
    expect(state.invoice.checked_fields).toBeUndefined();
  });
  it("does not create receipts without edit authority", () => {
    const { state } = fixture();
    const actor = authenticatedTestActor(state, "cashier");
    state.invoice.low_confidence_fields = ["supplier_invoice_number"];
    expect(() =>
      acknowledgeInvoiceCheck(state, actor, "supplier_invoice_number"),
    ).toThrow();
    expect(state.invoice.checked_fields).toBeUndefined();
  });
});
