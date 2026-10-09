import { expect, test } from "@playwright/test";
import { signIn, resetDemo } from "./helpers";

test("username sign-in, correct role menu, RTL and offline operation", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await signIn(page, "Floor Worker");
  if (testInfo.project.name === "phone") {
    await page.locator("#menu-toggle").click();
    const daily = page
      .getByRole("navigation", { name: "Pages", exact: true })
      .getByRole("button", { name: "Daily", exact: true });
    if (await daily.count()) {
      await expect(daily).toBeFocused();
      await expect(daily).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Tab");
    }
    await expect(
      page.getByRole("link", { name: "Lookup", exact: true }),
    ).toBeFocused();
  }
  await expect(
    page.getByRole("link", { name: "Payables", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Approvals", exact: true }),
  ).toHaveCount(0);
  if (testInfo.project.name === "phone") await page.keyboard.press("Escape");
  await page.evaluate(() => document.fonts.ready);
  await context.setOffline(true);
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => document.body.clientWidth),
  );
  await resetDemo(page);
  expect(errors).toEqual([]);
});
