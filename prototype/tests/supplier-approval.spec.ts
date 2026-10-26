import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Page } from "@playwright/test";
import { chooseOption, signIn, uploadInvoice } from "./helpers";

async function quickAddSupplier(page: Page, name: string) {
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  const previousInvoiceId = (await readCanonicalBusinessEvidence(page)).invoice
    .id;
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New invoice", exact: true })
    .getByRole("button", { name: "Photo (AI reading)", exact: true })
    .click();
  await expect(page).toHaveURL((url) => {
    const [route, parameters] = url.hash.slice(1).split("?");
    const id = new URLSearchParams(parameters).get("id");
    return route === "invoices" && Boolean(id && id !== previousInvoiceId);
  });
  const acceptedInvoiceId = new URLSearchParams(
    new URL(page.url()).hash.split("?")[1],
  ).get("id");
  // Wait for this accepted draft's retained original and completed reading,
  // rather than treating the native file-input change as completed review.
  await uploadInvoice(page);
  expect((await readCanonicalBusinessEvidence(page)).invoice.id).toBe(
    acceptedInvoiceId,
  );
  await expect(page.locator("#invoice-details-fields")).toBeVisible();
  await chooseOption(
    page,
    page.locator("#invoice-supplier"),
    "__add_supplier",
    "+ Add supplier",
  );
  const dialog = page.getByRole("dialog", {
    name: "Add supplier",
    exact: true,
  });
  await dialog.getByLabel("Supplier name", { exact: true }).fill(name);
  await expect(
    dialog.getByLabel("Opening balance", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Add supplier", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const state = await readCanonicalBusinessEvidence(page);
  const supplier = state.suppliers!.find((record) => record.name === name)!;
  expect(supplier).toMatchObject({
    status: "confirmed",
    active: true,
    phone: "",
    email: "",
    notes: "",
  });
  expect(
    state.approvals.filter((record) => record.supplier_id === supplier.id),
  ).toEqual([]);
  expect(state.invoice.supplier_confirmed).toBe(true);
  await expect(
    page.getByRole("button", { name: "Confirm supplier", exact: true }),
  ).toHaveCount(0);
  return supplier;
}

test("worker's name-only supplier is active immediately and absent from Approvals and Dashboard work", async ({
  page,
}) => {
  const supplier = await quickAddSupplier(page, "Orchard Immediate Supply");
  await signIn(page, "Supervisor");
  await page.goto("/#approvals");
  await expect(
    page.getByRole("heading", { name: "Approvals", level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".supplier-approval-card")).toHaveCount(0);
  await page.goto("/#dashboard");
  await expect(
    page.getByRole("heading", { name: /dashboard$/, level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-supplier-approval")).toHaveCount(0);
  const state = await readCanonicalBusinessEvidence(page);
  expect(
    state.suppliers!.find((record) => record.id === supplier.id),
  ).toMatchObject({ status: "confirmed", active: true });
  expect(
    state.approvals.some((record) => record.supplier_id === supplier.id),
  ).toBe(false);
});

test("profile notification opens its editor, clears when completed, and does not repeat", async ({
  page,
}) => {
  const supplier = await quickAddSupplier(page, "Orchard Profile Supply");
  await signIn(page, "Supervisor");
  await page.getByRole("button", { name: /^Notifications, / }).click();
  const notification = page
    .getByRole("menuitem")
    .filter({
      has: page.getByText("Complete supplier profile", { exact: true }),
    })
    .filter({ has: page.getByText(supplier.name, { exact: true }) });
  await expect(notification).toHaveCount(1);
  await notification.click();
  const dialog = page.getByRole("dialog", {
    name: "Edit supplier",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Supplier name", { exact: true })).toHaveValue(
    supplier.name,
  );
  await dialog
    .getByLabel("Phone (optional)", { exact: true })
    .fill("416-555-0173");
  await dialog
    .getByLabel("Email (optional)", { exact: true })
    .fill("orders@example.test");
  await dialog
    .getByLabel("Sales representative (optional)", { exact: true })
    .fill("Orchard Representative");
  await dialog
    .getByLabel("Sales rep phone (optional)", { exact: true })
    .fill("416-555-0174");
  await chooseOption(
    page,
    dialog.getByLabel("Payment terms (optional)", { exact: true }),
    "30",
    "Net 30 (30 days)",
  );
  await dialog
    .getByLabel("Address (optional)", { exact: true })
    .fill("1 Fictional Way");
  await dialog
    .getByRole("button", { name: "Save supplier", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page
      .locator(".supplier-detail-header")
      .getByText("Active", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Notifications, / }).click();
  await expect(notification).toHaveCount(0);
  const state = await readCanonicalBusinessEvidence(page);
  const notifications = state.notifications!.filter(
    (row) => row.supplier_id === supplier.id,
  );
  expect(new Set(notifications.map((row) => row.recipient_user_id)).size).toBe(
    notifications.length,
  );
});
