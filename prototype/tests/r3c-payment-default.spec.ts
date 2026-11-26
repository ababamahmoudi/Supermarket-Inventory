import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { InvoiceReadingsExport } from "../src/invoice-readings";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  chooseOption,
  openInvoiceDetails,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import { removeReceivingDemo, word } from "./r2-receiving-helpers";

const sourceFixture = JSON.parse(
  readFileSync(
    new URL(
      "./fixtures/r3c-monthly-fictional-readings-export.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as InvoiceReadingsExport;

for (const language of ["en", "fa"] as const) {
  test(`R3c K6 missing-paper Monthly is quiet and manual choice retains originals ${language}`, async ({
    page,
  }) => {
    await signIn(page, "Owner");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    await removeReceivingDemo(page, language);
    const source = structuredClone(sourceFixture);
    source.invoices = [source.invoices[0]];
    Object.assign(source.invoices[0].ai_reading!, {
      supplier_invoice_number: "FICTIONAL-MONTHLY-31",
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
    await page
      .getByLabel(word(language, "Choose file…", "انتخاب فایل…"), {
        exact: true,
      })
      .setInputFiles({
        name: "fictional-monthly-default.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(source)),
      });
    const preview = page.getByRole("dialog", {
      name: word(language, "Import invoice readings", "ورود خوانش فاکتورها"),
      exact: true,
    });
    await expect(preview.locator("[data-import-id]")).toHaveCount(1);
    await preview
      .getByRole("button", {
        name: word(language, "Import 1 invoice", "ورود 1 فاکتور"),
        exact: true,
      })
      .click();
    const summary = page.getByRole("dialog", {
      name: word(language, "Import complete", "ورود کامل شد"),
      exact: true,
    });
    await summary
      .getByRole("button", {
        name: word(language, "Open Needs review", "باز کردن نیازمند بررسی"),
        exact: true,
      })
      .click();
    await page
      .getByRole("link", { name: "FICTIONAL-MONTHLY-31", exact: true })
      .click();
    await expect(page.getByTestId("invoice-review")).toBeVisible();
    await openInvoiceDetails(page);
    const terms = page.locator("#invoice-payment-terms");
    const field = page.locator(".invoice-payment-terms");
    await expect(terms).toContainText(word(language, "Monthly", "ماهانه"));
    await expect(field).not.toHaveClass(/please-check-field/);
    await expect(field.locator(".reading-check-marker")).toHaveCount(0);
    await expect(field).toContainText(
      word(language, "Default: first of next month", "پیش‌فرض: اول ماه بعد"),
    );
    await expect(
      field.getByRole("button", {
        name: new RegExp(
          `^${word(language, "Not on the invoice", "در فاکتور نیست")}`,
        ),
      }),
    ).toHaveCount(0);
    await expect(page.locator("#invoice-due-date")).toHaveText("2027-01-01");
    await expect(
      page
        .locator("#invoice-due-date")
        .locator("xpath=ancestor::*[contains(@class,'field')][1]"),
    ).not.toHaveClass(/please-check-field/);
    const before = await readCanonicalBusinessEvidence(page);
    const invoice = before.invoice;
    expect(invoice).toMatchObject({
      payment_terms: "Monthly",
      payment_terms_defaulted: true,
      payment_terms_inferred: false,
      due_date: "2027-01-01",
    });
    expect(invoice.low_confidence_fields).toContain("order_reference");
    expect(invoice.low_confidence_fields).not.toContain("payment_terms");
    expect(invoice.low_confidence_fields).not.toContain("due_date");
    expect(
      invoice.original_pages!.map((entry) => entry.original_sha256),
    ).toEqual(source.invoices[0].original_sha256);
    await chooseOption(
      page,
      terms,
      "30",
      word(language, "Net 30 (30 days)", "خالص 30 (30 روز)"),
    );
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice
            .payment_terms_defaulted,
      )
      .toBe(false);
    await expect(field).not.toContainText(
      word(language, "Default: first of next month", "پیش‌فرض: اول ماه بعد"),
    );
    await expect(page.locator("#invoice-due-date")).toHaveText("2027-01-30");
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.invoice.id).toBe(invoice.id);
    expect(after.invoice.original_pages).toEqual(invoice.original_pages);
    expect(after.invoice.reading_record).toEqual(invoice.reading_record);
    expect(after.invoice.lines).toEqual(invoice.lines);
    expect(after.invoice.low_confidence_fields).toContain("order_reference");
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock_movements).toEqual(before.stock_movements);
    expect(after.approvals).toEqual(before.approvals);
  });
}
