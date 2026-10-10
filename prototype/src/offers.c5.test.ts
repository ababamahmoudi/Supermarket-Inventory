import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateOffer, applyApprovedPrice, stopOffer } from "./approvals";
import { effectiveOffer } from "./catalog";
import { currentOfferGroups, pastOffers, scopedOffers } from "./offer-list";
import { initialState } from "./store";
import { attachReversals, reverseActivity, HistoryError } from "./history";
import { configuredBranches } from "./settings";
import type { DemoState, Offer } from "./types";

function fixture() {
  const state = initialState();
  state.offers = [];
  state.activity = [];
  const product = state.products.find((item) => item.code === "0003")!;
  product.selling_price = "2.99";
  product.branch_prices = {};
  return state;
}

function offer(state: DemoState, values: Partial<Offer> = {}): Offer {
  return {
    id: "juice:first",
    company_id: state.config.company.seed_key,
    branch: "all",
    scope: "all",
    product_code: "0003",
    label: "2 for $5",
    price: "2.99",
    pool: "2_for_5",
    currency: state.config.company.currency,
    mix_and_match: true,
    status: "active",
    ...values,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T16:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("C5 offers retain history without duplicate current products", () => {
  it("Undo restores the previous offer, retains the new stopped version and refuses a later conflicting edit", () => {
    for (const conflictingChange of [false, true]) {
      const state = fixture();
      activateOffer(state, offer(state), "supervisor");
      const before = structuredClone(state);
      activateOffer(
        state,
        offer(state, { id: "changed", mix_and_match: false }),
        "supervisor",
      );
      const context = {
        company_id: state.config.company.seed_key,
        role: "supervisor" as const,
        actor: "Demo Supervisor",
        username: "supervisor",
        branch: "Branch 1",
        allowed_branches: configuredBranches(state.config, true),
      };
      const [entry] = attachReversals(before, state, context);
      if (conflictingChange) {
        state.offers.find((item) => item.id === "changed")!.end_date =
          "2026-11-01";
        const edited = structuredClone(state);
        expect(() => reverseActivity(state, context, entry.id, "undo")).toThrow(
          HistoryError,
        );
        expect(state).toEqual(edited);
      } else {
        const unrelated = state.products.find((item) => item.code === "0004")!;
        unrelated.name_en = "A later unrelated edit";
        reverseActivity(state, context, entry.id, "undo");
        expect(state.offers.find((item) => item.id === "juice:first")).toEqual(
          before.offers[0],
        );
        expect(state.offers.find((item) => item.id === "changed")?.status).toBe(
          "stopped",
        );
        expect(unrelated.name_en).toBe("A later unrelated edit");
        expect(state.ledger).toEqual(before.ledger);
      }
    }
  });

  it("confirms a redundant saved suggestion without replacing the already active offer", () => {
    const state = fixture();
    activateOffer(state, offer(state));
    const active = structuredClone(state.offers[0]);
    const suggested = offer(state, {
      id: "suggested:duplicate",
      status: "suggested",
    });
    state.offers.push(suggested);
    expect(activateOffer(state, suggested)).toBe("created");
    expect(state.offers[0]).toEqual(active);
    expect(state.offers[1]).toMatchObject({
      id: suggested.id,
      status: "stopped",
    });
    expect(state.activity.at(-1)?.action).toBe("Confirm offer");
    expect(
      currentOfferGroups(state.offers, state.config.company.timezone)[0],
    ).toEqual([active]);
    const snapshot = structuredClone(state);
    expect(activateOffer(state, suggested)).toBe("unchanged");
    expect(state).toEqual(snapshot);
  });

  it("changed terms using an existing offer identity retain its original version", () => {
    const state = fixture();
    activateOffer(state, offer(state));
    const original = structuredClone(state.offers[0]);
    activateOffer(state, { ...state.offers[0], mix_and_match: false });
    expect(state.offers).toHaveLength(2);
    expect(state.offers[0]).toEqual({
      ...original,
      status: "stopped",
      stopped_at: "2026-10-10T16:00:00.000Z",
    });
    expect(state.offers[1].id).not.toBe(original.id);
    expect(state.offers[1]).toMatchObject({
      status: "active",
      mix_and_match: false,
    });
  });

  it("repeating the same active or scheduled creation adds no version or History entry", () => {
    for (const dates of [
      {},
      { start_date: "2026-11-01", end_date: "2026-11-30" },
    ]) {
      const state = fixture();
      const first = offer(state, dates);
      expect(activateOffer(state, first)).toBe("created");
      const before = structuredClone(state);
      expect(activateOffer(state, { ...first, id: "juice:repeat" })).toBe(
        "unchanged",
      );
      expect(activateOffer(state, first)).toBe("unchanged");
      expect(state).toEqual(before);
    }
  });

  it("changed terms append one version and stop only the same company/product/price scope", () => {
    const state = fixture();
    activateOffer(state, offer(state));
    activateOffer(
      state,
      offer(state, { id: "north", scope: "branch", branch: "Branch 1" }),
    );
    state.offers.push(
      offer(state, { id: "foreign", company_id: "another-company" }),
    );
    const money = structuredClone(state.ledger);
    const products = structuredClone(state.products);
    vi.setSystemTime(new Date("2026-10-11T16:00:00Z"));
    activateOffer(
      state,
      offer(state, {
        id: "north:changed",
        scope: "branch",
        branch: "Branch 1",
        mix_and_match: false,
      }),
    );
    expect(state.offers.find((item) => item.id === "north")).toMatchObject({
      status: "stopped",
      stopped_at: "2026-10-11T16:00:00.000Z",
    });
    expect(state.offers.find((item) => item.id === "juice:first")?.status).toBe(
      "active",
    );
    expect(state.offers.find((item) => item.id === "foreign")?.status).toBe(
      "active",
    );
    expect(effectiveOffer(state, "0003", "Branch 1")?.id).toBe("north:changed");
    expect(effectiveOffer(state, "0003", "Branch 2")?.id).toBe("juice:first");
    expect(state.products).toEqual(products);
    expect(state.ledger).toEqual(money);
    const groups = currentOfferGroups(
      scopedOffers(state, "all"),
      state.config.company.timezone,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].map((item) => item.id)).toEqual([
      "juice:first",
      "north:changed",
    ]);
  });

  it("stopped and expired versions belong only in Past, newest first, with old records untouched", () => {
    const state = fixture();
    const old = offer(state, { id: "old", status: "stopped" });
    const expired = offer(state, { id: "expired", end_date: "2026-10-01" });
    const active = offer(state, { id: "active" });
    const scheduled = offer(state, {
      id: "scheduled",
      scope: "branch",
      branch: "Branch 2",
      start_date: "2026-11-01",
    });
    state.offers.push(old, expired, active, scheduled);
    const retainedOld = structuredClone(old);
    const source = structuredClone(state.offers);
    const rows = currentOfferGroups(
      scopedOffers(state, "all"),
      state.config.company.timezone,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].map((item) => item.id)).toEqual(["active", "scheduled"]);
    expect(
      pastOffers(scopedOffers(state, "all"), state.config.company.timezone).map(
        (item) => item.id,
      ),
    ).toEqual(["expired", "old"]);
    expect(state.offers).toEqual(source);
    stopOffer(state, "active");
    expect(
      pastOffers(scopedOffers(state, "all"), state.config.company.timezone).map(
        (item) => item.id,
      ),
    ).toEqual(["active", "expired", "old"]);
    expect(state.offers[0]).toEqual(retainedOld);
  });

  it("a later stopped record sorts first even when an older inserted offer stops afterward", () => {
    const state = fixture();
    state.offers.push(
      offer(state, { id: "first" }),
      offer(state, { id: "second" }),
    );
    stopOffer(state, "second");
    vi.setSystemTime(new Date("2026-10-11T16:00:00Z"));
    stopOffer(state, "first");
    expect(
      pastOffers(state.offers, state.config.company.timezone).map(
        (item) => item.id,
      ),
    ).toEqual(["first", "second"]);
  });

  it("price reconciliation retains the stopped original and timestamps its move to Past", () => {
    const state = fixture();
    activateOffer(state, offer(state));
    const original = structuredClone(state.offers[0]);
    applyApprovedPrice(state, "0003", "1.99", "all", "all");
    expect(state.offers[0]).toEqual({
      ...original,
      status: "stopped",
      stopped_at: "2026-10-10T16:00:00.000Z",
    });
    expect(
      currentOfferGroups(
        scopedOffers(state, "all"),
        state.config.company.timezone,
      ),
    ).toEqual([]);
    expect(
      pastOffers(scopedOffers(state, "all"), state.config.company.timezone)[0]
        .id,
    ).toBe(original.id);
  });

  it("each scoped tab excludes foreign-company and unrelated-branch offers without mutating them", () => {
    const state = fixture();
    state.offers.push(
      offer(state),
      offer(state, { id: "north", scope: "branch", branch: "Branch 1" }),
      offer(state, {
        id: "richmond",
        scope: "branch",
        branch: "Branch 2",
        status: "stopped",
      }),
      offer(state, {
        id: "warehouse",
        scope: "branch",
        branch: "Warehouse",
        status: "stopped",
      }),
      offer(state, {
        id: "foreign",
        company_id: "another-company",
        status: "stopped",
      }),
    );
    const before = structuredClone(state.offers);
    expect(scopedOffers(state, "Branch 1").map((item) => item.id)).toEqual([
      "juice:first",
      "north",
    ]);
    expect(
      pastOffers(
        scopedOffers(state, "Branch 1"),
        state.config.company.timezone,
      ),
    ).toEqual([]);
    expect(
      pastOffers(scopedOffers(state, "all"), state.config.company.timezone).map(
        (item) => item.id,
      ),
    ).toEqual(["richmond"]);
    expect(state.offers).toEqual(before);
  });
});
