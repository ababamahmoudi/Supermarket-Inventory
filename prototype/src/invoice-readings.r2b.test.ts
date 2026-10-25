import { describe, expect, it, vi } from "vitest";
import fixture from "../tests/fixtures/r2b-fictional-readings-export.json";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { companyDateTime } from "./company-time";
import { importedReadingReceived } from "./invoice-reading-dates";
import { createInvoice, postInvoice, recalculateInvoice } from "./invoice";
import {
  acknowledgeInvoiceCheck,
  confirmInvoiceLineChecks,
} from "./invoice-checks";
import { selectInvoiceWorkspace } from "./invoice-workspace-read";
import {
  importInvoiceReadings,
  parseInvoiceReadings,
  prepareInvoiceReadingPages,
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
async function importFictional(state = emptyBusiness()) {
  const exported = parseInvoiceReadings(JSON.stringify(fixture));
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
