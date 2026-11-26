import type { Page } from "@playwright/test";
import { runCanonicalBusinessFixture } from "./business-fixture";

/**
 * Fictional totals alert: the first posted demo invoice gets a paper subtotal
 * $100.00 above its lines (as if a page was missing), and the alert that
 * posting would raise.
 */
export async function createTotalsAlert(
  page: Page,
  options: { taxOnly?: boolean } = {},
) {
  const created = await runCanonicalBusinessFixture(
    page,
    (draft, taxOnly: boolean) => {
      const invoice = (draft.invoices ?? []).find(
        (row) =>
          row.status === "posted" &&
          row.company_id === draft.config.company.seed_key &&
          row.branch === "Branch 1",
      )!;
      const lines = [
        ...invoice.lines.map((line) => Number(line.line_total ?? 0)),
        ...(invoice.other_charges ?? []).map((charge) => Number(charge.amount)),
      ].reduce((sum, value) => sum + value, 0);
      const calculated = lines.toFixed(2);
      const subtotal = taxOnly ? calculated : (lines + 100).toFixed(2);
      invoice.subtotal = subtotal;
      invoice.tax = "26.00";
      invoice.final_total = taxOnly
        ? (lines + 30).toFixed(2)
        : (lines + 126).toFixed(2);
      draft.alerts.push({
        id: `${invoice.id}:tax`,
        company_id: invoice.company_id,
        branch: invoice.branch,
        type: "tax_discrepancy",
        product_code: "",
        status: "pending",
        supplier: invoice.supplier,
        invoice_id: invoice.id,
        note: `Invoice ${invoice.supplier_invoice_number}: review totals and tax.`,
      });
      return {
        id: invoice.id,
        number: invoice.supplier_invoice_number,
        subtotal,
        calculated,
      };
    },
    Boolean(options.taxOnly),
  );
  await page.reload();
  return created;
}
