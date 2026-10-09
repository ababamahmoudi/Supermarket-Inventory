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
  requestQuantityUnits,
  saveBranchRequestDraft,
  sendBranchRequest,
  type BranchRequestContext,
  type BranchRequestDraftInput,
} from "./branch-requests";
function fixture() {
  const state = initialState();
  state.branch_requests = [];
  state.request_transfer_events = [];
  const locations = configuredBranches(state.config);
  const worker = (branch: string): BranchRequestContext => ({
    company_id: state.config.company.seed_key,
    role: "floor_worker",
    branch,
    allowed_branches: [branch],
    actor: `Worker ${branch}`,
    username: "worker",
  });
  const source = worker(locations[0]),
    target = worker(locations[1]);
  const input: BranchRequestDraftInput = {
    from_branch: source.branch,
    to_branch: target.branch,
    items: [
      {
        kind: "catalog",
        product_code: state.products.find((item) => item.status === "active")!
          .code,
        quantity: "2",
        quantity_unit: "cases",
        units_per_case: 12,
      },
      {
        kind: "free_text",
        free_text: "Small paper bags",
        quantity: "3",
        quantity_unit: "cases",
      },
    ],
  };
  return { state, locations, source, target, input };
}
describe("Branch request quantities", () => {
  it("converts Decimal cases exactly and never invents free-text units", () => {
    expect(requestQuantityUnits("0.1", "cases", 30)).toBe(3);
    expect(requestQuantityUnits("1.5", "cases", 12)).toBe(18);
    expect(requestQuantityUnits("3", "cases")).toBeNull();
    expect(requestQuantityUnits("18", "units")).toBe(18);
  });
  it.each([
    ["0", "units", undefined],
    ["-1", "units", undefined],
    ["1.5", "units", undefined],
    ["0.1", "cases", 12],
    ["1.5", "cases", undefined],
    ["NaN", "units", undefined],
    ["Infinity", "cases", 12],
    ["9007199254740992", "units", undefined],
    ["1", "cases", 0],
  ] as const)("rejects invalid %s %s with pack %s", (quantity, unit, pack) => {
    expect(() => requestQuantityUnits(quantity, unit, pack)).toThrow();
  });
});
describe("retained, endpoint-scoped Branch requests", () => {
  it("retains residual allocation through draft edits and copies only the unallocated remainder", () => {
    const { state, source, target, input } = fixture();
    input.items = input.items.slice(0, 1);
    const original = saveBranchRequestDraft(state, source, input);
    sendBranchRequest(state, source, original.id, 1);
    markBranchRequestSent(state, target, original.id, 2, [
      { item_id: original.items[0].id, decision: "short", sent_quantity: "1" },
    ]);
    const copy = copyBranchRequestResidual(state, source, original.id, 3);
    const changed = saveBranchRequestDraft(state, source, {
      id: copy.id,
      expected_revision: 1,
      from_branch: copy.from_branch,
      to_branch: copy.to_branch,
      items: [
        {
          id: copy.items[0].id,
          kind: "catalog",
          product_code: copy.items[0].product_code,
          quantity: "0.5",
          quantity_unit: "cases",
          units_per_case: 12,
          note: "Updated note",
        },
      ],
    });
    expect(changed.items[0].source_item_id).toBe(original.items[0].id);
    expect(
      availableBranchRequestResidual(state, original).map(
        (item) => item.quantity,
      ),
    ).toEqual(["0.5"]);
    const remainder = copyBranchRequestResidual(state, source, original.id, 3);
    expect(remainder.id).not.toBe(copy.id);
    expect(remainder.items[0].quantity).toBe("0.5");
    expect(availableBranchRequestResidual(state, original)).toEqual([]);
    expect(copyBranchRequestResidual(state, source, original.id, 3).id).toBe(
      copy.id,
    );
    markBranchRequestReceived(state, source, original.id, 3, [
      { item_id: original.items[0].id, decision: "received" },
    ]);
    expect(availableBranchRequestResidual(state, original)).toEqual([]);
  });
  it("completes checklist lifecycle with partial sent and missing, preserves stock and ledger, records actual transfers and History", () => {
    const { state, source, target, input } = fixture(),
      stock = structuredClone(state.stock),
      ledger = structuredClone(state.ledger);
    const request = saveBranchRequestDraft(state, source, input);
    expect(listBranchRequests(state, target)).toEqual([]);
    expect(branchRequestCount(state, source)).toBe(1);
    sendBranchRequest(state, source, request.id, 1);
    expect(branchRequestCount(state, source)).toBe(0);
    expect(branchRequestCount(state, target)).toBe(1);
    markBranchRequestSent(state, target, request.id, 2, [
      { item_id: request.items[0].id, decision: "short", sent_quantity: "1.5" },
      { item_id: request.items[1].id, decision: "sent" },
    ]);
    expect(request.items[0].short_quantity).toBe("0.5");
    expect(
      state.request_transfer_events?.map((item) => item.normalized_units),
    ).toEqual([18, null]);
    expect(state.request_transfer_events?.[0]).toMatchObject({
      from_branch: target.branch,
      to_branch: source.branch,
      branch: target.branch,
      username: "worker",
    });
    expect(state.stock_movements?.at(-1)).toMatchObject({
      type: "transfer_sent",
      qty: -18,
      branch: target.branch,
    });
    expect(branchRequestCount(state, target)).toBe(0);
    expect(branchRequestCount(state, source)).toBe(1);
    markBranchRequestReceived(state, source, request.id, 3, [
      {
        item_id: request.items[0].id,
        decision: "missing",
        received_quantity: "1",
      },
      { item_id: request.items[1].id, decision: "received" },
    ]);
    expect(
      state.request_transfer_events?.map((item) => item.normalized_units),
    ).toEqual([18, null, 12, null]);
    expect(request.items[0].missing_quantity).toBe("0.5");
    const copied = copyBranchRequestResidual(state, source, request.id, 4);
    expect(copied.items.map((item) => item.quantity)).toEqual(["1"]);
    expect(copied.source_request_id).toBe(request.id);
    expect(copyBranchRequestResidual(state, source, request.id, 4).id).toBe(
      copied.id,
    );
    closeBranchRequest(state, source, request.id, 4);
    expect(request.status).toBe("closed");
    expect(branchRequestCount(state, source)).toBe(1); // New draft only.
    expect(state.stock).toEqual(stock);
    expect(state.ledger).toEqual(ledger);
    expect(
      state.activity
        .filter((item) => item.entity_id === request.id)
        .map((item) => item.action),
    ).toEqual([
      "Save draft",
      "Send request",
      "Mark as sent",
      "Mark as received",
      "Close request",
    ]);
    expect(request.items[0]).toMatchObject({
      quantity: "2",
      sent_quantity: "1.5",
      received_quantity: "1",
    });
  });
  it("prevents copying the same shortages again after the request advances", () => {
    const { state, source, target, input } = fixture();
    const request = saveBranchRequestDraft(state, source, input);
    sendBranchRequest(state, source, request.id, 1);
    markBranchRequestSent(state, target, request.id, 2, [
      { item_id: request.items[0].id, decision: "short", sent_quantity: "1" },
      { item_id: request.items[1].id, decision: "short" },
    ]);
    const first = copyBranchRequestResidual(state, source, request.id, 3);
    expect(first.items.map((item) => item.quantity)).toEqual(["1", "3"]);
    markBranchRequestReceived(state, source, request.id, 3, [
      {
        item_id: request.items[0].id,
        decision: "missing",
        received_quantity: "0.5",
      },
    ]);
    expect(
      availableBranchRequestResidual(state, request).map(
        (item) => item.quantity,
      ),
    ).toEqual(["0.5"]);
    const second = copyBranchRequestResidual(state, source, request.id, 4);
    expect(second.items.map((item) => item.quantity)).toEqual(["0.5"]);
    closeBranchRequest(state, source, request.id, 4);
    expect(() =>
      copyBranchRequestResidual(state, source, request.id, 5),
    ).toThrow("residual");
  });
  it("requires every explicit decision and validates entire checklists before mutations", () => {
    const { state, source, target, input } = fixture();
    const request = saveBranchRequestDraft(state, source, input);
    sendBranchRequest(state, source, request.id, 1);
    const before = structuredClone(state);
    expect(() =>
      markBranchRequestSent(state, target, request.id, 2, [
        { item_id: request.items[0].id, decision: "sent" },
      ]),
    ).toThrow("decision");
    expect(() =>
      markBranchRequestSent(state, target, request.id, 2, [
        { item_id: request.items[0].id, decision: "sent" },
        {
          item_id: request.items[1].id,
          decision: "short",
          sent_quantity: "0.5",
        },
      ]),
    ).toThrow("quantity");
    expect(state).toEqual(before);
    markBranchRequestSent(
      state,
      target,
      request.id,
      2,
      request.items.map((item) => ({ item_id: item.id, decision: "sent" })),
    );
    const shipped = structuredClone(state);
    expect(() =>
      markBranchRequestReceived(state, source, request.id, 3, [
        { item_id: request.items[0].id, decision: "received" },
      ]),
    ).toThrow("decision");
    expect(state).toEqual(shipped);
    expect(() =>
      markBranchRequestSent(state, target, request.id, 2, []),
    ).toThrow("stale");
    expect(state).toEqual(shipped);
  });
  it("rejects unrelated, foreign, Cashier, other-worker endpoint actions and implicit All branches", () => {
    const { state, source, target, input, locations } = fixture();
    const request = saveBranchRequestDraft(state, source, input);
    sendBranchRequest(state, source, request.id, 1);
    const unrelated = {
      ...source,
      branch: locations[2],
      allowed_branches: [locations[2]],
    };
    for (const context of [
      unrelated,
      { ...source, company_id: "foreign" },
      { ...source, role: "cashier" as const },
    ]) {
      expect(listBranchRequests(state, context)).toEqual([]);
      expect(branchRequestCount(state, context)).toBe(0);
      expect(() =>
        cancelBranchRequest(state, context, request.id, 2, "Wrong delivery"),
      ).toThrow();
    }
    expect(() =>
      markBranchRequestSent(state, source, request.id, 2, []),
    ).toThrow("location");
    const all = {
      ...source,
      role: "supervisor" as const,
      branch: "all",
      allowed_branches: locations,
    };
    expect(listBranchRequests(state, all)).toHaveLength(1);
    expect(branchRequestCount(state, all)).toBe(1);
    expect(() => markBranchRequestSent(state, all, request.id, 2, [])).toThrow(
      "location",
    );
    expect(() =>
      cancelBranchRequest(state, target, request.id, 2, "Wrong delivery"),
    ).toThrow("location");
  });
  it("retains cancelled records and reason; unsent cancellations remain source-only; never cancels actual transfers", () => {
    const { state, source, target, input } = fixture();
    const draft = saveBranchRequestDraft(state, source, input);
    expect(() => cancelBranchRequest(state, source, draft.id, 1, " ")).toThrow(
      "reason",
    );
    cancelBranchRequest(state, source, draft.id, 1, "Not needed");
    expect(state.branch_requests).toHaveLength(1);
    expect(listBranchRequests(state, target)).toEqual([]);
    const request = saveBranchRequestDraft(state, source, input);
    sendBranchRequest(state, source, request.id, 1);
    cancelBranchRequest(state, source, request.id, 2, "Wrong destination");
    expect(listBranchRequests(state, target)).toHaveLength(1);
    const physical = saveBranchRequestDraft(state, source, input);
    sendBranchRequest(state, source, physical.id, 1);
    markBranchRequestSent(
      state,
      target,
      physical.id,
      2,
      physical.items.map((item) => ({ item_id: item.id, decision: "short" })),
    );
    expect(state.request_transfer_events).toEqual([]);
    expect(() =>
      cancelBranchRequest(state, source, physical.id, 3, "Late"),
    ).toThrow("status");
    markBranchRequestReceived(state, source, physical.id, 3, []);
    closeBranchRequest(state, source, physical.id, 4);
    expect(physical.status).toBe("closed");
  });
  it("saves snapshots, guards stale draft edits and refuses inactive destination or invalid packs", () => {
    const { state, source, target, input } = fixture();
    const request = saveBranchRequestDraft(state, source, input);
    const name = request.items[0].name_en;
    state.products.find(
      (item) => item.code === request.items[0].product_code,
    )!.name_en = "Changed catalog name";
    sendBranchRequest(state, source, request.id, 1);
    expect(request.items[0].name_en).toBe(name);
    expect(() =>
      saveBranchRequestDraft(state, source, {
        ...input,
        id: request.id,
        expected_revision: 1,
      }),
    ).toThrow("stale");
    state.config.branches.find((item) => item.id === target.branch)!.active =
      false;
    expect(() => saveBranchRequestDraft(state, source, input)).toThrow(
      "location",
    );
  });
});
