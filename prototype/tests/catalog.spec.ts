import { expect, test, type Page } from "@playwright/test";
import { signIn, setBranch } from "./helpers";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };

// Hash navigation works with the desktop sidebar and the collapsed phone menu.
async function visit(page: Page, route: string, heading: string) {
  await page.goto(`/#${route}`);
  await expect(
    page.getByRole("heading", { name: heading, exact: true, level: 1 }),
  ).toBeVisible();
}

test("cashier finds English, Persian, code and barcode results with approved price, tax and pending tags", async ({
  page,
}) => {
  await signIn(page, "Cashier");
  const search = page.getByLabel("Search products", { exact: true });
  const sumac = demoSeed.products.find((product) =>
    product.name_en.includes("Sumac"),
  )!;
  for (const query of ["sumac", "سماق", sumac.code, sumac.barcode]) {
    await search.fill(query);
    await expect(
      page.getByRole("heading", { name: sumac.name_en, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".price")).toHaveText("$1.99");
  }
  await search.fill("0009");
  await expect(page.locator(".price")).toHaveText("$2.99");
  await expect(
    page.locator(".lookup-detail").getByText("Taxable", { exact: true }),
  ).toBeVisible();
  await search.fill("0006");
  await expect(page.locator(".price")).toHaveText("$1.99");
  await expect(
    page.getByText("New price pending", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Keep charging the approved price shown above.", {
      exact: false,
    }),
  ).toBeVisible();
  await search.fill("not-a-demo-product");
  await expect(
    page.getByText(
      "No products match. Check the name or barcode, or clear the category filter.",
    ),
  ).toBeVisible();
});

test("cashier direct navigation stays in lookup and exposes no operational or financial controls", async ({
  page,
}) => {
  await signIn(page, "Cashier");
  await visit(page, "payables", "Cashier lookup");
  await expect(
    page.getByRole("heading", { name: "Cashier lookup", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Payables", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Products", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Store cost", { exact: false })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Stock estimate", exact: true }),
  ).toHaveCount(0);
});

test("branch switcher shows approved overrides and a new product requires Supervisor confirmation", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await visit(page, "lookup", "Cashier lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0004");
  await setBranch(page, "Branch 1");
  await expect(page.locator(".price")).toHaveText("$6.49");
  await setBranch(page, "Branch 2");
  await expect(page.locator(".price")).toHaveText("$6.99");
  await setBranch(page, "Branch 1");
  for (const query of ["Dried Barberries", "0015", "۰۰۱۵"]) {
    await page.getByLabel("Search products", { exact: true }).fill(query);
    await expect(page.locator(".price")).toHaveCount(0);
    await expect(
      page
        .locator(".lookup-detail")
        .getByText("No approved price yet", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".lookup-pending-price")).toContainText("$5.49");
    await expect(
      page.getByRole("heading", {
        name: "Dried Barberries 100 g",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator('[aria-label="Product results"]').getByRole("option"),
    ).toHaveCount(1);
  }
  await expect(
    page.getByText("Pending: confirm with a Supervisor before selling", {
      exact: true,
    }),
  ).toBeVisible();
});

test("Floor Worker filters Products and opens details without seeing catalog supplier cost", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await visit(page, "products", "Products");
  await page.getByLabel("Has pending price", { exact: true }).check();
  await expect(
    page.getByText("Page 1 of 1 · 2 products", { exact: true }),
  ).toBeVisible();
  const lavash = demoSeed.products.find((product) => product.code === "0006")!;
  await page
    .getByRole("button", { name: `View ${lavash.name_en}`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: lavash.name_en, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".price")).toHaveText("$1.99");
  await expect(page.getByText("Store cost", { exact: false })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Stock estimate", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Last received", exact: true }),
  ).toBeVisible();
});
