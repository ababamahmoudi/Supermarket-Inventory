import { describe, expect, it } from "vitest";
import { returnFixture } from "./return-test-fixture";
import {
  recordPickup,
  receiveReplacement,
  submitFinancialClaim,
  postReturnClaim,
  correctReturnPickup,
  type OperationalReturn,
} from "./operations";
import {
  recordItemResolutions,
  returnItemProgress,
} from "./return-item-resolutions";
import { signedReturnPickupQuantities } from "./signed-return-pickups";
import { pendingReturnCredits } from "./return-workflow";
import { authenticatedTestActor } from "./authority-test-fixture";
const worker = (state: ReturnType<typeof returnFixture>) =>
  authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    name_en: "Demo Floor Worker",
  });
const supervisor = (state: ReturnType<typeof returnFixture>) =>
  authenticatedTestActor(state, "manager", { name_en: "Demo Supervisor" });
const pickup = (state: ReturnType<typeof returnFixture>, quantity = 3) =>
  recordPickup(state, worker(state), "c4-return", {
    quantities: { "0003": quantity },
    representative: "Demo Driver",
    slip: "SIGNED-PER-ITEM",
    shortfalls: {
      "0003": {
        reason: "Kept for next pickup",
        outcome: "keep_for_next_pickup",
      },
    },
  });
const ownRecord = (state: ReturnType<typeof returnFixture>) =>
  state.returns.find(
    (record) =>
      record.id === "c4-return" &&
      record.company_id === state.config.company.seed_key &&
      record.branch === "Branch 1",
  )! as OperationalReturn;
