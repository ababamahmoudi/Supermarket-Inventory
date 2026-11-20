import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { approvalBoard } from "./approval-board";
import { chooseLowerApprovalPrice, resolveApproval } from "./approvals";
import { effectivePrice } from "./catalog";
import {
  companyDate,
  createInvoice,
  postInvoice,
  recalculateInvoice,
} from "./invoice";
import { confirmInvoiceLineChecks } from "./invoice-checks";
import { initialState } from "./store";
import type { DemoState } from "./types";

const manager = (state: DemoState) =>
  authenticatedTestActor(state, "manager", {
    name_en: "Fictional Decider",
    username: "fictional-decider",
  });
const worker = (state: DemoState) =>
  authenticatedTestActor(state, "floor_worker", {
    name_en: "Fictional Receiver",
    username: "fictional-receiver",
  });

/** Post one fictional receipt where product 0002 (Grocery) costs `cost`. */
function posted(cost: string) {
  const state = initialState();
  state.invoice = createInvoice(state, worker(state), "Branch 1");
  Object.assign(state.invoice, {
    file_name: "fictional-use-lower.png",
    file_type: "image/png",
    file_data: "data:image/png;base64,ZmljdGlvbmFs",
    lower_price_answers: { same_expiry: "unknown", note: "Fictional." },
  });
  const line = state.invoice.lines.find((row) => row.product_code === "0002")!;
  line.unit_cost_before_tax = cost;
  if (line.quantity_unit === "cases")
    line.case_cost_before_tax = new Decimal(cost)
      .times(line.units_per_case!)
      .toFixed(4);
  recalculateInvoice(state.invoice, state.config);
  state.invoice.lines.forEach((row, index) => {
    confirmInvoiceLineChecks(state, worker(state), index, true);
    row.date_confirmed = true;
    if (row.date_tracking)
      row.date_value = new Date(
        new Date(`${companyDate(state.config)}T12:00:00Z`).getTime() +
          180 * 86400000,
      )
        .toISOString()
        .slice(0, 10);
  });
  expect(postInvoice(state, worker(state))).toBe(true);
  const approval = state.approvals.find(
    (row) =>
      row.product_code === "0002" &&
      row.status === "pending" &&
      row.type === "price_change",
  )!;
  return { state, approval };
}

describe("a store correction is a suggestion in Approvals", () => {
  it("shows deciders the lower band price and lets them use it, with attribution", () => {
    const { state, approval } = posted("1.60");
    const product = state.products.find((row) => row.code === "0002")!;
    const before = effectivePrice(state, product, "Branch 1");
    expect(approval.proposed_price).toBe("2.99");
    const row = () =>
      approvalBoard(state, manager(state)).find(
        (item) => item.approval.id === approval.id,
      )!;
    expect(row().roundedUp).toEqual({ from: "2.49", meets_margin: true });
    expect(() =>
      chooseLowerApprovalPrice(state, worker(state), approval.id),
    ).toThrow();
    chooseLowerApprovalPrice(state, manager(state), approval.id);
    expect(approval).toMatchObject({
      status: "pending",
      proposed_price: "2.49",
      manual_override: true,
    });
    expect(effectivePrice(state, product, "Branch 1")).toBe(before);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Use lower price",
      by: "Fictional Decider",
      product_code: "0002",
    });
    expect(row().roundedUp).toBeNull();
    expect(() =>
      chooseLowerApprovalPrice(state, manager(state), approval.id),
    ).toThrow("not rounded up");
    resolveApproval(
      state,
      manager(state),
      approval.id,
      "approve",
      "branch",
      "Branch 1",
    );
    expect(effectivePrice(state, product, "Branch 1")).toBe("2.49");
  });

  it("offers nothing for a .49 that the rule does not raise", () => {
    const { state, approval } = posted("3.00");
    expect(approval.proposed_price).toBe("4.49");
    expect(
      approvalBoard(state, manager(state)).find(
        (item) => item.approval.id === approval.id,
      )!.roundedUp,
    ).toBeNull();
    expect(() =>
      chooseLowerApprovalPrice(state, manager(state), approval.id),
    ).toThrow("not rounded up");
  });
});
