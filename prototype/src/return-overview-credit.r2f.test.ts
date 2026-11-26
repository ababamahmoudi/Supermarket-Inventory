import { expect, it } from "vitest";
import Decimal from "decimal.js";
import { pendingReturnCredits } from "./return-workflow";
import { returnCreateFixture } from "./return-create-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import { createReturn, returnCreateChoices } from "./return-create";
import {
  recordPickup,
  submitFinancialClaim,
  postReturnClaim,
  type OperationalReturn,
} from "./operations";
import { returnOverviewCredits } from "./return-overview-credit";
function fixture() {
  const state = returnCreateFixture();
  const actor = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
  });
  const choice = returnCreateChoices(state, actor, "Branch 1").products[0];
  const id = createReturn(state, actor, {
    request_id: "fictional-credit-overview",
    branch: "Branch 1",
    supplier_id: choice.supplier_id,
    product_code: choice.product_code,
    source_fingerprint: choice.source_fingerprint,
    quantity: "4",
    quantity_unit: "units",
    reason: "wrong_item",
    note: "Fictional return",
    photos: [],
  });
  const record = state.returns.find(
    (row) => row.id === id,
  )! as OperationalReturn;
  const read = () =>
    returnOverviewCredits(state, actor).find((row) => row.return_id === id)!;
  return { state, actor, id, record, read };
}
it("D8 retained expected credit stays in the original currency and a read changes no financial/stock state", () => {
  const { state, actor, read } = fixture();
  const before = JSON.stringify(state);
  expect(read()).toMatchObject({ amount: "28.50", currency: "CAD" });
  expect(JSON.stringify(state)).toBe(before);
  state.config.company.currency = "USD";
  state.products.find((row) => row.code === "0003")!.last_cost_before_tax =
    "999.0000";
  expect(read()).toMatchObject({ amount: "28.50", currency: "CAD" });
  expect(returnOverviewCredits(state, actor)).toHaveLength(1);
});
it("D8 an actual posted partial settlement reduces expected credit once; a pending claim does not", () => {
  const { state, actor, id, record, read } = fixture();
  recordPickup(state, actor, id, {
    quantities: { "0003": 4 },
    representative: "Fictional driver",
    slip: "SIGNED-D8-PAPER",
  });
  submitFinancialClaim(state, actor, id, {
    type: "cash_or_other",
    covers: { "0003": 2 },
    document: "D8-FICTIONAL-REFUND",
    amount: "14.25",
  });
  expect(read().amount).toBe("28.50");
  const claim = record.claims![0];
  postReturnClaim(state, actor, id, claim.id, "14.25");
  expect(read().amount).toBe("14.25");
  expect(read().amount).toBe("14.25");
});
it("D8 missing legacy cost/currency is unknown, never a current-cost or zero guess", () => {
  const { state, record, read } = fixture();
  delete record.currency;
  delete record.lines[0].unit_cost;
  expect(read()).toMatchObject({ amount: null, currency: null });
  record.currency = "CAD";
  expect(read()).toMatchObject({ amount: null, currency: "CAD" });
  expect(
    state.products.find((row) => row.code === "0003")!.last_cost_before_tax,
  ).toBeTruthy();
});
it("D8 legacy money requires the complete signed memo and retains its original denomination after a settings change", () => {
  const { state, actor, id, record, read } = fixture();
  recordPickup(state, actor, id, {
    quantities: { "0003": 4 },
    representative: "Fictional driver",
    slip: "SIGNED-D8-LEGACY",
  });
  delete record.creation_request_id;
  delete record.currency;
  delete record.lines[0].unit_cost;
  state.config.company.currency = "USD";
  expect(read()).toMatchObject({ amount: "28.50", currency: "CAD" });
  record.pickup_memos![0].signed_evidence_reference = "";
  expect(read().amount).toBeNull();
});
it.each(["cashier", "floor_worker", "branch_supervisor"] as const)(
  "D8 denies credit values to %s",
  (role) => {
    const { state } = fixture();
    const actor = authenticatedTestActor(state, role, {
      locations: ["Branch 1"],
    });
    expect(() => returnOverviewCredits(state, actor)).toThrow();
  },
);
it("D8 filters company/location records and rejects a copied actor", () => {
  const { state, actor, record } = fixture();
  state.returns.push(
    {
      ...structuredClone(record),
      id: "foreign",
      company_id: "foreign-company",
    },
    { ...structuredClone(record), id: "other-branch", branch: "Branch 2" },
  );
  expect(
    returnOverviewCredits(state, actor).map((row) => row.return_id),
  ).toEqual([record.id]);
  expect(() => returnOverviewCredits(state, { ...actor })).toThrow();
});

