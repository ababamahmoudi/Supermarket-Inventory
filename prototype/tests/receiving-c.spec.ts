import { createHash } from "node:crypto";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test } from "@playwright/test";
import Decimal from "decimal.js";
import {
  chooseOption,
  confirmInvoiceLine,
  openInvoiceLine,
  invoiceImage,
  setBranch,
  signIn,
  uploadInvoice,
} from "./helpers";
import receiptFixtures from "../src/fixtures/a2-demo-data.json" with { type: "json" };
import type { DemoState } from "../src/types";
import { openC8PriceDialog } from "../scripts/capture-c8-proof.mjs";

test.setTimeout(60000);

async function saved(
  page: import("@playwright/test").Page,
): Promise<DemoState> {
  return readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );
}

async function manualInvoice(page: import("@playwright/test").Page) {
  const previousId = (await saved(page)).invoice.id;
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New invoice", exact: true })
    .getByRole("button", { name: "Manual entry", exact: true })
    .click();
  await expect
    .poll(async () => {
      const current = (await saved(page)).invoice;
      return (
        current.id !== previousId &&
        current.entry_mode === "manual" &&
        current.lines.length === 0
      );
    })
    .toBe(true);
  const currentId = (await saved(page)).invoice.id;
  await expect(page).toHaveURL(
    (url) => url.hash === `#invoices?id=${encodeURIComponent(currentId)}`,
  );
  await expect(page.locator('[aria-busy="true"][inert]')).toHaveCount(0);
  await page
    .getByLabel("Invoice number", { exact: true })
    .fill("FICTIONAL-RECEIVING-C");
  const header = page.locator("#invoice-details-fields");
  await header.getByLabel("Supplier", { exact: true }).click();
  await page
    .getByRole("listbox", { name: "Supplier", exact: true })
    .getByRole("option", { name: /Fresh Valley Foods/ })
    .click();
  await chooseOption(
    page,
    page.getByRole("combobox", {
      name: "Add a product to the invoice",
      exact: true,
    }),
    "0002",
    "Canned Fava Beans 400 g",
  );
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const id = (await saved(page)).invoice.id;
  await page
    .getByLabel("Attach original", { exact: true })
    .setInputFiles(invoiceImage);
  // The existing manual line remains mounted while its original is saving.
  // Wait for this exact file and accepted route before editing that line.
  await expect
    .poll(async () => {
      const invoice = (await saved(page)).invoice;
      return {
        id: invoice.id,
        mode: invoice.entry_mode,
        status: invoice.status,
        file: invoice.file_name,
        sha256: invoice.file_data?.split(":").at(-1),
      };
    })
    .toEqual({
      id,
      mode: "manual",
      status: "review",
      file: invoiceImage.name,
      sha256: createHash("sha256").update(invoiceImage.buffer).digest("hex"),
    });
  await expect(
    page.getByRole("button", { name: "Save and close", exact: true }),
  ).toBeEnabled();
  await expect(page).toHaveURL(
    (url) => url.hash === `#invoices?id=${encodeURIComponent(id)}`,
  );
  await expect(page.locator('[aria-busy="true"][inert]')).toHaveCount(0);
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
  await header
    .getByRole("button", { name: "Change location", exact: true })
    .click();
  const locationDialog = page.getByRole("dialog", {
    name: "Change receiving location",
    exact: true,
  });
  await chooseOption(
    page,
    locationDialog.getByLabel("Location", { exact: true }),
    "Warehouse",
  );
  await locationDialog
    .getByRole("button", { name: "Save location", exact: true })
    .click();
  await expect(locationDialog).not.toBeVisible();
  await expect(header).toContainText("Warehouse");
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
  const count = await page
    .locator('[data-testid^="invoice-line-row-"]')
    .count();
  for (let index = 0; index < count; index++) {
    const line = await openInvoiceLine(page, index);
    await line
      .getByRole("group", { name: "Track date", exact: true })
      .getByRole("button", { name: "No", exact: true })
      .click();
    await confirmInvoiceLine(page, line);
    await expect(page.getByTestId(`invoice-line-row-${index}`)).toContainText(
      "Confirmed ✓",
    );
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
  // E1 always renders the person's permitted Location picker in the topbar.
  // Received itself still offers no wider location filter to this worker.
  await expect(
    page
      .locator(".received-filters")
      .getByRole("combobox", { name: "Location", exact: true }),
  ).toHaveCount(0);
  const ownLocation = page
    .locator(".topbar")
    .getByRole("combobox", { name: "Location", exact: true });
  await expect(ownLocation).toHaveText("North York");
  await ownLocation.click();
  await expect(page.getByRole("option")).toHaveText(["North York"]);
  await expect(
    page.getByRole("option", { name: "Warehouse", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
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
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Move invoice", exact: true })
    .click();
  await expect(
    dialog.getByRole("alert", { name: "What's missing", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Reason", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect((await saved(page)).ledger).toEqual(before.ledger);
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
  const warehouseLocation = page
    .locator(".received-table")
    .getByText("Warehouse", { exact: true })
    .first();
  if (!(await warehouseLocation.isVisible()))
    await page.locator(".received-table .table-details-toggle").first().click();
  await expect(warehouseLocation).toBeVisible();
  await page.reload();
  expect(
    (await saved(page)).invoice_location_corrections?.at(-1)?.to_branch,
  ).toBe("Warehouse");
});

test("invoice changed regular cost defaults to calculated and explicit Keep preserves the approved price on posting", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  const editor = await openC8PriceDialog(page, "0002");
  await editor.getByRole("radio", { name: /^New regular price/ }).check();
  await editor.getByLabel("Price", { exact: true }).fill("2.79");
  await editor
    .getByRole("checkbox", {
      name: "Add regular labels to the label waitlist",
      exact: true,
    })
    .uncheck();
  await editor
    .getByRole("button", { name: "Save new price", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await expect
    .poll(
      async () =>
        (await saved(page)).products.find((entry) => entry.code === "0002")
          ?.manual_prices?.all.price,
    )
    .toBe("2.79");
  await manualInvoice(page);
  const line = await openInvoiceLine(page, 0);
  await line.getByLabel("Unit cost before tax", { exact: true }).fill("1.4000");
  await expect(
    line.getByRole("group", { name: "Manual price decision", exact: true }),
  ).toBeVisible();
  await expect(
    line.getByText("Approved:", { exact: true }).locator(".."),
  ).toContainText("$2.79");
  await expect(
    line.getByRole("button", {
      name: "Confirm line",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    line.getByRole("button", {
      name: "Use the new calculated price $1.99",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await line.getByRole("button", { name: "Keep $2.79", exact: true }).click();
  await line
    .getByRole("group", { name: "Track date", exact: true })
    .getByRole("button", { name: "No", exact: true })
    .click();
  await confirmInvoiceLine(page, line);
  await expect(page.getByTestId("invoice-line-row-0")).toContainText(
    "Confirmed ✓",
  );
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await expect
    .poll(async () => (await saved(page)).invoice.status)
    .toBe("posted");
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
  ).toEqual([
    expect.objectContaining({
      type: "price_change",
      product_code: "0002",
      status: "pending",
      current_price: "2.79",
      proposed_price: "1.99",
      unit_cost: "1.4000",
      manual_price_review: expect.objectContaining({
        kept_price: "2.79",
        calculated_price: "1.99",
        receiver_recommendation: "keep",
      }),
    }),
  ]);
});
