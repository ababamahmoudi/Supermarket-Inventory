import { expect, test } from "@playwright/test";
test("demo PIN, correct role menu, RTL and offline operation", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await page.getByRole("radio", { name: "Floor Worker", exact: true }).click();
  await page.getByLabel("Demo PIN").fill("2222");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (testInfo.project.name === "phone") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(
      page.getByRole("link", { name: "Cashier lookup", exact: true }),
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
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo", exact: true })
    .click();
  expect(errors).toEqual([]);
});
