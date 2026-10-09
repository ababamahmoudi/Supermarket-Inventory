import { expect, it } from "vitest";
import { initialState } from "./store";
import { previousReceiptCost } from "./invoice";

it("does not borrow the original demo purchase baseline for another configured company", () => {
  const state = initialState();
  state.invoices = [];
  const line = state.invoice.lines.find((row) => row.product_code === "0002")!;
  delete line.supplier_item_id;
  delete line.supplier_item_code;
  expect(previousReceiptCost(state, line.product_code, line)).not.toBeNull();

  const company = "independent-market";
  state.config.company.seed_key = company;
  state.invoice.company_id = company;
  state.invoice.lines.forEach((row) => (row.company_id = company));
  state.products.forEach((row) => (row.company_id = company));
  state.suppliers?.forEach((row) => (row.company_id = company));
  expect(previousReceiptCost(state, line.product_code, line)).toBeNull();
});
