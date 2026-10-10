import { describe, expect, it } from "vitest";
import {
  activateOffer,
  approvalLocationEffects,
  approvalSnapshot,
  applyApprovedPrice,
  effectivePool,
  offerReadiness,
  reconcileOffers,
  resolveApproval,
  syncPriceConflicts,
} from "./approvals";
import { effectiveOffer, effectivePrice } from "./catalog";
import { initialState } from "./store";
import {
  branchAllowsRole,
  branchSellsToCustomers,
  sellingBranches,
} from "./settings";
import type { Approval, DemoState, Offer } from "./types";

function proposal(state: DemoState): Approval {
  return {
    id: "approval:c3-retail",
    company_id: state.config.company.seed_key,
    branch: "Branch 1",
    product_code: "0006",
    status: "pending",
    type: "price_change",
    proposed_price: "2.99",
    current_price: "1.99",
    unit_cost: "1.5500",
  };
}
function candidate(state: DemoState, branch = "Warehouse"): Offer {
  return {
    id: "offer:c3-warehouse",
    company_id: state.config.company.seed_key,
    product_code: "0006",
    scope: "branch",
    branch,
    status: "suggested",
    price: "1.99",
    label: "3 for $5",
    pool: "3_for_5",
    currency: state.config.company.currency,
    mix_and_match: true,
  };
}

