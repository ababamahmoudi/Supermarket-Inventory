import { expect, test } from "@playwright/test";
import {
  expectReceivingStable,
  importReceivingFixture,
  openReceivingLine,
  receivingRow,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";

for (const language of ["en", "fa"] as const) {
  test(`R2 line editor remains anchored while receiving in ${language}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: testInfo.project.name === "phone" ? 390 : 1440,
      height: 900,
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await importReceivingFixture(page, language);
    await expect(
      page
        .locator('[role="region"]')
        .filter({ has: page.locator('[id^="invoice-line-"][id$="-name-en"]') }),
    ).toHaveCount(0);
    const details = page.getByRole("button", {
      name: word(
        language,
        "Looks right: Invoice details",
        "درست است: اطلاعات فاکتور",
      ),
      exact: true,
    });
    await expectReceivingStable(page, details, async () => {
      await details.click();
      await expect(
        page.getByTestId("invoice-details-card").locator(".please-check-field"),
      ).toHaveCount(0);
    });
    const editor = await openReceivingLine(page, 0);
    const name = editor.locator("#invoice-line-0-name-en");
    const row = receivingRow(page, 0);
    const rowText = (await row.textContent()) ?? "";
    const editedName = `${await name.inputValue()} Test`;
    await name.click();
    await name.press("End");
    for (const character of " Test") {
      await expectReceivingStable(page, name, () =>
        name.pressSequentially(character),
      );
      await expect(row).toHaveText(rowText);
    }
    await name.press("Tab");
    await expect(row).toContainText(editedName);
    const category = editor.locator("#invoice-line-0-category");
    await expectReceivingStable(page, category, async () => {
      await setReceivingCategory(page, editor, language);
      await expect(category).toContainText(
        word(language, "Grocery", "خواربار"),
      );
    });
    const track = editor.getByRole("group", {
      name: word(language, "Track date", "پیگیری تاریخ"),
      exact: true,
    });
    const no = track.getByRole("button", {
      name: word(language, "No", "خیر"),
      exact: true,
    });
    const yes = track.getByRole("button", {
      name: word(language, "Yes", "بله"),
      exact: true,
    });
    await expect(no).toHaveAttribute("aria-pressed", "true");
    await expectReceivingStable(page, yes, async () => {
      await yes.click();
      await expect(yes).toHaveAttribute("aria-pressed", "true");
    });
    await expect(yes).toHaveAttribute("aria-pressed", "true");
    await expectReceivingStable(page, no, async () => {
      await no.click();
      await expect(no).toHaveAttribute("aria-pressed", "true");
    });
    await expect(no).toHaveAttribute("aria-pressed", "true");
    const confirm = editor.getByRole("button", {
      name: word(language, "Confirm line", "تأیید ردیف"),
      exact: true,
    });
    await confirm.scrollIntoViewIfNeeded();
    await expectReceivingStable(
      page,
      row,
      async () => {
        await confirm.click();
        await expect(editor).toHaveCount(0);
      },
      { scroll: false },
    );
    await expect(editor).toHaveCount(0);
    await expect(row).toContainText(word(language, "Confirmed", "تأیید شد"));
    await expect(
      page.locator('[id^="invoice-line-"][id$="-name-en"]'),
    ).toHaveCount(0);
    // Closing a line keeps edits and anchors the row as well.
    const reopened = await openReceivingLine(page, 0);
    const close = reopened.getByRole("button", {
      name: word(language, "Close", "بستن"),
      exact: true,
    });
    await close.scrollIntoViewIfNeeded();
    await expectReceivingStable(
      page,
      row,
      async () => {
        await close.click();
        await expect(reopened).toHaveCount(0);
      },
      { scroll: false },
    );
    const totals = page.getByRole("button", {
      name: word(language, "Looks right: Totals", "درست است: جمع‌ها"),
      exact: true,
    });
    await expectReceivingStable(page, totals, async () => {
      await totals.click();
      await expect(
        page.getByTestId("invoice-totals-card").locator(".please-check-field"),
      ).toHaveCount(0);
    });
    expect(errors).toEqual([]);
  });
}
