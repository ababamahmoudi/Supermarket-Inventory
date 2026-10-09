import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  saveSupplier,
  confirmSupplier,
  deactivateSupplier,
  supplierChoices,
  supplierRecords,
  similarSupplierNames,
  type SupplierEdits,
} from "./supplier-editor";
import {
  addProduct,
  nextProductCode,
  similarProductNames,
  type NewProductEdits,
} from "./manual-product";
import { calculatePrice } from "./pricing";
import { configuredBranches } from "./settings";
import {
  addManualLine,
  createInvoice,
  invoiceBlockers,
  postInvoice,
} from "./invoice";
import {
  supplierBalanceOverview,
  supplierBalanceSummary,
} from "./supplier-balances";
import { supplierPage } from "./suppliers";
import type { OperationsContext } from "./operations";
import type { ProductEditorContext } from "./product-editor";
import type { DemoState } from "./types";

let state: DemoState;
let supervisor: OperationsContext;
let productContext: ProductEditorContext;
beforeEach(() => {
  state = initialState();
  supervisor = {
    company_id: state.config.company.seed_key,
    role: "supervisor",
    branch: "Branch 1",
    actor: "Demo Supervisor",
  };
  productContext = {
    ...supervisor,
    allowed_branches: configuredBranches(state.config),
  };
});
const supplierEdits = (patch: Partial<SupplierEdits> = {}): SupplierEdits => ({
  name: "North Orchard Supply",
  phone: "416-555-0173",
  email: "orders@example.test",
  sales_rep_name: "Demo Representative",
  sales_rep_phone: "416-555-0174",
  payment_terms: "Net 30",
  address: "",
  notes: "",
  ...patch,
});
const productEdits = (
  patch: Partial<NewProductEdits> = {},
): NewProductEdits => ({
  name_en: "Orchard Pears",
  name_fa: "گلابی باغ",
  description_en: "",
  description_fa: "",
  unit_size: "500 g",
  ai_category: "Produce",
  pricing_category: "grocery",
  barcode: "DEMO-ORCHARD-NEW",
  main_supplier: "Fresh Valley Foods",
  date_tracking: false,
  scope: "all",
  last_cost_before_tax: "1.4000",
  ...patch,
});

