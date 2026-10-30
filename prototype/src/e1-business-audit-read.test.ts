import { describe, expect, it } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority, decisionAttribution } from "./authority";
import { returnFixture } from "./return-test-fixture";
import { approvalBoard, approvalPanelRead } from "./approval-board";
import { approvalViews, alertViews } from "./sales-projections";
import { returnView, returnMemoView } from "./return-projections";
import {
  attachReversals,
  projectHistoryEntry,
  historyChangePreview,
  selectHistory,
} from "./history";
import { approvalSnapshot, resolveApproval } from "./approvals";
import { returnFinancialFingerprint } from "./return-workflow";
import { recordPickup, type OperationalReturn } from "./operations";
import { businessAuditRead } from "./business-audit-read";
import { saveSupplierItem } from "./supplier-items";
import type { Activity } from "./types";

const privateSession = "fictional-private-session-DO-NOT-PUBLISH";
const privateContact = "fictional-private-contact-DO-NOT-PUBLISH";
const privatePassword = "fictional-private-credential-DO-NOT-PUBLISH";

function fixture() {
  const state = returnFixture();
  const manager = authenticatedTestActor(state, "manager");
  const worker = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
  });
  const branchSupervisor = authenticatedTestActor(state, "branch_supervisor", {
    locations: ["Branch 1"],
  });
  const decision = Object.assign(
    structuredClone(decisionAttribution(state, manager)),
    {
      session_id: privateSession,
      authority_epoch: 98421,
      person: { email: privateContact, setup: { password: privatePassword } },
      phone: privateContact,
      extra_private_extension: privatePassword,
    },
  );
  state.approvals = [
    {
      id: "audit-approval",
      company_id: manager.company_id,
      branch: "Branch 1",
      product_code: "0003",
      type: "price_change",
      status: "pending",
      proposed_price: "14.99",
      current_price: "12.99",
      unit_cost: "10.0000",
      decision_attribution: decision,
    },
  ];
  state.alerts = [
    {
      id: "audit-alert",
      company_id: manager.company_id,
      branch: "Branch 1",
      product_code: "0003",
      type: "price_conflict",
      status: "pending",
      decision_attribution: decision,
    },
  ];
  return { state, manager, worker, branchSupervisor, decision };
}

function expectSafe(value: unknown) {
  const raw = JSON.stringify(value);
  expect(raw).not.toContain(privateSession);
  expect(raw).not.toContain(privateContact);
  expect(raw).not.toContain(privatePassword);
  expect(raw).not.toContain("authority_epoch");
  expect(raw).not.toContain("session_id");
}

