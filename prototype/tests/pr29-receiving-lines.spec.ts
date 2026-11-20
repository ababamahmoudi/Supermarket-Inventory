import { expect, test, type Page } from "@playwright/test";
import { openReceivingLine, receivingRow, word } from "./r2-receiving-helpers";
import { openPr29Invoice } from "./pr29-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

async function setAllNewCategories(page: Page, language: "en" | "fa") {
  const bar = page.locator(".receiving-bulk-bar");
  await bar
    .getByRole("button", {
      name: word(
        language,
        "Set category for 4 new products",
        "تعیین دسته برای 4 کالای جدید",
      ),
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page
    .getByRole("option", {
      name: word(language, "Grocery", "مواد غذایی"),
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", {
      name: word(language, "Set category", "تعیین دسته"),
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);
}

/** Every visible bar action sits on one line. */
async function barOnOneLine(page: Page) {
  return page.locator(".receiving-bulk-bar-actions").evaluate((actions) => {
    const buttons = Array.from(actions.querySelectorAll("button")).map(
      (button) => button.getBoundingClientRect(),
    );
    return (
      buttons.length > 0 &&
      buttons.every(
        (box) =>
          Math.abs(box.top - buttons[0].top) < 1 && box.height <= 44 + 0.5,
      ) &&
      document.documentElement.scrollWidth <= window.innerWidth
    );
  });
}

for (const language of ["en", "fa"] as const) {
  test(`PR 29 bulk bar, ready lines and selling prices in ${language}`, async ({
    page,
  }, info) => {
    await openPr29Invoice(page, language);
    const bar = page.locator(".receiving-bulk-bar");
    await expect(bar).toBeVisible();
    // No category yet, so no line is ready to confirm.
    await expect(bar.locator(".receiving-confirm-ready")).toHaveCount(0);
    await setAllNewCategories(page, language);
    // Every new product has a category now: Set category disappears.
    await expect(bar.locator(".receiving-new-category-action")).toHaveCount(0);
    const ready = bar.getByRole("button", {
      name: word(language, "Confirm 3 ready lines", "تأیید 3 ردیف آماده"),
    });
    await expect(ready).toBeVisible();
    for (const width of info.project.name === "phone" ? [390] : [1440, 1000]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await barOnOneLine(page)).toBe(true);
    }
    // Every closed row shows a selling price and margin.
    for (const index of [0, 1, 2, 3])
      await expect(
        receivingRow(page, index).locator(".receiving-price-stack").first(),
      ).toContainText("$");
    await ready.click();
    await expect(
      page.getByTestId("undo-toast").filter({
        hasText: word(
          language,
          "Confirm ready invoice lines",
          "تأیید ردیف‌های آمادهٔ فاکتور",
        ),
      }),
    ).toBeVisible();
    const lines = (await readCanonicalBusinessEvidence(page)).invoice.lines;
    expect(lines.map((line) => Boolean(line.review_confirmed))).toEqual([
      true,
      false,
      true,
      true,
    ]);
    // The line with a check stays open for review; no ready lines remain.
    await expect(bar.locator(".receiving-confirm-ready")).toHaveCount(0);
  });

  test(`PR 29 Confirm line keeps a typed short in ${language}`, async ({
    page,
  }) => {
    await openPr29Invoice(page, language);
    await setAllNewCategories(page, language);
    const editor = await openReceivingLine(page, 1);
    await editor
      .getByRole("button", {
        name: word(language, "Report short or refused", "گزارش کسری یا مرجوعی"),
      })
      .click();
    await editor
      .getByLabel(word(language, "Short units", "واحدهای کسری"), {
        exact: true,
      })
      .fill("1");
    // No Apply: Confirm line must keep the short.
    await editor
      .getByRole("button", {
        name: word(language, "Confirm line", "تأیید ردیف"),
        exact: true,
      })
      .click();
    await expect
      .poll(async () => {
        const line = (await readCanonicalBusinessEvidence(page)).invoice
          .lines[1];
        return [line.qty_received_at_posting, line.review_confirmed];
      })
      .toEqual([3, true]);
    const row = receivingRow(page, 1);
    await expect(row).toHaveClass(/has-short/);
    await expect(row.locator(".receiving-short-total s")).toContainText(
      "$40.00",
    );
    await expect(row.locator(".receiving-short-payable")).toContainText(
      "$30.00",
    );
    const totals = page.locator(".receiving-totals-rows");
    await expect(totals.locator(".receiving-total-deduction")).toContainText(
      "-$10.00",
    );
    await expect(totals.locator(".receiving-total-payable")).toContainText(
      "$113.20",
    );
  });
}
