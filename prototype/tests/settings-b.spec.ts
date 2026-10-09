import { expect, test, type Page } from "@playwright/test";
import { chooseOption, signIn, visitPage } from "./helpers";
async function group(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "Settings groups" })
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function open(page: Page) {
  await signIn(page, "Supervisor");
  await visitPage(page, "Settings");
}

test("Settings presents the exact 13 groups and unfinished groups cannot save", async ({
  page,
}) => {
  await open(page);
  await expect(
    page
      .getByRole("navigation", { name: "Settings groups" })
      .getByRole("button"),
  ).toHaveText([
    "Company",
    "Branches",
    "People",
    "Catalog",
    "Pricing and approvals",
    "Offers",
    "Taxes",
    "Receiving",
    "Returns/date tracking/labels",
    "Notes",
    "Notifications",
    "Modules",
    "Data",
  ]);
  for (const label of [
    "People",
    "Pricing and approvals",
    "Taxes",
    "Receiving",
    "Notifications",
    "Data",
  ]) {
    await group(page, label);
    await expect(
      page.getByText(
        "These settings are planned. Changes are not available yet.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator(
        ".settings-group-content input, .settings-group-content [role=switch]",
      ),
    ).toHaveCount(0);
  }
});
test("company settings save deliberately, persist and record before/after History", async ({
  page,
}) => {
  await open(page);
  await group(page, "Company");
  await page.getByLabel("Name (English)", { exact: true }).fill("Arzon Market");
  await page
    .getByLabel("Name (Persian)", { exact: true })
    .fill("فروشگاه ارزان");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).config
          .company.name_en,
    ),
  ).toBe("Super Arzon");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".settings-changed-line")).toContainText(
    "Changed by",
  );
  await page.reload();
  await group(page, "Company");
  await expect(page.getByLabel("Name (English)", { exact: true })).toHaveValue(
    "Arzon Market",
  );
  const activity = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).activity.find(
      (entry: { entity_id: string }) => entry.entity_id === "company",
    ),
  );
  expect(activity).toMatchObject({
    reversible: true,
    company_id: "super-arzon",
    branch: "all",
    before: { name_en: "Super Arzon" },
    after: { name_en: "Arzon Market" },
  });
  await page.getByLabel("Time zone", { exact: true }).fill("Invalid/Zone");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Enter a valid time zone",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).config
          .company.timezone,
    ),
  ).toBe("America/Toronto");
});
test("new branch configuration works in the live branch switcher and retains history after deactivation", async ({
  page,
}) => {
  await open(page);
  await group(page, "Branches");
  await page.getByRole("button", { name: "Add branch", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add branch", exact: true });
  await dialog
    .getByLabel("Name (English)", { exact: true })
    .fill("North Market");
  await dialog.getByLabel("Name (Persian)", { exact: true }).fill("بازار شمال");
  await dialog.getByLabel("Address", { exact: true }).fill("100 Market Road");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await chooseOption(
    page,
    page.locator(".topbar").getByLabel("Branch", { exact: true }),
    "Branch 4",
    "North Market",
  );
  await expect(
    page.locator(".topbar").getByLabel("Branch", { exact: true }),
  ).toContainText("North Market");
  await page.reload();
  const row = page.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: "North Market", exact: true }),
  });
  await row.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(row).toContainText("Inactive");
  await page.locator(".topbar").getByLabel("Branch", { exact: true }).click();
  await expect(
    page.getByRole("option", { name: "North Market", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  const branches = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).config
        .branches,
  );
  expect(
    branches.find((entry: { code: string }) => entry.code === "B4"),
  ).toMatchObject({ id: "Branch 4", name_en: "North Market", active: false });
});
test("a new pricing category feeds the same Decimal tester and preserves approved prices", async ({
  page,
}) => {
  await open(page);
  await group(page, "Catalog");
  const pricingTable = page.locator(".settings-pricing-table");
  const tableGeometry = await pricingTable.evaluate((wrapper) => {
    const table = wrapper.querySelector("table")!;
    const actionsCell = table.querySelector("tbody tr td:last-child")!;
    const buttons = Array.from(actionsCell.querySelectorAll("button"));
    return {
      wrapperWidth: wrapper.clientWidth,
      scrollWidth: wrapper.scrollWidth,
      tableWidth: table.getBoundingClientRect().width,
      overflowX: getComputedStyle(wrapper).overflowX,
      actionsContained: buttons.every((button) => {
        const bounds = button.getBoundingClientRect();
        const cellBounds = actionsCell.getBoundingClientRect();
        return (
          bounds.left >= cellBounds.left && bounds.right <= cellBounds.right
        );
      }),
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(tableGeometry.tableWidth).toBeGreaterThanOrEqual(900);
  expect(tableGeometry.actionsContained).toBe(true);
  expect(tableGeometry.pageOverflow).toBe(false);
  if (await page.evaluate(() => window.innerWidth <= 760)) {
    expect(tableGeometry.scrollWidth).toBeGreaterThan(
      tableGeometry.wrapperWidth,
    );
    expect(["auto", "scroll"]).toContain(tableGeometry.overflowX);
    await pricingTable.evaluate((wrapper) => {
      wrapper.scrollLeft = wrapper.scrollWidth;
    });
    await expect(
      pricingTable
        .getByRole("button", { name: "Archive", exact: true })
        .first(),
    ).toBeInViewport();
  }
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).products.map(
      (product: { selling_price: string }) => product.selling_price,
    ),
  );
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Add category",
    exact: true,
  });
  await dialog.getByLabel("Name (English)", { exact: true }).fill("Bakery");
  await dialog.getByLabel("Name (Persian)", { exact: true }).fill("نانوایی");
  await dialog.getByLabel("Cost divisor", { exact: true }).fill("0.50");
  await dialog
    .getByRole("button", { name: "Apply category", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await chooseOption(
    page,
    page.getByLabel("Pricing category", { exact: true }),
    "bakery",
    "Bakery",
  );
  const tester = page.locator(".card").filter({
    has: page.getByRole("heading", { name: "Price tester", exact: true }),
  });
  await expect(tester.getByText("$1.99", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await group(page, "Catalog");
  await expect(
    page.getByLabel("Cost divisor for Bakery", { exact: true }),
  ).toHaveValue("0.50");
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).products.map(
      (product: { selling_price: string }) => product.selling_price,
    ),
  );
  expect(after).toEqual(before);
});
test("offer preferences and module visibility save, while existing records stay intact", async ({
  page,
}) => {
  await open(page);
  await group(page, "Offers");
  await page
    .getByRole("switch", { name: "AI offer suggestions", exact: true })
    .click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).config
          .promotions.ai_suggestions_enabled,
    ),
  ).toBe(false);
  const returns = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).returns
        .length,
  );
  await group(page, "Modules");
  await page.getByRole("switch", { name: "Returns", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page
      .getByRole("navigation", {
        name: "Pages",
        exact: true,
        includeHidden: true,
      })
      .getByRole("link", { name: "Returns", exact: true, includeHidden: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).returns
          .length,
    ),
  ).toBe(returns);
  await page.getByRole("switch", { name: "Returns", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page
      .getByRole("navigation", {
        name: "Pages",
        exact: true,
        includeHidden: true,
      })
      .getByRole("link", { name: "Returns", exact: true, includeHidden: true }),
  ).toHaveCount(1);
  await visitPage(page, "Returns");
  await expect(
    page.getByRole("heading", { name: "Returns", exact: true, level: 1 }),
  ).toBeVisible();
});
