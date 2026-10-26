import { describe, expect, it, vi } from "vitest";
import fixture from "../tests/fixtures/r2b-fictional-readings-export.json";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { companyDateTime } from "./company-time";
import { importedReadingReceived } from "./invoice-reading-dates";
import {
  createInvoice,
  postInvoice,
  recalculateInvoice,
  invoiceBlockers,
  addManualLine,
  validInvoiceLineQuantity,
  setInvoiceLineQuantity,
  lineShort,
  lineRefused,
} from "./invoice";
import {
  selectInvoiceWeightUnit,
  setInvoiceWeightQuantity,
  setInvoiceWeightCost,
  invoiceLineCalculation,
} from "./invoice-weight";
import { weightCostPerLb } from "./weighed";
import {
  acknowledgeInvoiceCheck,
  confirmInvoiceLineChecks,
  fillCalculatedInvoiceTotals,
  acknowledgeInvoiceFieldAbsence,
  invoiceCheckCount,
  normalizeInvoiceReceivingReview,
} from "./invoice-checks";
import {
  paymentTermsDays,
  paymentTermsDueDate,
  setInvoicePaymentTerms,
} from "./invoice-entry";
import { supplierItemFacts } from "./supplier-items";
import { saveSupplier, supplierNameCaseSuggestion } from "./supplier-editor";
import { projectSuppliers } from "./purchase-projections";
import { selectInvoiceWorkspace } from "./invoice-workspace-read";
import {
  importInvoiceReadings,
  parseInvoiceReadings,
  prepareInvoiceReadingPages,
  mapReadingLine,
} from "./invoice-readings";

vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(
    async (file: Blob & { name?: string }, company: string) => ({
      reference: `idb-file:v1:${company}:${"a".repeat(64)}`,
      name: file.name ?? "fictional-page.png",
      type: file.type,
      size: file.size,
    }),
  ),
}));
function emptyBusiness() {
  const state = initialState();
  state.invoice.status = "empty";
  state.invoice.lines = [];
  state.invoices = [];
  state.products = [];
  state.suppliers = [];
  state.supplier_items = [];
  state.activity = [];
  return state;
}
async function importFictional(
  state = emptyBusiness(),
  source: unknown = fixture,
) {
  const exported = parseInvoiceReadings(JSON.stringify(source));
  const actor = authenticatedTestActor(state, "owner");
  const selectedIds = exported.invoices.map((entry) => entry.id);
  const pages = await prepareInvoiceReadingPages(
    exported,
    selectedIds,
    state.config.company.seed_key,
  );
  importInvoiceReadings(
    state,
    actor,
    {
      exported,
      selectedIds,
      pages,
      mode: "ai",
      fileName: "r2b-fictional-readings-export.json",
      locations: Object.fromEntries(selectedIds.map((id) => [id, "Branch 1"])),
    },
    new Date("2026-12-30T20:00:00Z"),
  );
  return { state, actor, exported };
}

