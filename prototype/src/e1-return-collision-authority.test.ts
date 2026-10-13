import { describe, expect, it } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { actorAtLocation, cloneWithAuthority } from "./authority";
import { recordPickup } from "./operations";
import { recordItemResolutions } from "./return-item-resolutions";
import { returnFixture } from "./return-test-fixture";
import {
  returnFinancialFingerprint,
  syncReturnCreditAlertsForReturn,
} from "./return-workflow";

function collisionFixture() {
  const state = returnFixture();
  const actor = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
  });
  const own = state.returns.find(
    (item) =>
      item.company_id === actor.company_id &&
      item.branch === "Branch 1" &&
      item.id === "c4-return",
  )!;
  const foreign = { ...structuredClone(own), company_id: "foreign-company" };
  const other = { ...structuredClone(own), branch: "Branch 2" };
  state.returns.unshift(foreign, other);
  state.alerts.push({
    id: "other-location-alert",
    company_id: actor.company_id,
    branch: "Branch 2",
    type: "return_credit_overdue",
    return_id: own.id,
    product_code: own.lines[0].product_code,
    status: "pending",
  });
  return { state, actor, own, foreign, other };
}

describe("canonical return identity across reminder effects", () => {
  it("records own pickup with colliding IDs while preserving foreign returns and the other location's alert", () => {
    const { state, actor, own, foreign, other } = collisionFixture();
    const foreignBefore = structuredClone(foreign),
      otherBefore = structuredClone(other);
    const alertBefore = structuredClone(
      state.alerts.find((item) => item.id === "other-location-alert"),
    );
    recordPickup(state, actor, own.id, {
      quantities: { "0003": 3 },
      representative: "Actual Driver",
      slip: "OWN-COLLISION-PICKUP",
    });
    expect(own.pickup_memos?.[0].return_id).toBe(own.id);
    expect(own.pickup_memos?.[0].branch).toBe("Branch 1");
    expect(foreign).toEqual(foreignBefore);
    expect(other).toEqual(otherBefore);
    expect(
      state.alerts.find((item) => item.id === "other-location-alert"),
    ).toEqual(alertBefore);
  });

  it("rejects a copied canonical-shaped return and a reference from another draft before alert mutations", () => {
    const { state, actor, own } = collisionFixture();
    const before = structuredClone(state);
    expect(() =>
      syncReturnCreditAlertsForReturn(
        state,
        actor,
        structuredClone(own),
        "returns.operational_resolve",
      ),
    ).toThrow("scope");
    const otherDraft = cloneWithAuthority(state);
    expect(() =>
      syncReturnCreditAlertsForReturn(
        otherDraft,
        actor,
        own,
        "returns.operational_resolve",
      ),
    ).toThrow("scope");
    expect(state).toEqual(before);
    expect(otherDraft).toEqual(before);
  });

  it("guards the exact other-location canonical reference instead of substituting an allowed same-ID return", () => {
    const { state, actor, other } = collisionFixture();
    const before = structuredClone(state);
    expect(() =>
      syncReturnCreditAlertsForReturn(
        state,
        actor,
        other,
        "returns.operational_resolve",
      ),
    ).toThrow();
    expect(state).toEqual(before);
  });

  it("rejects duplicated exact company/location/ID resolution tuples without modifying either record", () => {
    const { state, actor, own } = collisionFixture();
    state.returns.push(structuredClone(own));
    const before = structuredClone(state);
    expect(() =>
      recordItemResolutions(state, actor, own.id, [
        {
          product_code: "0003",
          kind: "outstanding",
          quantity: 3,
          expected_date: "2026-10-23",
        },
      ]),
    ).toThrow("scope");
    expect(state).toEqual(before);
  });

  it("rejects an ambiguous aggregate financial fingerprint and permits an actual concrete Manager selection", () => {
    const { state, own } = collisionFixture();
    const manager = authenticatedTestActor(state, "manager", {
      selection: { kind: "all_locations" },
    });
    expect(() => returnFinancialFingerprint(state, manager, own.id)).toThrow(
      "scope",
    );
    expect(
      returnFinancialFingerprint(
        state,
        actorAtLocation(state, manager, "Branch 1"),
        own.id,
      ),
    ).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
