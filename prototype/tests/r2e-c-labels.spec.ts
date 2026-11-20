import { expect, test } from "@playwright/test";
import { signIn, setBranch, setLanguage, openShellAction } from "./helpers";
import { word } from "./r2-receiving-helpers";

for (const language of ["en", "fa"] as const) {
  test(`R2e C6 header selects all filtered labels in ${language}`, async ({
    page,
  }, info) => {
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    await page.goto("/#labels");
    const table = page.locator(".labels-product-table");
    const selectAll = table.getByRole("checkbox", {
      name: word(language, "Select all filtered", "انتخاب همه نتایج فیلترشده"),
      exact: true,
    });
    await expect(page.locator(".labels-selection-toolbar")).toHaveCount(0);
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
        await expect(selectAll).toBeVisible();
        await expect(selectAll).toBeEnabled();
        expect(await selectAll.locator("xpath=ancestor::thead").count()).toBe(
          1,
        );
        await selectAll.click();
        await expect(selectAll).toBeChecked();
        const eligibleRows = table.locator(
          'tbody [role="checkbox"]:not(:disabled)',
        );
        expect(await eligibleRows.count()).toBeGreaterThan(0);
        for (const checkbox of await eligibleRows.all())
          await expect(checkbox).toBeChecked();
        const summary = page.locator(".labels-filtered-selection-summary");
        await expect(summary).toBeVisible();
        await expect(summary).toContainText(String(await eligibleRows.count()));
        await summary
          .getByRole("button", {
            name: word(language, "Clear", "پاک کردن"),
            exact: true,
          })
          .click();
        await expect(selectAll).not.toBeChecked();
        for (const checkbox of await eligibleRows.all())
          await expect(checkbox).not.toBeChecked();
      }
    }
    await selectAll.focus();
    await page.keyboard.press("Space");
    await expect(selectAll).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(selectAll).not.toBeChecked();
  });
}
