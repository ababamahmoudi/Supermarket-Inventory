import { describe, expect, it } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { initialState } from "./store";
import { approvalBoard, approvalCategoryPreview } from "./approval-board";
import { calculatePrice } from "./pricing";
import {
  approvalSnapshot,
  approveInvoiceApprovals,
  changeApprovalCategory,
  proposeRegularPrice,
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

  it.each(["margin_review", "manual_price_review", "source_manual_request"])(
    "keeps %s decisions out of an atomic invoice batch",
    (kind) => {
      const { state, actor } = setup();
      const special = state.approvals[1];
      if (kind === "margin_review") special.type = "margin_review";
      if (kind === "manual_price_review")
        special.manual_price_review = {
          kept_price: "1.49",
          calculated_price: "0.99",
          prior_cost: "0.6000",
          received_cost: "0.7900",
          receiver_recommendation: "rule",
        };
      if (kind === "source_manual_request")
        special.source_manual_request = {
          requester_user_id: actor.user_id,
          requester_name_snapshot: actor.actor,
          requester_role_snapshot: actor.role,
          requested_at: "2026-10-22T12:00:00Z",
          entered_price: "3.49",
          price_unit: "each",
          regular_price_snapshot: null,
        };
      const before = structuredClone(state);
      expect(() =>
        approveInvoiceApprovals(state, actor, [
          state.approvals[0].id,
          special.id,
        ]),
      ).toThrow("individually");
      expect(state).toEqual(before);
    },
  );

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

  it.each([
    ["weight", "2.46"],
    ["each", "2.99"],
  ] as const)(
    "honors bands-off for %s category previews, changes and resubmission",
    (soldBy, expectedPrice) => {
      const { state, actor } = setup();
      state.config.weighed_items!.use_rounding_bands = false;
      const approval = state.approvals[0];
      const product = state.products.find(
        (item) => item.code === approval.product_code,
      )!;
      product.sold_by = soldBy;
      approval.unit_cost = "1.6000";
      expect(
        approvalCategoryPreview(state, actor, approval.id, "grocery"),
      ).toBe(expectedPrice);
      expect(
        changeApprovalCategory(state, actor, approval.id, "grocery")
          .proposed_price,
      ).toBe(expectedPrice);
      resolveApproval(state, actor, approval.id, "reject", "all", "Branch 1");
      expect(
        resubmitApproval(state, actor, approval.id, { category: "grocery" })
          .proposed_price,
      ).toBe(expectedPrice);
    },
  );

  function localManualRequest() {
    const { state, actor } = setup();
    const product = state.products[0];
    product.last_cost_before_tax = "2.0000";
    product.pricing_category = "grocery";
    product.selling_price = "4.49";
    product.branch_prices = {};
    const receipt = structuredClone(state.invoice);
    receipt.id = "r2-fictional-local-cost";
    receipt.status = "posted";
    receipt.branch = "Branch 1";
    receipt.handling_branch = "Branch 1";
    receipt.posted_at = "2026-10-22T12:00:00Z";
    receipt.lines = [
      {
        ...receipt.lines[0],
        product_code: product.code,
        unit_cost_before_tax: "10.0000",
        qty_received_at_posting: 1,
        refused_units: 0,
        short_dated: false,
      },
    ];
    state.invoice.status = "empty";
    state.invoices = [receipt];
    state.approvals = [];
    const proposer = authenticatedTestActor(state, "branch_supervisor", {
      locations: ["Branch 1"],
      selection: { kind: "location", location_id: "Branch 1" },
    });
    const request = proposeRegularPrice(
      state,
      proposer,
      product.code,
      "Branch 1",
      "3.49",
    );
    return { state, actor, product, request, receipt };
  }

  it("previews a manual request category using the same receiving-location cost as saving", () => {
    const { state, actor, request } = localManualRequest();
    const preview = approvalCategoryPreview(
      state,
      actor,
      request.id,
      "grocery",
    );
    expect(preview).toBe("15.99");
    expect(
      changeApprovalCategory(state, actor, request.id, "grocery")
        .proposed_price,
    ).toBe(preview);
  });

  it("retains live location-cost and price-snapshot safeguards when a rejected manual request is corrected", () => {
    const { state, actor, product, request, receipt } = localManualRequest();
    resolveApproval(state, actor, request.id, "reject", "all", "Branch 1");
    const rejectedEvidence = structuredClone(request.source_manual_request);
    expect(rejectedEvidence?.requester_user_id).not.toBe(actor.user_id);
    expect(() =>
      resubmitApproval(state, actor, request.id, { price: "3.49" }),
    ).toThrow("reason");
    const corrected = resubmitApproval(state, actor, request.id, {
      price: "3.49",
      reason: "Fictional clearance adjustment",
    });
    expect(corrected.unit_cost).toBe("10.0000");
    expect(corrected).toMatchObject({ actor_user_id: actor.user_id });
    expect(corrected.source_manual_request).toMatchObject({
      requester_user_id: actor.user_id,
      requester_role_snapshot: actor.role,
      regular_price_snapshot: "4.49",
      entered_price: "3.49",
      price_unit: "each",
    });
    expect(request.source_manual_request).toEqual(rejectedEvidence);
    product.selling_price = "5.49";
    expect(() =>
      resolveApproval(
        state,
        actor,
        corrected.id,
        "approve",
        "all",
        "Branch 1",
        "Reviewed",
      ),
    ).toThrow("Prices changed");
    expect(corrected.status).toBe("pending");
    product.selling_price = "4.49";
    receipt.lines[0].unit_cost_before_tax = "12.0000";
    expect(() =>
      resolveApproval(state, actor, corrected.id, "approve", "all", "Branch 1"),
    ).toThrow("reason");
    resolveApproval(
      state,
      actor,
      corrected.id,
      "approve",
      "all",
      "Branch 1",
      "Fictional clearance approved",
    );
    expect(corrected.unit_cost).toBe("12.0000");
    expect(corrected.status).toBe("approved");
  });

  it("takes an invoice group's number and supplier from its explicit source invoice", () => {
    const { state, actor } = setup();
    const contributor = structuredClone(state.invoice);
    contributor.id = "r2-fictional-contributor";
    contributor.supplier = "Fictional Contributor Market";
    contributor.supplier_invoice_number = "CONTRIBUTOR-1";
    const source = structuredClone(contributor);
    source.id = "r2-fictional-source";
    source.supplier = "Fictional Source Market";
    source.supplier_invoice_number = "SOURCE-2";
    state.invoice = contributor;
    state.invoices = [source];
    state.approvals[0].source_invoice_id = source.id;
    state.approvals[0].invoice_ids = [contributor.id, source.id];
    expect(approvalBoard(state, actor)[0]).toMatchObject({
      invoiceId: source.id,
      invoiceNumber: "SOURCE-2",
      supplierName: "Fictional Source Market",
    });
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
