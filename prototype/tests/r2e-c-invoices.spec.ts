import { expect, test } from "@playwright/test";
import { importReceivingFixture, word } from "./r2-receiving-helpers";
import { openShellAction } from "./helpers";

for (const language of ["en", "fa"] as const) {
  test(`R2e C1 imported reading has a human header and retained model evidence in ${language}`, async ({
    page,
  }, info) => {
    const invoice = await importReceivingFixture(page, language);
    const models = invoice.reading_record!.models;
    expect(models.length).toBeGreaterThan(0);
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
        const header = page.locator(".receiving-header");
        await expect(header).toContainText(
          word(
            language,
            "Read by AI · imported file",
            "خوانده‌شده با هوش مصنوعی · فایل واردشده",
          ),
        );
        for (const model of models)
          await expect(header).not.toContainText(model);
      }
    }
    const expand = page.getByRole("button", {
      name: word(language, "Expand invoice details", "باز کردن اطلاعات فاکتور"),
      exact: true,
    });
    if (await expand.isVisible()) await expand.click();
    const details = page.getByTestId("invoice-details-card");
    const more = details.locator("details.receiving-more");
    if ((await more.getAttribute("open")) === null)
      await more.locator("summary").click();
    await expect(
      details.getByRole("heading", {
        name: word(language, "Reading", "خوانش"),
        exact: true,
      }),
    ).toBeVisible();
    for (const model of models)
      await expect(
        details.locator(".receiving-reading-evidence"),
      ).toContainText(model);
  });
}
