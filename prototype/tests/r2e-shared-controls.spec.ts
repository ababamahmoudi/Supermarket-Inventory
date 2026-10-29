import { expect, test } from "@playwright/test";
import { signIn, setLanguage, openShellAction } from "./helpers";
import { inspect } from "../scripts/c5-browser-proof.mjs";

for (const [language, theme] of [
  ["en", "light"],
  ["fa", "dark"],
] as const) {
  test(`R2e B2 chips and B3 switches retain visible state and geometry (${language}/${theme})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await signIn(page, "Manager");
    await setLanguage(page, language);
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await (
        await openShellAction(
          page,
          language === "en" ? "Switch to dark theme" : "تغییر به تم تیره",
        )
      ).click();
    for (const route of ["products", "labels", "suppliers", "lookup"]) {
      await page.goto(`/#${route}`);
      const chip = page.locator("main .filter-chip:visible").first();
      await expect(chip).toBeVisible();
      const before = await chip.boundingBox();
      const idle = await chip.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await expect(chip.locator(".filter-chip-check, svg")).toHaveCount(0);
      await expect(chip).toHaveCSS("color", "rgb(255, 255, 255)");
      const selected = await chip.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );
      expect(selected, route).not.toBe(idle);
      const after = await chip.boundingBox();
      expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(2);
      await chip.press("Space");
      await expect(chip).toHaveAttribute("aria-pressed", "false");
      await expect(chip.locator(".filter-chip-check, svg")).toHaveCount(0);
      await chip.press("Enter");
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "false");
      expect(
        (
          await inspect(
            page,
            `R2e ${route} shared filters`,
            `${language}-${theme}`,
            "manager",
          )
        ).failures,
      ).toEqual([]);
    }
    await page.goto("/#received");
    const dateRange = page.getByRole("button", {
      name: language === "en" ? "Date range" : "بازه تاریخ",
      exact: true,
    });
    await dateRange.click();
    await page
      .getByRole("button", {
        name: language === "en" ? "Today" : "امروز",
        exact: true,
      })
      .click();
    await dateRange.click();
    const today = page.getByRole("button", {
      name: language === "en" ? "Today" : "امروز",
      exact: true,
    });
    await expect(today).toHaveAttribute("aria-pressed", "true");
    await today.click();
    await expect(dateRange).toContainText(
      language === "en" ? "Any date" : "هر تاریخی",
    );
    await page.goto("/#settings?group=company");
    const control = page.getByRole("switch", {
      name: language === "en" ? "Persian" : "فارسی",
      exact: true,
    });
    await expect(control).toBeVisible();
    await control.uncheck();
    const off = await control.locator(".ui-switch-track").evaluate((track) => ({
      width: track.getBoundingClientRect().width,
      height: track.getBoundingClientRect().height,
      border: getComputedStyle(track).borderTopWidth,
      background: getComputedStyle(track).backgroundColor,
      thumb: getComputedStyle(track.firstElementChild!).backgroundColor,
      parent: getComputedStyle(track.parentElement!).backgroundColor,
    }));
    expect(off.width).toBe(44);
    expect(off.height).toBe(26);
    expect(off.border).toBe("1px");
    expect(off.thumb).toBe("rgb(255, 255, 255)");
    expect(off.background).not.toBe(off.thumb);
    expect(off.background).not.toBe("rgba(0, 0, 0, 0)");
    await control.check();
    const on = await control.locator(".ui-switch-track").boundingBox();
    expect(on!.width).toBe(off.width);
    expect(on!.height).toBe(off.height);
  });
}
