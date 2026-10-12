import { describe, it, expect } from "vitest";
import { returnFixture } from "./return-test-fixture";
import {
  canCorrectReturnPickup,
  correctReturnPickup,
  recordPickup,
  receiveReplacement,
  submitFinancialClaim,
  postReturnClaim,
  type OperationalReturn,
  type OperationsContext,
} from "./operations";
import {
  recordItemResolutions,
  returnItemProgress,
} from "./return-item-resolutions";
import {
  pendingReturnCredits,
  returnUiStatus,
  returnClosureSubtype,
} from "./return-workflow";
import { supplierBalanceSummary } from "./supplier-balances";
const worker: OperationsContext = {
  company_id: "super-arzon",
  branch: "Branch 1",
  role: "floor_worker",
  actor: "Demo Floor Worker",
};
const supervisor: OperationsContext = {
  ...worker,
  role: "supervisor",
  actor: "Demo Supervisor",
};
const manager: OperationsContext = {
  ...supervisor,
  pickup_correction_authority: "manager",
};
const pickup = (
  state: ReturnType<typeof returnFixture>,
  qty = 3,
  slip = "SIGNED-C6-001",
  outcome:
    | "keep_for_next_pickup"
    | "put_back_on_shelf"
    | "throw_away" = "keep_for_next_pickup",
) =>
  recordPickup(state, worker, "c4-return", {
    quantities: { "0003": qty },
    representative: "Demo Driver",
    slip,
    shortfalls: {
      "0003": { reason: "Representative did not collect these goods", outcome },
    },
  });
const record = (state: ReturnType<typeof returnFixture>) =>
  state.returns[0] as OperationalReturn;

