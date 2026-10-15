import { expect, it } from "vitest";
import { initialState } from "./store";
import { lowerPriceLineIndexes, previousReceiptCost } from "./invoice";
import { authenticatedTestActor } from "./authority-test-fixture";

it("does not borrow the original demo purchase baseline for another configured company", () => {
  const state = initialState();
  state.invoices = [];
  const lineIndex = state.invoice.lines.findIndex(
    (row) => row.product_code === "0002",
  );
  const line = state.invoice.lines[lineIndex];
  delete line.supplier_item_id;
  delete line.supplier_item_code;
  line.unit_cost_before_tax = "0.0001";
  const manager = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
  });
  // The retained calculation hint stays private; it is never fictional public receipt evidence.
  expect(
    previousReceiptCost(state, manager, line.product_code, line),
  ).toBeNull();
  expect(lowerPriceLineIndexes(state, manager)).toContain(lineIndex);

  const other = structuredClone(state);
  const company = "independent-market";
  other.config.company.seed_key = company;
  other.invoice.company_id = company;
  other.invoice.lines.forEach((row) => (row.company_id = company));
  other.products.forEach((row) => (row.company_id = company));
  other.suppliers?.forEach((row) => (row.company_id = company));
  const otherManager = authenticatedTestActor(other, "manager", {
    locations: ["Branch 1"],
  });
  const otherLine = other.invoice.lines[lineIndex];
  expect(
    previousReceiptCost(other, otherManager, otherLine.product_code, otherLine),
  ).toBeNull();
  expect(lowerPriceLineIndexes(other, otherManager)).not.toContain(lineIndex);
});
