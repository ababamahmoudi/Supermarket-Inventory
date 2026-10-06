import { beforeEach, describe, expect, it } from "vitest";
import {
  effectiveOffer,
  effectivePrice,
  isOfferScheduledNow,
  matchesProduct,
  pendingPrice,
} from "./catalog";
import { initialState } from "./store";
import type { DemoState, Offer } from "./types";

let state: DemoState;
beforeEach(() => {
  state = initialState();
});

describe("bilingual product search", () => {
  it("finds the same product by English, Persian, code and complete barcode", () => {
    const sumac = state.products.find((product) =>
      product.name_en.includes("Sumac"),
    )!;
    for (const search of [
      "sumac",
      "سماق",
      sumac.code,
      sumac.barcode,
      "GROUND 100",
    ]) {
      expect(
        state.products
          .filter((product) => matchesProduct(product, search))
          .map((product) => product.code),
      ).toContain(sumac.code);
    }
    expect(matchesProduct(sumac, "sumac rice")).toBe(false);
  });

  it("normalizes Persian digits and Arabic keyboard forms without changing codes", () => {
    const product = state.products.find((item) => item.code === "0007")!;
    expect(matchesProduct(product, "۰۰۰۷")).toBe(true);
    expect(matchesProduct(product, "لوبيا")).toBe(true);
    expect(matchesProduct(product, "  RED   beans  ")).toBe(true);
    expect(product.code).toBe("0007");
  });
});

describe("approved and pending prices", () => {
  it("keeps the old approved price while a different price waits for a decision", () => {
    const lavash = state.products.find((item) => item.code === "0006")!;
    expect(effectivePrice(state, lavash, "Branch 1")).toBe("1.99");
    expect(pendingPrice(state, lavash, "Branch 1")).toBe("2.99");
    expect(pendingPrice(state, lavash, "Branch 2")).toBeNull();
  });

  it("resolves a branch override and never presents a new pending price as approved", () => {
    expect(effectivePrice(state, "0004", "Branch 1")).toBe("6.49");
    expect(effectivePrice(state, "0004", "Branch 2")).toBe("6.99");
    expect(effectivePrice(state, "0004", "all")).toBe("6.49");
    expect(effectivePrice(state, "0015", "Branch 1")).toBeNull();
    const product = state.products.find((item) => item.code === "0015")!;
    product.status = "active";
    product.branch_prices = { "Branch 1": "5.49" };
    expect(effectivePrice(state, product, "Branch 1")).toBe("5.49");
    expect(effectivePrice(state, product, "Branch 2")).toBeNull();
  });

  it("does not expose a different company product or its price", () => {
    const foreign = {
      ...state.products[0],
      company_id: "another-company",
      selling_price: "0.01",
    };
    state.products.unshift(foreign);
    expect(effectivePrice(state, foreign, "Branch 1")).toBeNull();
    expect(effectivePrice(state, foreign.code, "Branch 1")).toBe("23.99");
    expect(pendingPrice(state, foreign, "Branch 1")).toBeNull();
  });
});

describe("one effective offer per company and branch", () => {
  function branchOffer(overrides: Partial<Offer> = {}): Offer {
    const companyOffer = state.offers.find(
      (offer) => offer.product_code === "0003",
    )!;
    return {
      ...companyOffer,
      id: "branch-offer",
      scope: "branch",
      branch: "Branch 1",
      label: "Branch offer",
      ...overrides,
    };
  }

  it("prefers an eligible branch offer and retains the company offer in another branch", () => {
    const offer = branchOffer();
    state.offers.push(offer);
    expect(effectiveOffer(state, "0003", "Branch 1")?.id).toBe(offer.id);
    expect(effectiveOffer(state, "0003", "Branch 2")?.scope).toBe("all");
  });

  it("does not inherit an offer for a different approved price or switch to a suggestion", () => {
    const product = state.products.find((item) => item.code === "0003")!;
    product.branch_prices = { "Branch 1": "4.99" };
    state.offers.push(branchOffer({ status: "suggested", price: "4.99" }));
    expect(effectiveOffer(state, product, "Branch 1")).toBeNull();
    expect(effectiveOffer(state, product, "Branch 2")?.label).toBe("2 for $5");
    product.branch_prices = {};
    state.offers.push(
      branchOffer({ id: "foreign-offer", company_id: "another-company" }),
    );
    state.offers.push(branchOffer({ id: "other-currency", currency: "USD" }));
    expect(effectiveOffer(state, product, "Branch 1")?.scope).toBe("all");
  });

  it("accepts equivalent exact decimal prices and excludes stopped offers", () => {
    const offer = branchOffer({ price: "2.9900" });
    state.offers.push(offer);
    expect(effectiveOffer(state, "0003", "Branch 1")?.id).toBe(offer.id);
    offer.status = "stopped";
    expect(effectiveOffer(state, "0003", "Branch 1")?.scope).toBe("all");
  });

  it("checks optional dates in the company timezone with inclusive dates", () => {
    const offer = branchOffer({
      start_date: "2026-10-06",
      end_date: "2026-10-06",
    });
    const timezone = state.config.company.timezone;
    expect(
      isOfferScheduledNow(offer, timezone, new Date("2026-10-06T02:00:00Z")),
    ).toBe(false);
    expect(
      isOfferScheduledNow(offer, timezone, new Date("2026-10-06T16:00:00Z")),
    ).toBe(true);
    expect(
      isOfferScheduledNow(offer, timezone, new Date("2026-10-07T12:00:00Z")),
    ).toBe(false);
    expect(
      isOfferScheduledNow(
        branchOffer(),
        timezone,
        new Date("2026-10-07T12:00:00Z"),
      ),
    ).toBe(true);
  });
});
