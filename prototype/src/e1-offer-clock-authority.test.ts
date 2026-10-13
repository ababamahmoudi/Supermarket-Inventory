import { describe, expect, it } from "vitest";
import { returnFixture } from "./return-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { stopOffer } from "./approvals";
import { attachReversals, canReverse, reverseActivity } from "./history";
import { effectiveOffer } from "./catalog";
import { evaluateSales } from "./sales";
import { reconcileFixture } from "./system-reconciliation-test-fixture";
import type { SystemAttribution } from "./authority-types";
import type { DemoState, Offer } from "./types";

function fixture() {
  const state = returnFixture();
  state.activity = [];
  state.sales = [];
  state.sale_requests = [];
  state.sale_events = [];
  const mapping = state.config.promotions.price_to_offer[0];
  const product = state.products.find((item) => item.code === "0003")!;
  product.selling_price = mapping.price;
  product.branch_prices = {
    "Branch 1": mapping.price,
    "Branch 2": mapping.price,
  };
  const offer: Offer = {
    id: "e1-company-multibuy",
    company_id: state.config.company.seed_key,
    branch: "all",
    scope: "all",
    product_code: product.code,
    label: mapping.offer,
    price: mapping.price,
    pool: mapping.mix_and_match_pool,
    mix_and_match: true,
    status: "active",
    currency: state.config.company.currency,
    version: 7,
  };
  state.offers = [offer];
  const actor = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
  });
  return { state, offer, actor };
}
describe("E1 scoped company offer Stop and private clock authority", () => {
  it("Floor Worker stops only its actual store and Undo retains original evidence", () => {
    const { state, offer, actor } = fixture();
    const before = cloneWithAuthority(state);
    const original = structuredClone(offer);
    stopOffer(state, actor, offer.id, false, 7);
    expect(state.offers[0]).toEqual(original);
    expect(effectiveOffer(state, "0003", "Branch 1")).toBeNull();
    expect(effectiveOffer(state, "0003", "Branch 2")?.id).toBe(offer.id);
    const entries = attachReversals(before, state, actor);
    const entry = entries.find((item) => item.action === "Stop offer")!;
    expect(entry.actor_user_id).toBe(actor.user_id);
    expect(entry.branch).toBe("Branch 1");
    expect(canReverse(state, entry, actor, "undo")).toBe(true);
    reverseActivity(state, actor, entry.id, "undo");
    expect(state.offer_store_suppressions).toHaveLength(1);
    expect(state.offer_store_suppressions![0].status).toBe("cleared");
    expect(state.offer_store_suppressions![0].cleared_by_user_id).toBe(
      actor.user_id,
    );
    expect(state.offers[0]).toEqual(original);
    expect(effectiveOffer(state, "0003", "Branch 1")?.id).toBe(offer.id);
  });
  it("a revised company source blocks clearing a retained previous-version stop", () => {
    const { state, offer, actor } = fixture();
    const before = cloneWithAuthority(state);
    stopOffer(state, actor, offer.id, false, 7);
    const entry = attachReversals(before, state, actor).find(
      (item) => item.action === "Stop offer",
    )!;
    offer.version = 8;
    const latest = cloneWithAuthority(state);
    expect(canReverse(state, entry, actor, "undo")).toBe(false);
    expect(() => reverseActivity(state, actor, entry.id, "undo")).toThrow();
    expect(state).toEqual(latest);
  });
  it("an assigned aggregate cannot silently pick a store for company offer Stop", () => {
    const { state, offer } = fixture();
    const actor = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1", "Branch 2"],
      selection: { kind: "all_my_locations" },
    });
    const before = cloneWithAuthority(state);
    expect(() => stopOffer(state, actor, offer.id, false, 7)).toThrow();
    expect(state).toEqual(before);
  });
  it("plain system attribution cannot start a clock mutation", () => {
    const { state } = fixture();
    const before = cloneWithAuthority(state);
    expect(() =>
      evaluateSales(state, {
        kind: "system",
        source_event_id: "forged",
        applied_at: new Date().toISOString(),
      }),
    ).toThrow();
    expect(state).toEqual(before);
  });
  it("repository witnesses deny wrong sources, cloned drafts and copied attribution atomically", async () => {
    const { state } = fixture();
    const before = cloneWithAuthority(state);
    await expect(
      reconcileFixture(
        state,
        "return_credit_reminders",
        (canonical, attribution) => evaluateSales(canonical, attribution),
      ),
    ).rejects.toThrow();
    await expect(
      reconcileFixture(state, "sales_clock", (canonical, attribution) =>
        evaluateSales(cloneWithAuthority(canonical), attribution),
      ),
    ).rejects.toThrow();
    await expect(
      reconcileFixture(state, "sales_clock", (canonical, attribution) =>
        evaluateSales(canonical, { ...attribution }),
      ),
    ).rejects.toThrow();
    expect(state).toEqual(before);
  });
  it("even the exact witness expires when its real repository callback finishes", async () => {
    const { state } = fixture();
    let captured:
      { state: DemoState; attribution: SystemAttribution } | undefined;
    await reconcileFixture(state, "sales_clock", (canonical, attribution) => {
      captured = { state: canonical, attribution };
      return evaluateSales(canonical, attribution);
    });
    const source = captured!;
    const before = cloneWithAuthority(source.state);
    expect(() => evaluateSales(source.state, source.attribution)).toThrow();
    expect(source.state).toEqual(before);
  });
});
