import { describe, expect, it, vi } from "vitest";
import sourceFixture from "../tests/fixtures/r3c-monthly-fictional-readings-export.json";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { receivingDefaultPaymentTerms } from "./invoice-payment-default";
import {
  actionableReadingChecks,
  importInvoiceReadings,
  parseInvoiceReadings,
  prepareInvoiceReadingPages,
  previewInvoiceReadings,
  type ImportMode,
  type InvoiceReadingsExport,
} from "./invoice-readings";
import { invoiceView } from "./invoice-projections";
import { selectInvoiceWorkspace } from "./invoice-workspace-read";
import { setInvoicePaymentTerms, refreshInvoiceDueDate } from "./invoice-entry";
import { saveLiveReaderSettings } from "./live-reader-settings";
import { invoiceCheckCount } from "./invoice-checks";

vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(
    async (file: Blob & { name?: string }, company: string) => ({
      reference: `idb-file:v1:${company}:${"b".repeat(64)}`,
      name: file.name ?? "fictional-default-terms.png",
      type: file.type,
      size: file.size,
    }),
  ),
}));

function fixture() {
  const state = initialState();
  state.invoice.status = "empty";
  state.invoice.lines = [];
  state.invoices = [];
  state.products = [];
  state.suppliers = [];
  state.supplier_items = [];
  state.activity = [];
  const actor = authenticatedTestActor(state, "owner", {
    locations: ["Branch 1"],
  });
  const source = structuredClone(sourceFixture);
  source.invoices = [source.invoices[0]];
  const reading = source.invoices[0].ai_reading!;
  Object.assign(reading, {
    invoice_date: "2026-12-31",
    payment_terms: null,
    due_date: null,
    order_reference: "FICTIONAL-DEFAULT-PO",
  });
  Object.assign(source.invoices[0].ai_statuses, {
    "header.payment_terms": "check",
    "header.due_date": "check",
    "header.order_reference": "check",
  });
  const exported = parseInvoiceReadings(JSON.stringify(source));
  return { state, actor, exported };
}

async function importFixture(
  current = fixture(),
  source: InvoiceReadingsExport = current.exported,
  mode: ImportMode = "ai",
) {
  const { state, actor } = current;
  const selectedIds = source.invoices.map((entry) => entry.id);
  const pages = await prepareInvoiceReadingPages(
    source,
    selectedIds,
    actor.company_id,
  );
  const before = {
    ledger: structuredClone(state.ledger),
    movements: structuredClone(state.stock_movements),
    approvals: structuredClone(state.approvals),
  };
  importInvoiceReadings(
    state,
    actor,
    {
      exported: source,
      selectedIds,
      pages,
      mode,
      fileName: "fictional-configured-terms.json",
      locations: Object.fromEntries(selectedIds.map((id) => [id, "Branch 1"])),
    },
    new Date("2027-01-02T17:00:00Z"),
  );
  expect(state.ledger).toEqual(before.ledger);
  expect(state.stock_movements).toEqual(before.movements);
  expect(state.approvals).toEqual(before.approvals);
  return { ...current, invoice: state.invoices![0] };
}