describe("Supervisor manual supplier entry", () => {
  it("creates a Confirmed supplier immediately and includes zero-balance suppliers in Payables", () => {
    const added = saveSupplier(state, supervisor, supplierEdits());
    expect(added.status).toBe("confirmed");
    expect(supplierChoices(state)).toContain(added);
    expect(state.approvals.some((item) => item.supplier_id === added.id)).toBe(
      false,
    );
    expect(
      supplierBalanceOverview(state, supervisor).find(
        (item) => item.supplier === added.name,
      ),
    ).toMatchObject({ balance: "0.00" });
    expect(state.activity.at(-1)).toMatchObject({
      action: "Add supplier",
      by: supervisor.actor,
      entity_id: added.id,
    });
  });
  it("records separate per-branch opening balances with the as-of date, without inventing purchase invoices", () => {
    const invoices = structuredClone(state.invoices);
    const added = saveSupplier(
      state,
      supervisor,
      supplierEdits({
        opening_balances: [
          { branch: "Branch 1", amount: "123.45", date: "2026-10-01" },
          { branch: "Branch 2", amount: "-10.00", date: "2026-10-02" },
          { branch: "Branch 3", amount: "0", date: "2026-10-03" },
        ],
      }),
    );
    expect(
      state.ledger.filter((row) => row.supplier === added.name),
    ).toHaveLength(3);
    expect(
      state.ledger.find((row) => row.supplier === added.name),
    ).toMatchObject({
      type: "opening_balance",
      reference: "Opening balance",
      amount: "123.45",
      date: "2026-10-01",
      branch: "Branch 1",
    });
    expect(supplierBalanceSummary(state, supervisor, added.name).balance).toBe(
      "123.45",
    );
    expect(
      supplierBalanceSummary(
        state,
        { ...supervisor, branch: "all" },
        added.name,
      ).balance,
    ).toBe("113.45");
    expect(state.invoices).toEqual(invoices);
    expect(state.activity.at(-1)?.reversible).toBe(false);
  });
  it("warns about similar names and requires an explicit decision before creating the record", () => {
    expect(
      similarSupplierNames(state, "Fresh Valley").map((record) => record.name),
    ).toContain("Fresh Valley Foods");
    const before = structuredClone(state);
    expect(() =>
      saveSupplier(state, supervisor, supplierEdits({ name: "Fresh Valley" })),
    ).toThrow("similar");
    expect(state).toEqual(before);
    expect(
      saveSupplier(
        state,
        supervisor,
        supplierEdits({ name: "Fresh Valley", similar_name_confirmed: true }),
      ).status,
    ).toBe("confirmed");
  });
  it("preserves original history through rename and deactivation and excludes inactive new-invoice choices", () => {
    const oldInvoices = structuredClone(state.invoices);
    const oldLedger = structuredClone(state.ledger);
    const supplier = supplierRecords(state).find(
      (record) => record.name === "Fresh Valley Foods",
    )!;
    const beforeBalance = supplierBalanceSummary(
      state,
      supervisor,
      supplier.name,
    ).balance;
    saveSupplier(
      state,
      supervisor,
      supplierEdits({ name: "Valley Delivery Foods" }),
      { id: supplier.id },
    );
    expect(state.invoices).toEqual(oldInvoices);
    expect(state.ledger).toEqual(oldLedger);
    expect(
      supplierBalanceSummary(state, supervisor, "Valley Delivery Foods")
        .balance,
    ).toBe(beforeBalance);
    expect(
      supplierPage(state, supervisor, "Fresh Valley Foods").supplier.name,
    ).toBe("Valley Delivery Foods");
    deactivateSupplier(state, supervisor, supplier.id);
    expect(
      supplierChoices(state).some((record) => record.id === supplier.id),
    ).toBe(false);
    expect(
      supplierPage(state, supervisor, "Valley Delivery Foods").invoices.length,
    ).toBeGreaterThan(0);
    expect(state.invoices).toEqual(oldInvoices);
    expect(state.activity.at(-1)?.action).toBe("Deactivate supplier");
  });
  it("rejects workers' catalog additions, Cashier quick-adds, foreign companies and invalid balance branches", () => {
    const before = structuredClone(state);
    expect(() =>
      saveSupplier(
        state,
        { ...supervisor, role: "floor_worker" },
        supplierEdits(),
      ),
    ).toThrow("permission");
    expect(() =>
      saveSupplier(state, { ...supervisor, role: "cashier" }, supplierEdits(), {
        invoice_quick_add: true,
      }),
    ).toThrow("permission");
    expect(() =>
      saveSupplier(
        state,
        { ...supervisor, company_id: "other-company" },
        supplierEdits(),
      ),
    ).toThrow("scope");
    expect(() =>
      saveSupplier(
        state,
        supervisor,
        supplierEdits({
          opening_balances: [
            { branch: "all", amount: "1.00", date: "2026-10-01" },
          ],
        }),
      ),
    ).toThrow("scope");
    expect(state).toEqual(before);
  });
  it("rejects invalid money/date before creating any supplier or ledger row", () => {
    const before = structuredClone(state);
    for (const [amount, date, error] of [
      ["1.001", "2026-10-01", "balance"],
      ["1.00", "2026-02-31", "date"],
    ])
      expect(() =>
        saveSupplier(
          state,
          supervisor,
          supplierEdits({
            opening_balances: [{ branch: "Branch 1", amount, date }],
          }),
        ),
      ).toThrow(error);
    expect(state).toEqual(before);
  });
  it("creates worker invoice-only proposals, blocks posting even if a confirmed flag is forged, and unblocks only after confirmation", () => {
    const worker = { ...supervisor, role: "floor_worker" as const };
    const added = saveSupplier(state, worker, supplierEdits(), {
      invoice_quick_add: true,
    });
    expect(added.status).toBe("proposed");
    state.invoice = createInvoice(state, "Branch 1", true);
    state.invoice.supplier = added.name;
    state.invoice.supplier_confirmed = true;
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toContain(
      "supplier_pending",
    );
    expect(
      state.approvals.find((item) => item.supplier_id === added.id),
    ).toMatchObject({ type: "new_supplier", status: "pending" });
    expect(() => confirmSupplier(state, worker, added.id)).toThrow(
      "permission",
    );
    confirmSupplier(state, supervisor, added.id);
    expect(added.status).toBe("confirmed");
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).not.toContain(
      "supplier_pending",
    );
  });
  it("rejects worker opening balances in an invoice quick-add transaction", () => {
    const before = structuredClone(state);
    expect(() =>
      saveSupplier(
        state,
        { ...supervisor, role: "floor_worker" },
        supplierEdits({
          opening_balances: [
            { branch: "Branch 1", amount: "10.00", date: "2026-10-01" },
          ],
        }),
        { invoice_quick_add: true },
      ),
    ).toThrow("permission");
    expect(state).toEqual(before);
  });
});
describe("Supervisor manual product entry", () => {
  it("uses the configured taxable flag, including non-taxable zero rates stored with decimals", () => {
    const nonTaxable = addProduct(state, productContext, productEdits());
    expect(nonTaxable.tax_profile).toBe("non_taxable");
    expect(nonTaxable.taxable).toBe(false);
    const taxable = addProduct(
      state,
      productContext,
      productEdits({
        name_en: "Taxable crackers",
        name_fa: "کراکر مشمول مالیات",
        pricing_category: "grocery_taxable",
        barcode: "",
      }),
    );
    expect(taxable.tax_profile).toBe("hst_13");
    expect(taxable.taxable).toBe(true);
    state.invoice = createInvoice(state, "Branch 1", true);
    addManualLine(state, nonTaxable.code);
    addManualLine(state, taxable.code);
    expect(state.invoice.lines.map((line) => line.taxable)).toEqual([
      false,
      true,
    ]);
  });
  it("calculates the price and activates the next product code without an inventory count", () => {
    const code = nextProductCode(state);
    const stock = structuredClone(state.stock);
    const movements = structuredClone(state.stock_movements);
    const result = calculatePrice("1.4000", "grocery", state.config);
    const product = addProduct(state, productContext, productEdits());
    expect(product).toMatchObject({
      code,
      status: "active",
      selling_price: result.selling_price,
      last_cost_before_tax: "1.4000",
    });
    expect(
      state.approvals.some(
        (approval) =>
          approval.type === "new_product" && approval.product_code === code,
      ),
    ).toBe(false);
    expect(state.stock).toEqual(stock);
    expect(state.stock_movements).toEqual(movements);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Add product",
      product_code: code,
      reversible: false,
    });
  });
  it("retains a high-water mark independent of archive and restored snapshots", () => {
    const first = addProduct(state, productContext, productEdits());
    first.status = "archived";
    state.product_code_high_water = Number(first.code) + 4;
    expect(nextProductCode(state)).toBe(
      String(Number(first.code) + 5).padStart(4, "0"),
    );
  });
  it("records a manual override and requires confirmation below minimum margin", () => {
    const before = structuredClone(state);
    expect(() =>
      addProduct(
        state,
        productContext,
        productEdits({ selling_price: "1.41" }),
      ),
    ).toThrow("margin");
    expect(state).toEqual(before);
    const product = addProduct(
      state,
      productContext,
      productEdits({ selling_price: "1.41", minimum_margin_confirmed: true }),
    );
    expect(product.selling_price).toBe("1.41");
    expect(
      state.approvals.find(
        (approval) => approval.product_code === product.code,
      ),
    ).toMatchObject({
      status: "approved",
      manual_override: true,
      acknowledgment_reason: "Below minimum margin confirmed",
    });
    expect(product.price_provenance).toBeUndefined();
  });
  it("blocks conflicting barcodes without creating a partial product or stock movement", () => {
    const before = structuredClone(state);
    expect(() =>
      addProduct(
        state,
        productContext,
        productEdits({ barcode: state.products[0].barcode }),
      ),
    ).toThrow("barcode_conflict");
    expect(state).toEqual(before);
  });
  it("warns on a similar name and allows an explicit continuation without merging records", () => {
    const existing = state.products[0];
    expect(similarProductNames(state, existing.name_en)).toContain(existing);
    expect(() =>
      addProduct(
        state,
        productContext,
        productEdits({ name_en: existing.name_en }),
      ),
    ).toThrow("similar");
    const product = addProduct(
      state,
      productContext,
      productEdits({ name_en: existing.name_en, similar_name_confirmed: true }),
    );
    expect(product.code).not.toBe(existing.code);
  });
  it("does not allow worker or Cashier standalone creation; invoice worker proposals remain pending", () => {
    const worker = { ...productContext, role: "floor_worker" as const };
    expect(() => addProduct(state, worker, productEdits())).toThrow(
      "permission",
    );
    expect(() =>
      addProduct(
        state,
        { ...productContext, role: "cashier" },
        productEdits(),
        true,
      ),
    ).toThrow("permission");
    const product = addProduct(state, worker, productEdits(), true);
    expect(product.status).toBe("pending_approval");
    expect(product.selling_price).toBe("");
    expect(
      state.approvals.find(
        (approval) => approval.product_code === product.code,
      ),
    ).toMatchObject({ type: "new_product", status: "pending" });
  });
  it("rejects removed opening-count input, worker overrides, foreign company and invalid locations", () => {
    const before = structuredClone(state);
    const worker = { ...productContext, role: "floor_worker" as const };
    const obsolete = {
      ...productEdits(),
      opening_counts: [{ branch: "Branch 1", quantity: 0 }],
    };
    for (const actor of [productContext, worker])
      expect(() => addProduct(state, actor, obsolete, true)).toThrow(
        "inventory_disabled",
      );
    expect(() =>
      addProduct(state, worker, productEdits({ selling_price: "4.99" }), true),
    ).toThrow("permission");
    expect(() =>
      addProduct(
        state,
        { ...productContext, company_id: "foreign" },
        productEdits(),
      ),
    ).toThrow("company");
    expect(() =>
      addProduct(
        state,
        { ...productContext, branch: "foreign-location" },
        productEdits(),
      ),
    ).toThrow("branch");
    expect(state).toEqual(before);
  });
  it("excludes another company's similar names, codes and barcodes", () => {
    state.products.push({
      ...state.products[0],
      company_id: "foreign",
      code: "999999",
      name_en: "Orchard Pears",
      barcode: "DEMO-ORCHARD-NEW",
    });
    const product = addProduct(state, productContext, productEdits());
    expect(product.company_id).toBe(supervisor.company_id);
    expect(Number(product.code)).toBeLessThan(999999);
  });
});
describe("manual invoices use normal posting rules", () => {
  it("starts with no invented supplier, invoice number, lines or original", () => {
    state.invoice = createInvoice(state, "Branch 1", true);
    expect(state.invoice).toMatchObject({
      entry_mode: "manual",
      status: "draft",
      supplier: "",
      supplier_invoice_number: "",
      lines: [],
      final_total: "0.00",
    });
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toEqual(
      expect.arrayContaining(["file", "supplier", "lines"]),
    );
  });
  it("uses Supervisor-created supplier and product, saves a draft without a file and requires an original before posting", () => {
    const supplier = saveSupplier(state, supervisor, supplierEdits());
    const product = addProduct(
      state,
      productContext,
      productEdits({ main_supplier: supplier.name }),
    );
    state.invoice = createInvoice(state, "Branch 1", true);
    Object.assign(state.invoice, {
      supplier: supplier.name,
      supplier_confirmed: true,
      supplier_invoice_number: "DEMO-MANUAL-1",
      payment_terms: "Net 30",
    });
    addManualLine(state, product.code);
    state.invoice.lines[0].review_confirmed = true;
    state.invoice.lines[0].date_confirmed = true;
    expect(invoiceBlockers(state, "supervisor", "all")).toEqual(["file"]);
    expect(() => postInvoice(state, "supervisor", "all")).toThrow("file");
    state.invoice.file_name = "fictional-original.png";
    state.invoice.file_data = "data:image/png;base64,ZmFrZQ==";
    expect(postInvoice(state, "supervisor", "all", supervisor.actor)).toBe(
      true,
    );
    expect(state.ledger.at(-1)).toMatchObject({
      supplier: supplier.name,
      reference: "DEMO-MANUAL-1",
      type: "invoice",
    });
    expect(state.stock[`Branch 1:${product.code}`]).toBe(1);
  });
  it("posts a resumed saved draft into the same retained record without duplicate IDs or repeated stock/ledger entries", () => {
    const supplier = saveSupplier(state, supervisor, supplierEdits());
    const product = addProduct(
      state,
      productContext,
      productEdits({ main_supplier: supplier.name }),
    );
    state.invoice = createInvoice(state, "Branch 1", true);
    Object.assign(state.invoice, {
      supplier: supplier.name,
      supplier_confirmed: true,
      supplier_invoice_number: "RESUMED-1",
      file_name: "original.png",
      file_data: "data:image/png;base64,ZmFrZQ==",
    });
    addManualLine(state, product.code);
    state.invoice.lines[0].review_confirmed = true;
    state.invoice.lines[0].date_confirmed = true;
    const id = state.invoice.id;
    state.invoices!.push(structuredClone(state.invoice));
    expect(postInvoice(state, "supervisor", "Branch 1", supervisor.actor)).toBe(
      true,
    );
    expect(state.invoices!.filter((invoice) => invoice.id === id)).toHaveLength(
      1,
    );
    expect(state.invoices!.find((invoice) => invoice.id === id)?.status).toBe(
      "posted",
    );
    const posted = structuredClone(state);
    expect(postInvoice(state, "supervisor", "Branch 1", supervisor.actor)).toBe(
      false,
    );
    expect(state).toEqual(posted);
  });
});