describe("C3 selling locations and approval consequences", () => {
  it("defaults stores to selling and warehouses to non-selling without changing stable location IDs", () => {
    const state = initialState();
    expect(sellingBranches(state.config)).toEqual([
      "Branch 1",
      "Branch 2",
      "Branch 3",
    ]);
    expect(branchSellsToCustomers(state.config, "Warehouse")).toBe(false);
    expect(branchSellsToCustomers(state.config, "all")).toBe(false);
    expect(
      branchSellsToCustomers(state.config, "unknown-company-location"),
    ).toBe(false);
    state.config.branches[1].active = false;
    expect(branchSellsToCustomers(state.config, "Branch 2")).toBe(false);
    expect(sellingBranches(state.config, true)).toContain("Branch 2");
    state.config.branches[0].sells_to_customers = false;
    expect(sellingBranches(state.config)).toEqual(["Branch 3"]);
  });

  it("groups identical retail consequences and does not invent override-removal rows or warehouse effects", () => {
    const state = initialState();
    const effects = approvalLocationEffects(
      state,
      proposal(state),
      "all",
      "Branch 1",
    );
    expect(effects).toEqual([
      {
        locations: ["Branch 1", "Branch 2", "Branch 3"],
        old_price: "1.99",
        new_price: "2.99",
        offer_label: "3 for $5",
        offer_stops: true,
        override_removed: false,
      },
    ]);
    expect(effects.flatMap((effect) => effect.locations)).not.toContain(
      "Warehouse",
    );
  });

  it("separates actual overrides and differing offers instead of grouping merely matching prices", () => {
    const state = initialState();
    const product = state.products.find((item) => item.code === "0006")!;
    product.branch_prices = { "Branch 2": "1.99" };
    const effects = approvalLocationEffects(
      state,
      proposal(state),
      "all",
      "Branch 1",
    );
    expect(effects).toHaveLength(2);
    expect(
      effects.find((effect) => effect.override_removed)?.locations,
    ).toEqual(["Branch 2"]);
    expect(
      effects.find((effect) => !effect.override_removed)?.locations,
    ).toEqual(["Branch 1", "Branch 3"]);
    expect(
      approvalLocationEffects(state, proposal(state), "branch", "Branch 2"),
    ).toEqual([
      expect.objectContaining({
        locations: ["Branch 2"],
        override_removed: false,
      }),
    ]);
  });

  it("replaces active retail overrides while preserving inactive and non-selling historical prices and provenance", () => {
    const state = initialState();
    const product = state.products.find((item) => item.code === "0006")!;
    state.config.branches[2].active = false;
    product.branch_prices = {
      "Branch 2": "3.99",
      "Branch 3": "4.99",
      Warehouse: "8.99",
    };
    const retainedMarker = {
      price: "8.99",
      rule_price: "1.99",
      set_at: "2026-10-01T12:00:00Z",
      set_by: "Recorded Supervisor",
    };
    product.manual_prices = { Warehouse: retainedMarker };
    const originalLedger = structuredClone(state.ledger);
    const originalReceipts = structuredClone(state.stock_movements);
    applyApprovedPrice(state, product.code, "2.99", "all", "all");
    expect(product.branch_prices).toEqual({
      "Branch 3": "4.99",
      Warehouse: "8.99",
    });
    expect(product.manual_prices?.Warehouse).toEqual(retainedMarker);
    expect(effectivePrice(state, product, "Branch 1")).toBe("2.99");
    expect(state.ledger).toEqual(originalLedger);
    expect(state.stock_movements).toEqual(originalReceipts);
  });

  it("blocks a warehouse-only price decision atomically while allowing its purchase evidence to inform the company default", () => {
    const state = initialState();
    const approval = { ...proposal(state), branch: "Warehouse" };
    state.approvals = [approval];
    const before = structuredClone(state);
    expect(() =>
      resolveApproval(state, approval.id, "approve", "branch", "Branch 1"),
    ).toThrow("sells to customers");
    expect(state).toEqual(before);
    resolveApproval(state, approval.id, "approve", "all", "all");
    expect(state.approvals[0]).toMatchObject({
      branch: "Warehouse",
      status: "approved",
      scope: "all",
    });
    expect(effectivePrice(state, "0006", "Branch 1")).toBe("2.99");
    expect(state.activity.at(-1)?.reversible).toBe(true);
  });

  it("invalidates an approval preview when Settings changes the locations that actually sell", () => {
    const state = initialState();
    const approval = proposal(state);
    state.approvals = [approval];
    const snapshot = approvalSnapshot(state, approval.product_code);
    state.config.branches.find(
      (item) => item.type === "warehouse",
    )!.sells_to_customers = true;
    const before = structuredClone(state);
    expect(() =>
      resolveApproval(
        state,
        approval.id,
        "approve",
        "all",
        "all",
        undefined,
        snapshot,
      ),
    ).toThrow("Prices changed");
    expect(state).toEqual(before);
  });

  it("does not offer or mix retail promotions in a non-selling warehouse, with explicit opt-in available", () => {
    const state = initialState();
    const offer = candidate(state);
    expect(offerReadiness(state, offer)).toBe("location_not_selling");
    const before = structuredClone(state);
    expect(() => activateOffer(state, offer, "supervisor")).toThrow(
      "not ready",
    );
    expect(state).toEqual(before);
    expect(effectiveOffer(state, "0006", "Warehouse")).toBeNull();
    expect(
      effectivePool(
        state,
        "Warehouse",
        "3_for_5",
        state.config.company.currency,
      ),
    ).toEqual([]);
    state.config.branches.find(
      (item) => item.type === "warehouse",
    )!.sells_to_customers = true;
    expect(offerReadiness(state, offer)).toBe("ready");
    activateOffer(state, offer, "supervisor");
    expect(effectiveOffer(state, "0006", "Warehouse")?.id).toBe(offer.id);
    expect(branchAllowsRole(state.config, "Warehouse", "cashier")).toBe(false);
  });

  it("preserves an old non-selling warehouse offer as evidence and creates no warehouse replacement suggestion", () => {
    const state = initialState();
    const historic = { ...candidate(state), status: "active" as const };
    state.offers.push(historic);
    const product = state.products.find((item) => item.code === "0006")!;
    product.branch_prices = { Warehouse: "1.99" };
    product.selling_price = "2.99";
    reconcileOffers(state, product.code);
    expect(historic.status).toBe("active");
    expect(state.offers.filter((item) => item.branch === "Warehouse")).toEqual([
      historic,
    ]);
    expect(effectiveOffer(state, product, "Warehouse")).toBeNull();
  });

  it("ignores warehouse-only price differences and includes them only after an explicit selling opt-in", () => {
    const state = initialState();
    const product = state.products.find((item) => item.code === "0006")!;
    product.branch_prices = { Warehouse: "8.99" };
    state.alerts = [];
    syncPriceConflicts(state, product.code);
    expect(state.alerts).toEqual([]);
    state.config.branches.find(
      (item) => item.type === "warehouse",
    )!.sells_to_customers = true;
    syncPriceConflicts(state, product.code);
    expect(state.alerts[0].branch_prices).toMatchObject({
      Warehouse: "8.99",
      "Branch 1": "1.99",
    });
  });

  it("keeps foreign company approvals outside retail previews and prevents price changes when no active location sells", () => {
    const state = initialState();
    expect(
      approvalLocationEffects(
        state,
        { ...proposal(state), company_id: "foreign-company" },
        "all",
        "Branch 1",
      ),
    ).toEqual([]);
    state.config.branches.forEach((location) => {
      location.sells_to_customers = false;
    });
    const before = structuredClone(state);
    expect(() =>
      applyApprovedPrice(state, "0006", "2.99", "all", "all"),
    ).toThrow("sells to customers");
    expect(state).toEqual(before);
  });
});
