import { describe, expect, it, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import { supplierRecords } from "./supplier-editor";
import { authenticatedTestActor } from "./authority-test-fixture";
import { createInvoice, invoiceBlockers } from "./invoice";
import { invoiceView } from "./invoice-projections";
import { confirmInvoiceLineChecks } from "./invoice-checks";
import { invoiceLocationMovePreview, movePostedInvoice } from "./received";
import {
  mapReadingLine,
  matchReadingProduct,
  resolveReadingProductMatch,
} from "./invoice-readings";
import {
  importMatchingReading,
  postedMatchingProduct,
} from "./test/r2b-product-matching-fixture";

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

describe("R2b 1.10 supplier-aware product matching", () => {
  it.each(["CAR-24", ""])(
    "posts, renames in the actual catalog, then recognizes the next delivery (printed SKU %s)",
    async (code) => {
      const { state, actor, invoice, product } =
        await postedMatchingProduct(code);
      expect(invoice.status).toBe("posted");
      expect(product.name_en).toBe("Crafted Carrot Jam");
      expect(invoice.lines[0].description).toBe("CARROT 24");
      expect(invoice.lines[0].supplier_item_code_inferred).toBe(
        !code || undefined,
      );
      const next = await importMatchingReading(
        state,
        actor,
        1,
        undefined,
        code,
      );
      expect(next.lines[0]).toMatchObject({
        product_code: product.code,
        description: "CARROT 24",
        reading_product_match: {
          product_code: product.code,
          basis: code ? "supplier_code" : "supplier_description",
          earlier_delivery: true,
          requires_check: false,
        },
      });
      expect(next.lines[0].low_confidence_fields).not.toContain("product_code");
      expect(state.products).toHaveLength(1);
      expect(invoiceBlockers(state, actor)).not.toContain("matching");
      const dto = invoiceView(state, actor, next.id).lines[0]
        .reading_product_match!;
      expect(dto).toEqual({
        product_code: product.code,
        basis: code ? "supplier_code" : "supplier_description",
        earlier_delivery: true,
        requires_check: false,
      });
      expect(dto).not.toHaveProperty("source_invoice_id");
    },
  );

  it("prefers same-supplier raw printed history before another product's barcode", async () => {
    const { state, actor, product } = await postedMatchingProduct();
    const other = {
      ...structuredClone(product),
      code: "8888",
      name_en: "Unrelated Test Product",
      barcode: "900000000002",
    };
    state.products.unshift(other);
    const supplier = state.suppliers![0];
    const result = resolveReadingProductMatch(
      state,
      supplier,
      { description: "CARROT 24", barcode: other.barcode },
      actor,
    )!;
    expect(result.product.code).toBe(product.code);
    expect(result.provenance.basis).toBe("supplier_description");
    expect(
      matchReadingProduct(state, supplier, { description: "CARROT 24" })?.code,
    ).toBe(product.code);
  });

  it("marks another supplier's printed-history fallback as an actual open match check", async () => {
    const { state, actor, product } = await postedMatchingProduct();
    const next = await importMatchingReading(
      state,
      actor,
      1,
      "Elmwood Test Supply",
    );
    expect(next.lines[0].product_code).toBe(product.code);
    expect(next.lines[0].reading_product_match).toMatchObject({
      basis: "other_supplier_description",
      requires_check: true,
    });
    expect(next.lines[0].low_confidence_fields).toContain("product_code");
    confirmInvoiceLineChecks(state, actor, 0);
    expect(
      invoiceView(state, actor, next.id).lines[0].reading_product_match
        ?.requires_check,
    ).toBe(false);
  });

  it("does not promote a name-filled SKU binding/history above barcode and flags different packs", async () => {
    const { state, actor, product } = await postedMatchingProduct();
    const supplier = state.suppliers![0];
    const generated = state.invoice.lines[0].supplier_item_code!;
    expect(state.invoice.lines[0].supplier_item_code_inferred).toBe(true);
    const other = {
      ...structuredClone(product),
      code: "8888",
      name_en: "Other Carrot Test",
      barcode: "900000000003",
      unit_size: "16 × 500 g",
    };
    state.products.push(other);
    state.supplier_items = [
      {
        id: "inferred-binding",
        company_id: state.config.company.seed_key,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        product_code: product.code,
        supplier_item_code: generated,
        supplier_item_code_inferred: true,
        units_per_case: 24,
        created_at: "",
        created_by: "",
      },
    ];
    const result = resolveReadingProductMatch(
      state,
      supplier,
      {
        supplier_sku: generated,
        description: "OTHER CARROT TEST",
        barcode: other.barcode,
        unit: "case",
        units_per_case: "16",
        pack_size: "16 × 500 g",
      },
      actor,
    )!;
    expect(result.product.code).toBe(other.code);
    expect(result.provenance.basis).toBe("barcode");
    const different = mapReadingLine(
      state,
      supplier,
      {
        description: "CARROT 24",
        unit: "case",
        units_per_case: "16",
        pack_size: "16 × 500 g",
        quantity: "1",
        unit_cost_before_tax: "1.2500",
        taxable: false,
      },
      0,
      [],
      actor,
    );
    expect(different.product_code).toBe(product.code);
    expect(different.reading_product_match?.requires_check).toBe(true);
    expect(different.low_confidence_fields).toContain("product_code");
  });

  it("prefers the same supplier when display names coincide and marks cross-supplier name matches", () => {
    const state = initialState(),
      supplier = supplierRecords(state)[0];
    const own = {
      ...state.products[0],
      name_en: "Matching Test Item",
      main_supplier: supplier.name,
    };
    const other = {
      ...state.products[1],
      name_en: own.name_en,
      main_supplier: "Another Test Supplier",
    };
    state.products = [other, own];
    state.invoice.lines = [];
    state.invoices = [];
    state.supplier_items = [];
    expect(
      resolveReadingProductMatch(state, supplier, { description: own.name_en })
        ?.product.code,
    ).toBe(own.code);
    state.products = [other];
    expect(
      resolveReadingProductMatch(state, supplier, {
        description: other.name_en,
      })?.provenance.requires_check,
    ).toBe(true);
  });

  it("uses pack evidence for equal clean names and leaves missing-pack ambiguity as a check", () => {
    const state = initialState(),
      supplier = supplierRecords(state)[0];
    const small = {
      ...state.products[0],
      name_en: "Orchard Spread",
      main_supplier: supplier.name,
      unit_size: "300 g",
    };
    const large = {
      ...state.products[1],
      name_en: "Orchard Spread",
      main_supplier: supplier.name,
      unit_size: "500 g",
    };
    state.products = [small, large];
    state.invoice.lines = [];
    state.invoices = [];
    state.supplier_items = [small, large].map((product, index) => ({
      id: `inferred-pack-${index}`,
      company_id: supplier.company_id,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      product_code: product.code,
      supplier_item_code: "Orchard Spread",
      supplier_item_code_inferred: true,
      units_per_case: index === 0 ? 12 : 24,
      created_at: "",
      created_by: "",
    }));
    const precise = resolveReadingProductMatch(state, supplier, {
      description: "ORCHARD SPREAD X 24",
      unit: "case",
      units_per_case: "24",
      pack_size: "24 × 500 g",
    })!;
    expect(precise.product.code).toBe(large.code);
    expect(precise.provenance.basis).not.toBe("supplier_code");
    const ambiguous = resolveReadingProductMatch(state, supplier, {
      description: "ORCHARD SPREAD",
      unit: "each",
    })!;
    expect(ambiguous.provenance.requires_check).toBe(true);
  });

  it("rejects foreign-company and archived products/bindings and inactive supplier identities", () => {
    const state = initialState(),
      supplier = supplierRecords(state)[0],
      product = structuredClone(state.products[0]);
    state.invoice.lines = [];
    state.invoices = [];
    state.products = [
      {
        ...product,
        company_id: "foreign-company",
        name_en: "Foreign Test Item",
        barcode: "foreign-barcode",
      },
    ];
    expect(
      matchReadingProduct(state, supplier, {
        description: "Foreign Test Item",
        barcode: "foreign-barcode",
      }),
    ).toBeUndefined();
    state.products = [{ ...product, status: "archived" }];
    expect(
      matchReadingProduct(state, supplier, {
        description: product.name_en,
        barcode: product.barcode,
      }),
    ).toBeUndefined();
    state.products = [product];
    state.supplier_items = [
      {
        id: "archived-binding",
        company_id: supplier.company_id,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        product_code: product.code,
        supplier_item_code: "ONLY-SKU",
        units_per_case: 1,
        archived: true,
        created_at: "",
        created_by: "",
      },
    ];
    expect(
      matchReadingProduct(state, supplier, { supplier_sku: "ONLY-SKU" }),
    ).toBeUndefined();
    expect(
      matchReadingProduct(
        state,
        { ...supplier, company_id: "foreign-company" },
        { description: product.name_en },
      ),
    ).toBeUndefined();
    expect(
      matchReadingProduct(
        state,
        { ...supplier, active: false },
        { description: product.name_en },
      ),
    ).toBeUndefined();
  });

  it("does not use a prior delivery outside the actor's invoice authority or project private provenance", async () => {
    const { state, actor, invoice, product } = await postedMatchingProduct();
    const move = invoiceLocationMovePreview(
      state,
      actor,
      invoice.id,
      "Branch 2",
    );
    movePostedInvoice(
      state,
      actor,
      invoice.id,
      "Branch 2",
      "Correct fictional delivery location",
      move.snapshot,
    );
    const worker = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
    });
    expect(
      resolveReadingProductMatch(
        state,
        state.suppliers![0],
        { description: "CARROT 24" },
        worker,
      ),
    ).toBeUndefined();
    state.invoice = createInvoice(state, worker, "Branch 1");
    state.invoice.lines = [
      {
        ...structuredClone(invoice.lines[0]),
        reading_product_match: {
          product_code: product.code,
          basis: "supplier_description",
          earlier_delivery: true,
          requires_check: false,
          source_invoice_id: invoice.id,
        },
      },
    ];
    Object.assign(state.invoice.lines[0].reading_product_match!, {
      private_price: "PRIVATE-MATCH-SENTINEL",
      supplier_id: "PRIVATE-SUPPLIER-SENTINEL",
    });
    const view = invoiceView(state, actor, state.invoice.id);
    expect(JSON.stringify(view)).not.toContain("SENTINEL");
    expect(view.lines[0].reading_product_match).not.toHaveProperty(
      "source_invoice_id",
    );
    expect(
      invoiceView(state, worker, state.invoice.id).lines[0]
        .reading_product_match?.earlier_delivery,
    ).toBe(false);
  });
});
