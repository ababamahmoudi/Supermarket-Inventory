import { describe, expect, it, vi } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  confirmInvoiceLineChecks,
  invoiceCheckCount,
  setInvoiceLineCategory,
} from "./invoice-checks";
import { invoiceBlockers, postInvoice, recalculateInvoice } from "./invoice";
import {
  importInvoiceReadings,
  previewInvoiceReadings,
  prepareInvoiceReadingPages,
  type InvoiceReadingsExport,
  type ImportMode,
} from "./invoice-readings";
import { selectInvoiceWorkspace } from "./invoice-workspace-read";
import {
  matchingBusiness,
  matchingReading,
} from "./test/r2b-product-matching-fixture";
import { normalizedPrintedItem } from "./invoice-printed-item";
import type { DemoState } from "./types";
import type { AuthenticatedActor } from "./authority-types";

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
const raw = "NORTHSTAR TEST CARROT JAM 24 X 300G";
const clean = "Northstar Carrot Jam 300 g";
async function importFile(
  state: DemoState,
  actor: AuthenticatedActor,
  exported: InvoiceReadingsExport,
  mode: ImportMode,
) {
  const ids = exported.invoices.map((entry) => entry.id);
  const pages = await prepareInvoiceReadingPages(
    exported,
    ids,
    state.config.company.seed_key,
  );
  const result = importInvoiceReadings(state, actor, {
    exported,
    pages,
    selectedIds: ids,
    locations: Object.fromEntries(ids.map((id) => [id, "Branch 1"])),
    mode,
    fileName: "fictional-printed-name.json",
  });
  expect(result.imported).toHaveLength(1);
  selectInvoiceWorkspace(state, actor, result.imported[0]);
  return state.invoice;
}
function checkedFile() {
  const exported = matchingReading(0);
  exported.invoices[0].ai_reading!.lines![0].description = raw;
  exported.invoices[0].checked_answer = { lines: [{ description: clean }] };
  return exported;
}
async function postedCheckedName() {
  const state = matchingBusiness(),
    actor = authenticatedTestActor(state, "owner"),
    exported = checkedFile();
  const before = structuredClone(exported);
  const invoice = await importFile(state, actor, exported, "checked");
  expect(state.products).toEqual([]);
  expect(state.supplier_items).toEqual([]);
  expect(invoice.lines[0].description).toBe(raw);
  expect(invoice.lines[0].printed_description).toBe(raw);
  expect(invoice.lines[0].new_name_en).toBe(clean);
  invoice.lines[0].new_description_en = "Fictional extra shelf information";
  invoice.lines[0].new_description_fa = "توضیحات آزمایشی";
  setInvoiceLineCategory(invoice.lines[0], "grocery", state.config);
  recalculateInvoice(invoice, state.config);
  confirmInvoiceLineChecks(state, actor, 0);
  expect(invoiceBlockers(state, actor)).toEqual([]);
  postInvoice(state, actor);
  expect(exported).toEqual(before);
  return { state, actor, invoice, exported };
}