describe("C6 actual immutable pickups", () => {
  it("requires shortfall reason and outcome before any mutation", () => {
    const state = returnFixture(),
      before = structuredClone(state);
    expect(() =>
      recordPickup(state, worker, "c4-return", {
        quantities: { "0003": 2 },
        representative: "Demo Driver",
        slip: "SIGNED",
      }),
    ).toThrow("pickup_shortfall_reason");
    expect(state).toEqual(before);
    expect(() =>
      recordPickup(state, worker, "c4-return", {
        quantities: { "0003": 2 },
        representative: "Demo Driver",
        slip: "SIGNED",
        shortfalls: {
          "0003": { reason: "Refused", outcome: "" as "throw_away" },
        },
      }),
    ).toThrow("pickup_shortfall_outcome");
    expect(state).toEqual(before);
  });
  it("retains a partial event and appends a new signed pickup for the kept remainder", () => {
    const state = returnFixture();
    pickup(state, 1);
    const first = structuredClone(record(state).evidence![0]);
    const memo = structuredClone(record(state).pickup_memos![0]);
    pickup(state, 2, "SIGNED-C6-002");
    expect(record(state).lines[0].picked_up).toBe(3);
    expect(record(state).lines[0].pickup_shortfall).toBeUndefined();
    expect(record(state).evidence![0]).toEqual(first);
    expect(record(state).pickup_memos![0]).toEqual(memo);
    expect(record(state).pickup_memos!.map((memo) => memo.reference)).toEqual([
      "RM-0001",
      "RM-0002",
    ]);
    expect(pendingReturnCredits(state, supervisor)[0].amount).toBe("10.00");
    const before = structuredClone(state);
    pickup(state, 2, "SIGNED-C6-002");
    expect(state).toEqual(before);
  });
  it("recovers shelf leftovers once and blocks another pickup of disposed units", () => {
    const state = returnFixture();
    const movements = state.stock_movements?.length ?? 0;
    pickup(state, 2, "SIGNED", "put_back_on_shelf");
    expect(record(state).original_units_recovered).toBe(1);
    expect(record(state).recovered).toEqual({ "0003": 1 });
    expect(state.stock_movements).toHaveLength(movements + 1);
    const before = structuredClone(state);
    expect(() => pickup(state, 1, "SECOND")).toThrow("pickup_cap");
    expect(state).toEqual(before);
    receiveReplacement(state, worker, "c4-return", {
      product_code: "0002",
      qty: 2,
      covers: { "0003": 2 },
      date: "2026-10-11",
      representative: "Demo Driver",
      receipt: "REPLACEMENT",
    });
    expect(returnUiStatus(record(state))).toBe("closed");
  });
  it("records zero collected with a reason without inventing supplier-held goods or a credit", () => {
    const state = returnFixture();
    pickup(state, 0, "REFUSED");
    expect(returnUiStatus(record(state))).toBe("waiting_for_pickup");
    expect(pendingReturnCredits(state, supervisor)).toEqual([]);
    expect(state.ledger).toHaveLength(1);
    const discarded = returnFixture();
    pickup(discarded, 0, "THROWN", "throw_away");
    expect(returnUiStatus(record(discarded))).toBe("closed");
    expect(record(discarded).original_units_recovered).toBe(0);
  });
  it("does not grant correction through a broad Supervisor or Worker role", () => {
    expect(canCorrectReturnPickup(supervisor)).toBe(false);
    expect(
      canCorrectReturnPickup({
        ...worker,
        pickup_correction_authority: "manager",
      }),
    ).toBe(false);
    const state = returnFixture();
    pickup(state);
    const before = structuredClone(state);
    expect(() =>
      correctReturnPickup(state, supervisor, "c4-return", {
        memo_id: record(state).pickup_memos![0].id,
        quantities: { "0003": 2 },
        reason: "Wrong count",
      }),
    ).toThrow("pickup_authority");
    expect(state).toEqual(before);
  });
  it("appends a reasoned authorized correction, preserving original memo/paper/event and money", () => {
    const state = returnFixture();
    pickup(state, 2);
    const original = structuredClone(record(state).pickup_memos![0]),
      event = structuredClone(record(state).evidence![0]),
      ledger = structuredClone(state.ledger);
    correctReturnPickup(state, manager, "c4-return", {
      memo_id: original.id,
      quantities: { "0003": 1 },
      reason: "Signed count corrected after review",
      shortfalls: {
        "0003": {
          reason: "Only one actually collected",
          outcome: "keep_for_next_pickup",
        },
      },
    });
    expect(record(state).pickup_memos![0]).toEqual(original);
    expect(record(state).evidence![0]).toEqual(event);
    expect(record(state).pickup_memos![1]).toMatchObject({
      reference: "RM-0002",
      correction_of: original.id,
      signed_evidence_reference: original.signed_evidence_reference,
    });
    expect(record(state).pickup_corrections).toHaveLength(1);
    expect(record(state).lines[0].picked_up).toBe(1);
    expect(pendingReturnCredits(state, supervisor)).toEqual([
      expect.objectContaining({ reference: "RM-0002", amount: "10.00" }),
    ]);
    expect(state.ledger).toEqual(ledger);
    const corrected = structuredClone(state);
    expect(() =>
      correctReturnPickup(state, manager, "c4-return", {
        memo_id: original.id,
        quantities: { "0003": 1 },
        reason: "Old version",
      }),
    ).toThrow("pickup_correction_conflict");
    expect(state).toEqual(corrected);
  });
  it("blocks correction below already credited original quantity or across a company", () => {
    const state = returnFixture();
    pickup(state);
    submitFinancialClaim(state, supervisor, "c4-return", {
      type: "credit_current_invoice",
      covers: { "0003": 1 },
      amount: "8.00",
      document: "C6-CREDIT",
      invoice_id: "c4-base-invoice",
    });
    postReturnClaim(
      state,
      supervisor,
      "c4-return",
      record(state).claims![0].id,
    );
    const before = structuredClone(state);
    expect(() =>
      correctReturnPickup(state, manager, "c4-return", {
        memo_id: record(state).pickup_memos![0].id,
        quantities: { "0003": 0 },
        reason: "Bad reduction",
        shortfalls: { "0003": { reason: "Wrong", outcome: "throw_away" } },
      }),
    ).toThrow("pickup_correction_conflict");
    expect(() =>
      correctReturnPickup(
        state,
        { ...manager, company_id: "other" },
        "c4-return",
        {
          memo_id: record(state).pickup_memos![0].id,
          quantities: { "0003": 3 },
          reason: "Wrong company",
        },
      ),
    ).toThrow("scope");
    expect(state).toEqual(before);
  });
});

