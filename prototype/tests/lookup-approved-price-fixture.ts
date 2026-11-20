import type { Page } from "@playwright/test";
import { runCanonicalBusinessFixture } from "./business-fixture";

/** Explicit prior branch approvals for display tests, installed by a real Manager.
 * No company price, cost, pending proposal, invoice or sale is changed. */
export async function approvedLookupPrices(page: Page, codes: string[]) {
  await runCanonicalBusinessFixture(
    page,
    (state, selected) => {
      for (const code of selected) {
        const product = state.products.find(
          (row) =>
            row.company_id === state.config.company.seed_key &&
            row.code === code &&
            row.status !== "archived",
        );
        if (!product?.selling_price)
          throw new Error(`Missing approved-price fixture: ${code}`);
        product.branch_prices = {
          ...product.branch_prices,
          "Branch 1": product.selling_price,
          "Branch 2": product.selling_price,
        };
      }
    },
    codes,
  );
  await page.reload();
}
