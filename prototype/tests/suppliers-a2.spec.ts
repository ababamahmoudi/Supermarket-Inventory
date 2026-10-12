import { expect, test, type Locator } from "@playwright/test";
import { setBranch, setLanguage, signIn } from "./helpers";

/** Retain the named field check when its authorized value moves into a card or row disclosure. */
async function expectSupplierField(table: Locator, label: string) {
  const heading = table.getByRole("columnheader", { name: label, exact: true });
  if (await heading.isVisible()) {
    await expect(heading).toBeVisible();
    return;
  }
  const cell = table
    .locator(`td[data-column-label=${JSON.stringify(label)}]:visible`)
    .first();
  if (await cell.count()) {
    await expect(cell).toBeVisible();
    expect(
      await cell.evaluate(
        (element) => getComputedStyle(element, "::before").content,
      ),
    ).toBe(`"${label}"`);
    return;
  }
  const caption = table
    .locator(".table-expanded-row dt")
    .filter({ hasText: label });
  if (!(await caption.first().isVisible())) {
    const disclosures = table.getByRole("button", {
      name: "Show details",
      exact: true,
    });
    const count = await disclosures.count();
    for (let index = 0; index < count; index += 1) {
      await disclosures.first().click();
      if (await caption.first().isVisible()) break;
    }
  }
  await expect(caption.first()).toBeVisible();
  await expect(caption.first()).toHaveText(label);
}

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
  await fresh
    .getByRole("link", { name: "Fresh Valley Foods", exact: true })
    .click();
  await expect(page).toHaveURL(/#suppliers\?name=Fresh%20Valley%20Foods/);
  await expect(
    page.getByRole("heading", { name: "Fresh Valley Foods", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Invoices", exact: true }).click();
  const content = page.locator(".supplier-tab-card");
  await expectSupplierField(content, "Outstanding");
  const invoiceRow = content
    .getByRole("row")
    .filter({ hasText: "FV-20390" })
    .first();
  if ((await invoiceRow.innerText()).includes("$169.79")) {
    await expect(invoiceRow).toContainText("$169.79");
  } else {
    const disclosure = invoiceRow.locator(".table-details-toggle");
    const panelId = await disclosure.getAttribute("aria-controls");
    if ((await disclosure.getAttribute("aria-expanded")) !== "true")
      await disclosure.click();
    await expect(
      content.locator(`[id=${JSON.stringify(panelId)}]`),
    ).toContainText("$169.79");
  }
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  await expectSupplierField(content, "Last bought / case");
  await expectSupplierField(content, "Last bought / unit");
  await page.getByRole("tab", { name: "Payments", exact: true }).click();
  await expectSupplierField(content, "Amount");
  await page
    .getByRole("button", { name: "Back to Suppliers", exact: true })
    .click();
  await setBranch(page, "Richmond Hill");
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
      .getByRole("link", {
        name: "Fresh Valley Foods",
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
    expect(count).toBe(8);
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
        name: /^(Richmond Hill|Newmarket|Warehouse|ریچموند هیل|نیومارکت|انبار)$/,
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
