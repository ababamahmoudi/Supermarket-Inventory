import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  expectReceivingStable,
  importReceivingFixture,
  openReceivingLine,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";

for (const language of ["en", "fa"] as const) {
  test(`R3c K4 receiving price keeps rapid typing, invalid drafts and original invoice evidence ${language}`, async ({
    page,
  }) => {
    await importReceivingFixture(page, language);
    let editor = await openReceivingLine(page, 2);
    await setReceivingCategory(page, editor, language);
    const price = editor.locator('[id="invoice-line-2-selling-price"]');
    await expect(price).toHaveValue("2.99");
    const before = await readCanonicalBusinessEvidence(page);
    await expectReceivingStable(page, price, async () => {
      await price.fill("");
      await price.pressSequentially("2.73", { delay: 0 });
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).invoice.lines[2]
              .receiving_price?.price,
        )
        .toBe("2.73");
      await expect(price).toHaveValue("2.73");
      await expect(price).toBeFocused();
    });
    const after = await readCanonicalBusinessEvidence(page);
    const original = before.invoice;
    expect(after.invoice.lines[2].receiving_price).toMatchObject({
      price: "2.73",
      entered_price: "2.73",
      price_unit: "each",
      calculated_price: "2.99",
    });
    expect(after.invoice.file_data).toBe(original.file_data);
    expect(after.invoice.original_pages).toEqual(original.original_pages);
    expect(after.invoice.reading_record).toEqual(original.reading_record);
    expect([
      after.invoice.subtotal,
      after.invoice.tax,
      after.invoice.final_total,
    ]).toEqual([original.subtotal, original.tax, original.final_total]);
    expect(after.invoice.lines[2].unit_cost_before_tax).toBe(
      original.lines[2].unit_cost_before_tax,
    );
    expect(after.invoice.lines[2].line_total).toBe(
      original.lines[2].line_total,
    );
    expect(after.products).toEqual(before.products);
    expect(after.approvals).toEqual(before.approvals);
    expect(after.stock).toEqual(before.stock);
    expect(after.ledger).toEqual(before.ledger);
    await price.fill("0");
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.lines[2]
            .receiving_price?.price,
      )
      .toBe("0");
    await expect(price).toHaveAttribute("aria-invalid", "true");
    await editor
      .getByRole("button", {
        name: word(language, "Confirm line", "تأیید ردیف"),
        exact: true,
      })
      .click();
    await expect(price).toBeFocused();
    expect(
      (await readCanonicalBusinessEvidence(page)).invoice.lines[2]
        .review_confirmed,
    ).toBe(false);
    await price.fill("2.83");
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.lines[2]
            .receiving_price?.price,
      )
      .toBe("2.83");
    await expect(price).toHaveAttribute("aria-invalid", "false");
    await page.reload();
    await expect(page.getByTestId("invoice-review")).toBeVisible();
    editor = await openReceivingLine(page, 2);
    await expect(
      editor.locator('[id="invoice-line-2-selling-price"]'),
    ).toHaveValue("2.83");
    await editor
      .getByRole("button", {
        name: word(
          language,
          "Use calculated price",
          "استفاده از قیمت محاسبه‌شده",
        ),
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.lines[2]
            .receiving_price,
      )
      .toBeUndefined();
    await expect(
      editor.locator('[id="invoice-line-2-selling-price"]'),
    ).toHaveValue("2.99");
  });
}

test("R3c K4 an actual rejected IndexedDB save restores the buffered value and a fresh retry succeeds", async ({
  page,
}) => {
  await importReceivingFixture(page, "en");
  const editor = await openReceivingLine(page, 2);
  await setReceivingCategory(page, editor, "en");
  const price = editor.locator('[id="invoice-line-2-selling-price"]');
  await expect(price).toHaveValue("2.99");
  const before = await readCanonicalBusinessEvidence(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let failOnce = true;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      const record = args[0];
      if (
        failOnce &&
        this.name === "business" &&
        record?.state?.invoice?.lines?.[2]?.receiving_price?.price === "2.73"
      ) {
        failOnce = false;
        this.transaction.abort();
      }
      return original.apply(this, args);
    };
  });
  await price.fill("2.73");
  await expect(
    editor.getByText(
      "The price was not saved. Review the current value and try again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(price).toHaveValue("2.99");
  const failed = await readCanonicalBusinessEvidence(page);
  expect(failed.invoice.lines[2].receiving_price).toBeUndefined();
  expect(failed.products).toEqual(before.products);
  expect(
    failed.activity.filter((row) => row.action === "Set receiving price"),
  ).toHaveLength(0);
  await price.fill("2.83");
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoice.lines[2]
          .receiving_price?.price,
    )
    .toBe("2.83");
  await expect(price).toHaveValue("2.83");
  await expect(
    editor.getByText(
      "The price was not saved. Review the current value and try again.",
      { exact: true },
    ),
  ).toHaveCount(0);
});
