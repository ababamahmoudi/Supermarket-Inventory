import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  chooseOption,
  confirmInvoiceLine,
  openInvoiceDetails,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import {
  openReceivingLine,
  receivingNumber,
  receivingRow,
  removeReceivingDemo,
  setReceivingCategory,
  word,
  type ReceivingLanguage,
} from "./r2-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import type { DemoInvoice, DemoState } from "../src/types";

test.setTimeout(120000);

const mixedNumber = "F6-FICTIONAL-MIXED";
const categoryAction = "Set category for new invoice products";

/** Invented paper enters only through the ordinary readings-import dialog. */
async function readingFile(page: Page, mixed: boolean) {
  const exported = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/r2c-approval-fictional-readings-export.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const complete = exported.invoices[1];
  const number = mixed ? mixedNumber : receivingNumber;
  const lines = complete.ai_reading.lines.slice(0, mixed ? 3 : 1);
  // One printed tax decision and one genuinely inferred decision must survive
  // the same category selection with their respective existing semantics.
  if (mixed) lines[2].taxable = null;
  const total = mixed ? "5.00" : "1.50";
  const pages = await page.evaluate(
    ({ number, lines, total }) =>
      [1, 2].map((pageNumber) => {
        const canvas = document.createElement("canvas");
        canvas.width = 760;
        canvas.height = 560;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "black";
        context.font = "20px sans-serif";
        const text = [
          "FICTIONAL Cedar Vale Test Supply",
          `${number} - page ${pageNumber} of 2`,
          ...lines.map(
            (line: { description: string; line_total: string }) =>
              `${line.description} | 1 unit | CAD ${line.line_total}`,
          ),
          `Subtotal CAD ${total} | Tax 0.00 | Total CAD ${total}`,
        ];
        text.forEach((line, index) =>
          context.fillText(line, 16, 44 + index * 62),
        );
        return {
          page: pageNumber,
          mime: "image/png",
          data: canvas.toDataURL("image/png").split(",")[1],
        };
      }),
    { number, lines, total },
  );
  for (const entry of exported.invoices) {
    entry.file_name = `${number}.png`;
    entry.pages =
      entry.id === "fictional-r2-complete" ? pages : pages.slice(0, 1);
    entry.original_sha256 = entry.pages.map((image: { data: string }) =>
      createHash("sha256")
        .update(Buffer.from(image.data, "base64"))
        .digest("hex"),
    );
    entry.ai_reading.lines = structuredClone(lines);
    entry.ai_reading.supplier_invoice_number = number;
    entry.ai_reading.subtotal = entry.ai_reading.final_total = total;
    entry.ai_statuses = Object.fromEntries(
      lines.flatMap((_: unknown, index: number) => [
        [`lines[${index}].description`, "check"],
        [`lines[${index}].pricing_category`, "check"],
      ]),
    );
  }
  exported.invoices = [complete];
  return {
    name: `${number}.json`,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  };
}

async function importDelivery(page: Page, mixed: boolean, number: string) {
  const source = await readingFile(page, mixed);
  await page.goto("/#settings?group=data");
  await page
    .getByRole("navigation", { name: "Settings groups", exact: true })
    .getByRole("button", { name: "Data", exact: true })
    .click();
  await page.getByLabel("Choose file…", { exact: true }).setInputFiles(source);
  const preview = page.getByRole("dialog", {
    name: "Import invoice readings",
    exact: true,
  });
  await expect(preview.getByRole("checkbox")).toBeChecked();
  await preview.locator(".ui-dialog-footer > .button-primary").click();
  await page
    .getByRole("dialog", { name: "Import complete", exact: true })
    .getByRole("button", { name: "Open Needs review", exact: true })
    .click();
  await page.getByRole("link", { name: number, exact: true }).click();
  await expect(page.getByTestId("invoice-review")).toBeVisible();
}

async function mixedDelivery(page: Page, language: ReceivingLanguage) {
  await page.goto("/");
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await setLanguage(page, "en");
  await removeReceivingDemo(page, "en");
  await importDelivery(page, false, receivingNumber);
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

  await importDelivery(page, true, mixedNumber);
  await signIn(page, "Floor Worker");
  await setLanguage(page, language);
  await expect(page.getByTestId("invoice-review")).toBeVisible();
  const evidence = await readCanonicalBusinessEvidence(page);
  expect(evidence.invoice.supplier_invoice_number).toBe(mixedNumber);
  expect(
    evidence.invoice.lines.map((line) => line.product_code === "NEW"),
  ).toEqual([false, true, true]);
  await expect(receivingRow(page, 0)).toHaveClass(/receiving-row-confirmed/);
  await expect(
    receivingRow(page, 0).getByText(
      word(language, "Same as last delivery", "مانند تحویل قبلی"),
      { exact: true },
    ),
  ).toBeVisible();
}

