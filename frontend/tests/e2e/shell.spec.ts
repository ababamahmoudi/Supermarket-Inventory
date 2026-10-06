import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`app shell, API health, and Persian on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Your workspace is ready" }),
    ).toBeVisible();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "فارسی" }).click();
    await expect(
      page.getByRole("heading", { name: "فضای کار شما آماده است" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("متصل", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "فضای کار شما آماده است" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("phone menu is keyboard accessible in both directions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "فارسی" }).click();
  await page.getByRole("button", { name: "باز کردن منو" }).click();
  await expect(page.getByRole("button", { name: "بستن منو" })).toBeFocused();
  await expect(page.locator("#app-navigation")).toHaveCSS("right", "0px");
});