describe("C6 signed per-item resolution write guard", () => {
  it("rejects unrelated signed evidence even when a legacy aggregate claims all units were picked up", () => {
    const state = returnFixture();
    const record = ownRecord(state);
    record.lines[0].picked_up = 3;
    record.evidence = [
      {
        id: "legacy-signed-other-line",
        kind: "pickup",
        at: "2026-10-01T12:00:00Z",
        by: "Legacy",
        document: "OTHER-SIGNED",
        representative: "Driver",
        quantities: { "0002": 1 },
      },
    ];
    const before = structuredClone(state);
    expect(() =>
      submitFinancialClaim(state, worker(state), record.id, {
        type: "credit_current_invoice",
        covers: { "0003": 3 },
        invoice_id: "c4-base-invoice",
        document: "NO-SIGNED-COVERAGE",
      }),
    ).toThrow("pickup_required");
    expect(() =>
      receiveReplacement(state, worker(state), record.id, {
        product_code: "0002",
        qty: 1,
        covers: { "0003": 1 },
        date: "2026-10-23",
        representative: "Driver",
        receipt: "NO-SIGNED-REPLACEMENT",
      }),
    ).toThrow("pickup_required");
    expect(() =>
      submitFinancialClaim(state, supervisor(state), record.id, {
        type: "no_compensation",
        covers: { "0003": 1 },
        reason: "No signed pickup",
      }),
    ).toThrow("pickup_required");
    expect(() =>
      recordItemResolutions(state, worker(state), record.id, [
        {
          product_code: "0003",
          kind: "outstanding",
          quantity: 1,
          expected_date: "2026-10-23",
        },
      ]),
    ).toThrow("pickup_required");
    expect(state).toEqual(before);
  });
  it("caps writes to signed item quantities rather than an inflated imported picked_up projection", () => {
    const state = returnFixture();
    pickup(state, 1);
    const record = ownRecord(state);
    record.lines[0].picked_up = 3;
    expect([...signedReturnPickupQuantities(record)]).toEqual([["0003", 1]]);
    expect(returnItemProgress(record, record.lines[0])).toMatchObject({
      picked_up: 1,
      available: 1,
    });
    const before = structuredClone(state);
    expect(() =>
      submitFinancialClaim(state, worker(state), record.id, {
        type: "credit_current_invoice",
        covers: { "0003": 2 },
        invoice_id: "c4-base-invoice",
        document: "EXCESS",
      }),
    ).toThrow("coverage");
    expect(state).toEqual(before);
    submitFinancialClaim(state, worker(state), record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 1 },
      invoice_id: "c4-base-invoice",
      document: "ACTUAL-ONE",
    });
    postReturnClaim(
      state,
      supervisor(state),
      record.id,
      record.claims![0].id,
      "8.00",
    );
    expect(() =>
      submitFinancialClaim(state, worker(state), record.id, {
        type: "credit_current_invoice",
        covers: { "0003": 1 },
        invoice_id: "c4-base-invoice",
        document: "DUPLICATE-COVERAGE",
      }),
    ).toThrow("coverage");
    expect(record.lines[0].picked_up).toBe(3); // Retained imported projection is not silently rewritten.
  });
  it("counts one immutable signed event without a memo once and rejects unsigned quantities", () => {
    const state = returnFixture();
    const record = ownRecord(state);
    const event = {
      id: "actual-signed",
      kind: "pickup",
      at: "2026-10-01T12:00:00Z",
      by: "Legacy",
      document: "ACTUAL-SIGNED",
      representative: "Driver",
      quantities: { "0003": 1 },
    };
    record.evidence = [
      event,
      structuredClone(event),
      { ...event, id: "unsigned", document: "", quantities: { "0003": 2 } },
    ];
    record.lines[0].picked_up = 3;
    expect([...signedReturnPickupQuantities(record)]).toEqual([["0003", 1]]);
  });
  it("uses a reasoned signed correction chain and ignores an unreasoned or foreign correction", () => {
    const state = returnFixture();
    pickup(state);
    const record = ownRecord(state),
      original = structuredClone(record.pickup_memos![0]);
    correctReturnPickup(state, supervisor(state), record.id, {
      memo_id: original.id,
      quantities: { "0003": 1 },
      reason: "Signed count reviewed",
      shortfalls: {
        "0003": {
          reason: "Two not picked up",
          outcome: "keep_for_next_pickup",
        },
      },
    });
    expect([...signedReturnPickupQuantities(record)]).toEqual([["0003", 1]]);
    record.lines[0].picked_up = 3;
    expect(() =>
      submitFinancialClaim(state, worker(state), record.id, {
        type: "credit_current_invoice",
        covers: { "0003": 2 },
        invoice_id: "c4-base-invoice",
        document: "AFTER-CORRECTION-EXCESS",
      }),
    ).toThrow("coverage");
    expect(record.pickup_memos![0]).toEqual(original);
    record.pickup_corrections![0].reason = "";
    expect([...signedReturnPickupQuantities(record)]).toEqual([]);
    record.pickup_corrections![0].reason = "Reason";
    record.pickup_corrections![0].company_id = "foreign";
    expect([...signedReturnPickupQuantities(record)]).toEqual([]);
  });
  it("preserves an unsigned historical item while resolving only a newly signed different item", () => {
    const state = returnFixture();
    const record = ownRecord(state);
    record.lines[0].picked_up = 3;
    record.lines[0].settled = 1;
    record.lines.push({
      product_code: "0001",
      qty: 2,
      reason: "Damaged",
      unit_cost: "5.0000",
    });
    const legacy = structuredClone(record.lines[0]);
    recordPickup(state, worker(state), record.id, {
      quantities: { "0001": 1, "0003": 0 },
      representative: "Driver",
      slip: "SIGNED-NEW-ITEM",
      shortfalls: {
        "0001": { reason: "One kept", outcome: "keep_for_next_pickup" },
      },
    });
    recordItemResolutions(state, worker(state), record.id, [
      {
        product_code: "0001",
        kind: "outstanding",
        quantity: 1,
        expected_date: "2026-10-23",
      },
    ]);
    expect(ownRecord(state).lines[0]).toEqual(legacy);
    expect(ownRecord(state).lines[1]).toMatchObject({
      outstanding_expected_date: "2026-10-23",
      picked_up: 1,
    });
    const before = structuredClone(state);
    expect(() =>
      recordItemResolutions(state, worker(state), record.id, [
        {
          product_code: "0003",
          kind: "outstanding",
          quantity: 1,
          expected_date: "2026-10-23",
        },
      ]),
    ).toThrow("pickup_required");
    expect(state).toEqual(before);
  });
  it("scopes a private resolution draft by company and branch even when IDs collide", () => {
    const state = returnFixture();
    pickup(state);
    const own = structuredClone(ownRecord(state));
    const foreign = { ...structuredClone(own), company_id: "foreign-company" };
    const otherLocation = { ...structuredClone(own), branch: "Branch 2" };
    state.returns.unshift(foreign, otherLocation);
    const foreignBefore = structuredClone(foreign),
      otherBefore = structuredClone(otherLocation);
    recordItemResolutions(state, worker(state), "c4-return", [
      {
        product_code: "0003",
        kind: "outstanding",
        quantity: 3,
        expected_date: "2026-10-23",
        note: "Own company note",
      },
    ]);
    expect(state.returns[0]).toEqual(foreignBefore);
    expect(state.returns[1]).toEqual(otherBefore);
    expect(ownRecord(state).lines[0]).toMatchObject({
      outstanding_expected_date: "2026-10-23",
      outstanding_note: "Own company note",
    });
  });
});
it("blocks conflicting duplicate paper quantities and never counts duplicate memo snapshots twice", () => {
  const state = returnFixture();
  pickup(state, 1);
  const record = ownRecord(state);
  const duplicate = structuredClone(record.pickup_memos![0]);
  duplicate.id = "duplicate-memo";
  duplicate.reference = "RM-0002";
  record.pickup_memos!.push(duplicate);
  expect([...signedReturnPickupQuantities(record)]).toEqual([["0003", 1]]);
  duplicate.lines[0].quantity = 2;
  expect([...signedReturnPickupQuantities(record)]).toEqual([]);
  const older = returnFixture();
  const legacy = ownRecord(older);
  legacy.evidence = [1, 2].map((quantity) => ({
    id: `conflicting-paper-${quantity}`,
    kind: "pickup",
    at: "2026-10-01T12:00:00Z",
    by: "Legacy",
    document: "ONE-PAPER",
    representative: "Driver",
    quantities: { "0003": quantity },
  }));
  expect([...signedReturnPickupQuantities(legacy)]).toEqual([]);
});
it("does not fill legacy replacement aggregates when a new unsigned write is rejected", () => {
  const state = returnFixture();
  const record = ownRecord(state);
  record.status = "partially_resolved";
  record.replacement_received = {
    product_code: "0002",
    qty: 1,
    covers_original_qty: 1,
  };
  const before = structuredClone(state);
  expect(() =>
    receiveReplacement(state, worker(state), record.id, {
      product_code: "0002",
      qty: 1,
      covers: { "0003": 1 },
      date: "2026-10-23",
      representative: "Driver",
      receipt: "NEW-WITHOUT-SIGNED-EVIDENCE",
    }),
  ).toThrow("pickup_required");
  expect(state).toStrictEqual(before);
});

