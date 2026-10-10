import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import Decimal from "decimal.js";
import { chooseOption, setBranch, signIn } from "./helpers";
import { inspect, type C5Inspection } from "../scripts/c5-browser-proof.mjs";

test.setTimeout(180000);
test.use({ actionTimeout: 10000 });
const reports = new WeakMap<Page, C5Inspection[]>();

async function measure(page: Page, screen: string, role = "supervisor") {
  const observation = await inspect(
    page,
    screen,
    `${test.info().project.name}-en-light`,
    role,
  );
  const observations = reports.get(page) ?? [];
  observations.push(observation);
  reports.set(page, observations);
  expect.soft(observation.failures, screen).toEqual([]);
}

test.afterEach(async ({ page }, info) => {
  const observations = reports.get(page) ?? [];
  const path = info.outputPath("button-audit.json");
  await writeFile(path, JSON.stringify(observations, null, 2) + "\n");
  await info.attach("Conditional rendered button audit", {
    path,
    contentType: "application/json",
  });
});

test("C5 conditional request decisions and later lifecycle actions", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#requests");
  await page.getByRole("button", { name: "New request", exact: true }).click();
  await chooseOption(
    page,
    page.getByLabel("Sending location", { exact: true }),
    "Warehouse",
  );
  await page.getByLabel("Search products", { exact: true }).fill("0003");
  await measure(page, "Request catalog search result", "floor_worker");
  await page
    .locator(".request-search-results")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page
    .locator(".request-draft-line")
    .first()
    .getByLabel("Quantity", { exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const reference = await page.locator(".request-detail h2").innerText();
  await measure(page, "Requested branch request", "floor_worker");
  await signIn(page, "Supervisor");
  await setBranch(page, "Warehouse");
  await page.goto("/#requests");
  await page.getByRole("tab", { name: "Incoming", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: reference })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page.getByRole("button", { name: "Short", exact: true }).click();
  await page.getByLabel("Quantity being sent", { exact: true }).fill("1");
  await measure(page, "Request Short decision and Mark as sent");
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.locator(".request-detail-heading .badge")).toContainText(
    "Sent",
  );
  await signIn(page, "Floor Worker");
  await page.goto("/#requests");
  await page
    .getByRole("row")
    .filter({ hasText: reference })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page.getByRole("button", { name: "Missing", exact: true }).click();
  await page.getByLabel("Quantity arrived", { exact: true }).fill("0");
  await measure(
    page,
    "Request Missing decision and Mark as received",
    "floor_worker",
  );
  await page
    .getByRole("button", { name: "Mark as received", exact: true })
    .click();
  await expect(page.locator(".request-detail-heading .badge")).toContainText(
    "Received",
  );
  await measure(page, "Received request and Close request", "floor_worker");
  await page
    .getByRole("button", { name: "Close request", exact: true })
    .click();
  await measure(
    page,
    "Closed request and residual-copy action",
    "floor_worker",
  );
  await page
    .getByRole("button", { name: "Copy short or missing items", exact: true })
    .click();
  await measure(page, "Copied short or missing draft", "floor_worker");
});

