import { calculatePrice } from "./pricing";
import { branchId, branchSellsToCustomers } from "./settings";
import type { DemoState } from "./types";

/** Fresh/reset fictional practice only. Never called by saved-store migrations. */
export function seedFreshDemoApprovedPrices(state: DemoState): void {
  const locations = state.config.branches
    .map((branch, index) => branchId(branch, index))
    .filter((location) => branchSellsToCustomers(state.config, location));
  const demonstration = state.approvals.find(
    (approval) =>
      approval.type === "new_product" && approval.status === "pending",
  );
  for (const product of state.products) {
    if (
      product.company_id !== state.config.company.seed_key ||
      product.status === "archived"
    )
      continue;
    const price =
      product.selling_price ||
      product.pending_price ||
      calculatePrice(
        product.last_cost_before_tax,
        product.pricing_category,
        state.config,
      ).selling_price;
    product.branch_prices = { ...product.branch_prices };
    for (const location of locations) {
      if (
        product.code === demonstration?.product_code &&
        location === demonstration.branch
      ) {
        delete product.branch_prices[location];
        continue;
      }
      product.branch_prices[location] ||= price;
    }
  }
}