describe("R3c K6 configured missing-paper payment terms", () => {
  it("uses the configured seed for legacy missing settings without rewriting the store", () => {
    const { state } = fixture();
    delete state.config.receiving.default_payment_terms;
    const before = structuredClone(state.config);
    expect(receivingDefaultPaymentTerms(state.config)).toBe("Monthly");
    expect(state.config).toEqual(before);
  });

  it.each([null, "", "  ", "unknown", "Net -4"])(
    "does not invent terms for an explicitly disabled or invalid default %s",
    async (value) => {
      const current = fixture();
      current.state.config.receiving.default_payment_terms = value;
      const { invoice } = await importFixture(current);
      expect(invoice.payment_terms).toBe("");
      expect(invoice.payment_terms_defaulted).toBe(false);
      expect(invoice.low_confidence_fields).toContain("payment_terms");
      expect(invoice.low_confidence_fields).toContain("due_date");
      expect(invoice.due_date).toBe("");
    },
  );

  it.each([
    ["2026-01-31", "2026-02-01"],
    ["2028-02-29", "2028-03-01"],
    ["2026-12-31", "2027-01-01"],
  ])(
    "calculates calendar Monthly for %s and keeps original source evidence",
    async (date, due) => {
      const current = fixture();
      current.exported.invoices[0].ai_reading!.invoice_date = date;
      const original = structuredClone(current.exported.invoices[0]);
      const preview = actionableReadingChecks(
        current.state,
        original.ai_reading!,
        original.ai_statuses,
      );
      expect(preview.low_confidence_fields).not.toContain("payment_terms");
      expect(preview.low_confidence_fields).not.toContain("due_date");
      expect(preview.low_confidence_fields).toContain("order_reference");
      const previewRows = previewInvoiceReadings(
        current.state,
        current.actor,
        current.exported,
        "ai",
        "Branch 1",
      );
      const { state, actor, invoice } = await importFixture(current);
      expect(invoice).toMatchObject({
        payment_terms: "Monthly",
        payment_terms_defaulted: true,
        payment_terms_inferred: false,
        due_date: due,
        due_date_manual: false,
      });
      expect(invoice.low_confidence_fields).not.toContain("payment_terms");
      expect(invoice.low_confidence_fields).not.toContain("due_date");
      expect(invoice.low_confidence_fields).toContain("order_reference");
      expect(invoice.checked_fields).toBeUndefined();
      expect(
        invoice.original_pages!.map((page) => page.original_sha256),
      ).toEqual(original.original_sha256);
      expect(invoice.reading_record!.page_sha256s).toEqual(
        original.original_sha256,
      );
      expect(current.exported.invoices[0]).toEqual(original);
      expect(
        invoiceView(state, actor, invoice.id).payment_terms_defaulted,
      ).toBe(true);
      expect(previewRows[0].check_count).toBe(invoiceCheckCount(invoice));
      expect(previewRows[0].check_count).toBeGreaterThan(0);
    },
  );

  it("applies the same default in checked mode while an explicit checked term wins", async () => {
    const missing = fixture();
    missing.exported.invoices[0].checked_answer = structuredClone(
      missing.exported.invoices[0].ai_reading,
    );
    const { invoice: defaulted } = await importFixture(
      missing,
      missing.exported,
      "checked",
    );
    expect(defaulted).toMatchObject({
      payment_terms: "Monthly",
      payment_terms_defaulted: true,
      due_date: "2027-01-01",
    });
    const explicit = fixture();
    explicit.exported.invoices[0].checked_answer = {
      ...structuredClone(explicit.exported.invoices[0].ai_reading!),
      payment_terms: "Net 17",
    };
    const { invoice: checked } = await importFixture(
      explicit,
      explicit.exported,
      "checked",
    );
    expect(checked).toMatchObject({
      payment_terms: "Net 17",
      payment_terms_defaulted: false,
      due_date: "2027-01-17",
    });
  });

  it("honors another configured recognized default and preserves it across reader setting saves", async () => {
    const current = fixture();
    current.state.config.receiving.default_payment_terms = "Net 45";
    const { state, actor, invoice } = await importFixture(current);
    expect(invoice).toMatchObject({
      payment_terms: "Net 45",
      payment_term_days: 45,
      payment_terms_defaulted: true,
      due_date: "2027-02-14",
    });
    saveLiveReaderSettings(state, actor, {
      mode: "live",
      readerAddress: "http://fictional-reader.local:5191",
    });
    expect(state.config.receiving.default_payment_terms).toBe("Net 45");
    expect(state.config.receiving.ai_reading_mode).toBe("live");
  });

  it.each([
    ["COD", "2026-12-31"],
    ["Net 17", "2027-01-17"],
    ["Monthly", "2027-01-01"],
  ])(
    "keeps printed %s and its real AI question ahead of the default",
    async (terms, due) => {
      const current = fixture();
      current.exported.invoices[0].ai_reading!.payment_terms = terms;
      const { invoice } = await importFixture(current);
      expect(invoice).toMatchObject({
        payment_terms: terms,
        payment_terms_defaulted: false,
        due_date: due,
      });
      expect(invoice.low_confidence_fields).toContain("payment_terms");
      expect(invoice.low_confidence_fields).toContain("due_date");
    },
  );

  it.each(["2027-01-20", "not a date"])(
    "retains a genuine printed due-date question: %s",
    async (due) => {
      const current = fixture();
      current.exported.invoices[0].ai_reading!.due_date = due;
      const preview = actionableReadingChecks(
        current.state,
        current.exported.invoices[0].ai_reading!,
        current.exported.invoices[0].ai_statuses,
      );
      expect(preview.low_confidence_fields).toContain("due_date");
      const { invoice } = await importFixture(current);
      expect(invoice.low_confidence_fields).toContain("due_date");
      expect(invoice.low_confidence_fields).not.toContain("payment_terms");
    },
  );

  it("does not fabricate a due date from an invalid invoice date", async () => {
    const current = fixture();
    current.exported.invoices[0].ai_reading!.invoice_date = "2026-02-30";
    const { invoice } = await importFixture(current);
    expect(invoice.invoice_date).toBe("");
    expect(invoice.due_date).toBe("");
    expect(invoice.low_confidence_fields).toContain("invoice_date");
    expect(invoice.low_confidence_fields).toContain("due_date");
  });

  it("manual term selection clears default provenance while manual due-date behavior stays intact", async () => {
    const { state, actor, invoice } = await importFixture();
    selectInvoiceWorkspace(state, actor, invoice.id);
    setInvoicePaymentTerms(state.invoice, "Net 30");
    expect(state.invoice.payment_terms_defaulted).toBe(false);
    expect(state.invoice.due_date).toBe("2027-01-30");
    state.invoice.due_date = "2027-03-12";
    state.invoice.due_date_manual = true;
    state.invoice.invoice_date = "2027-01-15";
    refreshInvoiceDueDate(state.invoice);
    expect(state.invoice.due_date).toBe("2027-03-12");
    setInvoicePaymentTerms(state.invoice, "Monthly");
    expect(state.invoice.due_date).toBe("2027-02-01");
    expect(state.invoice.payment_terms_defaulted).toBe(false);
  });

  it("keeps defaulted import behind the existing current-role and company authority", async () => {
    const { state, actor, exported } = fixture();
    const selectedIds = exported.invoices.map((entry) => entry.id);
    const pages = await prepareInvoiceReadingPages(
      exported,
      selectedIds,
      actor.company_id,
    );
    const foreign = initialState();
    foreign.config.company.seed_key = "fictional-foreign-company";
    const invalidActors = [
      authenticatedTestActor(state, "cashier", { locations: ["Branch 1"] }),
      authenticatedTestActor(foreign, "owner"),
    ];
    for (const invalidActor of invalidActors) {
      const before = structuredClone(state);
      expect(() =>
        importInvoiceReadings(state, invalidActor, {
          exported,
          selectedIds,
          pages,
          mode: "ai",
          fileName: "fictional-configured-terms.json",
          locations: Object.fromEntries(
            selectedIds.map((id) => [id, "Branch 1"]),
          ),
        }),
      ).toThrow();
      expect(state).toEqual(before);
    }
  });
});
