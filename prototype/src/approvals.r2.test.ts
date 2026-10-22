import { describe, expect, it } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { initialState } from "./store";
import { approvalBoard } from "./approval-board";
import { calculatePrice } from "./pricing";
import {
  approvalSnapshot,
  approveInvoiceApprovals,
  changeApprovalCategory,
  resolveApproval,
  resubmitApproval,
} from "./approvals";
import type { Approval } from "./types";

function setup() {
  const state = initialState();
  const company_id = state.config.company.seed_key;
  state.activity = [];
  const actor = authenticatedTestActor(state, "manager", {
    selection: { kind: "location", location_id: "Branch 1" },
  });
  state.approvals = state.products
    .slice(0, 3)
    .map((product, index): Approval => ({
      id: `r2-approval-${index}`,
      company_id,
      branch: "Branch 1",
      type: "price_change",
      status: "pending",
      product_code: product.code,
      proposed_price: "3.49",
      unit_cost: "2.0000",
      source_invoice_id: "r2-fictional-invoice",
      invoice_ids: ["r2-fictional-invoice"],
    }));
  return { state, actor };
}

describe("R2 invoice approvals", () => {
  it("approves only ticked products and retains the unticked pending request", () => {
    const { state, actor } = setup();
    approveInvoiceApprovals(state, actor, ["r2-approval-0", "r2-approval-2"]);
    expect(state.approvals.map((item) => item.status)).toEqual([
      "approved",
      "pending",
      "approved",
    ]);
    expect(
      state.activity.filter((item) => item.action === "Approve price"),
    ).toHaveLength(2);
  });

  it("rejects a mixed-invoice or changed batch without partially approving", () => {
    const { state, actor } = setup();
    state.approvals[1].source_invoice_id = "another-invoice";
    expect(() =>
      approveInvoiceApprovals(state, actor, ["r2-approval-0", "r2-approval-1"]),
    ).toThrow("one invoice");
    expect(state.approvals.every((item) => item.status === "pending")).toBe(
      true,
    );
    expect(() => approveInvoiceApprovals(state, actor, [])).toThrow(
      "Select at least one",
    );
  });

  it("enforces manager authority and company scope for batch, category and resubmission", () => {
    const { state } = setup();
    const worker = authenticatedTestActor(state, "floor_worker");
    expect(() =>
      approveInvoiceApprovals(state, worker, ["r2-approval-0"]),
    ).toThrow();
    expect(() =>
      changeApprovalCategory(state, worker, "r2-approval-0", "rice"),
    ).toThrow();
    state.approvals[0].status = "rejected";
    expect(() =>
      resubmitApproval(state, worker, "r2-approval-0", { category: "rice" }),
    ).toThrow();
    const manager = authenticatedTestActor(state, "manager");
    state.approvals[0].company_id = "another-company";
    expect(() =>
      resubmitApproval(state, manager, "r2-approval-0", { category: "rice" }),
    ).toThrow();
  });

  it("recalculates a pending category with the pricing engine and invalidates its old preview", () => {
    const { state, actor } = setup();
    const proposal = state.approvals[0];
    const product = state.products.find(
      (item) => item.code === proposal.product_code,
    )!;
    const oldCategory = product.pricing_category;
    const snapshot = approvalSnapshot(state, actor, product.code);
    const result = changeApprovalCategory(state, actor, proposal.id, "rice");
    const expected = calculatePrice("2.0000", "rice", state.config);
    expect(result.proposed_price).toBe(expected.selling_price);
    expect(result.margin).toBe(expected.margin);
    expect(product.pricing_category).toBe(oldCategory);
    expect(approvalSnapshot(state, actor, product.code)).not.toBe(snapshot);
    expect(state.activity.at(-1)?.action).toBe("Change approval category");
    resolveApproval(state, actor, result.id, "approve", "all", "Branch 1");
    expect(product.pricing_category).toBe("rice");
    expect(product.selling_price).toBe(expected.selling_price);
  });

  it("retains rejection evidence and links a corrected new pending request in both directions", () => {
    const { state, actor } = setup();
    const rejected = state.approvals[0];
    rejected.type = "new_product";
    const product = state.products.find(
      (item) => item.code === rejected.product_code,
    )!;
    product.selling_price = "";
    product.branch_prices = {};
    resolveApproval(state, actor, rejected.id, "reject", "all", "Branch 1");
    const decidedAt = rejected.decided_at;
    const corrected = resubmitApproval(state, actor, rejected.id, {
      category: "rice",
    });
    expect(rejected.status).toBe("rejected");
    expect(rejected.decided_at).toBe(decidedAt);
    expect(rejected.resubmitted_as_id).toBe(corrected.id);
    expect(corrected.resubmitted_from_id).toBe(rejected.id);
    expect(corrected.status).toBe("pending");
    expect(corrected.decided_at).toBeUndefined();
    expect(product.status).toBe("pending_approval");
    expect(state.activity.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["Reject proposal", "Resubmit approval"]),
    );
    expect(() => resubmitApproval(state, actor, rejected.id, {})).toThrow(
      "already been resubmitted",
    );
  });

  it("requires a reason below the pricing minimum and keeps the chosen corrected price pending", () => {
    const { state, actor } = setup();
    const rejected = state.approvals[0];
    resolveApproval(state, actor, rejected.id, "reject", "all", "Branch 1");
    expect(() =>
      resubmitApproval(state, actor, rejected.id, { price: "0.01" }),
    ).toThrow("reason");
    const corrected = resubmitApproval(state, actor, rejected.id, {
      price: "1.99",
      reason: "Fictional damaged packaging adjustment",
    });
    expect(corrected.proposed_price).toBe("1.99");
    expect(corrected.manual_override).toBe(true);
    expect(corrected.status).toBe("pending");
  });

  it("never exposes old supplier tasks in the approvals board", () => {
    const { state, actor } = setup();
    state.approvals.push({
      ...state.approvals[0],
      id: "old-supplier-task",
      type: "new_supplier",
      product_code: "",
    });
    expect(
      approvalBoard(state, actor).some(
        (row) => row.approval.type === "new_supplier",
      ),
    ).toBe(false);
  });
});
