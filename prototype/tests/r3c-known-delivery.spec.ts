import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import {
  confirmInvoiceLine,
  openInvoiceDetails,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import {
  openReceivingLine,
  removeReceivingDemo,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

async function importDelivery(page: Page, index: number, amount = "30.00") {
  const exported = JSON.parse(
    readFileSync(
      new URL("./fixtures/r2b-matching-readings-export.json", import.meta.url),
      "utf8",
    ),
  );
  const entry = exported.invoices[index];
  const number = `REPEAT-${index + 1}`;
  const data = await page.evaluate(
    ({ number, amount }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 560;
      canvas.height = 420;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "white";
      context.fillRect(0, 0, 560, 420);
      context.fillStyle = "black";
      context.font = "24px sans-serif";
      [
        "Fictional Northstar Test Foods",
        number,
        "CARROT 24 | 1 case | 24 x 300 g",
        `Case cost $${amount}`,
        `Total CAD $${amount}`,
      ].forEach((line, i) => context.fillText(line, 20, 50 + i * 60));
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { number, amount },
  );
  entry.pages = [{ page: 1, mime: "image/png", data }];
  entry.original_sha256 = [
    createHash("sha256").update(Buffer.from(data, "base64")).digest("hex"),
  ];
  entry.id = `fictional-r3c-repeat-${index}`;
  entry.file_name = `${number}.png`;
  entry.ai_reading.supplier_name = "Northstar Test Foods";
  entry.ai_reading.supplier_tax_number = "TEST-NORTHSTAR";
  entry.ai_reading.supplier_invoice_number = number;
  entry.ai_reading.subtotal = entry.ai_reading.final_total = amount;
  const line = entry.ai_reading.lines[0];
  line.supplier_sku = "CAR-24";
  line.unit_cost_before_tax = line.cost_per_unit_before_tax = new Decimal(
    amount,
  )
    .div(24)
    .toFixed(4);
  line.cost_per_case_before_tax = new Decimal(amount).toFixed(4);
  line.line_total = amount;
  entry.ai_statuses = index
    ? Object.fromEntries(
        [
          "description",
          "supplier_sku",
          "units_per_case",
          "pack_size",
          "unit_cost_before_tax",
          "cost_per_case_before_tax",
          "pricing_category",
        ].map((field) => [`lines[0].${field}`, "check"]),
      )
    : {};
  exported.invoices = [entry];
  await page.goto("/#settings?group=data");
  await page
    .getByRole("navigation", { name: "Settings groups", exact: true })
    .getByRole("button", { name: "Data", exact: true })
    .click();
  await page.getByLabel("Choose file…", { exact: true }).setInputFiles({
    name: "fictional-r3c-delivery.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  const preview = page.getByRole("dialog", {
    name: "Import invoice readings",
    exact: true,
  });
  await expect(preview.getByRole("checkbox")).toBeChecked();
  await preview.locator(".ui-dialog-footer > .button-primary").click();
  const summary = page.getByRole("dialog", {
    name: "Import complete",
    exact: true,
  });
  await summary
    .getByRole("button", {
      name: index === 1 ? "Open Ready to post" : "Open Needs review",
      exact: true,
    })
    .click();
  await page
    .locator(".invoice-saved-drafts tbody tr")
    .filter({ hasText: number })
    .getByRole("link", { name: number, exact: true })
    .click();
  await expect(page.getByTestId("invoice-review")).toBeVisible();
  return entry.original_sha256[0] as string;
}

for (const language of ["en", "fa"] as const)
  test(`R3c K1 repeat delivery is green without a click and only a changed cost is amber ${language}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: testInfo.project.name === "phone" ? 390 : 1440,
      height: 1000,
    });
    await signIn(page, "Owner");
    await setBranch(page, "Branch 1");
    await removeReceivingDemo(page, "en");
    await importDelivery(page, 0);
    await openInvoiceDetails(page);
    await page
      .getByRole("button", {
        name: "Looks right: Invoice details",
        exact: true,
      })
      .click();
    const editor = await openReceivingLine(page, 0);
    await setReceivingCategory(page, editor, "en");
    await confirmInvoiceLine(page, editor);
    await page
      .getByRole("button", { name: "Looks right: Totals", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Post invoice", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Post invoice", exact: true })
      .getByRole("button", { name: "Post invoice", exact: true })
      .click();
    await expect
      .poll(
        async () => (await readCanonicalBusinessEvidence(page)).products.length,
      )
      .toBe(1);
    const before = await readCanonicalBusinessEvidence(page);
    expect(before.products[0].status).toBe("pending_approval");
    const sourceHash = await importDelivery(page, 1);
    await setLanguage(page, language);
    const row = page.getByTestId("invoice-line-row-0");
    await expect(row).toHaveClass(/receiving-row-confirmed/);
    await expect(
      row.getByText(
        word(language, "Same as last delivery", "مانند تحویل قبلی"),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      row.getByRole("img", {
        name: word(language, "Same as last delivery", "مانند تحویل قبلی"),
        exact: true,
      }),
    ).toBeVisible();
    await expect(row.locator(".receiving-line-check-count")).toHaveCount(0);
    await expect(page.locator(".receiving-known-counts")).toHaveText(
      word(
        language,
        "1 same as before · 0 changed · 0 new",
        "1 مانند قبل · 0 تغییرکرده · 0 جدید",
      ),
    );
    const same = await readCanonicalBusinessEvidence(page);
    expect(same.invoice.lines[0].review_confirmed).toBe(true);
    expect(same.invoice.lines[0].checked_fields).toBeUndefined();
    expect(same.invoice.lines[0].low_confidence_fields).toEqual([]);
    expect(same.invoice.original_pages![0].original_sha256).toBe(sourceHash);
    expect(same.approvals).toEqual(before.approvals);
    expect(same.ledger).toEqual(before.ledger);
    expect(same.products).toEqual(before.products);
    await page
      .getByRole("button", {
        name: word(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      })
      .click();
    const posting = page.getByRole("dialog", {
      name: word(language, "Post invoice", "ثبت فاکتور"),
      exact: true,
    });
    await expect(posting).toBeVisible();
    await posting
      .getByRole("button", {
        name: word(language, "Cancel", "انصراف"),
        exact: true,
      })
      .click();
    await setLanguage(page, "en");
    await importDelivery(page, 2, "34.20");
    await setLanguage(page, language);
    await expect(row).toHaveClass(/receiving-row-check/);
    await expect(
      row.locator('[data-changed-field="unit_cost_before_tax"]'),
    ).toContainText("30.00");
    await expect(
      row.locator('[data-changed-field="unit_cost_before_tax"]'),
    ).toContainText("34.20");
    await expect(
      row.locator('[data-changed-field="unit_cost_before_tax"]'),
    ).toContainText("2026-08-12");
    await expect(row.locator("[data-changed-field]")).toHaveCount(1);
    const changed = await readCanonicalBusinessEvidence(page);
    expect(changed.invoice.lines[0].low_confidence_fields).toEqual([
      "case_cost_before_tax",
    ]);
    expect(changed.invoice.lines[0].review_confirmed).toBe(false);
    expect(changed.invoice.final_total).toBe("34.20");
    expect(changed.products).toEqual(before.products);
    expect(changed.ledger).toEqual(before.ledger);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(testInfo.project.name === "phone" ? 391 : 1441);
    await row.screenshot({
      path: testInfo.outputPath(`known-delivery-${language}.png`),
    });
  });
