import { expect, type Page } from "@playwright/test";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { setBranch, signIn } from "./helpers";
export async function installReturnCreationFixture(
  page: Page,
  branch = "Branch 1",
) {
  await signIn(page, "Manager");
  await runCanonicalBusinessFixture(
    page,
    (state, { branch }) => {
      const company_id = state.config.company.seed_key;
      state.demo_fixture_schema = 2;
      state.returns = [];
      state.activity = [];
      state.alerts = [];
      const supplier = {
        id: "return-cloudbay",
        company_id,
        name: "Cloudbay Wholesale",
        phone: "",
        email: "",
        sales_rep_name: "",
        sales_rep_phone: "",
        payment_terms: "Net 30",
        address: "",
        status: "confirmed" as const,
        active: true,
        created_at: "2026-10-01T12:00:00Z",
        created_by: "Fictional setup",
      };
      state.suppliers = [supplier];
      const product = state.products.find(
        (product) => product.code === "0003",
      )!;
      Object.assign(product, {
        name_en: "Meadow Jar",
        name_fa: "شیشه مِدو",
        main_supplier: supplier.name,
        unit_size: "300 g",
        barcode: "FICT-RETURN-JAR",
        status: "active",
        sold_by: "each",
      });
      const line = {
        ...structuredClone(state.invoice.lines[0]),
        company_id,
        product_code: product.code,
        description: product.name_en,
        description_fa: product.name_fa,
        sold_by: "each" as const,
        quantity_unit: "units" as const,
        qty_invoiced: 20,
        qty_received_at_posting: 20,
        unit_cost_before_tax: "7.1250",
        line_total: "142.50",
        taxable: false,
        refused_units: 0,
        qty_later_received: 0,
      };
      state.invoices = [
        {
          ...structuredClone(state.invoice),
          id: "fictional-return-source",
          company_id,
          branch,
          supplier: supplier.name,
          supplier_invoice_number: "CLOUD-RET-01",
          status: "posted",
          invoice_date: "2026-10-21",
          received_at: "2026-10-21T14:00:00Z",
          posted_at: "2026-10-21T14:01:00Z",
          import_currency: state.config.company.currency,
          subtotal: "142.50",
          tax: "0.00",
          final_total: "142.50",
          payable_after_open_shorts: "142.50",
          lines: [line],
          short_lines: [],
        },
      ];
      state.invoice = {
        ...structuredClone(state.invoice),
        status: "empty",
        lines: [],
      };
      state.ledger = [
        {
          id: "fictional-return-purchase",
          company_id,
          branch,
          supplier: supplier.name,
          type: "invoice",
          amount: "142.50",
          date: "2026-10-21",
          reference: "CLOUD-RET-01",
          invoice_id: "fictional-return-source",
          currency: state.config.company.currency,
        },
      ];
    },
    { branch },
  );
  await setBranch(page, branch);
}
export async function fillReturnCreation(page: Page, fa = false) {
  await page.goto("/#returns");
  await page
    .getByRole("button", {
      name: fa ? "مرجوعی جدید" : "New return",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: fa ? "مرجوعی جدید" : "New return",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#new-return-supplier")).toBeEnabled();
  await dialog.locator("#new-return-supplier").click();
  await page
    .getByRole("option", { name: "Cloudbay Wholesale", exact: true })
    .click();
  await dialog.locator("#new-return-product").click();
  await page
    .getByRole("textbox", {
      name: fa ? "جستجوی گزینه‌ها" : "Search options",
      exact: true,
    })
    .fill("FICT-RETURN-JAR");
  await page
    .getByRole("option", { name: fa ? /شیشه مِدو/ : /Meadow Jar/ })
    .click();
  await dialog.locator("#new-return-quantity").fill("2");
  await dialog.locator("#new-return-reason").click();
  await page
    .getByRole("option", { name: fa ? "آسیب‌دیده" : "Damaged", exact: true })
    .click();
  await dialog
    .locator("#new-return-note")
    .fill(fa ? "کالای آزمایشی برای مرجوعی" : "Fictional condition report");
  return dialog;
}
