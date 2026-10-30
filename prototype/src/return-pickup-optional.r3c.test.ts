import { describe, expect, it } from "vitest";
import { returnFixture } from "./return-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import {
  recordPickup,
  correctReturnPickup,
  submitFinancialClaim,
  postReturnClaim,
  type OperationalReturn,
} from "./operations";
import { signedReturnPickupQuantities } from "./signed-return-pickups";
import { returnOverviewCredits } from "./return-overview-credit";

function fixture() {
  const state = returnFixture();
  const worker = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
  });
  const manager = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
  });
  const record = state.returns[0] as OperationalReturn;
  const read = () =>
    returnOverviewCredits(state, manager).find(
      (row) => row.return_id === record.id,
    )!;
  return { state, worker, manager, record, read };
}
type PickupInput = Parameters<typeof recordPickup>[3];
const request = (
  id = "fictional-pickup-request-one",
  quantity = 1,
): PickupInput & {
  request_id: string;
  shortfalls: NonNullable<PickupInput["shortfalls"]>;
} => ({
  request_id: id,
  quantities: { "0003": quantity },
  representative: "Fictional driver",
  slip: "",
  note: "Fictional physical pickup",
  shortfalls:
    quantity < 3
      ? {
          "0003": {
            reason: "Retained for the next visit",
            outcome: "keep_for_next_pickup" as const,
          },
        }
      : {},
});

