import { describe, expect, it, vi } from "vitest";
import sample from "../tests/fixtures/fictional-readings-export.json";
import additional from "../tests/fixtures/r1-fictional-readings-export.json";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { storeUploadedFile } from "./file-database";
import { supplierRecords } from "./supplier-editor";
import { weightCostPerLb, weightQuantityPerLb } from "./weighed";
import type { DemoState } from "./types";
import {
  effectiveInvoiceReading,
  importInvoiceReadings,
  mapReadingLine,
  matchReadingProduct,
  matchReadingSupplier,
  parseInvoiceReadings,
  prepareInvoiceReadingPages,
  previewInvoiceReadings,
  readingCheckFields,
  readingDuplicateReason,
  readingExpiryDate,
  suggestReadingLocation,
  type InvoiceReadingsExport,
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

const exported = () => parseInvoiceReadings(JSON.stringify(sample));
function emptyBusiness() {
  const state = initialState();
  state.invoice.status = "empty";
  state.invoice.supplier = "";
  state.invoice.supplier_invoice_number = "";
  state.invoice.lines = [];
  state.invoices = [];
  state.products = [];
  state.suppliers = [];
  state.supplier_items = [];
  state.activity = [];
  state.approvals = [];
  return state;
}
async function importFile(
  state: DemoState,
  file: InvoiceReadingsExport,
  mode: "ai" | "checked" = "ai",
) {
  const actor = authenticatedTestActor(state, "owner"),
    selectedIds = file.invoices.map((invoice) => invoice.id);
  const pages = await prepareInvoiceReadingPages(
    file,
    selectedIds,
    state.config.company.seed_key,
  );
  return importInvoiceReadings(state, actor, {
    exported: file,
    fileName: "fictional.json",
    mode,
    selectedIds,
    locations: Object.fromEntries(selectedIds.map((id) => [id, "Branch 1"])),
    pages,
  });
}

describe("invoice-reader kit export contract", () => {
  it.each([
    ["format", "wrong", "format"],
    ["version", 2, "version"],
    ["reading_schema", "invoice-reading-v1", "schema"],
  ])("rejects an unsupported %s plainly", (key, value, code) => {
    try {
      parseInvoiceReadings(JSON.stringify({ ...sample, [key]: value }));
      throw new Error("Expected rejection");
    } catch (error) {
      expect(error).toMatchObject({ code });
    }
  });
  it("rejects broken JSON and incomplete page/hash records", () => {
    expect(() => parseInvoiceReadings("{")).toThrow("valid JSON");
    const file = structuredClone(sample);
    file.invoices[0].original_sha256 = [];
    expect(() => parseInvoiceReadings(JSON.stringify(file))).toThrow("SHA-256");
  });
  it("accepts numbers and numeric strings without floating-point monetary arithmetic", () => {
    const file = JSON.parse(JSON.stringify(sample));
    file.invoices[0].ai_reading.lines[0].units_per_case = 12;
    file.invoices[0].ai_reading.lines[0].cost_per_unit_before_tax = 0.9801;
    const parsed = parseInvoiceReadings(JSON.stringify(file));
    expect(parsed.invoices[0].ai_reading?.lines?.[0]).toMatchObject({
      units_per_case: "12",
      cost_per_unit_before_tax: "0.9801",
    });
    expect(
      mapReadingLine(
        initialState(),
        undefined,
        parsed.invoices[0].ai_reading!.lines![0],
        0,
      ).unit_cost_before_tax,
    ).toBe("0.9801");
    file.invoices[0].ai_reading.subtotal = "NaN";
    expect(() => parseInvoiceReadings(JSON.stringify(file))).toThrow(
      "invalid number",
    );
  });
  it("maps only check statuses and retains source line indexes", () => {
    expect(
      readingCheckFields({
        "header.supplier_name": "check",
        "header.tax": "auto",
        "lines[2].supplier_sku": "check",
        "lines[2].quantity": "check",
        "lines[4].unit_cost_before_tax": "check",
      }),
    ).toEqual({
      header: ["supplier"],
      lines: {
        2: ["supplier_item_code", "quantity_entered"],
        4: ["unit_cost_before_tax"],
      },
    });
  });
  it("uses only checked fields and keeps all unchecked AI values and statuses", () => {
    const entry = exported().invoices[0];
    entry.checked_answer = {
      supplier_invoice_number: "FV-CHECKED",
      lines: [{ unit_cost_before_tax: "1.2345" }],
    };
    entry.ai_statuses["header.invoice_date"] = "check";
    const effective = effectiveInvoiceReading(entry, "checked");
    expect(effective.reading?.supplier_invoice_number).toBe("FV-CHECKED");
    expect(effective.reading?.invoice_date).toBe(
      entry.ai_reading?.invoice_date,
    );
    expect(effective.reading?.lines?.[0].description).toBe(
      entry.ai_reading?.lines?.[0].description,
    );
    expect(
      effective.statuses["header.supplier_invoice_number"],
    ).toBeUndefined();
    expect(effective.statuses["header.invoice_date"]).toBe("check");
    const line = mapReadingLine(
      initialState(),
      undefined,
      effective.reading!.lines![0],
      0,
    );
    expect(line.unit_cost_before_tax).toBe("1.2345");
    expect(line.case_cost_before_tax).toBe("14.8140");
    entry.checked_answer = null;
    expect(effectiveInvoiceReading(entry, "checked").using_checked).toBe(false);
  });
  it.each([
    [{ unit: "each" }, 2, "1.0000", "12.0000"],
    [{ units_per_case: "24" }, 48, "0.5000", "12.0000"],
    [{ quantity: "3" }, 36, "1.0000", "12.0000"],
    [{ cost_basis: "each" }, 24, "12.0000", "144.0000"],
    [{ unit_cost_before_tax: "18.0000" }, 24, "1.5000", "18.0000"],
  ] as const)(
    "recomputes dependent arithmetic after partial checked values %j",
    (answer, received, cost, caseCost) => {
      const entry = exported().invoices[0];
      entry.ai_reading!.lines![0] = {
        line_type: "item",
        description: "Fictional checked case",
        unit: "case",
        quantity: "2",
        units_per_case: "12",
        unit_cost_before_tax: "12.0000",
        cost_basis: "case",
        cost_per_unit_before_tax: "1.0000",
        cost_per_case_before_tax: "12.0000",
        units_received: "24",
        line_total: "24.00",
        taxable: false,
      };
      entry.checked_answer = { lines: [{ ...answer }] };
      const effective = effectiveInvoiceReading(entry, "checked"),
        mapped = mapReadingLine(
          initialState(),
          undefined,
          effective.reading!.lines![0],
          0,
        );
      expect(mapped.qty_received_at_posting).toBe(received);
      expect(mapped.unit_cost_before_tax).toBe(cost);
      if (mapped.quantity_unit === "cases")
        expect(mapped.case_cost_before_tax).toBe(caseCost);
    },
  );
  it("retains explicitly supplied checked arithmetic instead of replacing it with an inference", () => {
    const entry = exported().invoices[0];
    entry.checked_answer = {
      lines: [
        {
          units_per_case: "24",
          unit: "each",
          units_received: "1",
          cost_per_unit_before_tax: "0.1234",
          cost_per_case_before_tax: "2.9616",
        },
      ],
    };
    const effective = effectiveInvoiceReading(entry, "checked");
    expect(effective.reading!.lines![0]).toMatchObject({
      units_received: "1",
      cost_per_unit_before_tax: "0.1234",
      cost_per_case_before_tax: "2.9616",
    });
  });
  it("keeps additional checked lines that were absent from the AI reading", () => {
    const entry = exported().invoices[0];
    entry.ai_reading!.lines = [{ description: "First AI item", quantity: "1" }];
    entry.checked_answer = {
      lines: [
        { description: "First checked item" },
        {
          description: "A checked missing item",
          unit: "each",
          quantity: "2",
          unit_cost_before_tax: "1.0000",
          line_total: "2.00",
        },
      ],
    };
    const effective = effectiveInvoiceReading(entry, "checked");
    expect(effective.reading!.lines).toHaveLength(2);
    expect(effective.reading!.lines![1]).toMatchObject({
      description: "A checked missing item",
      quantity: "2",
    });
  });
});

describe("normal invoice field mappings", () => {
  const line = {
    line_type: "item",
    description: "Fictional lentils",
    quantity: "2",
    units_per_case: "12",
    unit_cost_before_tax: "1.2345",
    cost_basis: "each",
    line_total: "2.47",
    taxable: false,
  };
  it.each(["case", "each", "kg", "lb", "other"])(
    "maps %s without losing four-decimal source cost",
    (unit) => {
      const state = initialState(),
        mapped = mapReadingLine(state, undefined, { ...line, unit }, 3);
      expect(mapped.import_line_index).toBe(3);
      expect(mapped.new_name_fa).toBe("");
      expect(mapped.review_confirmed).toBe(false);
      if (unit === "kg" || unit === "lb") {
        expect(mapped.sold_by).toBe("weight");
        expect(mapped.source_quantity_unit).toBe(unit);
        expect(mapped.source_cost_before_tax).toBe("1.2345");
        expect(mapped.unit_cost_before_tax).toBe(
          weightCostPerLb("1.2345", unit),
        );
        expect(mapped.canonical_lb_quantity).toBe(
          weightQuantityPerLb("2", unit),
        );
      } else {
        expect(mapped.unit_cost_before_tax).toBe("1.2345");
        expect(mapped.quantity_unit).toBe(unit === "case" ? "cases" : "units");
        expect(mapped.qty_invoiced).toBe(unit === "case" ? 24 : 2);
        if (unit === "other")
          expect(mapped.low_confidence_fields).toContain("quantity_unit");
      }
    },
  );
  it("derives case and unit costs using Decimal and highlights null taxable and absent fields", () => {
    const mapped = mapReadingLine(
      initialState(),
      undefined,
      {
        ...line,
        unit: "case",
        cost_basis: "case",
        unit_cost_before_tax: "14.8140",
        description: null,
        taxable: null,
      },
      0,
    );
    expect(mapped.unit_cost_before_tax).toBe("1.2345");
    expect(mapped.case_cost_before_tax).toBe("14.8140");
    expect(mapped.low_confidence_fields).toEqual(
      expect.arrayContaining(["description", "taxable"]),
    );
  });
  it("offers complete Gregorian and Persian expiry dates, but retains partial dates as printed text", () => {
    expect(readingExpiryDate("2026-11-11")).toBe("2026-11-11");
    expect(readingExpiryDate("11-Nov-2026")).toBe("2026-11-11");
    expect(readingExpiryDate("1405-09-06")).toBe("2026-11-27");
    expect(readingExpiryDate("۱۴۰۵-۰۹-۰۶")).toBe("2026-11-27");
    expect(readingExpiryDate("2026-02-30")).toBeUndefined();
    expect(readingExpiryDate("(2026-12)")).toBeUndefined();
    const mapped = mapReadingLine(
      initialState(),
      undefined,
      { ...line, unit: "each", expiry_as_printed: "1405-09-06" },
      0,
    );
    expect(mapped).toMatchObject({
      date_value: "2026-11-27",
      date_confirmed: false,
      date_tracking: true,
    });
  });
});

describe("supplier, product, location and duplicate matching", () => {
  it("matches supplier tax number first and otherwise ignores legal name endings/punctuation", () => {
    const state = initialState();
    state.suppliers = structuredClone([...supplierRecords(state)]);
    state.suppliers[0].tax_number = "AB-123";
    expect(
      matchReadingSupplier(state, {
        supplier_tax_number: "AB 123",
        supplier_name: "Different Name",
      })?.id,
    ).toBe(state.suppliers[0].id);
    expect(
      matchReadingSupplier(state, {
        supplier_name: `${state.suppliers[0].name.toUpperCase()}, Inc. Ltd.`,
      })?.id,
    ).toBe(state.suppliers[0].id);
    expect(
      matchReadingSupplier(state, {
        supplier_name: "A completely new supplier",
      }),
    ).toBeUndefined();
  });
  it("matches supplier item code before barcode, then product-name history, then proposes a new product", () => {
    const state = initialState(),
      supplier = supplierRecords(state)[0],
      [first, second, third] = state.products;
    state.supplier_items = [
      {
        id: "binding",
        company_id: supplier.company_id,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        product_code: first.code,
        supplier_item_code: "SKU-1",
        units_per_case: 1,
        created_at: "",
        created_by: "",
      },
    ];
    expect(
      matchReadingProduct(state, supplier, {
        supplier_sku: "SKU-1",
        barcode: second.barcode,
      })?.code,
    ).toBe(first.code);
    expect(
      matchReadingProduct(state, supplier, { barcode: second.barcode })?.code,
    ).toBe(second.code);
    state.invoice.lines[0].description = "Former printed product name";
    state.invoice.lines[0].product_code = third.code;
    state.invoice.lines[0].barcode = "former-barcode";
    expect(
      matchReadingProduct(state, supplier, {
        barcode: "former-barcode",
        description: first.name_en,
      })?.code,
    ).toBe(third.code);
    expect(
      matchReadingProduct(state, supplier, {
        description: "former PRINTED product name!",
      })?.code,
    ).toBe(third.code);
    expect(
      matchReadingProduct(state, supplier, {
        description: "An unknown new item",
      }),
    ).toBeUndefined();
  });
  it("suggests accent/punctuation-insensitive names and streets, then current location or a required choice", () => {
    const state = initialState();
    state.config.branches[1].address = "123 Café Street";
    expect(
      suggestReadingLocation(
        state,
        { bill_to: "Super Arzon, North-York" },
        "all",
      ),
    ).toBe("Branch 1");
    expect(
      suggestReadingLocation(
        state,
        { branch_hint: "Ship to: 123 CAFE street, Toronto" },
        "all",
      ),
    ).toBe("Branch 2");
    state.config.branches[1].address = "123 Main St, Toronto, ON";
    expect(
      suggestReadingLocation(
        state,
        { branch_hint: "Deliver 123 Main St" },
        "all",
      ),
    ).toBe("Branch 2");
    expect(suggestReadingLocation(state, {}, "Branch 3")).toBe("Branch 3");
    expect(suggestReadingLocation(state, {}, "all")).toBeNull();
  });
  it("detects invoice-number duplicates in any status, and any original page SHA", () => {
    const state = initialState(),
      entry = exported().invoices[0];
    expect(readingDuplicateReason(state, entry, entry.ai_reading!)).toBe(
      "invoice_number",
    );
    state.invoice.supplier_invoice_number = "changed";
    state.invoice.original_pages = [
      {
        file_name: "p2.png",
        file_type: "image/png",
        file_size: 1,
        file_data: "stored",
        original_sha256: entry.original_sha256[0],
      },
    ];
    expect(readingDuplicateReason(state, entry, entry.ai_reading!)).toBe(
      "page_sha256",
    );
  });
  it("checks the current workspace invoice number before its older list snapshot", () => {
    const state = initialState(),
      entry = exported().invoices[0];
    state.invoices = [structuredClone(state.invoice)];
    state.invoice.supplier_invoice_number = "CORRECTED";
    expect(
      readingDuplicateReason(state, entry, entry.ai_reading!),
    ).toBeUndefined();
    expect(
      readingDuplicateReason(state, entry, {
        ...entry.ai_reading,
        supplier_invoice_number: "CORRECTED",
      }),
    ).toBe("invoice_number");
  });
  it.each(["cashier", "floor_worker", "branch_supervisor"] as const)(
    "denies %s import at the domain boundary",
    (role) => {
      const state = initialState(),
        actor = authenticatedTestActor(state, role);
      expect(() =>
        previewInvoiceReadings(state, actor, exported(), "ai", "Branch 1"),
      ).toThrow();
      expect(() =>
        importInvoiceReadings(state, actor, {
          exported: exported(),
          fileName: "x.json",
          selectedIds: [],
          locations: {},
          pages: { count: 0 },
          mode: "ai",
        }),
      ).toThrow();
    },
  );
});

describe("import prepares evidence and normal drafts only", () => {
  it("retains deposit, fee, discount and credit amounts outside the item/product flow", async () => {
    const state = emptyBusiness(),
      file = exported();
    file.invoices[0].ai_reading!.lines = [
      {
        line_type: "item",
        description: "Fictional item",
        quantity: "1",
        unit: "each",
        unit_cost_before_tax: "10.0000",
        line_total: "10.00",
        taxable: false,
      },
      {
        line_type: "deposit",
        description: "Container",
        line_total: "2.00",
        taxable: false,
      },
      {
        line_type: "fee",
        description: "Freight",
        line_total: "1.00",
        taxable: true,
      },
      {
        line_type: "discount",
        description: "Discount",
        line_total: "0.50",
        taxable: false,
      },
      {
        line_type: "credit",
        description: "Credit",
        line_total: "1.25",
        taxable: null,
      },
    ];
    file.invoices[0].ai_reading!.subtotal = "11.25";
    const summary = await importFile(state, file),
      draft = state.invoices!.find(
        (invoice) => invoice.id === summary.imported[0],
      )!;
    expect(draft.lines).toHaveLength(1);
    expect(draft.other_charges?.map((charge) => charge.amount)).toEqual([
      "2.00",
      "1.00",
      "-0.50",
      "-1.25",
    ]);
    expect(draft.other_charges?.[3].low_confidence_fields).toContain("taxable");
    expect(state.products).toHaveLength(0);
    expect(state.stock_movements?.length ?? 0).toBe(
      initialState().stock_movements?.length ?? 0,
    );
  });
  it("creates Needs review suppliers and drafts, derives Net 14, and records import provenance/history", async () => {
    const state = emptyBusiness(),
      beforeProducts = structuredClone(state.products),
      result = await importFile(state, exported());
    expect(result.imported).toHaveLength(1);
    expect(result.new_suppliers).toEqual(["Fresh Valley Foods"]);
    expect(state.suppliers?.[0]).toMatchObject({
      status: "proposed",
      created_from_import: true,
      notes: "Created from an imported reading",
    });
    expect(state.approvals).toContainEqual(
      expect.objectContaining({ type: "new_supplier", status: "pending" }),
    );
    const draft = state.invoices![0];
    expect(draft).toMatchObject({
      status: "review",
      invoice_date: "2026-10-09",
      due_date: "2026-10-23",
      payment_term_days: 14,
      final_total: "177.02",
    });
    expect(draft.reading_record).toMatchObject({
      source: "imported",
      file_name: "fictional.json",
      page_sha256s: sample.invoices[0].original_sha256,
      models: sample.invoices[0].ai_models,
    });
    expect(draft.low_confidence_fields).toContain("supplier_invoice_number");
    expect(state.products).toEqual(beforeProducts);
    expect(
      state.activity.filter((row) => row.action.startsWith("Imported ")),
    ).toHaveLength(1);
    expect(state.activity).toContainEqual(
      expect.objectContaining({
        action: "Create invoice draft",
        entity_id: draft.id,
      }),
    );
  });
  it("retains both page originals, separates charges from products, and skips the duplicate fixture invoice", async () => {
    const state = emptyBusiness();
    await importFile(state, exported());
    const file = parseInvoiceReadings(JSON.stringify(additional)),
      actor = authenticatedTestActor(state, "manager");
    const rows = previewInvoiceReadings(state, actor, file, "ai", "Branch 1");
    expect(rows[1].duplicate_reason).toBe("page_sha256");
    const writes = vi.mocked(storeUploadedFile).mock.calls.length,
      result = await importFile(state, file);
    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toEqual([
      { id: file.invoices[1].id, reason: "page_sha256" },
    ]);
    const draft = state.invoices!.find(
      (invoice) => invoice.id === result.imported[0],
    )!;
    expect(draft.original_pages).toHaveLength(2);
    expect(draft.original_pages?.map((page) => page.original_sha256)).toEqual(
      file.invoices[0].original_sha256,
    );
    expect(vi.mocked(storeUploadedFile).mock.calls.length - writes).toBe(3);
    expect(draft.lines).toHaveLength(2);
    expect(draft.other_charges).toHaveLength(2);
    expect(draft.other_charges?.map((charge) => charge.amount)).toEqual([
      "1.50",
      "-0.50",
    ]);
    expect(draft.lines[1]).toMatchObject({
      sold_by: "weight",
      source_quantity: "2",
      source_quantity_unit: "kg",
    });
    expect(
      draft.lines.some(
        (line) => line.date_value === "2026-11-27" && !line.date_confirmed,
      ),
    ).toBe(true);
    expect(state.products).toHaveLength(0);
  });
  it("requires a location before publishing, and rejects forged prepared-page handles", async () => {
    const state = emptyBusiness(),
      file = exported(),
      actor = authenticatedTestActor(state, "owner");
    expect(() =>
      importInvoiceReadings(state, actor, {
        exported: file,
        fileName: "x.json",
        mode: "ai",
        selectedIds: [file.invoices[0].id],
        locations: {},
        pages: { count: 1 },
      }),
    ).toThrow("saved");
    const pages = await prepareInvoiceReadingPages(
      file,
      [file.invoices[0].id],
      state.config.company.seed_key,
    );
    const summary = importInvoiceReadings(state, actor, {
      exported: file,
      fileName: "x.json",
      mode: "ai",
      selectedIds: [file.invoices[0].id],
      locations: {},
      pages,
    });
    expect(summary.needs_location).toEqual([file.invoices[0].id]);
    expect(state.invoices).toHaveLength(0);
  });
});
