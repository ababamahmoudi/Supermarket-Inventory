import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { migrateE1BusinessState } from "./e1-state-migration";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { projectProductReadDTO } from "./catalog-read-model";
import { emptyLookupFilters, matchesLookupFilters } from "./lookup-filters";
import { lookupBranchCatalog } from "./lookup-branch";
import {
  navigationKey,
  readNavigationValue,
  saveNavigationValue,
} from "./navigation";

function fixture() {
  const state = migrateE1BusinessState(initialState());
  const actor = authenticatedTestFixture(state, "cashier", {
    locations: ["Branch 1", "Branch 2"],
    selection: { kind: "location", location_id: "Branch 1" },
  }).actor;
  const canonical = state.products.find((row) => row.code === "0009")!;
  canonical.ai_category = "";
  canonical.branch_prices = { "Branch 2": "5.49" };
  canonical.manual_prices = {};
  canonical.price_provenance = {};
  state.approvals = state.approvals.filter(
    (row) => row.product_code !== canonical.code,
  );
  state.activity = state.activity.filter(
    (row) => row.product_code !== canonical.code,
  );
  return {
    state,
    actor,
    canonical,
    product: projectProductReadDTO(state, actor, canonical),
  };
}

describe("R2c 7.2 Lookup pricing filters", () => {
  it("filters an imported product without an AI category using its configured pricing category", () => {
    const { state, product } = fixture();
    expect(
      matchesLookupFilters(
        state.config,
        product,
        { ...emptyLookupFilters, pricingCategory: product.pricing_category },
        undefined,
        false,
      ),
    ).toBe(true);
    expect(
      matchesLookupFilters(
        state.config,
        product,
        {
          ...emptyLookupFilters,
          pricingCategory: "another-configured-category",
        },
        undefined,
        false,
      ),
    ).toBe(false);
  });
  it("combines pricing, AI and actual tax-profile filters without inferring tax from category names", () => {
    const { state, product } = fixture();
    product.ai_category = "Fictional pantry";
    const taxable = state.config.tax.profiles.find((row) => row.taxable)!;
    const exempt = state.config.tax.profiles.find((row) => !row.taxable)!;
    product.tax_profile = taxable.key;
    const filters = {
      ...emptyLookupFilters,
      category: product.ai_category,
      pricingCategory: product.pricing_category,
      taxable: true,
    };
    expect(
      matchesLookupFilters(state.config, product, filters, undefined, false),
    ).toBe(true);
    product.tax_profile = exempt.key;
    expect(
      matchesLookupFilters(state.config, product, filters, undefined, false),
    ).toBe(false);
  });
  it("Not approved here uses guarded branch facts instead of a company default or another store price", () => {
    const { state, actor, product, canonical } = fixture();
    const filters = { ...emptyLookupFilters, unapproved: true };
    const facts = () =>
      lookupBranchCatalog(state, actor).find(
        (row) => row.code === product.code,
      );
    expect(
      matchesLookupFilters(state.config, product, filters, facts(), false),
    ).toBe(true);
    expect(facts()?.other_prices).toEqual([
      { location: "Branch 2", price: "5.49" },
    ]);
    canonical.branch_prices!["Branch 1"] = "4.99";
    expect(
      matchesLookupFilters(state.config, product, filters, facts(), false),
    ).toBe(false);
  });
  it("All locations unapproved filter checks public approved prices across its visible stores", () => {
    const { state, product } = fixture();
    const filters = { ...emptyLookupFilters, unapproved: true };
    expect(
      matchesLookupFilters(state.config, product, filters, undefined, true),
    ).toBe(false);
    product.selling_price = "";
    product.branch_prices = {};
    expect(
      matchesLookupFilters(state.config, product, filters, undefined, true),
    ).toBe(true);
  });
  it("remembers the combined choice only for the same company, person and location", () => {
    const value = {
      category: "",
      pricingCategory: "configured",
      taxable: true,
      unapproved: true,
    };
    const key = navigationKey(
      "fictional-a",
      "casey",
      "north",
      "lookup.filters",
    );
    saveNavigationValue(key, value);
    expect(readNavigationValue(key, emptyLookupFilters)).toEqual(value);
    for (const args of [
      ["fictional-b", "casey", "north"],
      ["fictional-a", "jordan", "north"],
      ["fictional-a", "casey", "south"],
    ])
      expect(
        readNavigationValue(
          navigationKey(
            ...(args as [string, string, string]),
            "lookup.filters",
          ),
          emptyLookupFilters,
        ),
      ).toEqual(emptyLookupFilters);
  });
});
