import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  addManualLine,
  createInvoice,
  postInvoice,
  recalculateInvoice,
  setInvoiceLineQuantity,
} from "./invoice";
import { companyLocalToUtc } from "./company-time";
import { correctHandwrittenReceivedDate } from "./invoice-received-time";
import { effectiveInvoiceReceivedAt } from "./invoice-received-version";
import { purchaseInvoiceView } from "./invoice-projections";
import { projectPurchaseOperational } from "./purchase-projections";
import { receivedLog } from "./received";
import { suppliersOverview } from "./suppliers";
import { lookupLastReceipt } from "./receipt-lots";
import { saveSupplier } from "./supplier-editor";

function fixture() {
  const state = initialState();
  state.invoices = [];
  const actor = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1", "Branch 2"],
    selection: { kind: "location", location_id: "Branch 1" },
  });
  state.invoice = createInvoice(state, actor, "Branch 1", true);
  saveSupplier(state, actor, {
    name: "Fictional Spruce Supply",
    phone: "",
    email: "",
    address: "",
    sales_rep_name: "",
    sales_rep_phone: "",
    payment_terms: "Net 30",
    notes: "Fictional timestamp test supplier.",
  });
  Object.assign(state.invoice, {
    supplier: "Fictional Spruce Supply",
    supplier_invoice_number: "R2B-TIME-001",
    supplier_confirmed: true,
    invoice_date: "2026-10-05",
    received_at: "2026-10-25T15:12:00.000Z",
    import_handwritten_notes: ["Oct 6, 2026 11:35 AM"],
    file_name: "fictional-retained.png",
    file_type: "image/png",
    file_data: "data:image/png;base64,cmV0YWluZWQ=",
  });
  addManualLine(state, actor, "0002");
  const line = state.invoice.lines[0];
  setInvoiceLineQuantity(line, "6", "units", 1);
  line.unit_cost_before_tax = "1.0000";
  line.date_tracking = false;
  line.date_confirmed = true;
  line.review_confirmed = true;
  recalculateInvoice(state.invoice, state.config);
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Fictional receipt timestamp evidence.",
  };
  postInvoice(state, actor);
  return { state, actor };
}

describe("a posted invoice's handwritten received date", () => {
  it("appends attributed metadata and presents the same effective date everywhere without rewriting money or physical evidence", () => {
    const { state, actor } = fixture();
    const retained = structuredClone({
      invoice: state.invoice,
      invoices: state.invoices,
      ledger: state.ledger,
      stock: state.stock,
      movements: state.stock_movements,
      products: state.products,
      corrections: state.invoice_content_corrections,
    });
    const before = state.invoice.received_at;
    const expected = companyLocalToUtc(state.config, "2026-10-06", "11:35");
    correctHandwrittenReceivedDate(
      state,
      actor,
      state.invoice.id,
      before,
      new Date("2026-10-25T18:00:00Z"),
    );
    expect(state.invoice_received_corrections).toEqual([
      expect.objectContaining({
        invoice_id: state.invoice.id,
        from_received_at: before,
        to_received_at: expected,
        source: "handwriting",
        actor_user_id: actor.user_id,
        by: actor.actor,
        at: "2026-10-25T18:00:00.000Z",
      }),
    ]);
    expect(effectiveInvoiceReceivedAt(state, state.invoice)).toBe(expected);
    expect(
      purchaseInvoiceView(state, actor, state.invoice.id).received_at,
    ).toBe(expected);
    const receipts = receivedLog(state, actor).filter(
      (row) => row.invoice_id === state.invoice.id,
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      date: "2026-10-06",
      received_at: expected,
    });
    expect(
      suppliersOverview(state, actor).find(
        (supplier) => supplier.name === state.invoice.supplier,
      )?.last_delivery,
    ).toBe("2026-10-06");
    expect(lookupLastReceipt(state, actor, "0002")?.date).toBe("2026-10-06");
    const movements = projectPurchaseOperational(
      state,
      actor,
    ).stock_movements.filter(
      (movement) =>
        movement.invoice_id === state.invoice.id &&
        movement.type === "received",
    );
    expect(movements).toHaveLength(1);
    expect(movements[0].at).toBe(expected);
    expect({
      invoice: state.invoice,
      invoices: state.invoices,
      ledger: state.ledger,
      stock: state.stock,
      movements: state.stock_movements,
      products: state.products,
      corrections: state.invoice_content_corrections,
    }).toEqual(retained);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Correct invoice received date",
      actor_user_id: actor.user_id,
      reversible: false,
      before: { received_at: before },
      after: { received_at: expected, source: "handwriting" },
    });
    const accepted = JSON.stringify(state);
    correctHandwrittenReceivedDate(state, actor, state.invoice.id, before);
    expect(JSON.stringify(state)).toBe(accepted);
  });

  it("rejects a stale date, an unread note and genuine unprivileged/foreign access without changing canonical bytes", () => {
    const { state, actor } = fixture();
    const unchanged = JSON.stringify(state);
    expect(() =>
      correctHandwrittenReceivedDate(
        state,
        actor,
        state.invoice.id,
        "2020-01-01T00:00:00Z",
      ),
    ).toThrow(/changed/);
    expect(JSON.stringify(state)).toBe(unchanged);
    const worker = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
    });
    const foreignState = initialState();
    foreignState.config.company.seed_key = "fictional-other-company";
    const foreign = authenticatedTestActor(foreignState, "manager", {
      locations: ["Branch 1"],
    });
    for (const denied of [worker, foreign, { ...actor }]) {
      const before = JSON.stringify(state);
      expect(() =>
        correctHandwrittenReceivedDate(
          state,
          denied,
          state.invoice.id,
          state.invoice.received_at,
        ),
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    }
    state.invoice.import_handwritten_notes = ["Delivery instructions only"];
    const before = JSON.stringify(state);
    expect(() =>
      correctHandwrittenReceivedDate(
        state,
        actor,
        state.invoice.id,
        state.invoice.received_at,
      ),
    ).toThrow(/handwritten/);
    expect(JSON.stringify(state)).toBe(before);
  });
});
