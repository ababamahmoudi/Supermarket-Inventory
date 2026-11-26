import { expect, test } from "@playwright/test";
import { setBranch, signIn, visitPage } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

test("All locations lists the company catalog and shows branch facts only in the selected product", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "manager");
  await setBranch(page, "all");
  const before = await readCanonicalBusinessEvidence(page);
  await visitPage(page, "Lookup");
  const products = before.products.filter(
    (row) =>
      row.company_id === before.config.company.seed_key &&
      row.status !== "archived",
  );
  await expect(page.locator(".lookup-result-row")).toHaveCount(products.length);
  await expect(page.locator(".lookup-result-price")).toHaveCount(0);
  const facts = page.getByRole("region", { name: "By location" });
  await expect(facts.getByText("North York", { exact: true })).toBeVisible();
  await expect(facts.getByText("Richmond Hill", { exact: true })).toBeVisible();
  await expect(facts.getByText("Newmarket", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByRole("combobox", { name: "Location", exact: true }),
  ).toHaveCount(0);
  const target = products.find((row) => row.code === "0009")!;
  await page
    .getByRole("combobox", { name: "Search products" })
    .fill(target.code);
  await expect(page.locator(".lookup-result-row")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: target.name_en, exact: true }),
  ).toContainText(target.name_en);
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.products).toEqual(before.products);
  expect(after.invoices).toEqual(before.invoices);
  expect(after.stock_movements).toEqual(before.stock_movements);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.activity).toEqual(before.activity);
});

test("Cashier can browse every assigned Store together without costs or Warehouse and choose a Store to charge", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "cashier");
  await setBranch(page, "all");
  await page.getByRole("combobox", { name: "Search products" }).fill("0009");
  await expect(page.locator(".lookup-result-row")).toHaveCount(1);
  const facts = page.getByRole("region", { name: "By location" });
  await expect(facts.getByText("North York", { exact: true })).toBeVisible();
  await expect(facts.getByText("Warehouse", { exact: true })).toHaveCount(0);
  await expect(page.locator(".lookup-approved-price")).toHaveCount(0);
  await expect(page.getByText("Store cost", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Margin %", { exact: true })).toHaveCount(0);
  await setBranch(page, "Branch 1");
  await expect(page.locator(".lookup-approved-price")).toBeVisible();
  await expect(page.getByRole("region", { name: "By location" })).toHaveCount(
    0,
  );
});

test("an aggregate Cashier is asked for a location only when adding a date", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "cashier");
  await setBranch(page, "all");
  await page.getByRole("combobox", { name: "Search products" }).fill("0009");
  await expect(page.locator(".lookup-result-row")).toHaveCount(1);
  await page
    .locator(".lookup-detail")
    .getByRole("button", { name: "Product actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Add date", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Date tracking", exact: true, level: 1 }),
  ).toBeVisible();
  const location = page
    .getByRole("main")
    .getByRole("combobox", { name: "Location", exact: true });
  await expect(location).toHaveText("Choose an option");
  await expect(
    page
      .locator(".topbar")
      .getByRole("combobox", { name: "Location", exact: true }),
  ).toHaveText("All my locations");
});