describe("R2b 1.1 imported received dates", () => {
  it("uses handwriting and configured local invoice noon, while auditing the actual import time", async () => {
    const { state } = await importFictional();
    expect(state.invoices).toHaveLength(8);
    expect(
      companyDateTime(state.config, state.invoices![0].received_at),
    ).toEqual({ date: "2026-08-12", time: "09:20" });
    expect(state.invoices![0].imported_received_source).toBe("handwriting");
    expect(
      companyDateTime(state.config, state.invoices![1].received_at),
    ).toEqual({ date: "2026-08-11", time: "12:00" });
    expect(state.invoices![1].imported_received_source).toBe("invoice_date");
    expect(
      companyDateTime(state.config, state.invoices![3].received_at),
    ).toEqual({ date: "2026-08-20", time: "13:40" });
    expect(
      state.invoices!.every(
        (invoice) =>
          invoice.low_confidence_fields?.includes("received_at") ===
          (invoice.imported_received_source !== "invoice_date"),
      ),
    ).toBe(true);
    expect(
      state.activity
        .filter((entry) => entry.action === "Create invoice draft")
        .every((entry) => entry.at === "2026-12-30T20:00:00.000Z"),
    ).toBe(true);
  });
  it("uses company timezone and AM/PM, leaving ambiguous/invalid paper dates to review", () => {
    const state = emptyBusiness();
    state.config.company.timezone = "Asia/Tehran";
    expect(
      importedReadingReceived(state.config, {
        invoice_date: "2026-08-10",
        handwritten_notes: ["Aug 12, 2026 2:15 pm"],
      }),
    ).toEqual({
      received_at: "2026-08-12T10:45:00.000Z",
      source: "handwriting",
    });
    expect(
      companyDateTime(
        state.config,
        importedReadingReceived(state.config, {
          invoice_date: "2026-08-10",
          handwritten_notes: ["Aug 12"],
        }).received_at,
      ),
    ).toEqual({ date: "2026-08-12", time: "12:00" });
    expect(
      importedReadingReceived(state.config, {
        invoice_date: "2026-08-10",
        handwritten_notes: ["03/04/2026", "Feb 30, 2026"],
      }).source,
    ).toBe("invoice_date");
    expect(
      importedReadingReceived(state.config, {
        invoice_date: "",
        handwritten_notes: [],
      }),
    ).toEqual({ received_at: "", source: "unresolved" });
  });
  it("posts initial stock at the delivery instant while posting audit stays current", async () => {
    const { state, actor } = await importFictional();
    selectInvoiceWorkspace(state, actor, state.invoices![0].id);
    state.invoice.subtotal = "32.00";
    state.invoice.tax = "0.00";
    state.invoice.lines[0].pricing_category = "grocery";
    recalculateInvoice(state.invoice, state.config);
    for (const field of [...(state.invoice.low_confidence_fields ?? [])])
      acknowledgeInvoiceCheck(state, actor, field);
    confirmInvoiceLineChecks(state, actor, 0);
    const delivery = state.invoice.received_at;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-30T20:30:00Z"));
    try {
      postInvoice(state, actor);
    } finally {
      vi.useRealTimers();
    }
    expect(
      state.stock_movements?.find(
        (entry) =>
          entry.invoice_id === state.invoice.id && entry.type === "received",
      )?.at,
    ).toBe(delivery);
    expect(state.invoice.posted_at).toBe("2026-12-30T20:30:00.000Z");
  });
  it("recognizes a generic yearless date plus separate 24-hour clock and never attaches a clock to an unknown day", () => {
    const config = emptyBusiness().config;
    expect(
      companyDateTime(
        config,
        importedReadingReceived(config, {
          invoice_date: "2027-11-08",
          handwritten_notes: ["nov 9", "16:25"],
        }).received_at,
      ),
    ).toEqual({ date: "2027-11-09", time: "16:25" });
    expect(
      companyDateTime(
        config,
        importedReadingReceived(config, {
          invoice_date: "2027-11-08",
          handwritten_notes: ["16:25"],
        }).received_at,
      ),
    ).toEqual({ date: "2027-11-08", time: "12:00" });
  });
  it("keeps now for live upload and manual entry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-30T20:15:00Z"));
    try {
      const state = emptyBusiness(),
        actor = authenticatedTestActor(state, "owner");
      expect(createInvoice(state, actor, "Branch 1").received_at).toBe(
        "2026-12-30T20:15:00.000Z",
      );
      expect(createInvoice(state, actor, "Branch 1", true).received_at).toBe(
        "2026-12-30T20:15:00.000Z",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("R2b 1.2 configured import currency", () => {
  it("uses the configured company currency only when the paper has none", async () => {
    const input = emptyBusiness();
    input.config.company.currency = "GBP";
    const { state } = await importFictional(input);
    expect(state.invoices![0].import_currency).toBe("GBP");
    expect(state.invoices![1].import_currency).toBe("USD");
    expect(state.invoices![0].low_confidence_fields).not.toContain("currency");
    expect(state.invoices![1].low_confidence_fields).toContain("currency");
  });
});

describe("R2b 1.3 missing paper amounts", () => {
  it.each([
    [
      { subtotal: "", tax: "1.23", final_total: "12.34" },
      { subtotal: "11.11", tax: "1.23", final_total: "12.34" },
      ["calculated:subtotal"],
    ],
    [
      { subtotal: "11.11", tax: "", final_total: "12.34" },
      { subtotal: "11.11", tax: "1.23", final_total: "12.34" },
      ["calculated:tax"],
    ],
    [
      { subtotal: "11.11", tax: "1.23", final_total: "" },
      { subtotal: "11.11", tax: "1.23", final_total: "12.34" },
      ["calculated:final_total"],
    ],
    [
      { subtotal: "", tax: "", final_total: "12.34" },
      { subtotal: "12.34", tax: "0.00", final_total: "12.34" },
      ["calculated:subtotal", "calculated:tax"],
    ],
  ])(
    "derives supported missing amounts exactly and marks each derived field",
    (source, expected, checks) => {
      const invoice = {
        ...source,
        low_confidence_fields: [] as string[],
        calculated_fields: [] as string[],
      };
      fillCalculatedInvoiceTotals(invoice);
      expect(invoice).toMatchObject(expected);
      expect(invoice.low_confidence_fields).toEqual([]);
      expect(invoice.calculated_fields).toEqual(
        checks.map((field) => field.replace("calculated:", "")),
      );
      fillCalculatedInvoiceTotals(invoice);
      expect(invoice.low_confidence_fields).toEqual([]);
      expect(invoice.calculated_fields).toEqual(
        checks.map((field) => field.replace("calculated:", "")),
      );
    },
  );
  it("leaves unresolved or contradictory evidence blank and names each missing field", () => {
    const empty = {
      subtotal: "",
      tax: "",
      final_total: "",
      low_confidence_fields: [] as string[],
    };
    fillCalculatedInvoiceTotals(empty);
    expect(empty).toEqual({
      subtotal: "",
      tax: "",
      final_total: "",
      low_confidence_fields: ["subtotal", "tax", "final_total"],
    });
    const conflict = {
      subtotal: "20.00",
      tax: "",
      final_total: "10.00",
      low_confidence_fields: [] as string[],
    };
    fillCalculatedInvoiceTotals(conflict);
    expect(conflict.tax).toBe("");
    expect(conflict.low_confidence_fields).toEqual(["tax"]);
    const supplied = { subtotal: "20.00", tax: "1.00", final_total: "10.00" };
    fillCalculatedInvoiceTotals(supplied);
    expect(supplied).toEqual({
      subtotal: "20.00",
      tax: "1.00",
      final_total: "10.00",
    });
  });
  it("fills imported tax/subtotal, preserving the calculated markers through reopen until acknowledgment", async () => {
    const { state, actor } = await importFictional();
    expect(state.invoices![0]).toMatchObject({
      subtotal: "32.00",
      tax: "0.00",
      final_total: "32.00",
    });
    expect(state.invoices![0].calculated_fields).toEqual(
      expect.arrayContaining(["subtotal", "tax"]),
    );
    expect(state.invoices![0].low_confidence_fields).not.toContain(
      "calculated:subtotal",
    );
    selectInvoiceWorkspace(state, actor, state.invoices![0].id);
    acknowledgeInvoiceCheck(state, actor, "calculated:tax");
    expect(state.invoice.low_confidence_fields).not.toContain("calculated:tax");
    expect(state.invoice.calculated_fields).toContain("subtotal");
    expect(state.invoice.calculated_fields).toContain("tax");
    expect(state.invoices![3]).toMatchObject({
      subtotal: "15.13",
      tax: "",
      final_total: "",
      calculated_from_lines: true,
    });
    expect(state.invoices![3].calculated_fields).toEqual(["subtotal"]);
    expect(state.invoices![3].low_confidence_fields).toEqual(
      expect.arrayContaining(["tax", "final_total"]),
    );
  });
});

describe("R2b 1.4 payment terms", () => {
  it.each([
    "COD",
    "Cash on delivery",
    "Due on receipt",
    "Due upon receipt",
    "DUE UPON RECEIPT",
  ])("recognizes %s without inventing a delay", (terms) =>
    expect(paymentTermsDays(terms)).toBe(0),
  );
  it("computes calendar-month first days across year boundaries and blocks invalid entered days on imports", async () => {
    expect(paymentTermsDueDate("2026-10-15", "Monthly")).toBe("2026-11-01");
    expect(paymentTermsDueDate("2026-12-20", "Monthly")).toBe("2027-01-01");
    expect(paymentTermsDueDate("2026-10-15", "Net 30")).toBe("2026-11-14");
    const { state, actor } = await importFictional();
    selectInvoiceWorkspace(state, actor, state.invoices![0].id);
    setInvoicePaymentTerms(state.invoice, "Net ");
    expect(invoiceBlockers(state, actor)).toContain("payment_terms");
  });

  it("recognizes receipt/net spellings and keeps Monthly separate from Net30", async () => {
    const { state } = await importFictional();
    expect(state.invoices![0]).toMatchObject({
      payment_term_days: 0,
      due_date: "2026-08-10",
    });
    expect(state.invoices![1]).toMatchObject({
      payment_term_days: 45,
      due_date: "2026-09-25",
    });
    expect(state.invoices![2]).toMatchObject({
      payment_terms: "Due upon receipt",
      payment_terms_inferred: true,
      due_date: "2026-08-18",
    });
    expect(state.invoices![2].low_confidence_fields).not.toContain(
      "payment_terms",
    );
    expect(state.invoices![2].payment_terms_inferred).toBe(true);
    expect(state.invoices![3].due_date).toBe("2026-08-19");
    expect(state.invoices![3].low_confidence_fields).toContain("due_date");
    expect(state.invoices![4].due_date).toBe("2026-09-19");
    expect(state.invoices![4].low_confidence_fields).toContain("due_date");
    expect(state.invoices![5]).toMatchObject({
      payment_terms: "Monthly",
      due_date: "2027-01-01",
    });
    expect(state.invoices![6]).toMatchObject({
      payment_term_days: 17,
      due_date: "2026-09-08",
    });
  });
  it("uses only earlier recognized same-supplier terms, independent of file order", async () => {
    const source = structuredClone(fixture);
    source.invoices.reverse();
    const { state } = await importFictional(emptyBusiness(), source);
    expect(
      state.invoices!.find((i) => i.supplier_invoice_number === "BFP-0818")
        ?.payment_terms,
    ).toBe("Due upon receipt");
    const future = structuredClone(fixture);
    future.invoices = future.invoices.filter((i) =>
      ["r2b-name-suggestion", "r2b-renamed-product"].includes(i.id),
    );
    const { state: withoutHistory } = await importFictional(
      emptyBusiness(),
      future,
    );
    expect(withoutHistory.invoices![0].payment_terms).toBe("");
    expect(withoutHistory.invoices![0].low_confidence_fields).toContain(
      "payment_terms",
    );
  });
});

describe("R2b 1.5 product names and packs", () => {
  it("separates clean names/pack text and infers missing packs without replacing printed evidence", async () => {
    const { state } = await importFictional();
    expect(state.invoices![1].lines[0]).toMatchObject({
      new_name_en: "Highground Rice",
      pack_size: "4 × 5 lb",
      units_per_case: 4,
      description: "71011 HIGHGROUND RICE - 4 x 5 lb / Case",
    });
    expect(state.invoices![2].lines[0]).toMatchObject({
      new_name_en: "Plum Preserve",
      pack_size: "6 × 330 g",
      units_per_case: 6,
      description: "Box of 6 x 330g Plum Preserve",
    });
    expect(state.invoices![2].lines[1]).toMatchObject({
      new_name_suggestion: "Orchard Fig Preserve",
      description: "Box of 5 x 150g",
      pack_size: "5 × 150 g",
    });
    expect(state.invoices![2].lines[1].low_confidence_fields).toContain(
      "description",
    );
  });
  it("retains explicit packs and asks about conflicting/uncertain printed evidence", () => {
    const state = emptyBusiness();
    const source = {
      description: "BOX OF 6 X 250g SUMMER FRUIT SPREAD",
      unit: "case",
      quantity: "1",
      units_per_case: "8",
      unit_cost_before_tax: "16.0000",
      cost_basis: "case",
      line_total: "16.00",
      taxable: false,
    };
    const mapped = mapReadingLine(state, undefined, source, 0);
    expect(mapped.units_per_case).toBe(8);
    expect(mapped.low_confidence_fields).toContain("description");
    expect(mapped.description).toBe(source.description);
  });
});

describe("R2b 1.6 supplier code fallback", () => {
  it("retains inferred identifier provenance through posted history and remembered manual lines", async () => {
    const { state, actor } = await importFictional();
    selectInvoiceWorkspace(state, actor, state.invoices![2].id);
    state.invoice.lines[1].new_name_en =
      state.invoice.lines[1].new_name_suggestion;
    for (const line of state.invoice.lines) line.pricing_category = "grocery";
    recalculateInvoice(state.invoice, state.config);
    for (const field of [...(state.invoice.low_confidence_fields ?? [])])
      acknowledgeInvoiceCheck(state, actor, field);
    state.invoice.lines.forEach((_, i) =>
      confirmInvoiceLineChecks(state, actor, i),
    );
    postInvoice(state, actor);
    const supplier = state.invoice.supplier;
    const fact = supplierItemFacts(state, actor, supplier, "all").find(
      (i) => i.supplier_item_code === "Plum Preserve",
    )!;
    expect(fact.supplier_item_code_inferred).toBe(true);
    expect(fact.history[0].supplier_item_code_inferred).toBe(true);
    state.invoice = createInvoice(state, actor, "Branch 1", true);
    state.invoice.supplier = supplier;
    addManualLine(state, actor, fact.product_code);
    expect(state.invoice.lines[0].supplier_item_code_inferred).toBe(true);
  });

  it("fills missing codes from clean names with quiet provenance and preserves every printed code", async () => {
    const { state } = await importFictional();
    expect(state.invoices![2].lines[0]).toMatchObject({
      supplier_item_code: "Plum Preserve",
      supplier_item_code_inferred: true,
    });
    expect(state.invoices![0].lines[0].supplier_item_code).toBe("BF-HZ8");
    expect(state.invoices![0].lines[0].supplier_item_code_inferred).not.toBe(
      true,
    );
    const mapped = mapReadingLine(
      state,
      undefined,
      {
        description: "SUMMER FRUIT SPREAD",
        unit: "each",
        quantity: "1",
        unit_cost_before_tax: "3.0000",
        line_total: "3.00",
        taxable: false,
      },
      0,
      ["supplier_item_code"],
    );
    expect(mapped.supplier_item_code).toBe("Summer Fruit Spread");
    expect(mapped.low_confidence_fields).not.toContain("supplier_item_code");
  });
});

describe("R2b 1.7 supplier contacts and readable names", () => {
  it("extracts contacts into editable supplier fields without changing printed evidence or legal names", async () => {
    const { state, actor, exported } = await importFictional();
    const supplier = state.suppliers!.find(
      (item) => item.name === "BLUEFINCH PANTRY INC.",
    )!;
    expect(supplier).toMatchObject({
      name: "BLUEFINCH PANTRY INC.",
      address: "12 Fictional Lane, Exampletown",
      phone: "+1 (416) 555-0142",
      email: "billing@bluefinch.example",
      website: "https://bluefinch.example",
    });
    expect(exported.invoices[0].ai_reading!.supplier_address).toBe(
      fixture.invoices[0].ai_reading.supplier_address,
    );
    expect(
      projectSuppliers(state, actor).find((item) => item.id === supplier.id)
        ?.website,
    ).toBe("https://bluefinch.example");
    expect(supplierNameCaseSuggestion(supplier.name)).toBe(
      "Bluefinch Pantry Inc.",
    );
    const renamed = saveSupplier(
      state,
      actor,
      {
        ...supplier,
        name: supplierNameCaseSuggestion(supplier.name)!,
        address: supplier.address ?? "",
        notes: supplier.notes ?? "",
        similar_name_confirmed: true,
      },
      { id: supplier.id },
    );
    expect(renamed.previous_names).toContain("BLUEFINCH PANTRY INC.");
    expect(state.invoices![0].supplier).toBe("BLUEFINCH PANTRY INC.");
    expect(supplierNameCaseSuggestion("BlueFinch Pantry Inc.")).toBeUndefined();
  });
  it("fills only missing contacts and keeps an established supplier's curated address and phone", async () => {
    const state = emptyBusiness();
    const actor = authenticatedTestActor(state, "owner");
    const supplier = saveSupplier(state, actor, {
      name: "BLUEFINCH PANTRY INC.",
      phone: "+1 (416) 555-0199",
      email: "",
      website: "",
      sales_rep_name: "",
      sales_rep_phone: "",
      payment_terms: "Net 14",
      address: "8 Curated Avenue",
      notes: "Keep supplier notes",
    });
    await importFictional(state);
    expect(supplier).toMatchObject({
      phone: "+1 (416) 555-0199",
      address: "8 Curated Avenue",
      notes: "Keep supplier notes",
      payment_terms: "Net 14",
      email: "billing@bluefinch.example",
      website: "https://bluefinch.example",
    });
    expect(
      state.activity.some(
        (entry) =>
          entry.action === "Save supplier" && entry.entity_id === supplier.id,
      ),
    ).toBe(true);
  });
});

describe("R2b 1.8 source quantities and exact costs", () => {
  it.each(["CTN", "CS", "BOX", "case", "Cases", "ctn"])(
    "imports %s as cases rather than units",
    (unit) => {
      const state = emptyBusiness();
      const line = mapReadingLine(
        state,
        undefined,
        {
          description: "Orchard Tea",
          unit,
          quantity: "5",
          units_per_case: "6",
          unit_cost_before_tax: "12.0000",
          cost_basis: "case",
          taxable: false,
        },
        0,
      );
      expect(line).toMatchObject({
        quantity_unit: "cases",
        quantity_entered: "5",
        qty_invoiced: 30,
        qty_received_at_posting: 30,
        unit_cost_before_tax: "2.0000",
      });
    },
  );
  it("converts fractional cases only to exact whole units and retains the exact case amount after edits/recalculation", () => {
    const state = emptyBusiness();
    const line = mapReadingLine(
      state,
      undefined,
      {
        description: "Orchard Tea",
        unit: "CS",
        quantity: "0.5",
        units_per_case: "6",
        unit_cost_before_tax: "10.0000",
        cost_basis: "case",
        line_total: "5.00",
        taxable: false,
      },
      0,
    );
    state.invoice.lines = [line];
    expect(line).toMatchObject({
      quantity_unit: "units",
      quantity_entered: "3",
      qty_invoiced: 3,
      qty_received_at_posting: 3,
      unit_cost_before_tax: "1.6667",
      line_total: "5.00",
    });
    recalculateInvoice(state.invoice, state.config);
    expect(line.line_total).toBe("5.00");
    setInvoiceLineQuantity(line, "30000", "units");
    recalculateInvoice(state.invoice, state.config);
    expect(line.line_total).toBe("50000.00");
    line.qty_received_at_posting = 20000;
    line.refused_units = 10000;
    expect(lineShort(line).beforeTax).toBe("16666.67");
    expect(lineRefused(line).beforeTax).toBe("16666.66");
    line.units_per_case = 5;
    recalculateInvoice(state.invoice, state.config);
    expect(line.line_total).toBe("50001.00");
    line.units_per_case = 6;
    line.unit_cost_before_tax = "2.0000";
    recalculateInvoice(state.invoice, state.config);
    expect(line.line_total).toBe("60000.00");
    line.case_cost_before_tax = "900.0000";
    recalculateInvoice(state.invoice, state.config);
    expect(line.line_total).toBe("60000.00");
  });
  it("keeps non-whole cases blocked and gives unresolved packs the R2c one-unit check", () => {
    const state = emptyBusiness();
    for (const source of [
      { description: "Orchard Tea", units_per_case: "3", quantity: "0.5" },
      {
        description: "3 x 4 x 500 g Orchard Tea",
        pack_size: "3 x 4 x 500 g",
        quantity: "2",
      },
    ]) {
      const line = mapReadingLine(
        state,
        undefined,
        {
          ...source,
          unit: "CS",
          unit_cost_before_tax: "12.0000",
          cost_basis: "case",
          taxable: false,
        },
        0,
      );
      expect(validInvoiceLineQuantity(line)).toBe(
        !Object.hasOwn(source, "units_per_case"),
      );
      expect(line.low_confidence_fields).toContain("units_per_case");
      if (!Object.hasOwn(source, "units_per_case")) {
        expect(line.units_per_case).toBe(1);
        expect(line.units_per_case_inferred).toBe(true);
        expect(line.qty_invoiced).toBe(2);
        expect(line.unit_cost_before_tax).toBe("12.0000");
      }
    }
  });
  it.each(["kg", "lb"] as const)(
    "keeps imported %s source quantity/cost/line amount and canonical pricing consistent",
    (unit) => {
      const state = emptyBusiness();
      const line = mapReadingLine(
        state,
        undefined,
        {
          description: "Orchard Loose Tea",
          unit,
          quantity: "1.375",
          units_received: "1.250",
          unit_cost_before_tax: "11.1234",
          cost_basis: unit,
          taxable: false,
        },
        0,
      );
      state.invoice.lines = [line];
      line.pricing_category = "grocery";
      recalculateInvoice(state.invoice, state.config);
      expect(line).toMatchObject({
        sold_by: "weight",
        quantity_unit: unit,
        source_quantity: "1.375",
        source_received_quantity: "1.25",
        source_cost_before_tax: "11.1234",
        source_cost_unit: unit,
        line_total: "15.29",
      });
      expect(line.unit_cost_before_tax).toBe(
        weightCostPerLb("11.1234", unit, state.config),
      );
      expect(validInvoiceLineQuantity(line)).toBe(true);
      expect(
        invoiceLineCalculation(line, "grocery", state.config).selling_price,
      ).toBeTruthy();
    },
  );
  it.each(["kg", "lb"] as const)(
    "establishes %s source units when switching an each line, then accepts a rapidly typed20",
    (unit) => {
      const state = emptyBusiness();
      const line = mapReadingLine(
        state,
        undefined,
        {
          description: "Orchard Loose Tea",
          unit: "each",
          quantity: "1",
          unit_cost_before_tax: "3.2500",
          taxable: false,
        },
        0,
      );
      selectInvoiceWeightUnit(line, unit, state.config);
      setInvoiceWeightQuantity(line, "2", unit, state.config);
      setInvoiceWeightQuantity(line, "20", unit, state.config);
      setInvoiceWeightCost(line, "4.1250", unit, state.config);
      expect(line).toMatchObject({
        sold_by: "weight",
        source_quantity: "20",
        quantity_entered: "20",
        source_cost_unit: unit,
        line_total: "82.50",
      });
      expect(validInvoiceLineQuantity(line)).toBe(true);
    },
  );
});

describe("R2b 1.9 explicit blank optional questions", () => {
  it("keeps explicitly flagged blanks open, records actor/time when absent, and preserves the receipt on reopen", async () => {
    const { state, actor } = await importFictional();
    selectInvoiceWorkspace(state, actor, state.invoices![0].id);
    expect(state.invoice.low_confidence_fields).toContain(
      "supplier_tax_number",
    );
    expect(state.invoice.lines[0].low_confidence_fields).toContain("barcode");
    const count = invoiceCheckCount(state.invoice);
    const checkedAt = new Date("2026-12-31T09:15:00Z");
    acknowledgeInvoiceFieldAbsence(
      state,
      actor,
      "supplier_tax_number",
      undefined,
      checkedAt,
    );
    acknowledgeInvoiceFieldAbsence(state, actor, "barcode", 0, checkedAt);
    expect(invoiceCheckCount(state.invoice)).toBe(count - 2);
    expect(state.invoice.checked_fields?.supplier_tax_number).toEqual({
      checked_by_user_id: actor.user_id,
      checked_at: checkedAt.toISOString(),
    });
    expect(state.invoice.lines[0].checked_fields?.barcode).toEqual({
      checked_by_user_id: actor.user_id,
      checked_at: checkedAt.toISOString(),
    });
    normalizeInvoiceReceivingReview(state.invoice);
    expect(state.invoice.low_confidence_fields).not.toContain(
      "supplier_tax_number",
    );
    expect(state.invoice.lines[0].low_confidence_fields).not.toContain(
      "barcode",
    );
    const activities = state.activity.filter(
      (entry) => entry.action === "Invoice field not on the invoice",
    );
    expect(activities).toHaveLength(2);
    expect(
      activities.every(
        (entry) =>
          entry.actor_user_id === actor.user_id &&
          entry.entity_id === state.invoice.id,
      ),
    ).toBe(true);
    acknowledgeInvoiceFieldAbsence(state, actor, "barcode", 0, checkedAt);
    expect(
      state.activity.filter(
        (entry) => entry.action === "Invoice field not on the invoice",
      ),
    ).toHaveLength(2);
  });
  it("does not invent optional checks and cannot use absence to clear a nonempty or required field", async () => {
    const { state, actor } = await importFictional();
    selectInvoiceWorkspace(state, actor, state.invoices![0].id);
    expect(state.invoice.lines[0].low_confidence_fields).not.toContain(
      "lot_number",
    );
    expect(() =>
      acknowledgeInvoiceFieldAbsence(state, actor, "supplier_invoice_number"),
    ).toThrow("empty optional");
    state.invoice.lines[0].barcode = "9785550001123";
    expect(() =>
      acknowledgeInvoiceFieldAbsence(state, actor, "barcode", 0),
    ).toThrow("empty optional");
    expect(state.invoice.lines[0].low_confidence_fields).toContain("barcode");
    const before = JSON.stringify(state.invoice);
    expect(() =>
      acknowledgeInvoiceFieldAbsence(
        state,
        { ...actor, user_id: "missing-user" },
        "supplier_tax_number",
      ),
    ).toThrow();
    expect(JSON.stringify(state.invoice)).toBe(before);
    state.invoice.due_date = "";
    state.invoice.low_confidence_fields!.push("due_date");
    acknowledgeInvoiceFieldAbsence(state, actor, "due_date");
    expect(state.invoice.low_confidence_fields).not.toContain("due_date");
    expect(state.invoice.checked_fields?.due_date.checked_by_user_id).toBe(
      actor.user_id,
    );
  });
});
