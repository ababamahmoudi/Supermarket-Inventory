import { expect, test } from "@playwright/test";
import { setBranch, setLanguage, signIn } from "./helpers";

test("Supervisor supplier overview reconciles balances and opens financial tabs", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#suppliers");
  const overview = page.locator(".suppliers-overview");
  await expect(overview.locator("thead")).toContainText("Balance");
  const fresh = overview
    .getByRole("row")
    .filter({ hasText: "Fresh Valley Foods" });
  await expect(fresh).toContainText("$169.79");
  await expect(
    overview.getByRole("row").filter({ hasText: "Golden Grain Distributors" }),
  ).toContainText("$842.10");
  await overview.getByRole("button", { name: "Overdue", exact: true }).click();
  await expect(overview.locator("tbody tr")).toHaveCount(2);
  await overview
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await overview
    .getByLabel("Search suppliers", { exact: true })
    .fill("Fresh Valley");
  await expect(overview.locator("tbody tr")).toHaveCount(1);
  await fresh.getByRole("button", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(/#suppliers\?name=Fresh%20Valley%20Foods/);
  await expect(
    page.getByRole("heading", { name: "Fresh Valley Foods", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Invoices", exact: true }).click();
  const content = page.locator(".supplier-tab-card");
  await expect(
    content.getByRole("columnheader", { name: "Outstanding", exact: true }),
  ).toBeVisible();
  await expect(
    content.getByRole("row").filter({ hasText: "FV-20390" }),
  ).toContainText("$169.79");
  await page
    .getByRole("tab", { name: "Products supplied", exact: true })
    .click();
  await expect(
    content.getByRole("columnheader", { name: "Last cost", exact: true }),
  ).toBeVisible();
  await expect(
    content.getByRole("columnheader", { name: "Cost history", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Payments", exact: true }).click();
  await expect(
    content.getByRole("columnheader", { name: "Amount", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to Suppliers", exact: true })
    .click();
  await setBranch(page, "Branch 2");
  await expect(
    page.locator(".suppliers-overview .money").filter({ hasText: "$169.79" }),
  ).toHaveCount(0);
});

for (const language of ["en", "fa"] as const) {
  test(`Floor Worker supplier overview and every tab omit financial DOM in ${language}`, async ({
    page,
  }) => {
    await signIn(page, "Floor Worker");
    await page.goto("/#suppliers");
    if (language === "fa") await setLanguage(page, "fa");
    const overview = page.locator(".suppliers-overview");
    await expect(overview.locator(".money")).toHaveCount(0);
    await expect(
      overview.getByRole("columnheader", {
        name: /^(Balance|Overdue|Next due date|مانده|سررسید گذشته|سررسید بعدی)/,
      }),
    ).toHaveCount(0);
    await overview
      .getByRole("row")
      .filter({ hasText: "Fresh Valley Foods" })
      .getByRole("button", {
        name: language === "en" ? "View" : "نمایش",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Fresh Valley Foods", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".supplier-kpis .money")).toHaveCount(0);
    await expect(
      page.getByRole("tab", {
        name: language === "en" ? "Payments" : "پرداخت‌ها",
        exact: true,
      }),
    ).toHaveCount(0);
    const tabs = page.locator(".supplier-tabs").getByRole("tab");
    const count = await tabs.count();
    expect(count).toBe(7);
    for (let index = 0; index < count; index += 1) {
      await tabs.nth(index).click();
      const content = page.locator(".supplier-tab-card");
      await expect(content.locator(".money")).toHaveCount(0);
      await expect(
        content.getByRole("columnheader", {
          name: /^(Total|Outstanding|Last cost|Cost history|Credit or compensation|Amount|جمع|مانده پرداخت|آخرین هزینه|تاریخچه هزینه|اعتبار یا جبران|مبلغ)$/,
        }),
      ).toHaveCount(0);
      const branchCells = content.getByRole("cell", {
        name: /^(Branch [23]|شعبه [۲۳])$/,
      });
      await expect(branchCells).toHaveCount(0);
    }
    const supplierName = page.locator(".page-header h1 bdi");
    await expect(supplierName).toHaveAttribute("dir", "ltr");
  });
}

test("Cashier cannot open Suppliers through a direct address", async ({
  page,
}) => {
  await signIn(page, "Cashier");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await expect(
    page.locator(".suppliers-overview, .supplier-header-card"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Cashier lookup", exact: true }),
  ).toBeVisible();
});
