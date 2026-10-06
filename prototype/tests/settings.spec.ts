import { expect, test, type Page } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };

async function openSettings(page: Page) {
  await page.goto("/");
  await page.getByRole("radio", { name: "Supervisor", exact: true }).click();
  await page
    .getByLabel("Demo PIN", { exact: true })
    .fill(demoSeed.demo_users.find((user) => user.role === "supervisor")!.pin);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reset demo", exact: true }),
  ).toBeVisible();
  const mobileMenu = page.getByRole("button", {
    name: "Open menu",
    exact: true,
  });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pricing categories", exact: true }),
  ).toBeVisible();
  return page.locator(".card").filter({
    has: page.getByRole("heading", { name: "Price sandbox", exact: true }),
  });
}

test("divisors update live, survive refresh, and invalid money preserves valid rules", async ({
  page,
}) => {
  let sandbox = await openSettings(page);
  await expect(sandbox.getByText("$1.49", { exact: true })).toBeVisible();
  const divisor = page.getByLabel("Cost divisor for Grocery", { exact: true });
  await divisor.fill("0.50");
  await expect(sandbox.getByText("$1.99", { exact: true })).toBeVisible();

  await page.reload();
  sandbox = page.locator(".card").filter({
    has: page.getByRole("heading", { name: "Price sandbox", exact: true }),
  });
  await expect(
    page.getByLabel("Cost divisor for Grocery", { exact: true }),
  ).toHaveValue("0.50");
  await expect(sandbox.getByText("$1.99", { exact: true })).toBeVisible();
  await page.getByLabel("Cost divisor for Grocery", { exact: true }).fill("0");
  await expect(page.getByRole("alert")).toContainText(
    "Enter a divisor greater than zero.",
  );
  await expect(sandbox.getByText("$1.99", { exact: true })).toBeVisible();

  await page
    .getByLabel("Cost divisor for Grocery", { exact: true })
    .fill("0.65");
  const cost = page.getByLabel("Unit cost before tax", { exact: true });
  await cost.fill("-1");
  await expect(
    sandbox.getByText(
      "Enter a cost of zero or more, with no more than four decimal places.",
    ),
  ).toBeVisible();
  await expect(sandbox.locator(".price-display")).toHaveCount(0);
  await cost.fill("1.12345");
  await expect(sandbox.locator(".price-display")).toHaveCount(0);
  await cost.fill("1.12");
  await expect(sandbox.getByText("$1.49", { exact: true })).toBeVisible();
  await expect(sandbox.getByText("24.83%", { exact: true })).toBeVisible();
  await expect(
    sandbox.getByText("Below minimum margin", { exact: true }),
  ).toBeVisible();
});

test("Rice uses unrounded raw and the same result renders in Persian RTL", async ({
  page,
}) => {
  const sandbox = await openSettings(page);
  await page
    .getByLabel("Pricing category", { exact: true })
    .selectOption("rice");
  const cost = page.getByLabel("Unit cost before tax", { exact: true });
  await cost.fill("3.1920");
  await expect(sandbox.getByText("$3.99", { exact: true })).toBeVisible();
  await cost.fill("3.1921");
  await expect(sandbox.getByText("3.99", { exact: true })).toBeVisible();
  await expect(sandbox.getByText("$4.99", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "آزمایش قیمت", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$4.99", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("هزینه هر واحد پیش از مالیات", { exact: true }),
  ).toHaveAttribute("dir", "ltr");
});

test("Reset demo restores pricing rules, including an invalid field draft", async ({
  page,
}) => {
  await openSettings(page);
  await page
    .getByLabel("Cost divisor for Grocery", { exact: true })
    .fill("0.50");
  await page.getByLabel("Cost divisor for Grocery", { exact: true }).fill("-1");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo", exact: true })
    .click();
  await expect(
    page.getByLabel("Cost divisor for Grocery", { exact: true }),
  ).toHaveValue("0.65");
  await expect(page.getByText("$1.49", { exact: true })).toBeVisible();
});