describe("E1 business audit projections never publish private authentication records", () => {
  it("Manager and Branch Supervisor boards omit private extensions while retaining exact decision identity and prices", () => {
    const { state, manager, branchSupervisor, decision } = fixture();
    const original = structuredClone(state);
    const managerRows = approvalViews(state, manager);
    const supervisorRows = approvalViews(state, branchSupervisor);
    expectSafe(managerRows);
    expectSafe(supervisorRows);
    expectSafe(alertViews(state, manager));
    expectSafe(alertViews(state, branchSupervisor));
    expectSafe(approvalBoard(state, manager));
    expectSafe(
      approvalPanelRead(
        state,
        manager,
        "audit-approval",
        "branch",
        "Branch 1",
        "rule",
        true,
      ),
    );
    expect(managerRows[0].unit_cost).toBe("10.0000");
    expect(supervisorRows[0].unit_cost).toBeUndefined();
    expect(managerRows[0].decision_attribution).toEqual({
      user_id: decision.user_id,
      company_id: decision.company_id,
      username: decision.username,
      name_snapshot: decision.name_snapshot,
      role_snapshot: decision.role_snapshot,
      device_id: decision.device_id,
      at: decision.at,
    });
    expect(state).toEqual(original);
  });

  it("retained signed return money stays canonical, with protected role-specific print copies and safe audit snapshots", () => {
    const { state, manager, worker, branchSupervisor, decision } = fixture();
    recordPickup(state, worker, "c4-return", {
      quantities: { "0003": 3 },
      representative: "Fictional driver",
      slip: "FICTIONAL-SIGNED-AUDIT",
    });
    const actual = state.returns[0] as OperationalReturn;
    Object.assign(actual, {
      decision_attribution: decision,
      session_id: privateSession,
    });
    const memo = actual.pickup_memos![0];
    Object.assign(memo, {
      decision_attribution: decision,
      authority_epoch: 98421,
    });
    actual.evidence![0].photo = "fictional-private-stored-photo-reference";
    const original = structuredClone(state);
    const managerView = returnView(state, manager, actual.id);
    expect(managerView.pickup_memos![0].expected_credit).toBe("30.00");
    expect(managerView.evidence![0].photo_available).toBe(true);
    expect(JSON.stringify(managerView)).not.toContain(
      "fictional-private-stored-photo-reference",
    );
    expectSafe(managerView);
    for (const actor of [worker, branchSupervisor]) {
      expectSafe(returnView(state, actor, actual.id));
      const print = returnMemoView(state, actor, actual.id, memo.id);
      expectSafe(print);
      expect(print.expected_credit).toBeUndefined();
      expect(print.lines[0].unit_cost).toBeUndefined();
      expect(print.lines[0].quantity).toBe(3);
    }
    expect(state).toEqual(original);
  });

  it("Manager History also removes nested secrets and primitive private-path values without changing inverse evidence", () => {
    const { state, manager, decision } = fixture();
    const product = state.products.find((item) => item.code === "0003")!;
    Object.assign(product, { session_id: privateSession });
    const entry: Activity = {
      id: "audit-history",
      company_id: manager.company_id,
      branch: "Branch 1",
      actor_user_id: manager.user_id,
      action: "Edit product",
      by: manager.actor,
      at: decision.at,
      product_code: product.code,
      entity_type: "product",
      entity_id: product.code,
      reversible: true,
      before: { decision_attribution: decision, selling_price: "12.99" },
      after: { decision_attribution: decision, selling_price: "14.99" },
      reversal: [
        {
          path: [
            "products",
            { key: "code", value: product.code },
            "session_id",
          ],
          before: "fictional-older-private-session",
          after: privateSession,
          before_exists: true,
          after_exists: true,
        },
      ],
    };
    state.activity = [entry];
    const original = structuredClone(state);
    expectSafe(projectHistoryEntry(state, manager, entry));
    const preview = historyChangePreview(state, manager, entry.id);
    expectSafe(preview);
    expect(preview[0].current).toBeUndefined();
    expect(JSON.stringify(preview)).not.toContain(
      "fictional-older-private-session",
    );
    expect(state).toEqual(original);
  });

  it("approval and return conflict tokens are opaque hashes of complete original snapshots, so hidden changes still invalidate them", () => {
    const { state, manager, decision } = fixture();
    const product = state.products.find((item) => item.code === "0003")!;
    product.manual_prices = {
      "Branch 1": {
        price: "12.99",
        rule_price: "14.99",
        set_by: manager.actor,
        set_by_user_id: manager.user_id,
        set_at: decision.at,
        decision_attribution: decision,
      },
    };
    Object.assign(state.returns[0], { decision_attribution: decision });
    const approval = approvalSnapshot(state, manager, product.code);
    const returns = returnFinancialFingerprint(state, manager, "c4-return");
    expect(approval).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(returns).toMatch(/^sha256:[0-9a-f]{64}$/);
    expectSafe([approval, returns]);
    decision.session_id = "fictional-different-private-session";
    expect(approvalSnapshot(state, manager, product.code)).not.toBe(approval);
    expect(returnFinancialFingerprint(state, manager, "c4-return")).not.toBe(
      returns,
    );
    const changedOriginal = structuredClone(state);
    expect(() =>
      resolveApproval(
        state,
        manager,
        "audit-approval",
        "approve",
        "branch",
        "Branch 1",
        undefined,
        approval,
      ),
    ).toThrow("Prices changed");
    expect(state).toEqual(changedOriginal);
  });

  it("business supplier contacts are retained while raw person contacts and setup records are removed", () => {
    const read = businessAuditRead({
      supplier: {
        phone: "Fictional supplier phone",
        email: "supplier@example.test",
      },
      audit: {
        username: "fictional",
        authority_epoch: 2,
        phone: privateContact,
        email: privateContact,
        setup: { password: privatePassword },
      },
    });
    expectSafe(read);
    expect(read.supplier).toEqual({
      phone: "Fictional supplier phone",
      email: "supplier@example.test",
    });
    expect(read.audit).toEqual({ username: "fictional" });
  });

  it("real supplier-item History omits internal printed matching provenance while retaining ordinary audited edits", () => {
    const { state, manager, worker } = fixture();
    const supplier = "Fresh Valley Foods";
    const added = saveSupplierItem(state, manager, supplier, {
      product_code: "0003",
      supplier_item_code: "FICTIONAL-AUDIT-SKU",
      units_per_case: 6,
    });
    added.printed_description_keys = [
      {
        key: "fictional private printed matching key",
        product_code: "0003",
        source_invoice_ids: ["fictional-private-source-invoice"],
      },
    ];
    const before = cloneWithAuthority(state);
    saveSupplierItem(
      state,
      manager,
      supplier,
      {
        product_code: "0003",
        supplier_item_code: added.supplier_item_code,
        units_per_case: 12,
      },
      added.id,
    );
    const entry = attachReversals(before, state, manager).find(
      (item) => item.action === "Save supplier item",
    )!;
    expect(entry).toBeDefined();
    expect(entry.after).toMatchObject({
      printed_description_keys: added.printed_description_keys,
    });
    const original = structuredClone(state);
    const projected = projectHistoryEntry(state, manager, entry);
    expect(projected.before).toMatchObject({ units_per_case: 6 });
    expect(projected.after).toMatchObject({
      supplier_item_code: "FICTIONAL-AUDIT-SKU",
      units_per_case: 12,
    });
    const preview = historyChangePreview(state, manager, entry.id);
    expect(preview.some((item) => item.patch.after === 12)).toBe(true);
    const exported = JSON.stringify([
      projected,
      selectHistory(state, manager),
      preview,
    ]);
    expect(exported).not.toContain("printed_description_keys");
    expect(exported).not.toContain("source_invoice_ids");
    expect(exported).not.toContain("fictional private printed matching key");
    expect(exported).not.toContain("fictional-private-source-invoice");
    expect(() => projectHistoryEntry(state, worker, entry)).toThrow(
      "permission",
    );
    expect(() => historyChangePreview(state, worker, entry.id)).toThrow(
      "permission",
    );
    expect(state).toEqual(original);
  });

  it("redacts matching provenance in nested copies and primitive paths without altering retained patches or supplier contacts", () => {
    const privateSource = "fictional-private-nested-source-invoice";
    const privateKey = "fictional private nested matching key";
    const value = {
      "supplier_items · fictional-id · printed_description_keys": privateKey,
      "supplier_items[0].source_invoice_ids": privateSource,
      supplier: {
        phone: "Fictional supplier phone",
        email: "supplier@example.test",
        printed_description_keys: [
          { key: privateKey, source_invoice_ids: [privateSource] },
        ],
      },
      patches: [
        {
          path: ["supplier_items", "printed_description_keys"],
          before: privateKey,
          after: privateSource,
          current: privateSource,
          guards: [{ after: privateSource }],
          conflict: false,
        },
        {
          patch: {
            path: [
              "supplier_items",
              { key: "printed_description_keys", value: privateKey },
            ],
            before: privateKey,
            after: privateSource,
          },
          current: privateSource,
          conflict: true,
        },
        {
          path: ["supplier_items[0].source_invoice_ids"],
          before: privateSource,
          after: privateSource,
        },
      ],
    };
    const original = structuredClone(value);
    const read = businessAuditRead(value);
    expect(read.supplier).toEqual({
      phone: "Fictional supplier phone",
      email: "supplier@example.test",
    });
    expect(read.patches).toEqual([
      { path: [], conflict: false },
      { patch: { path: [] }, conflict: true },
      { path: [] },
    ]);
    expect(JSON.stringify(read)).not.toContain(privateSource);
    expect(JSON.stringify(read)).not.toContain(privateKey);
    expect(value).toEqual(original);
  });
});
