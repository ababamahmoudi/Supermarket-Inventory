import { expect, test } from "@playwright/test";
import { chooseOption, setLanguage, signIn } from "./helpers";

test.setTimeout(60000);

test("Offers combines name/code/label search, category, supplier, type and status without changing prices", async ({
  page,
}) => {
  await signIn(page, "supervisor");
  await page.goto("/#offers");
  const filters = page.getByLabel("Offer filters", { exact: true });
  const current = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Current offers", exact: true }),
  });
  await expect(current.locator("tbody tr")).toHaveCount(5);
  await filters.getByLabel("Search offers", { exact: true }).fill("0003");
  await expect(current.locator("tbody tr")).toHaveCount(1);
  await expect(current).toContainText("Sour Cherry Juice");
  await filters.getByLabel("Search offers", { exact: true }).fill("آب آلبالو");
  await expect(current.locator("tbody tr")).toHaveCount(1);
  await filters.getByLabel("Search offers", { exact: true }).fill("2 for $5");
  await expect(current.locator("tbody tr")).toHaveCount(2);
  await chooseOption(
    page,
    filters.getByLabel("Offer category", { exact: true }),
    "Juices",
  );
  await chooseOption(
    page,
    filters.getByLabel("Offer supplier", { exact: true }),
    "Fresh Valley Foods",
  );
  await chooseOption(
    page,
    filters.getByLabel("Offer type", { exact: true }),
    "2 for $5",
  );
  await expect(current.locator("tbody tr")).toHaveCount(1);
  await expect(filters.locator(".filter-count")).toHaveText("1 offer");
  await current
    .getByRole("button", { name: "Stop offer", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Stop offer", exact: true })
    .getByRole("button", { name: "Stop offer", exact: true })
    .click();
  await chooseOption(
    page,
    filters.getByLabel("Offer status", { exact: true }),
    "stopped",
    "Stopped",
  );
  await expect(current.locator("tbody tr")).toHaveCount(1);
  await expect(current.getByText("Stopped", { exact: true })).toBeVisible();
  await filters
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await chooseOption(
    page,
    filters.getByLabel("Offer status", { exact: true }),
    "active",
    "Active",
  );
  await expect(current.locator("tbody tr")).toHaveCount(4);
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0003");
  await expect(page.locator(".price")).toHaveText("$2.99");
});

test("Offers branch filtering never lets a Floor Worker read another branch offer", async ({
  page,
}) => {
  await signIn(page, "supervisor");
  await page.goto("/#offers");
  const filters = page.getByLabel("Offer filters", { exact: true });
  await chooseOption(
    page,
    filters.getByLabel("Offer branch", { exact: true }),
    "Richmond Hill",
  );
  await page.getByRole("button", { name: "Create offer", exact: true }).click();
  const create = page.getByRole("dialog", {
    name: "Create offer",
    exact: true,
  });
  await chooseOption(
    page,
    create.getByLabel("Product", { exact: true }),
    "0003",
    "Sour Cherry Juice 1 L · \u20660003\u2069",
  );
  await chooseOption(
    page,
    create.getByLabel("Offer scope", { exact: true }),
    "branch",
    "This branch only — Richmond Hill",
  );
  await create
    .getByRole("button", { name: "Create offer", exact: true })
    .click();
  const current = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Current offers", exact: true }),
  });
  await expect(current.locator("tbody tr")).toHaveCount(6);
  await expect(
    current.getByRole("cell", { name: "Richmond Hill", exact: true }),
  ).toBeVisible();
  await signIn(page, "floor_worker");
  await page.goto("/#offers");
  await expect(
    filters.getByLabel("Offer branch", { exact: true }),
  ).toBeDisabled();
  await expect(filters.getByLabel("Offer branch", { exact: true })).toHaveText(
    "North York",
  );
  await expect(current.locator("tbody tr")).toHaveCount(5);
  await expect(
    current.getByRole("cell", { name: "Richmond Hill", exact: true }),
  ).toHaveCount(0);
  await filters
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(filters.getByLabel("Offer branch", { exact: true })).toHaveText(
    "North York",
  );
});

test("Payables filters supplier totals and keeps selected report in the same branch", async ({
  page,
}) => {
  await signIn(page, "supervisor");
  await page.goto("/#payables");
  const filters = page.getByLabel("Payables filters", { exact: true });
  const overview = page.locator(".payables-overview");
  await chooseOption(
    page,
    filters.getByLabel("Payables branch", { exact: true }),
    "North York",
  );
  await filters.getByLabel("Search suppliers", { exact: true }).fill("fresh");
  await expect(overview.locator("tbody tr")).toHaveCount(1);
  await expect(overview).toContainText("$169.79");
  await overview.getByRole("button", { name: "View", exact: true }).click();
  const report = page.getByLabel("Supplier financial report", { exact: true });
  await expect(report.locator(".payables-summary-grid")).toContainText(
    "$169.79",
  );
  await chooseOption(
    page,
    filters.getByLabel("Payables branch", { exact: true }),
    "Richmond Hill",
  );
  await expect(
    overview.getByRole("cell", { name: "Richmond Hill", exact: true }),
  ).toBeVisible();
  await expect(report.locator(".payables-summary-grid")).toContainText("$0.00");
  await filters
    .getByRole("checkbox", { name: "With balance", exact: true })
    .check();
  await expect(report).toHaveCount(0);
  await expect(overview).toContainText("No suppliers match these filters");
  await filters
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await chooseOption(
    page,
    filters.getByLabel("Payables branch", { exact: true }),
    "North York",
  );
  await filters
    .getByRole("checkbox", { name: "Overdue only", exact: true })
    .check();
  await filters
    .getByRole("checkbox", { name: "With balance", exact: true })
    .check();
  const rows = overview.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(
    rows.filter({ hasText: "Golden Grain Distributors" }),
  ).toContainText("$842.10");
  await expect(
    rows.filter({ hasText: "Golden Grain Distributors" }),
  ).toContainText("$210.00");
  await expect(rows.filter({ hasText: "Sunrise Beverages" })).toContainText(
    "$96.40",
  );
  await expect(filters).toContainText("2 suppliers");
  await signIn(page, "floor_worker");
  await page.goto("/#payables");
  await expect(
    page.getByRole("heading", { name: "Payables", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".payables-overview")).toHaveCount(0);
});

test("Persian Offers and Payables keep complete custom-filter choices and isolated supplier names", async ({
  page,
}) => {
  await signIn(page, "supervisor");
  await setLanguage(page, "fa");
  await page.goto("/#offers");
  const offers = page.getByLabel("فیلترهای پیشنهادها", { exact: true });
  await chooseOption(
    page,
    offers.getByLabel("تأمین‌کننده پیشنهاد", { exact: true }),
    "Golden Grain Distributors",
  );
  await expect(
    page
      .locator("section.card")
      .filter({
        has: page.getByRole("heading", {
          name: "پیشنهادهای فعلی",
          exact: true,
        }),
      })
      .locator("tbody tr"),
  ).toHaveCount(1);
  await expect(offers).toContainText("1 پیشنهاد");
  await page.goto("/#payables");
  const payables = page.getByLabel("فیلترهای پرداختنی‌ها", { exact: true });
  await payables
    .getByLabel("جستجوی تأمین‌کنندگان", { exact: true })
    .fill("Corner Spice");
  await expect(
    page.locator(".payables-overview tbody bdi").first(),
  ).toHaveAttribute("dir", "ltr");
  await expect(payables).toContainText("1 تأمین‌کننده");
  await expect(page.locator("select")).toHaveCount(0);
});
