import { expect, test } from "@playwright/test";
import { signIn, setLanguage, openShellAction } from "./helpers";

for (const [language, theme] of [
  ["en", "light"],
  ["fa", "dark"],
] as const) {
  for (const width of [360, 390, 509, 760]) {
    test(`R2g A2 colour-only filters retain centred copy at ${width}px (${language}/${theme})${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page, "Manager");
      await setLanguage(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await (
          await openShellAction(
            page,
            language === "en" ? "Switch to dark theme" : "تغییر به تم تیره",
          )
        ).click();
      for (const route of ["products", "payables", "alerts"]) {
        await page.goto(`/#${route}`);
        const chip = page
          .locator('main button[data-ui-component="filter-chip"]:visible')
          .first();
        await expect(chip).toBeVisible();
        await expect(chip).toHaveAttribute("aria-pressed", "false");
        await expect(chip.locator("svg, .filter-chip-check")).toHaveCount(0);
        const snapshot = () =>
          chip.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const range = document.createRange();
            range.selectNodeContents(element);
            const text = range.getBoundingClientRect();
            return {
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
              textCentre: text.x + text.width / 2,
              centre: bounds.x + bounds.width / 2,
              background: style.backgroundColor,
              border: style.borderTopWidth,
              colour: style.color,
            };
          });
        const before = await snapshot();
        expect(before.height).toBe(44);
        expect(before.border).toBe("1px");
        expect(Math.abs(before.textCentre - before.centre)).toBeLessThanOrEqual(
          1.5,
        );
        await chip.click();
        await expect(chip).toHaveAttribute("aria-pressed", "true");
        const after = await snapshot();
        expect(after.background).not.toBe(before.background);
        expect(after.colour).toBe("rgb(255, 255, 255)");
        for (const key of ["x", "y", "width", "height"] as const)
          expect(
            Math.abs(after[key] - before[key]),
            `${route}: ${key}`,
          ).toBeLessThanOrEqual(2);
        expect(Math.abs(after.textCentre - after.centre)).toBeLessThanOrEqual(
          1.5,
        );
        await chip.press("Space");
        await expect(chip).toHaveAttribute("aria-pressed", "false");
        await chip.press("Enter");
        await expect(chip).toHaveAttribute("aria-pressed", "true");
        await chip.click();
        await expect(chip).toHaveAttribute("aria-pressed", "false");
      }
    });
  }
}
