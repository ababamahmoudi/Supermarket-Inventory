import { describe, expect, it } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { returnFixture } from "./return-test-fixture";
import {
  changeSale,
  savePriceChange,
  saleDateAfter,
  saleStoreDate,
  type ChangePriceInput,
} from "./sales";

describe("E1 changed Sale retains its creator and records the actual new decision identity", () => {
  it("a different genuine Manager owns the revised future plan and lifecycle source without rewriting its original creator", () => {
    const state = returnFixture();
    state.sales = [];
    state.sale_requests = [];
    state.sale_events = [];
    state.activity = [];
    const now = new Date();
    const creator = authenticatedTestActor(state, "manager", {
      name_en: "Fictional original Manager",
      now,
    });
    const today = saleStoreDate(state.config, "Branch 1", now);
    const input: ChangePriceInput = {
      product_code: "0003",
      mode: "sale",
      scope: "current",
      branches: ["Branch 1"],
      price: "1.99",
      price_unit: "each",
      starts_on: saleDateAfter(today, 1),
      last_day: saleDateAfter(today, 7),
      accept_below_margin: true,
      below_cost_reason: "Fictional approved sale planning",
      add_labels: false,
    };
    const original = savePriceChange(state, creator, input, now).sales[0];
    const originalCreation = {
      created_by: original.created_by,
      created_by_user_id: original.created_by_user_id,
      created_by_role_snapshot: original.created_by_role_snapshot,
      created_by_username: original.created_by_username,
      created_at: original.created_at,
    };
    const stock = structuredClone(state.stock),
      ledger = structuredClone(state.ledger);
    const later = new Date();
    const decider = authenticatedTestActor(state, "manager", {
      user_id: "fictional-other-sale-manager",
      username: "fictional-other-sale-manager",
      name_en: "Fictional second Manager",
      now: later,
    });
    const changed = changeSale(
      state,
      decider,
      original.id,
      {
        ...input,
        price: "1.89",
        last_day: saleDateAfter(today, 8),
        expected_revision: original.revision,
      },
      later,
    ).sales[0];
    expect(changed).toMatchObject(originalCreation);
    expect(changed.changed_by_user_id).toBe(decider.user_id);
    expect(changed.changed_by_role_snapshot).toBe(decider.role);
    expect(changed.changed_by).toBe(decider.actor);
    expect(changed.decision_attribution).toMatchObject({
      user_id: decider.user_id,
      name_snapshot: decider.actor,
      role_snapshot: decider.role,
      at: later.toISOString(),
    });
    const event = state.sale_events!.find(
      (item) => item.sale_id === changed.id && item.kind === "changed",
    )!;
    expect(event.source_decision?.user_id).toBe(decider.user_id);
    expect(event.source_decision?.at).toBe(later.toISOString());
    expect(event.actor_user_id).toBe(event.source_decision?.user_id);
    expect(
      state.activity.find((item) => item.action === "Change sale")
        ?.actor_user_id,
    ).toBe(decider.user_id);
    expect(state.stock).toEqual(stock);
    expect(state.ledger).toEqual(ledger);
  });
});