it("retained posted claims cap remaining signed coverage even when settled projection is stale zero", () => {
  const state = returnFixture();
  pickup(state);
  const record = ownRecord(state);
  record.status = "partially_resolved";
  record.lines[0].settled = 0;
  record.claims = [
    {
      id: "legacy-posted-credit",
      type: "credit_current_invoice",
      status: "posted",
      covers: { "0003": 2 },
      amount: "20.00",
      document: "LEGACY-CREDIT",
      invoice_id: "c4-base-invoice",
      submitted_by: "Legacy",
      at: "2026-10-01T12:00:00Z",
      posted_by: "Legacy",
    },
  ];
  const before = structuredClone(state);
  expect(returnItemProgress(record, record.lines[0])).toMatchObject({
    resolved: 2,
    available: 1,
  });
  expect(pendingReturnCredits(state, supervisor(state))).toEqual([
    expect.objectContaining({ amount: "10.00" }),
  ]);
  expect(() =>
    submitFinancialClaim(state, worker(state), record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 2 },
      invoice_id: "c4-base-invoice",
      document: "NEW-OVERLAPPING-CREDIT",
    }),
  ).toThrow("coverage");
  expect(() =>
    receiveReplacement(state, worker(state), record.id, {
      product_code: "0002",
      qty: 2,
      covers: { "0003": 2 },
      date: "2026-10-23",
      representative: "Driver",
      receipt: "OVERLAPPING-REPLACEMENT",
    }),
  ).toThrow("coverage");
  expect(state).toStrictEqual(before);
  submitFinancialClaim(state, worker(state), record.id, {
    type: "credit_current_invoice",
    covers: { "0003": 1 },
    invoice_id: "c4-base-invoice",
    document: "ACTUAL-ONE-REMAINING",
  });
  expect(record.claims).toHaveLength(2);
  expect(state.ledger).toEqual(before.ledger); // Submission never posts money.
});
it("pairs posted claim events once, retains replacement coverage and blocks ambiguous duplicate settlements", () => {
  const state = returnFixture();
  pickup(state);
  const record = ownRecord(state);
  submitFinancialClaim(state, supervisor(state), record.id, {
    type: "credit_current_invoice",
    covers: { "0003": 1 },
    invoice_id: "c4-base-invoice",
    document: "CREDIT-ONE",
    amount: "8.00",
  });
  postReturnClaim(state, supervisor(state), record.id, record.claims![0].id);
  record.lines[0].settled = 0;
  expect(returnItemProgress(record, record.lines[0])).toMatchObject({
    resolved: 1,
    available: 2,
  });
  receiveReplacement(state, worker(state), record.id, {
    product_code: "0002",
    qty: 1,
    covers: { "0003": 1 },
    date: "2026-10-23",
    representative: "Driver",
    receipt: "REPLACE-ONE",
  });
  record.lines[0].settled = 0;
  expect(returnItemProgress(record, record.lines[0])).toMatchObject({
    resolved: 2,
    available: 1,
  });
  const conflicting = structuredClone(record.claims![0]);
  conflicting.id = "conflicting-duplicate-note";
  conflicting.covers = { "0003": 2 };
  record.claims!.push(conflicting);
  const before = structuredClone(state);
  expect(() =>
    submitFinancialClaim(state, worker(state), record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 1 },
      invoice_id: "c4-base-invoice",
      document: "UNSAFE-NEW-NOTE",
    }),
  ).toThrow("return_settlement_evidence");
  expect(state).toStrictEqual(before);
});
it("keeps resolved imports closed for new writes while retrying an already recorded replacement exactly once", () => {
  const state = returnFixture();
  pickup(state);
  const record = ownRecord(state);
  const actual = {
    product_code: "0002",
    qty: 1,
    covers: { "0003": 3 },
    date: "2026-10-23",
    representative: "Driver",
    receipt: "RESOLVED-REPLACEMENT",
  };
  receiveReplacement(state, worker(state), record.id, actual);
  const before = structuredClone(state);
  receiveReplacement(state, worker(state), record.id, actual);
  expect(state).toStrictEqual(before);
  record.lines[0].settled = 0;
  const stale = structuredClone(state);
  expect(() =>
    receiveReplacement(state, worker(state), record.id, {
      ...actual,
      receipt: "SECOND-ON-CLOSED",
      covers: { "0003": 1 },
    }),
  ).toThrow("closed");
  expect(() =>
    submitFinancialClaim(state, worker(state), record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 1 },
      invoice_id: "c4-base-invoice",
      document: "CLOSED-CREDIT",
    }),
  ).toThrow("closed");
  expect(() =>
    recordItemResolutions(state, worker(state), record.id, [
      {
        product_code: "0003",
        kind: "outstanding",
        quantity: 1,
        expected_date: "2026-10-23",
      },
    ]),
  ).toThrow("closed");
  expect(state).toStrictEqual(stale);
});
it("does not read a colliding foreign return's posted settlements into the own company's write ceiling", () => {
  const state = returnFixture();
  pickup(state);
  const record = ownRecord(state);
  const foreign = structuredClone(record);
  foreign.company_id = "foreign-company";
  foreign.claims = [
    {
      id: "foreign-credit",
      type: "credit_current_invoice",
      status: "posted",
      covers: { "0003": 3 },
      amount: "30.00",
      document: "FOREIGN-CREDIT",
      invoice_id: "foreign-invoice",
      submitted_by: "Foreign",
      at: "2026-10-01T12:00:00Z",
    },
  ];
  state.returns.unshift(foreign);
  const foreignBefore = structuredClone(foreign);
  recordItemResolutions(state, worker(state), record.id, [
    {
      product_code: "0003",
      kind: "outstanding",
      quantity: 3,
      expected_date: "2026-10-23",
    },
  ]);
  expect(state.returns[0]).toStrictEqual(foreignBefore);
  expect(ownRecord(state).lines[0].outstanding_expected_date).toBe(
    "2026-10-23",
  );
});
it("does not post a preserved unverified claim on an already closed return", () => {
  const state = returnFixture();
  pickup(state);
  const record = ownRecord(state);
  submitFinancialClaim(state, worker(state), record.id, {
    type: "credit_current_invoice",
    covers: { "0003": 1 },
    invoice_id: "c4-base-invoice",
    document: "PRESERVED-SUBMITTED-NOTE",
  });
  record.status = "resolved";
  const before = structuredClone(state);
  expect(() =>
    postReturnClaim(
      state,
      supervisor(state),
      record.id,
      record.claims![0].id,
      "8.00",
    ),
  ).toThrow("closed");
  expect(state).toStrictEqual(before);
});
it("keeps historical postings with missing covered quantities read-only without guessing a zero settlement", () => {
  for (const evidence of ["claim", "event"] as const) {
    const state = returnFixture();
    pickup(state);
    const record = ownRecord(state);
    if (evidence === "claim")
      record.claims = [
        {
          id: "historical-unknown-coverage",
          type: "credit_current_invoice",
          status: "posted",
          covers: {},
          amount: "20.00",
          document: "HISTORICAL-NOTE",
          invoice_id: "c4-base-invoice",
          submitted_by: "Legacy",
          at: "2026-10-01T12:00:00Z",
        },
      ];
    else
      record.evidence!.push({
        id: "historical-unknown-coverage",
        kind: "claim_posted",
        at: "2026-10-01T12:00:00Z",
        by: "Legacy",
        document: "HISTORICAL-NOTE",
      });
    const before = structuredClone(state);
    expect(returnItemProgress(record, record.lines[0]).available).toBe(0);
    expect(() =>
      submitFinancialClaim(state, worker(state), record.id, {
        type: "credit_current_invoice",
        covers: { "0003": 1 },
        invoice_id: "c4-base-invoice",
        document: "NEW-UNKNOWN-OVERLAP",
      }),
    ).toThrow("return_settlement_evidence");
    expect(state).toStrictEqual(before);
  }
});
it("does not guess which original item a legacy multi-item replacement snapshot settled", () => {
  const state = returnFixture();
  const record = ownRecord(state);
  record.lines.push({
    product_code: "0002",
    qty: 1,
    reason: "Damaged",
    quantity_unit: "units",
  });
  recordPickup(state, worker(state), record.id, {
    quantities: { "0003": 3, "0002": 1 },
    representative: "Driver",
    slip: "SIGNED-MULTIPLE-ITEMS",
  });
  record.replacement_received = {
    product_code: "0002",
    qty: 1,
    covers_original_qty: 1,
  };
  const before = structuredClone(state);
  expect(() =>
    submitFinancialClaim(state, worker(state), record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 1 },
      invoice_id: "c4-base-invoice",
      document: "UNKNOWN-LEGACY-REPLACEMENT-COVERAGE",
    }),
  ).toThrow("return_settlement_evidence");
  expect(state).toStrictEqual(before);
});
it.each(["snapshot", "line_projection", "mismatched_event"] as const)(
  "keeps an event-less legacy replacement %s plus a posted credit read-only rather than maxing unrelated outcomes",
  (representation) => {
    const state = returnFixture();
    pickup(state);
    const record = ownRecord(state);
    record.status = "partially_resolved";
    record.lines[0].settled = 0;
    if (representation !== "line_projection")
      record.replacement_received = {
        product_code: "0003",
        qty: 2,
        covers_original_qty: 2,
      };
    else record.lines[0].replaced = 2;
    if (representation === "mismatched_event")
      record.evidence!.push({
        id: "different-legacy-replacement",
        kind: "replacement",
        at: "2026-10-01T12:00:00Z",
        by: "Legacy",
        document: "DIFFERENT-REPLACEMENT-RECEIPT",
        quantities: { "0003": 1 },
        product_code: "0003",
        actual_qty: 1,
      });
    record.claims = [
      {
        id: "historical-credit-one",
        type: "credit_current_invoice",
        status: "posted",
        covers: { "0003": 1 },
        amount: "10.00",
        document: "HISTORICAL-CREDIT-ONE",
        invoice_id: "c4-base-invoice",
        submitted_by: "Legacy",
        at: "2026-10-01T12:00:00Z",
      },
    ];
    const before = structuredClone(state);
    expect(returnItemProgress(record, record.lines[0]).available).toBe(0);
    expect(() =>
      submitFinancialClaim(state, worker(state), record.id, {
        type: "credit_current_invoice",
        covers: { "0003": 1 },
        invoice_id: "c4-base-invoice",
        document: "NEW-CREDIT-ON-MIXED-LEGACY",
      }),
    ).toThrow("return_settlement_evidence");
    expect(() =>
      submitFinancialClaim(state, supervisor(state), record.id, {
        type: "no_compensation",
        covers: { "0003": 1 },
        reason: "New writeoff on mixed history",
      }),
    ).toThrow("return_settlement_evidence");
    expect(() =>
      receiveReplacement(state, worker(state), record.id, {
        product_code: "0002",
        qty: 1,
        covers: { "0003": 1 },
        date: "2026-10-23",
        representative: "Driver",
        receipt: "NEW-REPLACEMENT-ON-MIXED-LEGACY",
      }),
    ).toThrow("return_settlement_evidence");
    expect(() =>
      recordItemResolutions(state, worker(state), record.id, [
        {
          product_code: "0003",
          kind: "outstanding",
          quantity: 1,
          expected_date: "2026-10-23",
        },
      ]),
    ).toThrow("return_settlement_evidence");
    expect(state).toStrictEqual(before);
  },
);