describe("C6 item-level partial settlement and conservation", () => {
  it("rejects new resolution/credit/replacement without real signed pickup evidence", () => {
    const state = returnFixture(),
      before = structuredClone(state);
    expect(() =>
      recordItemResolutions(state, worker, "c4-return", [
        {
          product_code: "0003",
          kind: "outstanding",
          quantity: 3,
          expected_date: "2026-10-23",
        },
      ]),
    ).toThrow("pickup_required");
    expect(() =>
      receiveReplacement(state, worker, "c4-return", {
        product_code: "0002",
        qty: 1,
        covers: { "0003": 1 },
        date: "2026-10-11",
        representative: "Demo Driver",
        receipt: "NEW",
      }),
    ).toThrow("pickup_required");
    expect(() =>
      submitFinancialClaim(state, worker, "c4-return", {
        type: "credit_current_invoice",
        covers: { "0003": 1 },
        invoice_id: "c4-base-invoice",
        document: "NEW-CREDIT",
      }),
    ).toThrow("pickup_required");
    expect(state).toEqual(before);
  });
  it("blocks coverage beyond actual pickup and overlapping submitted claims", () => {
    const state = returnFixture();
    pickup(state, 1);
    const before = structuredClone(state);
    expect(() =>
      submitFinancialClaim(state, worker, "c4-return", {
        type: "credit_current_invoice",
        covers: { "0003": 2 },
        invoice_id: "c4-base-invoice",
        document: "EXCESS",
      }),
    ).toThrow("coverage");
    expect(state).toEqual(before);
    submitFinancialClaim(state, worker, "c4-return", {
      type: "credit_current_invoice",
      covers: { "0003": 1 },
      invoice_id: "c4-base-invoice",
      document: "CLAIM-1",
    });
    expect(() =>
      submitFinancialClaim(state, worker, "c4-return", {
        type: "credit_current_invoice",
        covers: { "0003": 1 },
        invoice_id: "c4-base-invoice",
        document: "CLAIM-2",
      }),
    ).toThrow("coverage");
    expect(record(state).claims).toHaveLength(1);
  });
  it("records outstanding date/note without changing locked pickup or a payable", () => {
    const state = returnFixture();
    pickup(state);
    const memo = structuredClone(record(state).pickup_memos),
      ledger = structuredClone(state.ledger);
    recordItemResolutions(state, worker, "c4-return", [
      {
        product_code: "0003",
        kind: "outstanding",
        quantity: 3,
        expected_date: "2026-10-23",
        note: "Rep will bring one more next week",
      },
    ]);
    expect(record(state).lines[0]).toMatchObject({
      outstanding_expected_date: "2026-10-23",
      outstanding_note: "Rep will bring one more next week",
      picked_up: 3,
    });
    expect(record(state).pickup_memos).toEqual(memo);
    expect(state.ledger).toEqual(ledger);
    expect(returnUiStatus(record(state))).toBe("waiting_for_credit");
  });
  it("permits separate partial notes and releases only resolved expected coverage once", () => {
    const state = returnFixture();
    pickup(state);
    for (const [quantity, amount, document] of [
      [1, "8.00", "C6-1"],
      [2, "17.00", "C6-2"],
    ] as const) {
      recordItemResolutions(state, supervisor, "c4-return", [
        {
          product_code: "0003",
          kind: "credited",
          expected_date: "2026-10-23",
          quantity,
          amount,
          document,
          invoice_id: "c4-base-invoice",
        },
      ]);
      const claim = record(state).claims!.at(-1)!;
      postReturnClaim(state, supervisor, "c4-return", claim.id);
      postReturnClaim(state, supervisor, "c4-return", claim.id);
      if (quantity === 1)
        expect(
          supplierBalanceSummary(state, supervisor, "Fresh Valley Foods"),
        ).toMatchObject({
          balance: "572.00",
          confirmed_balance: "592.00",
          pending_credit: "20.00",
        });
    }
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods"),
    ).toMatchObject({ balance: "575.00", pending_credit: "0.00" });
    expect(
      state.ledger.filter((entry) => entry.type === "credit"),
    ).toHaveLength(2);
    expect(
      returnItemProgress(record(state), record(state).lines[0]),
    ).toMatchObject({ credited: 3, outstanding: 0 });
    expect(returnUiStatus(record(state))).toBe("closed");
  });
  it("validates all item decisions before writing even the first valid replacement", () => {
    const state = returnFixture();
    state.returns[0].lines.push({
      product_code: "0001",
      qty: 2,
      unit_cost: "5.0000",
      reason: "Damaged",
    });
    recordPickup(state, worker, "c4-return", {
      quantities: { "0003": 3, "0001": 2 },
      representative: "Demo Driver",
      slip: "SIGNED-MIXED",
    });
    const before = structuredClone(state);
    expect(() =>
      recordItemResolutions(state, worker, "c4-return", [
        {
          product_code: "0003",
          kind: "replaced",
          expected_date: "2026-10-23",
          quantity: 1,
          replacement_product_code: "0002",
          replacement_quantity: 2,
          received_date: "2026-10-11",
          representative: "Demo Driver",
          document: "ACTUAL-REPLACEMENT",
        },
        {
          product_code: "0001",
          kind: "outstanding",
          quantity: 2,
          expected_date: "",
        },
      ]),
    ).toThrow("outstanding_date");
    expect(state).toEqual(before);
  });
  it("groups a shared note into one credit without double posting and keeps mixed outcomes open", () => {
    const state = returnFixture();
    state.returns[0].lines.push({
      product_code: "0001",
      qty: 2,
      unit_cost: "5.0000",
      reason: "Damaged",
    });
    recordPickup(state, worker, "c4-return", {
      quantities: { "0003": 3, "0001": 2 },
      representative: "Demo Driver",
      slip: "SIGNED-MIXED",
    });
    recordItemResolutions(state, supervisor, "c4-return", [
      {
        product_code: "0003",
        kind: "credited",
        expected_date: "2026-10-23",
        quantity: 1,
        amount: "8.00",
        document: "ONE-NOTE",
        invoice_id: "c4-base-invoice",
      },
      {
        product_code: "0001",
        kind: "credited",
        expected_date: "2026-10-23",
        quantity: 1,
        amount: "4.00",
        document: "ONE-NOTE",
        invoice_id: "c4-base-invoice",
      },
    ]);
    expect(record(state).claims).toHaveLength(1);
    expect(record(state).claims![0]).toMatchObject({
      amount: "12.00",
      covers: { "0003": 1, "0001": 1 },
      item_amounts: { "0003": "8.00", "0001": "4.00" },
    });
    postReturnClaim(
      state,
      supervisor,
      "c4-return",
      record(state).claims![0].id,
    );
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods"),
    ).toMatchObject({
      confirmed_balance: "588.00",
      pending_credit: "25.00",
      balance: "563.00",
    });
    recordItemResolutions(state, worker, "c4-return", [
      {
        product_code: "0003",
        kind: "replaced",
        expected_date: "2026-10-23",
        quantity: 2,
        replacement_quantity: 1,
        replacement_product_code: "0002",
        document: "MIXED-REPLACEMENT",
        representative: "Demo Driver",
        received_date: "2026-10-11",
      },
      {
        product_code: "0001",
        kind: "outstanding",
        quantity: 1,
        expected_date: "2026-10-23",
      },
    ]);
    expect(returnUiStatus(record(state))).toBe("waiting_for_credit");
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods")
        .pending_credit,
    ).toBe("5.00");
    recordItemResolutions(state, supervisor, "c4-return", [
      {
        product_code: "0001",
        kind: "written_off",
        expected_date: "2026-10-23",
        quantity: 1,
        note: "Supplier refused final item",
      },
    ]);
    postReturnClaim(
      state,
      supervisor,
      "c4-return",
      record(state).claims!.at(-1)!.id,
    );
    expect(returnUiStatus(record(state))).toBe("closed");
    expect(returnClosureSubtype(record(state))).toBeUndefined();
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods").balance,
    ).toBe("588.00");
  });
  it("preserves full replacement570→600 without a new credit or purchase", () => {
    const state = returnFixture();
    pickup(state);
    const ledger = structuredClone(state.ledger);
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods").balance,
    ).toBe("570.00");
    recordItemResolutions(state, worker, "c4-return", [
      {
        product_code: "0003",
        kind: "replaced",
        expected_date: "2026-10-23",
        quantity: 3,
        replacement_quantity: 1,
        replacement_product_code: "0002",
        document: "REPLACEMENT-ALL",
        representative: "Demo Driver",
        received_date: "2026-10-11",
      },
    ]);
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods").balance,
    ).toBe("600.00");
    expect(state.ledger).toEqual(ledger);
  });
});

