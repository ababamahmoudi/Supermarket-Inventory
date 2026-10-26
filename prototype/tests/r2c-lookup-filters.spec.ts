import { expect, test } from "@playwright/test";
import { setBranch, signIn } from "./helpers";
import { runCanonicalBusinessFixture } from "./business-fixture";

test("configured categories filter imported products without AI categories and remember this person's choice", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await runCanonicalBusinessFixture(
    page,
    (state) => {
      const source = state.products.find((row) => row.code === "0009")!;
      source.ai_category = "";
      source.name_en = "Fictional imported pantry item";
      source.branch_prices = { "Branch 1": "4.99" };
    },
    undefined,
  );
  await page.reload();
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup");
  const category = page.getByRole("combobox", {
    name: "Pricing category",
    exact: true,
  });
  await category.click();
  const option = page.getByRole("option", {
    name: /^Grocery \(Taxable\) \(\d+\)$/,
  });
  await expect(option).toBeVisible();
  await option.click();
  await page
    .getByRole("combobox", { name: "Search products", exact: true })
    .fill("Fictional imported");
  await expect(page.locator(".lookup-result-row")).toHaveCount(1);
  await expect(page.locator(".lookup-result-row")).toContainText(
    "Fictional imported pantry item",
  );
  await page.getByRole("button", { name: "Taxable", exact: true }).click();
  await page.goto("/#dashboard");
  await page.goto("/#lookup");
  await expect(category).toContainText("Grocery (Taxable)");
  await expect(
    page.getByRole("button", { name: "Taxable", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(category).toContainText("Grocery (Taxable)");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(category).toContainText("All pricing categories");
  await expect(
    page.getByRole("button", { name: "Taxable", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