const financial = (state: DemoState) => ({
  products: state.products,
  approvals: state.approvals,
  stock: state.stock,
  movements: state.stock_movements,
  ledger: state.ledger,
  supplierItems: state.supplier_items,
  suppliers: state.suppliers,
});

const sourceAndMoney = (invoice: DemoInvoice) => ({
  source: {
    file_data: invoice.file_data,
    file_name: invoice.file_name,
    original_pages: invoice.original_pages,
    reading_record: invoice.reading_record,
  },
  header: {
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    final_total: invoice.final_total,
    low_confidence_fields: invoice.low_confidence_fields,
  },
  lines: invoice.lines.map((line) => ({
    product_code: line.product_code,
    description: line.description,
    printed_description: line.printed_description,
    import_line_index: line.import_line_index,
    new_name_en: line.new_name_en,
    unit_cost_before_tax: line.unit_cost_before_tax,
    line_total: line.line_total,
    qty_invoiced: line.qty_invoiced,
    qty_received_at_posting: line.qty_received_at_posting,
    quantity_entered: line.quantity_entered,
    pack_size: line.pack_size,
    units_per_case: line.units_per_case,
    receiving_price: line.receiving_price,
  })),
});

function bulkButton(page: Page, language: ReceivingLanguage) {
  return page.getByRole("button", {
    name: word(
      language,
      "Set category for 2 new products",
      "تعیین دسته برای 2 کالای جدید",
    ),
    exact: true,
  });
}

