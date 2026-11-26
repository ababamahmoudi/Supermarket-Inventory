import { expect, test } from "@playwright/test";
import {
  answerCreditsOnInvoiceTotal,
  openReceivingLine,
} from "./r2-receiving-helpers";
import { openPr29Invoice, pr29Number } from "./pr29-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

/**
 * PR 29 (Ali, 2026-11-20): after posting an invoice and marking a price
 * update Done, History lists both actions with who and when. Fictional data.
 */
test("History shows the posted invoice and the Done price update with who and when", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "One walk is enough.");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPr29Invoice(page, "en");
  await page
    .locator(".receiving-bulk-bar .receiving-new-category-action")
    .click();
  const categories = page.getByRole("dialog");
  await categories.getByRole("combobox").click();
  await page.getByRole("option", { name: "Grocery", exact: true }).click();
  await categories
    .getByRole("button", { name: "Set category", exact: true })
    .click();
  await answerCreditsOnInvoiceTotal(page);
  await page
    .getByTestId("invoice-details-card")
    .getByRole("button", { name: "Looks right: Invoice details" })
    .click();
  await page.locator(".receiving-confirm-ready").click();
  const editor = await openReceivingLine(page, 1);
  await editor
    .getByRole("button", { name: "Confirm line", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await readCanonicalBusinessEvidence(page)).invoice.lines.every(
        (line) => line.review_confirmed,
      ),
    )
    .toBe(true);
  await page
    .locator(".receiving-post-control:visible")
    .getByRole("button")
    .click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await expect(page.locator(".invoice-posted-workspace")).toBeVisible();

  // Approving one of its new products creates a price update to apply.
  await page.goto("/#approvals");
  const card = page
    .locator("section.card")
    .filter({ has: page.getByRole("button", { name: "Approve product" }) })
    .first();
  await card
    .getByRole("button", { name: "Approve product", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve product", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/#price-updates");
  await page.locator(".price-update-open").first().click();
  await page.getByRole("button", { name: "Mark as done", exact: true }).click();
  await expect
    .poll(async () =>
      (await readCanonicalBusinessEvidence(page)).price_update_tasks?.some(
        (task) => task.status === "done",
      ),
    )
    .toBe(true);

  await page.goto("/#history");
  const table = page.locator(".history-card");
  for (const action of ["Posted invoice", "Complete price update"]) {
    const row = table.locator("tbody tr").filter({ hasText: action }).first();
    await expect(row, action).toBeVisible();
    await expect(row).toContainText("Demo Owner");
    await expect(row).toContainText(/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}/);
  }
  await expect(
    table.locator("tbody tr").filter({ hasText: "Posted invoice" }).first(),
  ).toContainText(pr29Number);
});
