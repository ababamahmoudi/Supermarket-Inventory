import { expect, test } from "@playwright/test";
import {
  chooseOption,
  resetDemo,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";

test("manual price stays visible to staff while catalog cost, margin and cost history stay Supervisor-only", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await page.goto("/#products");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await expect(
    page.getByRole("columnheader", { name: "Store cost", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Margin %", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Potato Chips 150 g", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor.getByLabel("Selling price", { exact: true }).fill("3.29");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await page.getByLabel("Manual prices", { exact: true }).check();
  await expect(page.locator(".catalog-products-table tbody tr")).toHaveCount(1);
  await expect(
    page.locator(".catalog-products-table .manual-price-pill"),
  ).toHaveText("Manual price");
  await page
    .getByRole("button", { name: "View Potato Chips 150 g", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cost history", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Last received", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stock estimate", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".manual-price-comparison")).toHaveText(
    "Rule price $2.99 · Manual price $3.29",
  );
  await expect(page.locator(".manual-price-margin")).toBeVisible();

  await signIn(page, "Floor Worker");
  await page.goto("/#products");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await expect(
    page.getByRole("columnheader", { name: "Store cost", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "Margin %", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".catalog-products-table .manual-price-pill"),
  ).toHaveText("Manual price");
  await page
    .getByRole("button", { name: "View Potato Chips 150 g", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cost history", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".manual-price-margin")).toHaveCount(0);

  await signIn(page, "Cashier");
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await expect(page.locator(".lookup-detail .manual-price-pill")).toHaveText(
    "Manual price",
  );
  await expect(
    page.locator(".lookup-detail .manual-price-comparison"),
  ).toHaveText("Rule price $2.99 · Manual price $3.29");
  await expect(page.locator(".manual-price-margin")).toHaveCount(0);
  await page.reload();
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await expect(page.locator(".lookup-detail .price")).toHaveText("$3.29");
  await setLanguage(page, "fa");
  await expect(page.locator(".lookup-detail .manual-price-pill")).toHaveText(
    "قیمت دستی",
  );
  await expect(
    page.locator(".lookup-detail .manual-price-comparison bdi"),
  ).toHaveText(["$2.99", "$3.29"]);
  await setLanguage(page, "en");
  await resetDemo(page);
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await expect(page.locator(".lookup-detail .manual-price-pill")).toHaveCount(
    0,
  );
  await expect(page.locator(".lookup-detail .price")).toHaveText("$2.99");
});

test("branch-only manual prices do not flag the other location", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await page
    .getByRole("button", { name: "Edit Potato Chips 150 g", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor.getByLabel("Selling price", { exact: true }).fill("3.29");
  await chooseOption(
    page,
    editor.getByLabel("Approval scope", { exact: true }),
    "branch",
    "This branch only",
  );
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(page.locator(".lookup-detail .manual-price-pill")).toHaveText(
    "Manual price",
  );
  await setBranch(page, "Branch 2");
  await expect(page.locator(".lookup-detail .manual-price-pill")).toHaveCount(
    0,
  );
  await expect(page.locator(".lookup-detail .price")).toHaveText("$2.99");
});
