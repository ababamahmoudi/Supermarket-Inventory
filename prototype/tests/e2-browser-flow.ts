import { expect, type Page } from "@playwright/test";
import { signIn, setBranch, openAlert } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
export async function route(page: Page, hash: string) {
  await page.evaluate((value) => {
    window.location.hash = value;
  }, hash);
  await expect(page.locator("main h1")).toBeVisible();
}
export async function applyBlackTeaAcrossStores(page: Page) {
  await signIn(page, "Manager");
  await setBranch(page, "all");
  await route(page, "alerts");
  await openAlert(page, "Black Tea");
  const card = page
    .locator("main .card")
    .filter({ hasText: "Black Tea" })
    .filter({
      has: page.getByRole("button", {
        name: "Apply this price to all",
        exact: true,
      }),
    })
    .first();
  const northYork = card.getByRole("row").filter({ hasText: "North York" });
  await northYork
    .getByRole("button", { name: "Apply this price to all", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Apply price to all branches", exact: true })
    .getByRole("button", { name: "Apply price to all branches", exact: true })
    .click();
  await expect
    .poll(async () => {
      const state = await readCanonicalBusinessEvidence(page);
      return (state.price_update_tasks ?? []).filter(
        (row) => row.status === "pending",
      ).length;
    })
    .toBeGreaterThan(0);
  const state = await readCanonicalBusinessEvidence(page);
  const product = state.products.find((row) =>
    row.name_en.startsWith("Black Tea"),
  );
  if (!product) throw new Error("Configured Black Tea is missing");
  const task = state.price_update_tasks?.find(
    (row) =>
      row.product_code === product.code &&
      row.branch === "Branch 2" &&
      row.status === "pending",
  );
  if (!task)
    throw new Error("Richmond Hill's actual price-update task was not created");
  return { task, product };
}
