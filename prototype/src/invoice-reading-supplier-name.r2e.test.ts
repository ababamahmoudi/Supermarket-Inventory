import { describe, expect, it, vi } from "vitest";
import fixture from "../tests/fixtures/r2e-weight-cases.json";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { suggestInvoiceSupplierName } from "./invoice-reading-products";
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
      name: file.name ?? "page.png",
      type: file.type,
      size: file.size,
    }),
  ),
}));
describe("R2e B8 supplier names", () => {
  it.each([
    ["FICTIONAL ALDER FINE FOODS INC.", "Fictional Alder Fine Foods Inc."],
    ["FICTIONAL 24HR FOODS LTD", "Fictional 24HR Foods Ltd."],
    ["FICTIONAL FOODS CO.", "Fictional Foods Co."],
    ["FICTIONAL FOODS CORP", "Fictional Foods Corp."],
    ["Fictional iFood Inc.", "Fictional iFood Inc."],
  ])(
    "suggests %s without changing digit words or curated spelling",
    (source, expected) => {
      expect(suggestInvoiceSupplierName(source)).toBe(expected);
    },
  );
  it.each([false, true])(
    "normalizes only a new supplier, keeping raw reading evidence (existing=%s)",
    async (existing) => {
      const state = initialState();
      const actor = authenticatedTestActor(state, "owner");
      const file = parseInvoiceReadings(JSON.stringify(fixture));
      file.invoices[0].ai_reading!.supplier_name = "FICTIONAL ALDER FOODS INC.";
      if (existing)
        state.suppliers!.push({
          ...state.suppliers![0],
          id: "fictional-curated-alder",
          company_id: state.config.company.seed_key,
          name: "FICTIONAL ALDER FOODS INC.",
          previous_names: [],
        });
      const ids = file.invoices.map((row) => row.id);
      const pages = await prepareInvoiceReadingPages(
        file,
        ids,
        state.config.company.seed_key,
      );
      const summary = importInvoiceReadings(state, actor, {
        exported: file,
        fileName: "fictional.json",
        mode: "ai",
        selectedIds: ids,
        locations: Object.fromEntries(ids.map((id) => [id, "Branch 1"])),
        pages,
      });
      const imported = state.invoices!.find(
        (row) => row.id === summary.imported[0],
      )!;
      expect(imported.supplier).toBe(
        existing ? "FICTIONAL ALDER FOODS INC." : "Fictional Alder Foods Inc.",
      );
      expect(imported.reading_record?.supplier_name_as_printed).toBe(
        "FICTIONAL ALDER FOODS INC.",
      );
      expect(summary.new_suppliers).toEqual(
        existing ? [] : ["Fictional Alder Foods Inc."],
      );
    },
  );
});
