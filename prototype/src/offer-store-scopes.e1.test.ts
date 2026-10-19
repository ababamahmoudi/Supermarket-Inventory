import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { migrateE1BusinessState } from "./e1-state-migration";
import { effectiveOffer, effectivePrice } from "./catalog";
import {
  clearOfferStoreSuppression,
  offerVersion,
  stopCompanyOfferAtStore,
} from "./offer-store-scopes";
import { scopedOffers, pastOffers } from "./offer-list";
import { projectOffersReadView } from "./offers-read-model";
import { projectCatalogReadView } from "./catalog-read-model";
import { savePriceChange, saleDateAfter, saleStoreDate } from "./sales";
import { companyLocalToUtc } from "./company-time";
import { branchId } from "./settings";
import type { DemoState, Offer } from "./types";

let state: DemoState;
let offer: Offer;
beforeEach(() => {
  state = migrateE1BusinessState(initialState());
  offer = state.offers.find(
    (record) =>
      record.product_code === "0003" &&
      record.scope === "all" &&
      record.status === "active",
  )!;
  expect(offer).toBeDefined();
});
describe("E1 own-store stop of a company offer", () => {
  it("preserves the global record, other stores and regular charge while stopping own effective terms", () => {
    const actor = authenticatedTestFixture(state, "floor_worker", {
      locations: ["Branch 1"],
      selection: { kind: "location", location_id: "Branch 1" },
    }).actor;
    const original = structuredClone(state.offers);
    const other = effectiveOffer(state, "0003", "Branch 2");
    const price = effectivePrice(state, "0003", "Branch 1");
    const stop = stopCompanyOfferAtStore(
      state,
      actor,
      offer.id,
      offerVersion(offer),
    );
    expect(stop).toMatchObject({
      branch: "Branch 1",
      offer_id: offer.id,
      offer_version: offerVersion(offer),
      stopped_by_user_id: actor.user_id,
    });
    expect(state.offers).toEqual(original);
    expect(effectiveOffer(state, "0003", "Branch 1")).toBeNull();
    expect(effectivePrice(state, "0003", "Branch 1")).toBe(price);
    expect(effectiveOffer(state, "0003", "Branch 2")).toEqual(other);
    expect(
      pastOffers(
        scopedOffers(state, "Branch 1"),
        state.config.company.timezone,
      ),
    ).toContainEqual(
      expect.objectContaining({
        id: offer.id,
        status: "stopped",
        branch: "Branch 1",
      }),
    );
    expect(
      stopCompanyOfferAtStore(state, actor, offer.id, offerVersion(offer)),
    ).toBeNull();
    expect(state.offer_store_suppressions).toHaveLength(1);
    const view = projectCatalogReadView(state, actor);
    expect(
      effectiveOffer(
        { config: state.config, ...view, sales: [] },
        "0003",
        "Branch 1",
      ),
    ).toBeNull();
    expect(
      projectOffersReadView(state, actor).offer_store_suppressions[0],
    ).not.toHaveProperty("stopped_by_user_id");
  });
  it("keeps suppression evidence when an authorized undo clears the exact version", () => {
    const actor = authenticatedTestFixture(state, "floor_worker", {
      locations: ["Branch 1"],
    }).actor;
    const stop = stopCompanyOfferAtStore(
      state,
      actor,
      offer.id,
      offerVersion(offer),
    )!;
    clearOfferStoreSuppression(state, actor, stop.id);
    expect(state.offer_store_suppressions).toHaveLength(1);
    expect(stop).toMatchObject({
      status: "cleared",
      cleared_by_user_id: actor.user_id,
    });
    expect(effectiveOffer(state, "0003", "Branch 1")?.id).toBe(offer.id);
  });
  it("rejects aggregate guesses, stale versions and unsupported role inheritance without mutation", () => {
    const actor = authenticatedTestFixture(state, "floor_worker", {
      locations: ["Branch 1", "Branch 2"],
      selection: { kind: "all_my_locations" },
    }).actor;
    const before = structuredClone(state.offer_store_suppressions);
    expect(() =>
      stopCompanyOfferAtStore(state, actor, offer.id, offerVersion(offer)),
    ).toThrow();
    const concrete = authenticatedTestFixture(state, "floor_worker", {
      locations: ["Branch 1"],
    }).actor;
    expect(() =>
      stopCompanyOfferAtStore(
        state,
        concrete,
        offer.id,
        offerVersion(offer) + 1,
      ),
    ).toThrow();
    const supervisor = authenticatedTestFixture(state, "branch_supervisor", {
      locations: ["Branch 1"],
    }).actor;
    expect(() =>
      stopCompanyOfferAtStore(state, supervisor, offer.id, offerVersion(offer)),
    ).toThrow();
    expect(state.offer_store_suppressions).toEqual(before);
  });
  it("continues stopping the same terms across sale pause and automatic end, without a global fallback", () => {
    const actor = authenticatedTestFixture(state, "floor_worker", {
      locations: ["Branch 1"],
    }).actor;
    stopCompanyOfferAtStore(state, actor, offer.id, offerVersion(offer));
    const version = offerVersion(offer);
    const originalOffers = structuredClone(state.offers);
    const now = new Date();
    expect(effectivePrice(state, "0003", "Branch 1", now)).toBe("2.99");
    expect(offer.price).toBe("2.99");
    const today = saleStoreDate(state.config, "Branch 1", now);
    const manager = authenticatedTestFixture(state, "manager", {
      selection: { kind: "location", location_id: "Branch 1" },
      now,
    }).actor;
    savePriceChange(
      state,
      manager,
      {
        product_code: "0003",
        mode: "sale",
        scope: "current",
        price: "1.49",
        price_unit: "each",
        branches: ["Branch 1"],
        starts_on: today,
        last_day: today,
        accept_below_margin: true,
        below_cost_reason: "Fictional own-store suppression test",
        add_labels: false,
      },
      now,
    );
    expect(effectivePrice(state, "0003", "Branch 1", now)).toBe("1.49");
    expect(effectiveOffer(state, "0003", "Branch 1", now)).toBeNull();
    const store = state.config.branches.find(
      (entry, index) => branchId(entry, index) === "Branch 1",
    );
    expect(store).toBeDefined();
    const afterLastDay = new Date(
      companyLocalToUtc(
        {
          ...state.config,
          company: {
            ...state.config.company,
            timezone: store?.timezone || state.config.company.timezone,
          },
        },
        saleDateAfter(today, 1),
        "00:00",
      ),
    );
    expect(effectiveOffer(state, "0003", "Branch 1", afterLastDay)).toBeNull();
    expect(effectivePrice(state, "0003", "Branch 1", afterLastDay)).toBe(
      "2.99",
    );
    expect(offerVersion(offer)).toBe(version);
    expect(state.offers).toEqual(originalOffers);
    expect(effectiveOffer(state, "0003", "Branch 2")?.id).toBe(offer.id);
  });
});