it.each(["put_back_on_shelf", "throw_away", "keep_for_next_pickup"] as const)(
  "D8 expected credit follows actual %s pickup disposition",
  (outcome) => {
    const { state, actor, id, read } = fixture();
    recordPickup(state, actor, id, {
      quantities: { "0003": 2 },
      representative: "Fictional driver",
      slip: `D8-${outcome}`,
      shortfalls: {
        "0003": { reason: "Fictional uncollected goods", outcome },
      },
    });
    expect(read().amount).toBe(
      outcome === "keep_for_next_pickup" ? "28.50" : "14.25",
    );
  },
);
it("D8 malformed retained quantities stay explicitly unknown", () => {
  const { record, read } = fixture();
  record.lines[0].qty = Number.NaN;
  expect(read()).toMatchObject({ amount: null, currency: "CAD" });
});

it("D8 sums each retained legacy memo line before subtracting an actual partial settlement", () => {
  const { state, actor, id, record, read } = fixture();
  record.lines.push({
    ...record.lines[0],
    product_code: "0001",
    qty: 2,
    unit_cost: "1.2500",
  });
  recordPickup(state, actor, id, {
    quantities: { "0003": 4, "0001": 2 },
    representative: "Fictional driver",
    slip: "SIGNED-D8-TWO-LINES",
  });
  delete record.creation_request_id;
  delete record.currency;
  for (const line of record.lines) delete line.unit_cost;
  expect(read()).toMatchObject({ amount: "31.00", currency: "CAD" });
  submitFinancialClaim(state, actor, id, {
    type: "cash_or_other",
    covers: { "0003": 1 },
    document: "D8-TWO-LINE-CREDIT",
    amount: "7.13",
  });
  expect(read().amount).toBe("31.00");
  postReturnClaim(state, actor, id, record.claims![0].id, "7.13");
  expect(read().amount).toBe("23.88");
});

it("D8 signed pickup with a missing/contradictory legacy projection remains unknown instead of counting units twice", () => {
  const { state, actor, id, record, read } = fixture();
  recordPickup(state, actor, id, {
    quantities: { "0003": 3 },
    shortfalls: {
      "0003": { reason: "Driver capacity", outcome: "keep_for_next_pickup" },
    },
    representative: "Fictional driver",
    slip: "SIGNED-D8-MISSING-PROJECTION",
  });
  // The actual 3-unit memo retains21.38 and the separate unpicked line rounds7.13.
  expect(read().amount).toBe("28.51");
  delete record.lines[0].picked_up;
  expect(read().amount).toBeNull();
  record.lines[0].picked_up = 2;
  expect(read().amount).toBeNull();
});
it.each(["resolved", "cancelled"] as const)(
  "D8 %s legacy records with missing retained cost are unknown, never a guessed zero",
  (status) => {
    const { record, read } = fixture();
    record.status = status;
    delete record.lines[0].unit_cost;
    expect(read().amount).toBeNull();
  },
);

it("D8 rounds each original cost line like actual signed memos, including half-cent lines", () => {
  const { state, actor, id, record, read } = fixture();
  record.lines[0].qty = 1;
  record.lines[0].unit_cost = "0.0050";
  record.lines.push({ ...record.lines[0], product_code: "0001" });
  expect(read().amount).toBe("0.02");
  recordPickup(state, actor, id, {
    quantities: { "0003": 1, "0001": 1 },
    representative: "Fictional driver",
    slip: "SIGNED-D8-HALF-CENTS",
  });
  expect(read().amount).toBe("0.02");
  expect(pendingReturnCredits(state, actor)[0].amount).toBe("0.02");
});
it("D8 split pickups use their genuine retained cent totals and actual proportional settlement", () => {
  const { state, actor, id, record, read } = fixture();
  recordPickup(state, actor, id, {
    quantities: { "0003": 1 },
    shortfalls: {
      "0003": { reason: "Driver capacity", outcome: "keep_for_next_pickup" },
    },
    representative: "Fictional driver",
    slip: "SIGNED-D8-SPLIT-ONE",
  });
  expect(read().amount).toBe("28.51");
  recordPickup(state, actor, id, {
    quantities: { "0003": 3 },
    representative: "Fictional driver",
    slip: "SIGNED-D8-SPLIT-TWO",
  });
  const projected = () =>
    pendingReturnCredits(state, actor)
      .reduce((sum, row) => sum.plus(row.amount), new Decimal(0))
      .toFixed(2);
  expect(read().amount).toBe("28.51");
  expect(read().amount).toBe(projected());
  submitFinancialClaim(state, actor, id, {
    type: "cash_or_other",
    covers: { "0003": 2 },
    document: "D8-SPLIT-CREDIT",
    amount: "14.25",
  });
  postReturnClaim(state, actor, id, record.claims![0].id, "14.25");
  expect(read().amount).toBe("14.25");
  expect(read().amount).toBe(projected());
});
