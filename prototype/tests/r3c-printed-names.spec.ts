import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
import {
  configureLive,
  expectNoPosting,
  expectReview,
  fictionalResponse,
  mockReader,
  newLiveOriginal,
  pressRead,
  retainedSourceHashes,
  sourceHash,
} from "./r3-live-reading-helpers";

const raw = "NORTHSTAR TEST CARROT JAM 24 X 300G",
  clean = "Northstar Carrot Jam 300 g";
async function fictionalPaper(page: Page, number: string) {
  const data = await page.evaluate(
    ({ number, raw }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 680;
      canvas.height = 440;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "white";
      context.fillRect(0, 0, 680, 440);
      context.fillStyle = "black";
      context.font = "20px sans-serif";
      [
        "FICTIONAL Northstar Test Foods",
        number,
        raw,
        "1 case |24 x300g |$30.00",
        "Subtotal CAD30.00 |Tax0.00 |Total30.00",
      ].forEach((line, i) => context.fillText(line, 16, 50 + i * 64));
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { number, raw },
  );
  return {
    name: `${number}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  };
}
for (const language of ["en", "fa"] as const)
  test(`R3c K2 checked clean name matches a raw live reader response and preserves Description ${language}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width: info.project.name === "phone" ? 390 : 1440,
      height: 1000,
    });
    await signIn(page, "Owner");
    await setBranch(page, "Branch 1");
    await removeReceivingDemo(page, "en");
    const file = JSON.parse(
      readFileSync(
        new URL(
          "./fixtures/r2b-matching-readings-export.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const entry = file.invoices[0],
      first = await fictionalPaper(page, "K2-CHECKED-1");
    entry.id = "fictional-r3c-checked-name";
    entry.file_name = first.name;
    entry.pages = [
      { page: 1, mime: first.mimeType, data: first.buffer.toString("base64") },
    ];
    entry.original_sha256 = [
      createHash("sha256").update(first.buffer).digest("hex"),
    ];
    entry.ai_reading.supplier_invoice_number = "K2-CHECKED-1";
    entry.ai_reading.lines[0].description = raw;
    entry.checked_answer = { lines: [{ description: clean }] };
    entry.ai_statuses = { "lines[0].description": "check" };
    file.invoices = [entry];
    await page.getByLabel("Choose file…", { exact: true }).setInputFiles({
      name: "fictional-checked-names.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(file)),
    });
    const preview = page.getByRole("dialog", {
      name: "Import invoice readings",
      exact: true,
    });
    await preview
      .getByRole("group", { name: "Reading values", exact: true })
      .getByRole("button", { name: "My checked values", exact: true })
      .click();
    await preview.locator(".ui-dialog-footer > .button-primary").click();
    await page
      .getByRole("dialog", { name: "Import complete", exact: true })
      .getByRole("button", { name: "Open Needs review", exact: true })
      .click();
    await page.getByRole("link", { name: "K2-CHECKED-1", exact: true }).click();
    await openInvoiceDetails(page);
    await page
      .getByRole("button", {
        name: "Looks right: Invoice details",
        exact: true,
      })
      .click();
    const editor = await openReceivingLine(page, 0);
    await expect(editor.locator("#invoice-line-0-name-en")).toHaveValue(clean);
    await setReceivingCategory(page, editor, "en");
    await editor.locator("details.receiving-more > summary").click();
    await expect(editor.locator("#invoice-line-0-description")).toHaveValue(
      raw,
    );
    await expect(editor.locator("#invoice-line-0-description")).toHaveAttribute(
      "readonly",
      "",
    );
    await editor
      .getByLabel("Description (optional)", { exact: true })
      .fill("Fictional shelf note");
    await editor
      .getByLabel("Persian description (optional)", { exact: true })
      .fill("یادداشت آزمایشی");
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
    const posted = await readCanonicalBusinessEvidence(page),
      product = posted.products[0];
    expect(product).toMatchObject({
      name_en: clean,
      unit_size: "300 g",
      description_en: "Fictional shelf note",
      description_fa: "یادداشت آزمایشی",
    });
    expect(posted.supplier_items).toHaveLength(1);
    expect(posted.supplier_items![0].printed_description_keys?.[0].key).toBe(
      "northstar test carrot jam 24 x 300g",
    );
    const response = {
      ...fictionalResponse("K2-LIVE-2"),
      models: [
        {
          id: "fictional-vision-kit-a",
          ok: true,
          seconds: 71.25,
          costUSD: 0.0123,
          error: null,
        },
        {
          id: "fictional-vision-kit-b",
          ok: true,
          seconds: 30.5,
          costUSD: 0.0011,
          error: null,
        },
      ],
      checkFailures: [],
    };
    Object.assign(response.reading, {
      ...entry.ai_reading,
      supplier_invoice_number: "K2-LIVE-2",
      invoice_date: "2026-08-13",
      due_date: "2026-08-13",
      lines: [{ ...entry.ai_reading.lines[0], description: raw }],
    });
    Object.assign(response.statuses, {
      "lines[0].description": "check",
      "lines[0].supplier_sku": "check",
      "lines[0].units_per_case": "check",
      "lines[0].pricing_category": "check",
    });
    const reader = await mockReader(page, [{ kind: "success", response }]);
    await configureLive(page);
    const second = await fictionalPaper(page, "K2-LIVE-2"),
      original = await newLiveOriginal(page, second);
    const before = await readCanonicalBusinessEvidence(page);
    expect(await retainedSourceHashes(page, original)).toEqual([
      sourceHash(second),
    ]);
    await pressRead(page);
    await expectReview(page, original.id);
    await setLanguage(page, language);
    const row = page.getByTestId("invoice-line-row-0");
    await expect(row).toHaveClass(/receiving-row-confirmed/);
    await expect(row.locator(".receiving-product-name")).toHaveText(clean);
    await expect(
      row.getByText(
        word(language, "Same as last delivery", "مانند تحویل قبلی"),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(row.locator(".receiving-line-check-count")).toHaveCount(0);
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.invoice.lines[0]).toMatchObject({
      product_code: product.code,
      description: raw,
      printed_description: raw,
      review_confirmed: true,
      low_confidence_fields: [],
    });
    expect(after.invoice.lines[0].checked_fields).toBeUndefined();
    expectNoPosting(before, after);
    expect(after.products).toHaveLength(1);
    expect(after.supplier_items).toEqual(before.supplier_items);
    expect(reader.requests).toHaveLength(1);
    expect(await retainedSourceHashes(page, after.invoice)).toEqual([
      sourceHash(second),
    ]);
    const secondEditor = await openReceivingLine(page, 0);
    await secondEditor.locator("details.receiving-more > summary").click();
    await expect(
      secondEditor.locator("#invoice-line-0-description"),
    ).toHaveValue(raw);
    await expect(
      secondEditor.locator("#invoice-line-0-description-en"),
    ).toHaveValue("Fictional shelf note");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(info.project.name === "phone" ? 391 : 1441);
    await secondEditor.screenshot({
      path: info.outputPath(`printed-names-${language}.png`),
    });
  });
