import { expect, test } from "@playwright/test";
import { importReceivingFixture, word } from "./r2-receiving-helpers";
import { openShellAction } from "./helpers";

for (const language of ["en", "fa"] as const) {
  test(`R2e C2 invoices use one four-choice entry and bounded progress in ${language}`, async ({
    page,
  }, info) => {
    await importReceivingFixture(page, language);
    await page.locator("#invoice-back-link").click();
    const progress = page.locator(".invoice-queue-progress").first();
    const action = progress.locator("xpath=ancestor::tr/td[last()]");
    for (const width of info.project.name === "phone" ? [390] : [1440, 1000]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"] as const) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await (
            await openShellAction(
              page,
              word(
                language,
                `Switch to ${theme} theme`,
                theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
              ),
            )
          ).click();
        if (width === 1000 && !(await progress.isVisible())) {
          // The shared responsive table omits this lower-priority column.
          await expect(
            page.locator(".invoice-saved-table tbody tr"),
          ).toHaveCount(1);
          continue;
        }
        await expect(progress).toContainText(
          language === "en" ? /^0\/\d+ confirmed/ : /^0\/\d+ تأیید شده/,
        );
        const textBox = await progress.boundingBox();
        const actionBox = await action.boundingBox();
        expect(textBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        if (width >= 760) {
          if (language === "en")
            expect(textBox!.x + textBox!.width).toBeLessThanOrEqual(
              actionBox!.x + 1,
            );
          else
            expect(textBox!.x).toBeGreaterThanOrEqual(
              actionBox!.x + actionBox!.width - 1,
            );
        }
      }
    }
    await page
      .getByRole("tab", {
        name: new RegExp(`^${word(language, "Drafts", "پیش‌نویس‌ها")}`),
      })
      .click();
    await expect(
      page.getByRole("heading", {
        name: word(language, "New invoice", "فاکتور جدید"),
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: word(language, "Upload", "بارگذاری"),
        exact: true,
      }),
    ).toHaveCount(0);
    const start = page.getByRole("button", {
      name: word(language, "New invoice", "فاکتور جدید"),
      exact: true,
    });
    await expect(start).toHaveCount(1);
    await start.click();
    const dialog = page.getByRole("dialog", {
      name: word(language, "New invoice", "فاکتور جدید"),
      exact: true,
    });
    await expect(dialog.locator(".invoice-entry-choice-tile")).toHaveCount(4);
  });
}
