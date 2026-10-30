import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  confirmInvoiceLine,
  openInvoiceDetails,
  openShellAction,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import {
  expectReceivingStable,
  openReceivingLine,
  receivingRow,
  removeReceivingDemo,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

function readingFile(index: number, supplier: string) {
  const file = JSON.parse(
    readFileSync(
      new URL("./fixtures/r2b-matching-readings-export.json", import.meta.url),
      "utf8",
    ),
  );
  const entry = file.invoices[index];
  expect(entry.ai_reading.supplier_name).toBe(supplier);
  file.invoices = [entry];
  return {
    name: "fictional-matching.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(file)),
  };
}
async function addReading(
  page: Page,
  index: number,
  supplier = "Northstar Test Foods",
) {
  await page.goto("/#settings?group=data");
  await page
    .getByRole("navigation", { name: "Settings groups", exact: true })
    .getByRole("button", { name: "Data", exact: true })
    .click();
  await page
    .getByLabel("Choose file…", { exact: true })
    .setInputFiles(readingFile(index, supplier));
  const preview = page.getByRole("dialog", {
    name: "Import invoice readings",
    exact: true,
  });
  await expect(preview.getByRole("checkbox")).toBeChecked();
  // The shared dialog's primary footer action performs the real additive import.
  // Its exact singular/plural wording is covered by the dialog contract tests.
  await preview.locator(".ui-dialog-footer > .button-primary").click();
  const summary = page.getByRole("dialog", {
    name: "Import complete",
    exact: true,
  });
  await expect(
    summary.getByRole("heading", { name: "1 invoice imported", exact: true }),
  ).toBeVisible();
  await summary
    .getByRole("button", {
      name: index === 1 ? "Open Ready to post" : "Open Needs review",
      exact: true,
    })
    .click();
  await page
    .locator(".invoice-saved-drafts tbody tr")
    .filter({ hasText: `MATCH-${index + 1}` })
    .getByRole("link", { name: `MATCH-${index + 1}`, exact: true })
    .click();
}

test("R2b 1.10 a posted product survives a catalog rename on its next supplier delivery", async ({
  page,
}, testInfo) => {
  const phone = testInfo.project.name === "phone";
  await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await removeReceivingDemo(page, "en");
  await addReading(page, 0);
  await openInvoiceDetails(page);
  await page
    .getByRole("button", { name: "Looks right: Invoice details", exact: true })
    .click();
  let editor = await openReceivingLine(page, 0);
  await setReceivingCategory(page, editor, "en");
  await confirmInvoiceLine(page, editor);
  await page
    .getByRole("button", { name: "Looks right: Totals", exact: true })
    .click();
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await expect
    .poll(
      async () => (await readCanonicalBusinessEvidence(page)).products.length,
    )
    .toBe(1);
  const product = (await readCanonicalBusinessEvidence(page)).products[0];
  await page.goto(`/#product?code=${encodeURIComponent(product.code)}`);
  await page
    .getByRole("button", { name: `Edit ${product.name_en}`, exact: true })
    .click();
  const productEditor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await productEditor
    .getByLabel("English name", { exact: true })
    .fill("Crafted Carrot Jam");
  await productEditor
    .getByLabel("Persian name (optional)", { exact: true })
    .fill("مربای هویج آزمایشی");
  await productEditor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(productEditor).not.toBeVisible();
  await addReading(page, 1);
  const same = (await readCanonicalBusinessEvidence(page)).invoice.lines[0];
  expect(same.product_code).toBe(product.code);
  expect(same.description).toBe("CARROT 24");
  expect(same.low_confidence_fields).not.toContain("product_code");
  editor = await openReceivingLine(page, 0);
  await expect(
    editor.getByRole("combobox", { name: "Matched product", exact: true }),
  ).toHaveAccessibleDescription(
    "Matched to “Crafted Carrot Jam” from an earlier delivery.",
  );
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await addReading(page, 2, "Elmwood Test Supply");
  const other = (await readCanonicalBusinessEvidence(page)).invoice.lines[0];
  expect(other.product_code).toBe(product.code);
  expect(other.low_confidence_fields).toContain("product_code");
  const language = phone ? "fa" : "en";
  if (phone) {
    await setLanguage(page, "fa");
    await (await openShellAction(page, "تغییر به تم تیره")).click();
  }
  editor = await openReceivingLine(page, 0);
  const matched = editor.getByRole("combobox", {
    name: word(language, "Matched product", "کالای مرتبط"),
    exact: true,
  });
  await expect(
    editor.getByText(word(language, "Check the match", "تطبیق را بررسی کنید"), {
      exact: true,
    }),
  ).toBeVisible();
  await expect(matched).toHaveAccessibleDescription(
    phone
      ? "تطبیق با «مربای هویج آزمایشی» از دریافت قبلی. تطبیق را بررسی کنید"
      : "Matched to “Crafted Carrot Jam” from an earlier delivery. Check the match",
  );
  for (const width of phone ? [390] : [1440, 1000]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await matched.scrollIntoViewIfNeeded();
    await expect(matched).toBeInViewport({ ratio: 1 });
    expect(
      await matched.evaluate(
        (element) => getComputedStyle(element).borderTopWidth,
      ),
    ).toBe("2px");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    await editor.screenshot({
      path: testInfo.outputPath(`match-${width}-${language}.png`),
    });
  }
  const row = receivingRow(page, 0);
  await editor
    .getByRole("button", {
      name: word(language, "Confirm line", "تأیید ردیف"),
      exact: true,
    })
    .scrollIntoViewIfNeeded();
  await expectReceivingStable(
    page,
    row,
    () => confirmInvoiceLine(page, editor),
    { scroll: false },
  );
  const final = await readCanonicalBusinessEvidence(page);
  expect(final.invoice.lines[0].review_confirmed).toBe(true);
  expect(final.invoice.lines[0].low_confidence_fields).toEqual([]);
  expect(final.invoice.lines[0].description).toBe("CARROT 24");
  expect(final.products).toHaveLength(1);
});
