import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { configuredBranches } from "./settings";
import {
  availableBranchRequestResidual,
  branchRequestCount,
  cancelBranchRequest,
  closeBranchRequest,
  copyBranchRequestResidual,
  listBranchRequests,
  markBranchRequestReceived,
  markBranchRequestSent,
  pickingListSnapshot,
  saveBranchRequestDraft,
  sendBranchRequest,
  type BranchRequestContext,
} from "./branch-requests";

function fixture() {
  const state = initialState();
  state.branch_requests = [];
  state.request_transfer_events = [];
  const branches = configuredBranches(state.config);
  const worker = (branch: string): BranchRequestContext => ({
    company_id: state.config.company.seed_key,
    role: "floor_worker",
    branch,
    allowed_branches: [branch],
    actor: `Worker at ${branch}`,
    username: "worker",
  });
  const source = worker(branches[0]);
  const target = worker(branches[1]);
  const supervisor: BranchRequestContext = {
    ...source,
    role: "supervisor",
    branch: "all",
    allowed_branches: branches,
    actor: "Demo Supervisor",
  };
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.status === "active",
  )!;
  const draft = () =>
    saveBranchRequestDraft(state, source, {
      from_branch: source.branch,
      to_branch: target.branch,
      items: [
        {
          kind: "catalog",
          product_code: product.code,
          quantity: "2",
          quantity_unit: "cases",
          units_per_case: 12,
        },
      ],
    });
  return { state, source, target, supervisor, draft };
}

describe("independent Branch requests regression review", () => {
  it("retains endpoint history after deactivation while blocking actions and actionable counts", () => {
    const { state, source, target, supervisor, draft } = fixture();
    const completed = draft();
    sendBranchRequest(state, source, completed.id, completed.revision);
    markBranchRequestSent(state, target, completed.id, completed.revision, [
      { item_id: completed.items[0].id, decision: "sent" },
    ]);
    markBranchRequestReceived(state, source, completed.id, completed.revision, [
      { item_id: completed.items[0].id, decision: "received" },
    ]);
    closeBranchRequest(state, source, completed.id, completed.revision);
    const waiting = draft();
    sendBranchRequest(state, source, waiting.id, waiting.revision);
    for (const location of state.config.branches)
      if (
        typeof location.id === "string" &&
        [source.branch, target.branch].includes(location.id)
      )
        location.active = false;

    expect(
      listBranchRequests(state, supervisor).map((item) => item.id),
    ).toEqual(expect.arrayContaining([completed.id, waiting.id]));
    expect(pickingListSnapshot(state, supervisor, completed.id)).toEqual(
      completed,
    );
    expect(listBranchRequests(state, source)).toContainEqual(completed);
    expect(listBranchRequests(state, target)).toContainEqual(completed);
    expect(branchRequestCount(state, supervisor)).toBe(0);
    expect(branchRequestCount(state, target)).toBe(0);
    const before = structuredClone(state);
    expect(() =>
      markBranchRequestSent(state, target, waiting.id, waiting.revision, [
        { item_id: waiting.items[0].id, decision: "sent" },
      ]),
    ).toThrow("location");
    expect(state).toEqual(before);
    expect(
      listBranchRequests(state, {
        ...supervisor,
        company_id: "another-company",
      }),
    ).toEqual([]);
    expect(
      listBranchRequests(state, { ...supervisor, allowed_branches: [] }),
    ).toEqual([]);
  });

  it("records outgoing and incoming physical quantities with correct signs without estimating inventory", () => {
    const { state, source, target, draft } = fixture();
    const aggregate = structuredClone(state.stock);
    const ledger = structuredClone(state.ledger);
    const priorMovements = structuredClone(state.stock_movements ?? []);
    const request = draft();
    sendBranchRequest(state, source, request.id, request.revision);
    markBranchRequestSent(state, target, request.id, request.revision, [
      {
        item_id: request.items[0].id,
        decision: "short",
        sent_quantity: "1.5",
      },
    ]);
    markBranchRequestReceived(state, source, request.id, request.revision, [
      {
        item_id: request.items[0].id,
        decision: "missing",
        received_quantity: "1",
      },
    ]);

    expect(state.request_transfer_events).toMatchObject([
      {
        kind: "transfer_sent",
        quantity: "1.5",
        normalized_units: 18,
        branch: target.branch,
        from_branch: target.branch,
        to_branch: source.branch,
      },
      {
        kind: "transfer_received",
        quantity: "1",
        normalized_units: 12,
        branch: source.branch,
        from_branch: target.branch,
        to_branch: source.branch,
      },
    ]);
    expect(state.stock_movements?.slice(priorMovements.length)).toMatchObject([
      { type: "transfer_sent", branch: target.branch, qty: -18 },
      { type: "transfer_received", branch: source.branch, qty: 12 },
    ]);
    expect(state.stock_movements?.slice(0, priorMovements.length)).toEqual(
      priorMovements,
    );
    expect(state.stock).toEqual(aggregate);
    expect(state.ledger).toEqual(ledger);
  });

  it("allows replacement of a cancelled shortage copy and copies only newly missing quantities later", () => {
    const { state, source, target, draft } = fixture();
    const request = draft();
    sendBranchRequest(state, source, request.id, request.revision);
    markBranchRequestSent(state, target, request.id, request.revision, [
      {
        item_id: request.items[0].id,
        decision: "short",
        sent_quantity: "1",
      },
    ]);
    const original = structuredClone(request);
    const first = copyBranchRequestResidual(
      state,
      source,
      request.id,
      request.revision,
    );
    cancelBranchRequest(
      state,
      source,
      first.id,
      first.revision,
      "Replace this draft",
    );
    const replacement = copyBranchRequestResidual(
      state,
      source,
      request.id,
      request.revision,
    );
    expect(replacement.id).not.toBe(first.id);
    expect(replacement.reference).not.toBe(first.reference);
    expect(replacement.items[0].quantity).toBe("1");
    expect(first).toMatchObject({
      status: "cancelled",
      cancellation_reason: "Replace this draft",
      source_request_id: request.id,
    });
    expect(
      copyBranchRequestResidual(state, source, request.id, request.revision).id,
    ).toBe(replacement.id);
    expect(request).toEqual(original);

    markBranchRequestReceived(state, source, request.id, request.revision, [
      {
        item_id: request.items[0].id,
        decision: "missing",
        received_quantity: "0.5",
      },
    ]);
    expect(availableBranchRequestResidual(state, request)).toMatchObject([
      { quantity: "0.5", normalized_units: 6 },
    ]);
    const later = copyBranchRequestResidual(
      state,
      source,
      request.id,
      request.revision,
    );
    expect(later.items[0]).toMatchObject({
      quantity: "0.5",
      source_item_id: request.items[0].id,
    });
    expect(availableBranchRequestResidual(state, request)).toEqual([]);
    expect(state.branch_requests).toHaveLength(4);
    expect(state.activity).toContainEqual(
      expect.objectContaining({
        entity_id: first.id,
        action: "Cancel request",
      }),
    );
  });
});
