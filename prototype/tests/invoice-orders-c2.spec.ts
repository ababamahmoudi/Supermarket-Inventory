import { expect, test, type Page } from "@playwright/test";
import Decimal from "decimal.js";
import { chooseOption, invoiceImage, signIn } from "./helpers";
import type { DemoState } from "../src/types";

test.setTimeout(60000);
const stored = (page: Page): Promise<DemoState> =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!),
  );

async function rememberedPack(page: Page) {
  await page.goto(
    `/#suppliers?name=${encodeURIComponent("Fresh Valley Foods")}`,
  );
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  const row = page
    .locator(".supplier-items-table tbody tr")
    .filter({ hasText: "Canned Fava Beans" })
    .first();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit item", exact: true });
  await dialog.getByLabel("Units per case", { exact: true }).fill("12");
  await dialog.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function manual(page: Page) {
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await page
    .locator("#invoice-details-fields")
    .getByLabel("Supplier", { exact: true })
    .click();
  await page
    .getByRole("listbox", { name: "Supplier", exact: true })
    .getByRole("option", { name: /Fresh Valley Foods/ })
    .click();
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(invoiceImage);
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  return page.locator(".invoice-line").first();
}

async function confirmNoDate(page: Page) {
  const line = page.locator(".invoice-line").first();
  await line.getByRole("button", { name: "No", exact: true }).click();
  await line
    .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
    .click();
  await expect(line.getByText("Confirmed", { exact: true })).toBeVisible();
}

async function post(page: Page) {
  const button = page.getByRole("button", {
    name: "Post invoice",
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await expect(button).toHaveCount(0);
  expect((await stored(page)).invoice.status).toBe("posted");
}

test("retained case quote bills exactly, remembers the pack and leaves the posted snapshot intact", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await rememberedPack(page);
  const line = await manual(page);
  await expect(line.getByLabel("Units per case", { exact: true })).toHaveValue(
    "12",
  );
  await chooseOption(
    page,
    line.getByLabel("Quantity unit", { exact: true }),
    "cases",
    "Cases",
  );
  await line.getByLabel("Invoiced quantity", { exact: true }).fill("500");
  await line.getByLabel("Case cost before tax", { exact: true }).fill("19.99");
  await expect(
    line.getByLabel("Unit cost before tax", { exact: true }),
  ).toHaveValue("1.6658");
  await expect(line.locator(".invoice-pack-equation")).toContainText(
    "500 × 12 = 6000",
  );
  await confirmNoDate(page);
  await post(page);
  const after = await stored(page);
  expect(after.invoice).toMatchObject({
    subtotal: "9995.00",
    final_total: "9995.00",
    payable_after_open_shorts: "9995.00",
  });
  expect(after.invoice.lines[0]).toMatchObject({
    units_per_case: 12,
    quantity_unit: "cases",
    quantity_entered: "500",
    qty_invoiced: 6000,
    unit_cost_before_tax: "1.6658",
    case_cost_before_tax: "19.99",
  });
  expect(
    Decimal.sum(
      ...after.ledger
        .filter((entry) => entry.invoice_id === after.invoice.id)
        .map((entry) => entry.amount),
    ).toFixed(2),
  ).toBe("9995.00");
  await page.goto("/#received");
  await page
    .getByRole("textbox", { name: "Search Received", exact: true })
    .fill(after.invoice.supplier_invoice_number);
  await expect(page.locator(".received-table")).toContainText("500 cases");
  await page.reload();
  expect((await stored(page)).invoice.lines[0].units_per_case).toBe(12);
});

test("order comparison requires explicit extra and changed-cost decisions, then preserves one alert and accepted receipts", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await rememberedPack(page);
  await page.goto("/#orders");
  await page.getByRole("button", { name: "New order", exact: true }).click();
  const form = page.getByRole("form", { name: "New order", exact: true });
  await chooseOption(
    page,
    form.getByLabel("Supplier", { exact: true }),
    "Fresh Valley Foods",
  );
  await form
    .getByRole("textbox", { name: /^Cases — Canned Fava Beans/ })
    .fill("1");
  await form
    .getByRole("textbox", { name: /^Expected unit cost — Canned Fava Beans/ })
    .fill("0.9800");
  await form.getByRole("button", { name: "Place order", exact: true }).click();
  const before = await stored(page);
  const order = before.orders!.at(-1)!;
  expect(order.status).toBe("ordered");
  const line = await manual(page);
  await line.getByLabel("Invoiced quantity", { exact: true }).fill("18");
  await line.getByLabel("Unit cost before tax", { exact: true }).fill("1.1000");
  const comparison = page.locator(".invoice-order-card");
  await chooseOption(
    page,
    comparison.getByLabel("Order (optional)", { exact: true }),
    order.id,
    `${order.reference} · ${order.date}`,
  );
  await expect(
    page.getByText(
      "Choose a decision for every order difference before posting.",
      { exact: true },
    ),
  ).toBeVisible();
  const row = comparison.locator('tr[data-invoice-line="0"]');
  await row
    .getByRole("button", {
      name: "Refused / sent back with the driver",
      exact: true,
    })
    .click();
  await row
    .getByRole("button", { name: "Accept new cost", exact: true })
    .click();
  await confirmNoDate(page);
  await post(page);
  const after = await stored(page);
  const currentOrder = after.orders!.find((item) => item.id === order.id)!;
  expect(currentOrder.status).toBe("received");
  expect(currentOrder.lines[0].received_units).toBe(12);
  expect(after.invoice.lines[0]).toMatchObject({
    qty_received_at_posting: 18,
    refused_units: 6,
    extra_delivery_decision: "refuse",
    order_price_decision: "accept",
  });
  expect(after.invoice.payable_after_open_shorts).toBe("13.20");
  expect(
    after.alerts.filter((alert) => alert.invoice_id === after.invoice.id),
  ).toHaveLength(1);
  expect(
    after.alerts.find((alert) => alert.invoice_id === after.invoice.id)
      ?.order_differences,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "extra", units: 6, decision: "refuse" }),
      expect.objectContaining({ kind: "price_change", decision: "accept" }),
    ]),
  );
  await page.reload();
  await expect(
    page.locator('.invoice-order-card tr[data-invoice-line="0"]'),
  ).toContainText("12");
  await page.goto("/#alerts");
  await expect(
    page.getByRole("heading", {
      name: "Invoice and order differences",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/#received");
  await page
    .getByRole("textbox", { name: "Search Received", exact: true })
    .fill(after.invoice.supplier_invoice_number);
  await expect(page.locator(".received-table")).toContainText("12 units");
});

test("short-dated expiry discount requires a real date and preserves an existing manual selling price", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#product?code=0002");
  await page.getByRole("button", { name: /^Edit / }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor.getByLabel("Selling price", { exact: true }).fill("2.49");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  const before = await stored(page);
  const prior = before.products.find((item) => item.code === "0002")!;
  const line = await manual(page);
  await line.getByLabel("Unit cost before tax", { exact: true }).fill("0.8000");
  await line
    .getByRole("button", { name: "Short-dated (expiry discount)", exact: true })
    .click();
  await expect(
    line.getByRole("button", { name: "No", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  await expect(
    line.getByRole("button", { name: "Keep manual price", exact: true }),
  ).toHaveCount(0);
  await line.getByLabel("Date", { exact: true }).click();
  await page
    .getByRole("dialog", { name: "Choose date", exact: true })
    .getByRole("button", { name: "Today", exact: true })
    .click();
  await line
    .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
    .click();
  await post(page);
  const after = await stored(page);
  const product = after.products.find((item) => item.code === "0002")!;
  expect(product.last_cost_before_tax).toBe(prior.last_cost_before_tax);
  expect(product.selling_price).toBe("2.49");
  expect(product.manual_prices).toEqual(prior.manual_prices);
  expect(product.price_provenance).toEqual(prior.price_provenance);
  expect(after.invoice.payable_after_open_shorts).toBe("0.80");
  expect(
    after.expiry.find((entry) => entry.invoice_id === after.invoice.id)?.date,
  ).toBe(after.invoice.lines[0].date_value);
  expect(
    after.approvals.filter(
      (approval) => approval.source_invoice_id === after.invoice.id,
    ),
  ).toHaveLength(0);
  expect(
    after.alerts.filter((alert) =>
      alert.id.startsWith(`${after.invoice.id}:lower:`),
    ),
  ).toHaveLength(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