describe("R3c K9 optional pickup reference", () => {
  it("requires a real form identity and representative, plus actual shortfall reason and outcome", () => {
    const { state, worker, record } = fixture();
    for (const input of [
      { ...request(), request_id: undefined },
      { ...request(), request_id: "bad" },
      { ...request(), representative: "" },
      { ...request(), shortfalls: {} },
      {
        ...request(),
        shortfalls: {
          "0003": { reason: "", outcome: "keep_for_next_pickup" as const },
        },
      },
    ]) {
      const before = JSON.stringify(state);
      expect(() => recordPickup(state, worker, record.id, input)).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it("keeps separate blank-reference pickups and retries each exact accepted attempt without writes", () => {
    const { state, worker, record } = fixture();
    const ledger = structuredClone(state.ledger);
    const first = request();
    recordPickup(state, worker, record.id, first);
    const memo = structuredClone(record.pickup_memos![0]);
    const event = structuredClone(record.evidence![0]);
    expect(memo).toMatchObject({
      pickup_request_id: first.request_id,
      representative: first.representative,
      signed_evidence_reference: "",
      expected_credit: "10.00",
    });
    expect(event).toMatchObject({
      pickup_request_id: first.request_id,
      actor_user_id: worker.user_id,
      document: "",
      quantities: { "0003": 1 },
    });
    expect(signedReturnPickupQuantities(record).get("0003")).toBe(1);
    const before = JSON.stringify(state);
    recordPickup(state, worker, record.id, first);
    expect(JSON.stringify(state)).toBe(before);
    const second = {
      ...request("fictional-pickup-request-two", 2),
      shortfalls: {},
    };
    recordPickup(state, worker, record.id, second);
    expect(record.pickup_memos).toHaveLength(2);
    expect(record.pickup_memos![0]).toEqual(memo);
    expect(record.evidence![0]).toEqual(event);
    expect(record.lines[0].picked_up).toBe(3);
    expect(record.lines[0].pickup_shortfall).toBeUndefined();
    expect(signedReturnPickupQuantities(record).get("0003")).toBe(3);
    const after = JSON.stringify(state);
    recordPickup(state, worker, record.id, second);
    expect(JSON.stringify(state)).toBe(after);
    expect(state.ledger).toEqual(ledger);
  });

  it("rejects changed details or another actual person reusing an accepted request atomically", () => {
    const { state, worker, manager, record } = fixture();
    const input = request();
    recordPickup(state, worker, record.id, input);
    const before = JSON.stringify(state);
    for (const changed of [
      { ...input, quantities: { "0003": 2 } },
      { ...input, representative: "Different driver" },
      { ...input, slip: "ADDED-AFTER-ACCEPTANCE" },
      { ...input, note: "Changed note" },
      {
        ...input,
        shortfalls: {
          "0003": {
            reason: "Changed reason",
            outcome: "keep_for_next_pickup" as const,
          },
        },
      },
      {
        ...input,
        shortfalls: {
          "0003": {
            reason: input.shortfalls["0003"]!.reason,
            outcome: "throw_away" as const,
          },
        },
      },
    ]) {
      expect(() => recordPickup(state, worker, record.id, changed)).toThrow(
        "duplicate_document",
      );
      expect(JSON.stringify(state)).toBe(before);
    }
    expect(() => recordPickup(state, manager, record.id, input)).toThrow(
      "duplicate_document",
    );
    expect(JSON.stringify(state)).toBe(before);
  });

  it("replays a resolved shelf-recovery pickup without repeating its physical movement and denies a new attempt", () => {
    const { state, worker, record } = fixture();
    const input = {
      ...request("fictional-resolved-pickup", 0),
      shortfalls: {
        "0003": {
          reason: "Supplier declined; goods are sellable",
          outcome: "put_back_on_shelf" as const,
        },
      },
    };
    const stockBefore = state.stock["Branch 1:0003"] ?? 0;
    recordPickup(state, worker, record.id, input);
    expect(record.status).toBe("resolved");
    expect(state.stock["Branch 1:0003"]).toBe(stockBefore + 3);
    const before = JSON.stringify(state);
    recordPickup(state, worker, record.id, input);
    expect(JSON.stringify(state)).toBe(before);
    expect(() =>
      recordPickup(state, worker, record.id, {
        ...input,
        request_id: "fictional-new-on-resolved",
      }),
    ).toThrow("closed");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("valid blank-reference evidence reaches real claim verification and reduces expected credit exactly once", () => {
    const { state, worker, manager, record, read } = fixture();
    recordPickup(
      state,
      worker,
      record.id,
      request("fictional-credit-pickup", 3),
    );
    expect(read().amount).toBe("30.00");
    const ledger = structuredClone(state.ledger);
    submitFinancialClaim(state, worker, record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 1 },
      document: "FICTIONAL-CREDIT-ONE",
      invoice_id: "c4-base-invoice",
      amount: "10.00",
    });
    expect(read().amount).toBe("30.00");
    expect(state.ledger).toEqual(ledger);
    const claim = record.claims![0];
    postReturnClaim(state, manager, record.id, claim.id, "10.00");
    expect(read().amount).toBe("20.00");
    const after = JSON.stringify(state);
    recordPickup(
      state,
      worker,
      record.id,
      request("fictional-credit-pickup", 3),
    );
    expect(JSON.stringify(state)).toBe(after);
    expect(read().amount).toBe("20.00");
  });

  it("retains the original blank-reference identity through a correction and an original-request replay cannot revert it", () => {
    const { state, worker, manager, record } = fixture();
    const input = request("fictional-corrected-pickup", 2);
    recordPickup(state, worker, record.id, input);
    const original = structuredClone(record.pickup_memos![0]);
    correctReturnPickup(state, manager, record.id, {
      memo_id: original.id,
      quantities: { "0003": 1 },
      reason: "Corrected the actual collected count",
      shortfalls: {
        "0003": { reason: "Two remain", outcome: "keep_for_next_pickup" },
      },
    });
    expect(record.pickup_memos![0]).toEqual(original);
    expect(record.pickup_memos!.at(-1)).toMatchObject({
      pickup_request_id: input.request_id,
      correction_of: original.id,
      signed_evidence_reference: "",
      representative: input.representative,
    });
    expect(signedReturnPickupQuantities(record).get("0003")).toBe(1);
    const before = JSON.stringify(state);
    recordPickup(state, worker, record.id, input);
    expect(JSON.stringify(state)).toBe(before);
    expect(record.lines[0].picked_up).toBe(1);
    submitFinancialClaim(state, worker, record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 1 },
      document: "FICTIONAL-PENDING-COVER",
      invoice_id: "c4-base-invoice",
      amount: "10.00",
    });
    const submitted = JSON.stringify(state);
    expect(() =>
      correctReturnPickup(state, manager, record.id, {
        memo_id: record.pickup_memos!.at(-1)!.id,
        quantities: { "0003": 0 },
        reason: "Cannot remove claimed coverage",
        shortfalls: {
          "0003": { reason: "All remain", outcome: "keep_for_next_pickup" },
        },
      }),
    ).toThrow("pickup_correction_conflict");
    expect(JSON.stringify(state)).toBe(submitted);
  });

  it.each([
    "event_missing",
    "event_actor",
    "event_quantity",
    "memo_key",
    "memo_company",
    "memo_reference",
  ] as const)("rejects incoherent blank-reference proof: %s", (kind) => {
    const { state, worker, record } = fixture();
    recordPickup(
      state,
      worker,
      record.id,
      request("fictional-proof-pickup", 3),
    );
    const broken = cloneWithAuthority(state);
    const target = broken.returns[0] as OperationalReturn;
    if (kind === "event_missing") target.evidence = [];
    if (kind === "event_actor")
      target.evidence![0].actor_user_id = "another-person";
    if (kind === "event_quantity") target.evidence![0].quantities!["0003"] = 2;
    if (kind === "memo_key") delete target.pickup_memos![0].pickup_request_id;
    if (kind === "memo_company") target.pickup_memos![0].company_id = "foreign";
    if (kind === "memo_reference")
      target.pickup_memos![0].signed_evidence_reference =
        "A-PAPER-NOT-IN-THE-EVENT";
    expect(signedReturnPickupQuantities(target).get("0003")).toBeUndefined();
    expect(() =>
      submitFinancialClaim(broken, worker, target.id, {
        type: "credit_current_invoice",
        covers: { "0003": 1 },
        document: "NO-FALSE-CREDIT",
        invoice_id: "c4-base-invoice",
      }),
    ).toThrow("pickup_required");
  });
});