test("C5 conditional reauthentication dialog", async ({ page }) => {
  await signIn(page, "Supervisor");
  await page.goto("/#settings");
  // Reproduce the existing real-session expiry recipe without altering demo data.
  await page.evaluate(() => {
    const key = "supermarket-prototype-session-v2";
    const session = JSON.parse(sessionStorage.getItem(key)!);
    session.authenticatedAt = Date.now() - 16 * 60 * 1000;
    session.lastActivityAt = Date.now();
    sessionStorage.setItem(key, JSON.stringify(session));
  });
  await page.reload();
  const dialog = page.getByRole("dialog", {
    name: "Confirm your password",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await measure(page, "Expired session reauthentication dialog");
  await dialog.getByLabel("Password", { exact: true }).fill("demo1234");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("C5 conditional label selection, template restore, and print confirmation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await signIn(page, "Floor Worker");
  await page.goto("/#labels");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await measure(page, "Saved label template archive action", "floor_worker");
  await page
    .getByRole("button", { name: "Archive template", exact: true })
    .click();
  await measure(page, "Archived label template restore action", "floor_worker");
  await page
    .getByRole("button", { name: "Restore template", exact: true })
    .click();
  // The recent template actions have real, temporary Undo toasts. Leave their
  // hover area and wait for expiry before the lower product action is clicked.
  await page.mouse.move(0, 0);
  await expect(page.locator(".undo-toast-stack")).not.toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("tab", { name: "Products", exact: true }).click();
  await page.getByLabel("Search products", { exact: true }).fill("0003");
  await page
    .getByRole("checkbox", { name: "Select product 0003", exact: true })
    .check();
  await measure(
    page,
    "Selected product add-to-waitlist action",
    "floor_worker",
  );
  await page
    .getByRole("button", { name: "Add 1 product to waitlist", exact: true })
    .click();
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
  await measure(page, "Waitlist with printable label copies", "floor_worker");
  await page.getByRole("button", { name: "Print labels", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Did the labels print correctly?",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await measure(page, "Label print confirmation Yes and No", "floor_worker");
  await dialog.getByRole("button", { name: "No", exact: true }).click();
});

test("C5 conditional note editing and seen/done/open actions", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#notes");
  await page.getByRole("tab", { name: /^Deli temperatures(?: \d+)?$/ }).click();
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page
    .getByLabel("Note", { exact: true })
    .fill("C5 conditional presentation review note");
  await page.getByLabel("Measurement (°C)", { exact: true }).fill("3.4");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const card = page
    .locator("[data-notebook-entry]")
    .filter({ hasText: "C5 conditional presentation review note" });
  await measure(page, "Notebook entry Edit note action");
  await card.getByRole("button", { name: "Edit note", exact: true }).click();
  await measure(page, "Edit notebook entry form");
  await page
    .getByRole("form", { name: "Edit note", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("tab", { name: /For Supervisor/ }).click();
  await measure(page, "Supervisor note Mark seen and Mark done actions");
  await page
    .getByRole("button", { name: "Mark seen", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Mark done", exact: true })
    .first()
    .click();
  await page
    .getByRole("checkbox", {
      name: "Include done and ordered notes",
      exact: true,
    })
    .check();
  await measure(page, "Completed notebook entry Mark open action");
});

test("C5 conditional saved order and print/cancel dialogs", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await page.goto("/#orders");
  await page.getByRole("button", { name: "New order", exact: true }).click();
  const form = page.getByRole("form", { name: "New order", exact: true });
  await chooseOption(
    page,
    form.getByLabel("Supplier", { exact: true }),
    "Fresh Valley Foods",
  );
  await form
    .locator(".order-items-table tbody tr")
    .first()
    .getByLabel(/^Cases —/)
    .fill("1");
  await form
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await expect(page.locator(".order-detail-card")).toBeVisible();
  await measure(page, "Saved order Place/Edit/Print/Cancel actions");
  await page.getByRole("button", { name: "Print order", exact: true }).click();
  await measure(page, "Saved order print preview dialog");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await measure(page, "Cancel order Keep order confirmation");
  await page.keyboard.press("Escape");
});

test("C5 conditional correction preview, confirmation, versions, history menu and Revert", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await page.goto("/#invoices?id=a2-fixture%3AFV-20390");
  await page
    .getByRole("button", { name: "Correct invoice", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Correct invoice",
    exact: true,
  });
  const cost = dialog
    .locator(".invoice-correction-line")
    .first()
    .getByLabel("Unit cost before tax", { exact: true });
  await cost.fill(
    new Decimal(await cost.inputValue()).plus("0.5000").toFixed(4),
  );
  await dialog
    .getByLabel("Reason (required)", { exact: true })
    .fill("Review the corrected fictional unit cost.");
  await dialog
    .getByRole("button", { name: "Preview correction", exact: true })
    .click();
  await measure(page, "Invoice correction preview Continue/Back actions");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await measure(page, "Invoice correction final confirmation");
  await dialog
    .getByRole("button", { name: "Confirm correction", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await measure(page, "Corrected posted invoice version actions");
  await page.goto("/#history");
  const corrected = page
    .locator(".history-table tbody tr")
    .filter({ hasText: "Correct invoice" })
    .first();
  await corrected
    .getByRole("button", { name: "More actions", exact: true })
    .click();
  await measure(page, "Corrected History More actions menu");
  await page.keyboard.press("Escape");
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await page.getByRole("button", { name: /^Edit Potato Chips/ }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor
    .getByLabel("English name", { exact: true })
    .fill("Potato Chips 150 g presentation audit edit");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await page.goto("/#history");
  await page
    .locator(".history-table tbody tr")
    .filter({ hasText: "Save product" })
    .first()
    .getByRole("button", { name: "Revert", exact: true })
    .click();
  await measure(page, "Revert History change confirmation");
});

test("C5 conditional supplier-held return cancellation review actions", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#return?id=demo-return-2");
  await page
    .getByRole("button", { name: "Request cancellation", exact: true })
    .click();
  await chooseOption(
    page,
    page.getByLabel("Actual disposition", { exact: true }),
    "supplier_held",
    "Supplier still holds originals — restore zero",
  );
  await page
    .getByLabel("Cancellation reason (required)", { exact: true })
    .fill("Supplier still holds the originals; retain the replacement.");
  await measure(
    page,
    "Return cancellation disposition submission",
    "floor_worker",
  );
  await page
    .getByRole("button", {
      name: "Record cancellation disposition",
      exact: true,
    })
    .click();
  await measure(
    page,
    "Return cancellation awaiting Supervisor",
    "floor_worker",
  );
  await signIn(page, "Supervisor");
  await page.goto("/#return?id=demo-return-2");
  await measure(page, "Supervisor cancellation approve/decline review");
});
