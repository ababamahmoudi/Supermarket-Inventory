import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { migrateE1BusinessState } from "./e1-state-migration";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { projectCatalogReadView } from "./catalog-read-model";
import {
  newProductPricePreview,
  productFinancialSnapshot,
} from "./catalog-private-projections";
import { regularPrice } from "./catalog";
import type { RoleId } from "./authority-types";

const fixture = () => migrateE1BusinessState(initialState());
const nonFinancialRoles: RoleId[] = [
  "branch_supervisor",
  "floor_worker",
  "cashier",
];

describe("E1 Catalog financial boundary", () => {
  for (const role of nonFinancialRoles) {
    it(`${role} sees exact public prices while the real financial query denies access`, () => {
      const state = fixture();
      const actor = authenticatedTestFixture(state, role, {
        locations: ["Branch 1"],
        selection: { kind: "location", location_id: "Branch 1" },
      }).actor;
      const product = state.products.find((item) => item.code === "0003")!;
      product.manual_prices = {
        "Branch 1": {
          price: "1.59",
          rule_price: "1.49",
          set_by: "Historical manager",
          set_at: new Date().toISOString(),
        },
      };
      product.branch_prices = { ...product.branch_prices, "Branch 1": "1.59" };
      const view = projectCatalogReadView(state, actor);
      const publicProduct = view.products.find(
        (item) => item.code === product.code,
      )!;
      expect(publicProduct.manual_price_scopes).toContain("Branch 1");
      expect(
        regularPrice(
          { config: state.config, ...view, sales: [] },
          publicProduct,
          "Branch 1",
        ),
      ).toBe(regularPrice(state, product, "Branch 1"));
      for (const privateField of [
        "last_cost_before_tax",
        "manual_prices",
        "price_provenance",
        "cost",
        "margin",
        "minimum_margin",
      ])
        expect(publicProduct).not.toHaveProperty(privateField);
      expect(() =>
        productFinancialSnapshot(state, actor, product.code),
      ).toThrow();
    });
  }
  it("uses the current authorized Manager scope for private costs without exposing another company", () => {
    const state = fixture();
    const actor = authenticatedTestFixture(state, "manager", {
      selection: { kind: "location", location_id: "Branch 1" },
    }).actor;
    const product = state.products.find((item) => item.code === "0003")!;
    const result = productFinancialSnapshot(state, actor, product.code);
    expect(result.cost).not.toBeNull();
    expect(result.costs.every((entry) => entry.branch === "Branch 1")).toBe(
      true,
    );
    product.company_id = "another-company";
    expect(() =>
      productFinancialSnapshot(state, actor, product.code),
    ).toThrow();
  });
  it("does not turn invoice product-proposal authority into active Catalog creation or margin access", () => {
    const state = fixture();
    const actor = authenticatedTestFixture(state, "branch_supervisor", {
      locations: [state.invoice.branch],
      selection: { kind: "location", location_id: state.invoice.branch },
    }).actor;
    const input = {
      cost: "1.99",
      costUnit: "lb" as const,
      soldBy: "each" as const,
      category: state.config.pricing_categories[0].key,
      sellingPrice: "",
      manualPrice: false,
    };
    expect(() => newProductPricePreview(state, actor, input, false)).toThrow();
    const proposal = newProductPricePreview(state, actor, input, true);
    expect(proposal.displayCalculatedPrice).toMatch(/^\d+\.\d{2}$/);
    expect(proposal.belowMinimum).toBe(false);
    for (const field of [
      "cost",
      "cost_divisor",
      "margin",
      "minimum_margin",
      "threshold",
    ])
      expect(proposal).not.toHaveProperty(field);
    expect(state.products).toHaveLength(initialState().products.length);
  });
});
