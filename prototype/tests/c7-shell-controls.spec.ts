import { expect, test } from "@playwright/test";
import { signIn, setLanguage, openShellAction } from "./helpers";
for (const language of ["en", "fa"] as const) {
  test(`C7 phone nested menu focus and controls ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    const en = language === "en";
    const more = page.locator(".mobile-more-menu");
    await expect(more).toBeVisible();
    await expect(
      page.getByRole("button", { name: en ? "Demo" : "دمو", exact: true }),
    ).toHaveCount(0);
    await more.focus();
    await page.keyboard.press("ArrowDown");
    const search = page.getByRole("menuitem", {
      name: en ? "Search all products" : "جست‌وجوی همهٔ محصولات",
      exact: true,
    });
    await expect(search).toBeFocused();
    await page.keyboard.press("End");
    const demo = page.getByRole("menuitem", {
      name: en ? "Demo" : "دمو",
      exact: true,
    });
    await expect(demo).toBeFocused();
    await page.keyboard.press(en ? "ArrowRight" : "ArrowLeft");
    const submenu = page.locator(".ui-submenu-items");
    await expect(submenu).toBeVisible();
    await expect(submenu.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("End");
    await expect(
      submenu.getByRole("menuitem", {
        name: en ? "Reset demo" : "بازنشانی دمو",
        exact: true,
      }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(submenu).not.toBeVisible();
    await expect(demo).toBeFocused();
    await page.keyboard.press("Home");
    await expect(search).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await (
      await openShellAction(
        page,
        en ? "Switch to dark theme" : "تغییر به تم تیره",
      )
    ).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await (
      await openShellAction(
        page,
        en ? "Comfortable text size" : "اندازهٔ متن راحت",
      )
    ).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-text-size",
      "comfortable",
    );
    await (
      await openShellAction(
        page,
        en ? "Search all products" : "جست‌وجوی همهٔ محصولات",
      )
    ).click();
    const dialog = page.locator(".topbar-search-dialog[open]");
    await expect(dialog).toBeVisible();
    await dialog.locator("input").fill("0003 & tea");
    await dialog
      .getByRole("button", { name: en ? "Search" : "جست‌وجو", exact: true })
      .click();
    await expect(page).toHaveURL(/lookup\?search=0003%20%26%20tea/);
    await expect(dialog).not.toBeVisible();
    await page.locator(".mobile-account-menu").click();
    await page
      .getByRole("menuitem", { name: en ? "Lock" : "قفل", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: en ? "Screen locked" : "صفحه قفل شده است",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByLabel(en ? "Password" : "گذرواژه", { exact: true })
      .fill("demo1234");
    await page
      .getByRole("button", {
        name: en ? "Unlock" : "باز کردن قفل",
        exact: true,
      })
      .click();
    await expect(page.locator(".topbar")).toBeVisible();
    await page.locator(".mobile-account-menu").click();
    await page
      .getByRole("menuitem", { name: en ? "Sign out" : "خروج", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: en ? "Sign in" : "ورود", exact: true }),
    ).toBeVisible();
  });
}