async function openCategoryDialog(page: Page, language: ReceivingLanguage) {
  await bulkButton(page, language).click();
  const dialog = page.getByRole("dialog", {
    name: word(
      language,
      "Set category for 2 new products",
      "تعیین دسته برای 2 کالای جدید",
    ),
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const save = dialog.getByRole("button", {
    name: word(language, "Set category", "تعیین دسته"),
    exact: true,
  });
  await expect(save).toBeDisabled();
  await chooseOption(
    page,
    dialog.getByRole("combobox", {
      name: word(language, "Pricing category", "دسته قیمت‌گذاری"),
      exact: true,
    }),
    "grocery_taxable",
    word(language, "Grocery (Taxable)", "مواد غذایی (مشمول مالیات)"),
  );
  await expect(save).toBeEnabled();
  return { dialog, save };
}

for (const language of ["en", "fa"] as const) {
  test(`R3c F6 actual Floor bulk category preserves a known row, first-time checks and invoice evidence ${language}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const width = info.project.name === "phone" ? 390 : 1440;
    await page.setViewportSize({ width, height: 1000 });
    await mixedDelivery(page, language);
    await expect(bulkButton(page, language)).toBeVisible();
    const before = await readCanonicalBusinessEvidence(page);

    let { dialog, save } = await openCategoryDialog(page, language);
    await expect(save).toBeInViewport({ ratio: 1 });
    await dialog.screenshot({
      path: info.outputPath(`new-product-category-dialog-${language}.png`),
    });
    await dialog
      .getByRole("button", {
        name: word(language, "Cancel", "انصراف"),
        exact: true,
      })
      .click();
    await expect(dialog).toBeHidden();
    const cancelled = await readCanonicalBusinessEvidence(page);
    expect(cancelled.invoice).toEqual(before.invoice);
    expect(cancelled.activity).toEqual(before.activity);
    expect(financial(cancelled)).toEqual(financial(before));

    ({ dialog, save } = await openCategoryDialog(page, language));
    await save.click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => {
        const state = await readCanonicalBusinessEvidence(page);
        return state.activity.filter((entry) => entry.action === categoryAction)
          .length;
      })
      .toBe(1);
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.invoice.lines[0]).toEqual(before.invoice.lines[0]);
    expect(sourceAndMoney(after.invoice)).toEqual(
      sourceAndMoney(before.invoice),
    );
    expect(financial(after)).toEqual(financial(before));
    const action = after.activity.filter(
      (entry) => entry.action === categoryAction,
    )[0];
    expect(action).toMatchObject({
      actor_user_id: "demo-person-ny-floor",
      actor_username: "ny-floor",
      actor_role_snapshot: "floor_worker",
      entity_type: "invoice",
      entity_id: after.invoice.id,
      reversible: true,
      invoice_category_selection: {
        count: 2,
        category: "grocery_taxable",
        line_ids: after.invoice.lines.slice(1).map((line) => line.id),
      },
    });
    expect(Number.isFinite(Date.parse(action.at))).toBe(true);
    expect(action.device_id).toMatch(/\S/);
    for (const index of [1, 2]) {
      const line = after.invoice.lines[index];
      expect(line).toMatchObject({
        product_code: "NEW",
        pricing_category: "grocery_taxable",
        review_confirmed: false,
      });
      expect(line.low_confidence_fields).toEqual(
        before.invoice.lines[index].low_confidence_fields?.filter(
          (field) => field !== "pricing_category",
        ),
      );
      expect(line.low_confidence_fields?.length).toBeGreaterThan(0);
      expect(line.checked_fields?.pricing_category).toEqual({
        checked_by_user_id: action.actor_user_id,
        checked_at: action.at,
      });
      await expect(receivingRow(page, index)).toHaveClass(
        /receiving-row-check/,
      );
      await expect(
        receivingRow(page, index).locator(".receiving-line-check-count"),
      ).toBeVisible();
    }
    expect(after.invoice.lines[1].line_tax).toBe(
      before.invoice.lines[1].line_tax,
    );
    expect(after.invoice.lines[1].taxable_inferred).toBe(false);
    expect(after.invoice.lines[2]).toMatchObject({
      taxable_inferred: true,
      taxable: true,
      tax_profile: "hst_13",
      line_tax: "0.29",
    });
    await page.reload();
    await expect(page.getByTestId("invoice-review")).toBeVisible();
    await expect(bulkButton(page, language)).toBeVisible();
    const reloaded = await readCanonicalBusinessEvidence(page);
    expect(reloaded.invoice).toEqual(after.invoice);
    expect(reloaded.activity).toEqual(after.activity);
    expect(financial(reloaded)).toEqual(financial(after));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    await page.locator(".receiving-lines").screenshot({
      path: info.outputPath(`new-product-categories-saved-${language}.png`),
    });
    expect(errors).toEqual([]);
  });
}

test("R3c F6 a real second-page edit retires the open choice until the receiver reviews again", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({
    width: info.project.name === "phone" ? 390 : 1440,
    height: 1000,
  });
  await mixedDelivery(page, "en");
  const { dialog, save } = await openCategoryDialog(page, "en");
  const reviewUrl = page.url();
  const anotherPage = await context.newPage();
  anotherPage.on("pageerror", (error) => errors.push(error.message));
  anotherPage.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  try {
    await anotherPage.goto("/");
    await signIn(anotherPage, "Floor Worker");
    await anotherPage.goto(reviewUrl);
    await expect(anotherPage.getByTestId("invoice-review")).toBeVisible();
    const editor = await openReceivingLine(anotherPage, 1);
    const name = editor.locator("#invoice-line-1-name-en");
    const changedName = "Fictional Silverleaf Crackers 250 g revised";
    await name.fill(changedName);
    await name.press("Tab");
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(anotherPage)).invoice.lines[1]
            .new_name_en,
      )
      .toBe(changedName);
    const changed = await readCanonicalBusinessEvidence(page);
    await save.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveText(
      "The invoice or category changed. Close this dialog, review the current new products, and try again.",
    );
    await expect(dialog.getByRole("combobox")).toContainText(
      "Grocery (Taxable)",
    );
    const rejected = await readCanonicalBusinessEvidence(page);
    expect(rejected.invoice).toEqual(changed.invoice);
    expect(rejected.activity).toEqual(changed.activity);
    expect(financial(rejected)).toEqual(financial(changed));
    expect(
      rejected.activity.filter((entry) => entry.action === categoryAction),
    ).toHaveLength(0);
    await dialog.screenshot({
      path: info.outputPath("new-product-categories-stale-choice.png"),
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const fresh = await openCategoryDialog(page, "en");
    await fresh.save.click();
    await expect(fresh.dialog).toBeHidden();
    await expect
      .poll(async () => {
        const state = await readCanonicalBusinessEvidence(page);
        return state.activity.filter((entry) => entry.action === categoryAction)
          .length;
      })
      .toBe(1);
    expect(
      (await readCanonicalBusinessEvidence(page)).invoice.lines[1].new_name_en,
    ).toBe(changedName);
    expect(errors).toEqual([]);
  } finally {
    await anotherPage.close();
  }
});
