import { expect, test } from "@playwright/test";
import Decimal from "decimal.js";
import {
  chooseOption,
  invoiceImage,
  setBranch,
  signIn,
  uploadInvoice,
} from "./helpers";
import receiptFixtures from "../src/fixtures/a2-demo-data.json" with { type: "json" };
import type { DemoState } from "../src/types";

const storage = "supermarket-prototype-v1";
test.setTimeout(60000);

async function saved(
  page: import("@playwright/test").Page,
): Promise<DemoState> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storage,
  );
}

async function manualInvoice(page: import("@playwright/test").Page) {
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  const header = page.locator("#invoice-details-fields");
  await header.getByLabel("Supplier", { exact: true }).click();
  await page
    .getByRole("listbox", { name: "Supplier", exact: true })
    .getByRole("option", { name: /Fresh Valley Foods/ })
    .click();
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(invoiceImage);
  await expect(page.locator(".invoice-line")).toHaveCount(1);
}

test("a worker retargets their own invoice to Warehouse without gaining Warehouse access", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await expect(
    page.getByRole("button", { name: "Manual entry", exact: true }),
  ).toHaveCount(0);
  await uploadInvoice(page);
  await expect(page.locator(".invoice-line")).toHaveCount(6);
  const header = page.locator("#invoice-details-fields");
  if (!(await header.isVisible()))
    await page
      .getByRole("button", { name: "Invoice details", exact: true })
      .click();
  await chooseOption(
    page,
    header.getByLabel("Location", { exact: true }),
    "Warehouse",
  );
  await expect(header.getByLabel("Location", { exact: true })).toContainText(
    "Warehouse",
  );
  await expect(page.locator(".topbar .branch-pill")).toContainText(
    "North York",
  );
  await expect(
    page.getByText(
      "Choose an invoice in your branch, or start a new invoice.",
      { exact: true },
    ),
  ).toHaveCount(0);
  const draft = (await saved(page)).invoice;
  expect(draft).toMatchObject({
    branch: "Warehouse",
    handling_branch: "Branch 1",
  });
  for (const line of await page.locator(".invoice-line").all()) {
    await line.getByRole("button", { name: "No", exact: true }).click();
    await line
      .getByRole("checkbox", {
        name: "Confirm this invoice line",
        exact: true,
      })
      .click();
    await expect(line.getByText("Confirmed", { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  const after = await saved(page);
  expect(
    after.invoices?.find((invoice) => invoice.id === draft.id),
  ).toMatchObject({ status: "posted", branch: "Warehouse" });
  await page.goto("/#received");
  await expect(
    page.getByRole("heading", { name: "Received", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Location", exact: true }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".received-table")
      .getByText("Warehouse", { exact: true })
      .count(),
  ).toBe(0);
});

test("Supervisor moves a posted invoice with a reason and retains its original document and company balance", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  const source = receiptFixtures.invoices[0];
  const id = `a2-fixture:${source.number}`;
  await page.goto(`/#invoices?id=${encodeURIComponent(id)}`);
  await expect(
    page.getByRole("button", { name: "Move invoice", exact: true }),
  ).toBeVisible();
  const before = await saved(page);
  const original = before.invoices!.find((invoice) => invoice.id === id)!;
  await page.getByRole("button", { name: "Move invoice", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Move invoice",
    exact: true,
  });
  await chooseOption(
    page,
    dialog.getByLabel("Location", { exact: true }),
    "Warehouse",
  );
  await expect(
    dialog.getByRole("button", { name: "Move invoice", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Reason", { exact: true })
    .fill("Correct the delivery location");
  await expect(dialog).toContainText(
    "Previous payments and credits stay at their recorded location.",
  );
  await dialog
    .getByRole("button", { name: "Move invoice", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Invoice moved. The correction is recorded in History.", {
      exact: true,
    }),
  ).toBeVisible();
  const after = await saved(page);
  expect(after.invoices!.find((invoice) => invoice.id === id)).toEqual(
    original,
  );
  expect(after.ledger.slice(0, before.ledger.length)).toEqual(before.ledger);
  expect(after.invoice_location_corrections?.at(-1)).toMatchObject({
    invoice_id: id,
    to_branch: "Warehouse",
    reason: "Correct the delivery location",
  });
  const appended = after.ledger.slice(before.ledger.length);
  expect(appended).toHaveLength(2);
  expect(Decimal.sum(...appended.map((entry) => entry.amount)).toFixed(2)).toBe(
    "0.00",
  );
  await page.goto("/#received");
  await page
    .getByRole("textbox", { name: "Search Received", exact: true })
    .fill(source.number);
  await expect(
    page
      .locator(".received-table")
      .getByText("Warehouse", { exact: true })
      .first(),
  ).toBeVisible();
  await page.reload();
  expect(
    (await saved(page)).invoice_location_corrections?.at(-1)?.to_branch,
  ).toBe("Warehouse");
});

test("invoice manual price requires Keep or Use and Keep preserves the approved price on posting", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#product?code=0002");
  await page.getByRole("button", { name: /^Edit / }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor.getByLabel("Selling price", { exact: true }).fill("2.79");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await manualInvoice(page);
  const line = page.locator(".invoice-line").first();
  await line.getByLabel("Unit cost before tax", { exact: true }).fill("1.4000");
  await expect(
    line.getByText("Manual price", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    line.getByRole("checkbox", {
      name: "Confirm this invoice line",
      exact: true,
    }),
  ).toBeDisabled();
  await line
    .getByRole("button", { name: "Keep manual price", exact: true })
    .click();
  await line.getByRole("button", { name: "No", exact: true }).click();
  await line
    .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
    .click();
  await expect(line.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  const after = await saved(page);
  const product = after.products.find((product) => product.code === "0002")!;
  expect(product.selling_price).toBe("2.79");
  expect(product.manual_prices?.all.price).toBe("2.79");
  expect(after.invoice.lines[0]).toMatchObject({
    manual_price_decision: "keep",
    calculated_selling_price: "1.99",
    current_selling_price: "2.79",
  });
  expect(
    after.approvals.filter(
      (approval) => approval.source_invoice_id === after.invoice.id,
    ),
  ).toHaveLength(0);
});
