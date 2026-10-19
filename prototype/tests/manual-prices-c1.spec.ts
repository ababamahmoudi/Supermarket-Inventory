import { expect, test, type Page } from "@playwright/test";
import { resetDemo, setBranch, setLanguage, signIn } from "./helpers";

async function showManualPrice(page: Page) {
  const table = page.locator(".catalog-products-table");
  const badge = table.locator(".manual-price-pill");
  if (!(await badge.isVisible()))
    await table
      .getByRole("button", { name: "Show details", exact: true })
      .first()
      .click();
  await expect(badge).toHaveText("Manual price");
}

test("manual price stays visible to staff while catalog cost, margin and cost history stay Supervisor-only", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await page.goto("/#products");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  const table = page.locator(".catalog-products-table");
  const productRow = table
    .locator("tbody tr")
    .filter({ hasText: "0009" })
    .first();
  const compact = await productRow.evaluate((element) =>
    element.matches(".phone-list-row"),
  );
  if (compact) {
    // E3 omits private operational columns from the short phone list. The
    // Manager still reads the same cost and margin in the actual record.
    await productRow.locator(".phone-list-chevron .table-row-link").click();
    await expect(page).toHaveURL(/#product\?code=0009$/);
    await setBranch(page, "Branch 1");
    const card = page.locator(".product-page-cost-card");
    for (const label of ["Store cost", "Margin %"]) {
      const field = card
        .locator("dl > div")
        .filter({ has: page.getByText(label, { exact: true }) });
      await expect(field.locator("dt")).toHaveText(label);
      await expect(field.locator("dd")).toBeVisible();
      await expect(field.locator("dd")).not.toBeEmpty();
      await expect(field.locator("dd")).toContainText(
        label === "Store cost" ? "$" : "%",
      );
    }
    await page
      .getByRole("link", { name: "Back to Products", exact: true })
      .click();
    // Re-enter the original test selection after this extra compact-record
    // visit; the existing Back to Products link opens the catalog itself.
    await page.getByLabel("Search products", { exact: true }).fill("0009");
  } else {
    for (const label of ["Store cost", "Margin %"]) {
      const heading = table.getByRole("columnheader", {
        name: label,
        exact: true,
      });
      const cell = productRow.locator(`td[data-column-label="${label}"]`);
      if (await heading.count()) await expect(heading).toBeVisible();
      else if (await cell.isVisible()) {
        await expect(cell).toHaveAttribute("data-column-label", label);
        await expect(cell).not.toBeEmpty();
      } else {
        await productRow
          .getByRole("button", { name: "Show details", exact: true })
          .click();
        await expect(
          table
            .locator(".table-expanded-row")
            .getByText(label, { exact: true }),
        ).toBeVisible();
        await productRow
          .getByRole("button", { name: "Hide details", exact: true })
          .click();
      }
    }
  }
  await page
    .getByRole("link", { name: "Potato Chips 150 g", exact: true })
    .click();
  await page
    .locator(".product-header-actions")
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Change price",
    exact: true,
  });
  await editor.getByRole("radio", { name: /^New regular price/ }).click();
  await editor.getByLabel("Price", { exact: true }).fill("3.29");
  await editor
    .getByRole("button", { name: "Save new price", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await page
    .getByRole("link", { name: "Back to Products", exact: true })
    .click();
  await page.getByLabel("Manual prices", { exact: true }).check();
  await expect(page.locator(".catalog-products-table tbody tr")).toHaveCount(1);
  await showManualPrice(page);
  await page
    .getByRole("link", { name: "Potato Chips 150 g", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cost history", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Deliveries", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".product-last-received-summary")).toContainText(
    "Last received",
  );
  await expect(
    page.getByRole("heading", { name: "Stock estimate", exact: true }),
  ).toHaveCount(0);
  // Aggregate prices require an explicit selling location before a customer price.
  await setBranch(page, "North York");
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
    page.locator(
      '.catalog-products-table td[data-column-label="Store cost"], .catalog-products-table td[data-column-label="Margin %"]',
    ),
  ).toHaveCount(0);
  await showManualPrice(page);
  await page
    .getByRole("link", { name: "Potato Chips 150 g", exact: true })
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
    .locator(".product-header-actions")
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Change price",
    exact: true,
  });
  await editor.getByRole("radio", { name: /^New regular price/ }).click();
  await editor.getByLabel("Price", { exact: true }).fill("3.29");
  await editor
    .getByRole("button", { name: "Only North York", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Save new price", exact: true })
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
