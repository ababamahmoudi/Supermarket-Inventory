import { expect, test, type Page } from "@playwright/test";
import { chooseOption, signIn } from "./helpers";

const storage = "supermarket-prototype-v1";
async function proposeSupplier(page: Page, name: string) {
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  if (!(await page.locator("#invoice-details-fields").isVisible()))
    await page
      .getByRole("button", { name: "Invoice details", exact: true })
      .click();
  await chooseOption(
    page,
    page
      .locator("#invoice-details-fields")
      .getByLabel("Supplier", { exact: true }),
    "__add_supplier",
    "+ Add supplier",
  );
  const dialog = page.getByRole("dialog", {
    name: "Add supplier",
    exact: true,
  });
  await dialog.getByLabel("Supplier name", { exact: true }).fill(name);
  await dialog.getByLabel("Phone", { exact: true }).fill("416-555-0173");
  await dialog.getByLabel("Payment terms", { exact: true }).fill("Net 30");
  await dialog
    .getByRole("button", { name: "Add supplier", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
}

test("Supervisor confirms a worker supplier from Approvals without product-price fields", async ({
  page,
}) => {
  await proposeSupplier(page, "Orchard Confirmation Supply");
  await signIn(page, "Supervisor");
  await page.goto("/#approvals");
  const card = page.locator(".supplier-approval-card").filter({
    has: page.getByRole("heading", {
      name: "Orchard Confirmation Supply",
      exact: true,
    }),
  });
  await expect(
    card.getByText("Supplier waiting for confirmation", { exact: true }),
  ).toBeVisible();
  await expect(card.getByText("416-555-0173", { exact: true })).toBeVisible();
  await expect(card.getByText("Old price", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Unit cost", { exact: true })).toHaveCount(0);
  await card
    .getByRole("button", { name: "Confirm supplier", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Confirm supplier",
    exact: true,
  });
  await expect(dialog.getByText("Net 30", { exact: true })).toBeVisible();
  await expect(
    dialog.getByLabel("Apply price to", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Confirm supplier", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storage,
  );
  const supplier = saved.suppliers.find(
    (record: { name: string }) => record.name === "Orchard Confirmation Supply",
  );
  expect(supplier.status).toBe("confirmed");
  expect(saved.invoice.supplier_confirmed).toBe(true);
  expect(
    saved.approvals.find(
      (record: { supplier_id: string }) => record.supplier_id === supplier.id,
    ).status,
  ).toBe("approved");
  expect(
    saved.activity.find(
      (record: { action: string }) => record.action === "Confirm supplier",
    ).by,
  ).toBe("Demo Supervisor");
  await page.getByRole("tab", { name: "Approved", exact: true }).click();
  await expect(
    page
      .locator(".supplier-approval-card")
      .getByText("Confirmed", { exact: true }),
  ).toBeVisible();
});

test("Supervisor rejects a worker supplier from the dashboard and keeps its invoice blocked", async ({
  page,
}) => {
  await proposeSupplier(page, "Orchard Rejection Supply");
  await signIn(page, "Supervisor");
  await page.goto("/#dashboard");
  const card = page.locator(".dashboard-supplier-approval").filter({
    has: page.getByRole("heading", {
      name: "Orchard Rejection Supply",
      exact: true,
    }),
  });
  await expect(
    card.getByText("Supplier waiting for confirmation", { exact: true }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Reject", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Reject proposal", exact: true })
    .getByRole("button", { name: "Reject proposal", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storage,
  );
  const supplier = saved.suppliers.find(
    (record: { name: string }) => record.name === "Orchard Rejection Supply",
  );
  expect(supplier).toMatchObject({ status: "proposed", active: false });
  expect(saved.invoice.supplier).toBe(supplier.name);
  expect(saved.invoice.supplier_confirmed).toBe(false);
  expect(
    saved.approvals.find(
      (record: { supplier_id: string }) => record.supplier_id === supplier.id,
    ).status,
  ).toBe("rejected");
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Confirm supplier", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".supplier-approval-card")).toHaveCount(0);
});
