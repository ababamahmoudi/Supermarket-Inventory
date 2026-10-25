import { describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import fixture from "../tests/fixtures/r2-fictional-readings-export.json";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  addManualLine,
  invoiceBlockers,
  postInvoice,
  recalculateInvoice,
  removeInvoiceLine,
  setInvoiceLineQuantity,
} from "./invoice";
import {
  acknowledgeInvoiceCheck,
  confirmInvoiceLineChecks,
  fillCalculatedInvoiceTotals,
  invoiceCheckCount,
  normalizeInvoiceReceivingReview,
  setInvoiceLineCategory,
} from "./invoice-checks";
import {
  actionableReadingChecks,
  importInvoiceReadings,
  mapReadingLine,
  parseInvoiceReadings,
  prepareInvoiceReadingPages,
  previewInvoiceReadings,
  selectInvoiceReading,
  suggestInvoiceEnglishName,
} from "./invoice-readings";
import { saveSupplier } from "./supplier-editor";

vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(
    async (file: Blob & { name?: string }, company: string) => ({
      reference: `idb-file:v1:${company}:${"a".repeat(64)}`,
      name: file.name ?? "fictional.png",
      type: file.type,
      size: file.size,
    }),
  ),
}));
function empty() {
  const state = initialState();
  state.invoice.status = "empty";
  state.invoice.lines = [];
  state.invoice.supplier = "";
  state.invoice.supplier_invoice_number = "";
  state.invoices = [];
  state.products = [];
  state.suppliers = [];
  state.supplier_items = [];
  state.approvals = [];
  return state;
}
async function imported(neighbor = false) {
  const state = empty(),
    actor = authenticatedTestActor(state, "owner");
  if (neighbor)
    saveSupplier(state, actor, {
      name: "Sunrise Fine Foods Inc.",
      address: "",
      phone: "",
      email: "",
      sales_rep_name: "",
      sales_rep_phone: "",
      payment_terms: "",
      notes: "",
    });
  const file = parseInvoiceReadings(JSON.stringify(fixture));
  const rows = previewInvoiceReadings(state, actor, file, "ai", "Branch 1");
  const selectedIds = rows
    .filter((row) => row.recommended)
    .map((row) => row.id);
  const pages = await prepareInvoiceReadingPages(
    file,
    selectedIds,
    actor.company_id,
  );
  const summary = importInvoiceReadings(state, actor, {
    exported: file,
    fileName: "r2-fictional.json",
    selectedIds,
    locations: Object.fromEntries(selectedIds.map((id) => [id, "Branch 1"])),
    pages,
    mode: "ai",
  });
  state.invoice = state.invoices!.find(
    (invoice) => invoice.id === summary.imported[0],
  )!;
  return { state, actor, file, rows, summary };
}
describe("R2 receiving decisions", () => {
  it("defaults date tracking to No, except for an existing product that tracks dates", () => {
    const state = initialState(),
      source = {
        description: "Fictional item",
        quantity: "1",
        unit: "each",
        unit_cost_before_tax: "1.0000",
        line_total: "1.00",
        taxable: false,
        expiry_as_printed: "2026-12-01",
      };
    expect(mapReadingLine(state, undefined, source, 0)).toMatchObject({
      date_tracking: false,
      date_confirmed: true,
      date_value: "2026-12-01",
    });
    state.products[0].date_tracking = true;
    expect(
      mapReadingLine(
        state,
        undefined,
        { ...source, description: state.products[0].name_en },
        0,
      ).date_tracking,
    ).toBe(true);
  });
  it("highlights empty required fields and never empty optional fields", () => {
    const state = empty(),
      value = {
        supplier_name: "",
        supplier_invoice_number: "",
        invoice_date: "",
        final_total: null,
        tax: "0.00",
        order_reference: "",
        bill_to: "",
        ship_to: "",
        lines: [
          {
            description: "",
            quantity: null,
            unit: "each",
            unit_cost_before_tax: null,
            lot_number: "",
            expiry_as_printed: "",
            barcode: "",
            handwritten_note: "",
            taxable: false,
          },
        ],
      };
    const checks = actionableReadingChecks(
      state,
      value,
      Object.fromEntries(
        [
          "header.order_reference",
          "header.bill_to",
          "header.ship_to",
          "lines[0].lot_number",
          "lines[0].expiry_as_printed",
          "lines[0].barcode",
          "lines[0].handwritten_note",
        ].map((key) => [key, "check" as const]),
      ),
    );
    expect(checks.low_confidence_fields).toEqual([
      "received_at",
      "supplier",
      "supplier_invoice_number",
      "invoice_date",
      "final_total",
      "subtotal",
    ]);
    expect(checks.lines[0].low_confidence_fields).toEqual([
      "description",
      "quantity_entered",
      "unit_cost_before_tax",
    ]);
    expect(invoiceCheckCount(checks)).toBe(9);
  });
  it("counts present optional questions and malformed required dates exactly as the review will show them", () => {
    const state = empty();
    const checks = actionableReadingChecks(
      state,
      {
        supplier_name: "Fictional supplier",
        supplier_invoice_number: "OPTIONAL-CHECK",
        invoice_date: "2026-02-30",
        subtotal: "0.00",
        tax: "0.00",
        final_total: "0.00",
        bill_to: "Fictional billing office",
        order_reference: "ORDER-FAKE",
        lines: [],
      },
      { "header.bill_to": "check", "header.order_reference": "check" },
    );
    expect(checks.low_confidence_fields).toEqual([
      "bill_to",
      "order_reference",
      "received_at",
      "invoice_date",
    ]);
    expect(invoiceCheckCount(checks)).toBe(4);
  });
  it.each([
    [{ subtotal: "", tax: "1.23", final_total: "12.34" }, "subtotal", "11.11"],
    [
      { subtotal: "12.34", tax: "1.23", final_total: "" },
      "final_total",
      "13.57",
    ],
  ] as const)(
    "calculates a missing total exactly and retains its totals-card question",
    (source, field, expected) => {
      const invoice = { ...source, low_confidence_fields: [field] };
      fillCalculatedInvoiceTotals(invoice);
      expect(invoice[field]).toBe(expected);
      expect(invoice.low_confidence_fields).toEqual([`calculated:${field}`]);
    },
  );
  it("suggests Title Case names with lowercase sizes and pack units", () => {
    expect(
      suggestInvoiceEnglishName("CEDAR CRUNCH 12X454G 1KG 500ML 25LB"),
    ).toBe("Cedar Crunch 12x454g 1kg 500ml 25lb");
    expect(suggestInvoiceEnglishName("BOX OF 12 X 454G")).toBe(
      "Box Of 12 x 454g",
    );
    expect(suggestInvoiceEnglishName("R1 Fictional Dry Beans 500 g")).toBe(
      "R1 Fictional Dry Beans 500 g",
    );
    expect(suggestInvoiceEnglishName("Cedar Brand 500 ML")).toBe(
      "Cedar Brand 500 ml",
    );
  });
  it("marks both in-file copies, recommends the complete one, and switches the choice exclusively", () => {
    const state = empty(),
      actor = authenticatedTestActor(state, "owner"),
      file = parseInvoiceReadings(JSON.stringify(fixture));
    const rows = previewInvoiceReadings(state, actor, file, "ai", "Branch 1");
    expect(rows.map((row) => row.duplicate_reason)).toEqual([
      undefined,
      undefined,
    ]);
    expect(rows[0].in_file_duplicate_group).toBe(
      rows[1].in_file_duplicate_group,
    );
    expect(rows.map((row) => row.recommended)).toEqual([false, true]);
    const selected = selectInvoiceReading(rows, [rows[1].id], rows[0].id, true);
    expect(selected).toEqual([rows[0].id]);
    expect(selectInvoiceReading(rows, selected, rows[1].id, true)).toEqual([
      rows[1].id,
    ]);
  });
  it("imports the complete copy once and gives the preview the same actual question count", async () => {
    const { state, rows, summary } = await imported();
    expect(summary.imported).toHaveLength(1);
    expect(state.invoice.lines).toHaveLength(25);
    expect(state.invoice.other_charges).toHaveLength(2);
    expect(state.invoice.subtotal).toBe("96.35");
    expect(state.invoice.low_confidence_fields).toContain(
      "calculated:subtotal",
    );
    expect(invoiceCheckCount(state.invoice)).toBe(rows[1].check_count);
    expect(
      state.invoice.lines.every(
        (line) => !line.date_tracking && !line.review_confirmed,
      ),
    ).toBe(true);
    expect(
      state.invoice.lines.every(
        (line) =>
          !line.low_confidence_fields?.some((field) =>
            ["lot_number", "expiry_as_printed", "barcode"].includes(field),
          ),
      ),
    ).toBe(true);
  });
  it("requires the new-product category, then confirms the entire line once", async () => {
    const { state, actor } = await imported();
    expect(() => confirmInvoiceLineChecks(state, actor, 0)).toThrow(
      "Choose a pricing category",
    );
    state.invoice.lines[0].pricing_category =
      state.config.pricing_categories[0].key;
    state.invoice.lines[0].low_confidence_fields = [
      "description",
      "quantity_entered",
      "unit_cost_before_tax",
    ];
    confirmInvoiceLineChecks(state, actor, 0);
    expect(state.invoice.lines[0].review_confirmed).toBe(true);
    expect(state.invoice.lines[0].low_confidence_fields).toEqual([]);
  });
  it("does not confirm an empty or inconsistent case cost while a stale unit cost remains valid", async () => {
    const { state, actor } = await imported();
    const line = state.invoice.lines[0];
    line.pricing_category = state.config.pricing_categories[0].key;
    expect(line.quantity_unit).toBe("cases");
    const original = line.case_cost_before_tax;
    line.case_cost_before_tax = "";
    expect(() => confirmInvoiceLineChecks(state, actor, 0)).toThrow(
      expect.objectContaining({ field: "case_cost_before_tax" }),
    );
    expect(line.review_confirmed).toBe(false);
    line.case_cost_before_tax = new Decimal(original!).plus(1).toFixed(4);
    expect(() => confirmInvoiceLineChecks(state, actor, 0)).toThrow(
      expect.objectContaining({ field: "case_cost_before_tax" }),
    );
    expect(line.review_confirmed).toBe(false);
    line.case_cost_before_tax = original;
    confirmInvoiceLineChecks(state, actor, 0);
    expect(line.review_confirmed).toBe(true);
  });
  it("invalidates only the changed line and retains confirmations when removing another line", async () => {
    const { state, actor } = await imported();
    for (const line of state.invoice.lines) {
      line.pricing_category = state.config.pricing_categories[0].key;
      line.review_confirmed = true;
    }
    setInvoiceLineQuantity(state.invoice.lines[1], "3", "units");
    recalculateInvoice(state.invoice, state.config);
    expect(state.invoice.lines[0].review_confirmed).toBe(true);
    expect(state.invoice.lines[1]).toMatchObject({
      review_confirmed: false,
      review_changed_after_confirmation: true,
    });
    expect(state.invoice.lines[2].review_confirmed).toBe(true);
    removeInvoiceLine(state, actor, 1);
    expect(state.invoice.lines.every((line) => line.review_confirmed)).toBe(
      true,
    );
  });
  it("preserves another confirmed line's refused units, reason and price decision when a line is removed", async () => {
    const { state, actor } = await imported();
    const kept = state.invoice.lines[1];
    Object.assign(kept, {
      review_confirmed: true,
      refused_units: 1,
      extra_delivery_decision: "refuse",
      order_price_decision: "accept",
      handwritten_note: "Fictional damaged package",
    });
    const facts = structuredClone(kept);
    removeInvoiceLine(state, actor, 0);
    expect(state.invoice.lines[0]).toEqual(facts);
    expect(state.invoice.lines[0].review_confirmed).toBe(true);
  });
  it("keeps existing confirmations when a manual line is added", () => {
    const state = initialState(),
      actor = authenticatedTestActor(state, "owner");
    state.invoice.lines.forEach((line) => {
      line.review_confirmed = true;
    });
    const count = state.invoice.lines.length;
    addManualLine(state, actor, state.products[0].code);
    expect(state.invoice.lines).toHaveLength(count + 1);
    expect(
      state.invoice.lines
        .slice(0, count)
        .every((line) => line.review_confirmed),
    ).toBe(true);
    expect(state.invoice.lines.at(-1)?.review_confirmed).toBe(false);
  });
  it("requires a real invoice number even when a manual draft previously allowed a system number", async () => {
    const { state, actor } = await imported();
    state.invoice.entry_mode = "manual";
    state.invoice.supplier_invoice_number = "";
    state.invoice.number_is_system_assigned = true;
    state.invoice.low_confidence_fields = [];
    normalizeInvoiceReceivingReview(state.invoice);
    expect(state.invoice.low_confidence_fields).toContain(
      "supplier_invoice_number",
    );
    expect(invoiceBlockers(state, actor)).toContain("header");
    expect(() => postInvoice(state, actor)).toThrow("header");
    expect(state.invoice.supplier_invoice_number).toBe("");
  });
  it("does not disturb the date choice when the pricing category changes", async () => {
    const { state } = await imported();
    const line = state.invoice.lines[0];
    line.review_confirmed = true;
    setInvoiceLineCategory(
      line,
      state.config.pricing_categories[0].key,
      state.config,
    );
    expect(line).toMatchObject({
      date_tracking: false,
      date_confirmed: true,
      review_confirmed: false,
    });
  });
  it("opens existing R1 drafts with optional blanks cleared and calculated totals ready to check", async () => {
    const { state } = await imported();
    state.invoice.subtotal = "";
    state.invoice.low_confidence_fields = [
      "subtotal",
      "order_reference",
      "bill_to",
    ];
    const line = state.invoice.lines[0];
    Object.assign(line, {
      low_confidence_fields: ["lot_number", "barcode", "description"],
      date_tracking: undefined,
      date_confirmed: false,
    });
    normalizeInvoiceReceivingReview(state.invoice);
    expect(state.invoice.low_confidence_fields).toEqual([
      "calculated:subtotal",
    ]);
    expect(line.low_confidence_fields).toEqual(["description"]);
    expect(line).toMatchObject({ date_tracking: false, date_confirmed: true });
  });
  it("posts an explicitly refused quantity without requiring a linked purchase order", async () => {
    const { state, actor } = await imported();
    const first = state.invoice.lines[0];
    first.refused_units = 2;
    first.handwritten_note = "Fictional crushed boxes returned to driver";
    for (const [index, line] of state.invoice.lines.entries()) {
      line.pricing_category = state.config.pricing_categories[0].key;
      confirmInvoiceLineChecks(state, actor, index);
    }
    for (const field of [...(state.invoice.low_confidence_fields ?? [])])
      acknowledgeInvoiceCheck(state, actor, field);
    for (const charge of state.invoice.other_charges ?? [])
      charge.low_confidence_fields = [];
    const expected = new Decimal(state.invoice.final_total)
      .minus(new Decimal(first.unit_cost_before_tax).times(2))
      .toFixed(2);
    expect(state.invoice.order_id).toBeUndefined();
    expect(invoiceBlockers(state, actor)).toEqual([]);
    postInvoice(state, actor);
    expect(state.invoice.payable_after_open_shorts).toBe(expected);
    expect(state.invoice.lines[0].refused_units).toBe(2);
    expect(state.invoice.lines[0].handwritten_note).toContain(
      "Fictional crushed boxes",
    );
  });
  it("saves Cedar Valley Foods Inc. unchanged beside Sunrise Fine Foods Inc. through import, and posts without contacts", async () => {
    const { state, actor } = await imported(true);
    expect(state.suppliers?.map((supplier) => supplier.name)).toContain(
      "Cedar Valley Foods Inc.",
    );
    expect(state.invoice.supplier).toBe("Cedar Valley Foods Inc.");
    for (const [index, line] of state.invoice.lines.entries()) {
      line.pricing_category = state.config.pricing_categories[0].key;
      confirmInvoiceLineChecks(state, actor, index);
    }
    for (const field of [...(state.invoice.low_confidence_fields ?? [])])
      acknowledgeInvoiceCheck(state, actor, field);
    for (const charge of state.invoice.other_charges ?? [])
      charge.low_confidence_fields = [];
    expect(invoiceBlockers(state, actor)).toEqual([]);
    postInvoice(state, actor);
    expect(state.invoice.status).toBe("posted");
    expect(
      state.approvals.some((approval) => approval.type === "new_supplier"),
    ).toBe(false);
  });
});
