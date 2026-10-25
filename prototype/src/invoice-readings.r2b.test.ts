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
} from "./invoice";
import {
  acknowledgeInvoiceCheck,
  confirmInvoiceLineChecks,
  fillCalculatedInvoiceTotals,
} from "./invoice-checks";
import {
  paymentTermsDays,
  paymentTermsDueDate,
  setInvoicePaymentTerms,
} from "./invoice-entry";
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
      state.invoices!.every((invoice) =>
        invoice.low_confidence_fields?.includes("received_at"),
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
      const invoice = { ...source, low_confidence_fields: [] as string[] };
      fillCalculatedInvoiceTotals(invoice);
      expect(invoice).toMatchObject(expected);
      expect(invoice.low_confidence_fields).toEqual(checks);
      fillCalculatedInvoiceTotals(invoice);
      expect(invoice.low_confidence_fields).toEqual(checks);
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
    expect(state.invoices![0].low_confidence_fields).toEqual(
      expect.arrayContaining(["calculated:subtotal", "calculated:tax"]),
    );
    selectInvoiceWorkspace(state, actor, state.invoices![0].id);
    acknowledgeInvoiceCheck(state, actor, "calculated:tax");
    expect(state.invoice.low_confidence_fields).not.toContain("calculated:tax");
    expect(state.invoice.low_confidence_fields).toContain(
      "calculated:subtotal",
    );
    expect(state.invoices![3]).toMatchObject({
      subtotal: "",
      tax: "",
      final_total: "",
    });
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
    expect(state.invoices![2].low_confidence_fields).toContain("payment_terms");
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
