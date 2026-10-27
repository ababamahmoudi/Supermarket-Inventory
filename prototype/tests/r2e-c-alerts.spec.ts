import { expect, test } from "@playwright/test";
import { signIn, setBranch, setLanguage, openShellAction } from "./helpers";
import { word } from "./r2-receiving-helpers";
for (const language of ["en", "fa"] as const) {
  test(`R2e C7 resolved switch lives in the alert card header in ${language}`, async ({
    page,
  }, info) => {
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    await page.goto("/#alerts");
    const card = page.locator(".alerts-card");
    const heading = card.getByRole("heading", {
      name: word(language, "All alerts", "همه هشدارها"),
      exact: true,
    });
    const toggle = card.getByRole("switch", {
      name: word(language, "Show resolved", "نمایش حل‌شده‌ها"),
      exact: true,
    });
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
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute("aria-checked", "false");
        const h = await heading.boundingBox();
        const control = await toggle.boundingBox();
        expect(
          Math.abs(h!.y + h!.height / 2 - control!.y - control!.height / 2),
        ).toBeLessThanOrEqual(1.5);
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-checked", "true");
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-checked", "false");
      }
    }
  });
}