describe("R3c K2 printed descriptions and checked clean names", () => {
  it.each(["ai", "checked"] as const)(
    "posts a checked clean name and extra Description, then confirms the next %s raw reading green",
    async (mode) => {
      const {
        state,
        actor,
        invoice: first,
        exported,
      } = await postedCheckedName();
      const product = state.products[0];
      expect(product.name_en).toBe(clean);
      expect(product.unit_size).toBe("300 g");
      expect(product.description_en).toBe("Fictional extra shelf information");
      expect(product.description_fa).toBe("توضیحات آزمایشی");
      expect(state.supplier_items).toHaveLength(1);
      expect(state.supplier_items![0]).toMatchObject({
        product_code: product.code,
        supplier_item_code: clean,
        supplier_item_code_inferred: true,
        created_by_user_id: actor.user_id,
        printed_description_keys: [
          { key: normalizedPrintedItem(raw), product_code: product.code },
        ],
      });
      const next = matchingReading(1);
      next.invoices[0].ai_reading!.lines![0].description = raw;
      next.invoices[0].ai_statuses = {
        "lines[0].description": "check",
        "lines[0].supplier_sku": "check",
        "lines[0].units_per_case": "check",
        "lines[0].unit_cost_before_tax": "check",
        "lines[0].pricing_category": "check",
      };
      if (mode === "checked")
        next.invoices[0].checked_answer = { lines: [{ description: clean }] };
      const preview = previewInvoiceReadings(
        state,
        actor,
        next,
        mode,
        "Branch 1",
      );
      const invoice = await importFile(state, actor, next, mode);
      expect(preview[0].check_count).toBe(invoiceCheckCount(invoice));
      expect(invoice.lines[0]).toMatchObject({
        product_code: product.code,
        description: raw,
        printed_description: raw,
        review_confirmed: true,
        low_confidence_fields: [],
        reading_product_match: {
          basis: "supplier_description",
          requires_check: false,
        },
        known_delivery: { status: "same" },
      });
      expect(invoice.lines[0].checked_fields).toBeUndefined();
      expect(first.lines[0].description).toBe(raw);
      expect(invoice.original_pages?.[0].original_sha256).toBe(
        next.invoices[0].original_sha256[0],
      );
      expect(first.original_pages?.[0].original_sha256).toBe(
        exported.invoices[0].original_sha256[0],
      );
      // A receiving Description for an existing Product remains delivery evidence.
      invoice.lines[0].new_description_en = "Fictional delivery-only note";
      postInvoice(state, actor);
      expect(state.products).toHaveLength(1);
      expect(state.products[0].description_en).toBe(
        "Fictional extra shelf information",
      );
      expect(state.supplier_items![0].printed_description_keys).toHaveLength(1);
    },
  );

  it("keeps a human-curated checked name authoritative, including an explicit blank", async () => {
    const state = matchingBusiness(),
      actor = authenticatedTestActor(state, "owner"),
      exported = checkedFile();
    exported.invoices[0].checked_answer!.lines![0].description = "";
    const invoice = await importFile(state, actor, exported, "checked");
    expect(invoice.lines[0].new_name_en).toBe("");
    expect(invoice.lines[0].description).toBe(raw);
    expect(() => confirmInvoiceLineChecks(state, actor, 0)).toThrow(
      /English name/,
    );
    expect(state.products).toEqual([]);
    expect(state.supplier_items).toEqual([]);
  });

  it("does not fabricate a printed key for an extra checked-only line", async () => {
    const state = matchingBusiness(),
      actor = authenticatedTestActor(state, "owner"),
      exported = checkedFile();
    exported.invoices[0].checked_answer = {
      subtotal: "45.00",
      final_total: "45.00",
      lines: [
        { description: clean },
        {
          line_type: "item",
          description: "Fictional Reviewed Extra 250 g",
          supplier_sku: "",
          quantity: "1",
          unit: "case",
          units_per_case: "12",
          pack_size: "12 ×250g",
          unit_cost_before_tax: "1.2500",
          line_total: "15.00",
          taxable: false,
        },
      ],
    };
    const invoice = await importFile(state, actor, exported, "checked");
    expect(invoice.lines[1].printed_description).toBeUndefined();
    expect(invoice.lines[1].new_name_en).toBe("Fictional Reviewed Extra 250 g");
    for (const [index, line] of invoice.lines.entries()) {
      setInvoiceLineCategory(line, "grocery", state.config);
      confirmInvoiceLineChecks(state, actor, index);
    }
    recalculateInvoice(invoice, state.config);
    postInvoice(state, actor);
    const learned = state.supplier_items!.flatMap(
      (binding) => binding.printed_description_keys ?? [],
    );
    expect(learned).toEqual([
      {
        key: normalizedPrintedItem(raw),
        product_code: state.products[0].code,
        source_invoice_ids: [invoice.id],
      },
    ]);
    expect(state.products).toHaveLength(2);
  });

  it("learns the printed key when a person changes a new product name during review", async () => {
    const state = matchingBusiness(),
      actor = authenticatedTestActor(state, "owner"),
      exported = checkedFile();
    const invoice = await importFile(state, actor, exported, "ai");
    invoice.lines[0].new_name_en = "Hand Reviewed Carrot Jam 300 g";
    setInvoiceLineCategory(invoice.lines[0], "grocery", state.config);
    confirmInvoiceLineChecks(state, actor, 0);
    postInvoice(state, actor);
    expect(state.products[0].name_en).toBe("Hand Reviewed Carrot Jam 300 g");
    expect(state.supplier_items![0].printed_description_keys).toEqual([
      {
        key: normalizedPrintedItem(raw),
        product_code: state.products[0].code,
        source_invoice_ids: [invoice.id],
      },
    ]);
    expect(invoice.lines[0].printed_description).toBe(raw);
  });

  it("never treats another supplier's learned description as trusted same-supplier knowledge", async () => {
    const { state, actor } = await postedCheckedName();
    const next = matchingReading(1, "Elmwood Test Supply");
    next.invoices[0].ai_reading!.lines![0].description = raw;
    const invoice = await importFile(state, actor, next, "ai");
    expect(invoice.lines[0].reading_product_match?.basis).toBe(
      "other_supplier_description",
    );
    expect(invoice.lines[0].review_confirmed).toBe(false);
    expect(invoice.lines[0].known_delivery).toBeUndefined();
    expect(invoice.lines[0].low_confidence_fields).toContain("product_code");
  });

  it("keeps duplicate learned-key identities as genuine match checks", async () => {
    const { state, actor } = await postedCheckedName();
    const product = state.products[0],
      binding = state.supplier_items![0];
    state.products.push({
      ...structuredClone(product),
      code: "9999",
      name_en: "Different Fictional Product 300 g",
    });
    const duplicateSource = structuredClone(state.invoice);
    duplicateSource.id = "fictional-second-key-source";
    duplicateSource.supplier_invoice_number = "FICTIONAL-SECOND-KEY";
    duplicateSource.lines[0].product_code = "9999";
    state.invoices!.push(duplicateSource);
    state.supplier_items!.push({
      ...structuredClone(binding),
      id: "fictional-ambiguous-key",
      product_code: "9999",
      printed_description_keys: [
        {
          key: normalizedPrintedItem(raw),
          product_code: "9999",
          source_invoice_ids: [duplicateSource.id],
        },
      ],
    });
    const next = matchingReading(1);
    next.invoices[0].ai_reading!.lines![0].description = raw;
    const invoice = await importFile(state, actor, next, "ai");
    expect(invoice.lines[0].reading_product_match?.requires_check).toBe(true);
    expect(invoice.lines[0].low_confidence_fields).toContain("product_code");
    expect(invoice.lines[0].review_confirmed).toBe(false);
    expect(invoice.lines[0].known_delivery).toBeUndefined();
  });

  it("normalizes Persian/Arabic letters and digits consistently without changing raw text", () => {
    expect(normalizedPrintedItem("كيك ۱۲ × ٣٣٠ گرم")).toBe(
      normalizedPrintedItem("کیک 12 ×330 گرم"),
    );
  });
});