it("retains detached immutable pickup/claim inputs and rejects a changed shortfall retry", () => {
  const state = returnFixture();
  const input = {
    quantities: { "0003": 1 },
    representative: "Demo Driver",
    slip: "SIGNED-IMMUTABLE",
    shortfalls: {
      "0003": { reason: "Two kept", outcome: "keep_for_next_pickup" as const },
    },
  };
  recordPickup(state, worker, "c4-return", input);
  const saved = structuredClone(record(state));
  input.quantities["0003"] = 2;
  input.shortfalls["0003"].reason = "Changed later";
  expect(record(state)).toEqual(saved);
  expect(() =>
    recordPickup(state, worker, "c4-return", {
      ...input,
      quantities: { "0003": 1 },
    }),
  ).toThrow("duplicate_document");
  const claimInput = {
    type: "credit_current_invoice" as const,
    covers: { "0003": 1 },
    invoice_id: "c4-base-invoice",
    document: "DETACHED-CREDIT",
  };
  submitFinancialClaim(state, worker, "c4-return", claimInput);
  claimInput.covers["0003"] = 3;
  expect(record(state).claims![0].covers).toEqual({ "0003": 1 });
});
it("requires a multi-item verified note to equal the explicit per-item amounts before posting", () => {
  const state = returnFixture();
  state.returns[0].lines.push({
    product_code: "0001",
    qty: 1,
    unit_cost: "5.0000",
    reason: "Damaged",
  });
  recordPickup(state, worker, "c4-return", {
    quantities: { "0003": 3, "0001": 1 },
    representative: "Demo Driver",
    slip: "SIGNED-MULTI-AMOUNT",
  });
  submitFinancialClaim(state, worker, "c4-return", {
    type: "credit_current_invoice",
    covers: { "0003": 1, "0001": 1 },
    invoice_id: "c4-base-invoice",
    document: "MULTI-CREDIT",
  });
  const claimId = record(state).claims![0].id,
    before = structuredClone(state);
  expect(() =>
    postReturnClaim(state, supervisor, "c4-return", claimId, "12.00"),
  ).toThrow("item_credit_amount");
  expect(() =>
    postReturnClaim(state, supervisor, "c4-return", claimId, "12.00", {
      "0003": "8.00",
      "0001": "5.00",
    }),
  ).toThrow("item_credit_amount");
  expect(state).toEqual(before);
  postReturnClaim(state, supervisor, "c4-return", claimId, "12.00", {
    "0003": "8.00",
    "0001": "4.00",
  });
  expect(record(state).claims![0].item_amounts).toEqual({
    "0003": "8.00",
    "0001": "4.00",
  });
});
it("preserves cash/other compensation as an evidence claim with verified item money", () => {
  const state = returnFixture();
  pickup(state);
  recordItemResolutions(state, supervisor, "c4-return", [
    {
      product_code: "0003",
      kind: "cash_or_other",
      expected_date: "2026-10-23",
      quantity: 1,
      amount: "8.00",
      document: "CASH-RECEIPT",
    },
  ]);
  const claim = record(state).claims![0];
  expect(claim.type).toBe("cash_or_other");
  postReturnClaim(state, supervisor, "c4-return", claim.id);
  expect(claim.item_amounts).toEqual({ "0003": "8.00" });
  expect(state.ledger.at(-1)!.amount).toBe("-8.00");
  expect(returnUiStatus(record(state))).toBe("waiting_for_credit");
});
