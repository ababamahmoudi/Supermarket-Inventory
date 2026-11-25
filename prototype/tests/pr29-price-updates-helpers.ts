import { expect, type Page } from "@playwright/test";
import { chooseOption, setBranch, signIn } from "./helpers";
import { route } from "./e2-browser-flow";

/**
 * Creates fictional pending price updates by changing demo regular prices
 * for all stores as the Manager (one task per product and store).
 */
export async function createPriceUpdates(
  page: Page,
  changes: { code: string; price: string }[] = [
    { code: "0004", price: "7.79" },
    { code: "0001", price: "29.99" },
    { code: "0003", price: "3.99" },
  ],
) {
  await page.goto("/");
  await signIn(page, "manager");
  await setBranch(page, "Branch 1");
  for (const change of changes) {
    await route(page, `product?code=${change.code}`);
    await page
      .locator(".product-header-actions")
      .getByRole("button", { name: "Change price", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Change price",
      exact: true,
    });
    await dialog.getByRole("radio", { name: /^New regular price/ }).click();
    await dialog
      .getByRole("button", { name: "All stores", exact: true })
      .click();
    await dialog.getByLabel("Price", { exact: true }).fill(change.price);
    await dialog
      .getByRole("button", { name: "Save new price", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  }
}

/** Approve the demo Lavash price for one branch so Offers shows a suggestion. */
export async function createOfferSuggestion(page: Page) {
  await page.goto("/");
  await signIn(page, "supervisor");
  await page.goto("/#approvals");
  const card = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Lavash Bread 500 g", exact: true }),
  });
  await card
    .getByRole("button", { name: "Approve price", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await chooseOption(
    page,
    dialog.getByLabel("Apply price to", { exact: true }),
    "branch",
    "This branch only",
  );
  await dialog
    .getByRole("button", { name: "Approve price", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}
