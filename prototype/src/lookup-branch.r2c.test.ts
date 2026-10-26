import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { migrateE1BusinessState } from "./e1-state-migration";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { actorAtLocation } from "./authority";
import { lookupBranchCatalog } from "./lookup-branch";
import { applyApprovedPrice } from "./approvals";
import { addProduct } from "./manual-product";
import type { RoleId } from "./authority-types";

function fixture(role: RoleId = "cashier") {
  const state = migrateE1BusinessState(initialState());
  const actor = authenticatedTestFixture(state, role, {
    locations: ["Branch 1", "Branch 2"],
    selection: { kind: "location", location_id: "Branch 1" },
  }).actor;
  const product = structuredClone(
    state.products.find((row) => row.code === "0009")!,
  );
  product.code = "F-9100";
  product.name_en = "Fictional branch pantry item";
  product.branch_prices = {};
  product.selling_price = "9.99";
  product.price_provenance = {};
  product.manual_prices = {};
  product.last_received_relative_days = {};
  state.products.push(product);
  const facts = () =>
    lookupBranchCatalog(state, actor).find((row) => row.code === product.code)!;
  return { state, actor, product, facts };
}

describe("R2c 7.3 guarded branch Lookup", () => {
  it("does not turn a bare company default into a branch approval or branch membership", () => {
    const { facts } = fixture();
    expect(facts()).toEqual({
      code: "F-9100",
      present: false,
      at_other_locations: false,
      price: null,
      other_prices: [],
    });
  });
  it("recognizes stock, delivery and explicit pricing independently without returning counts or invoice identities", () => {
    const { state, product, facts } = fixture();
    state.stock[`Branch 1:${product.code}`] = 4;
    expect(facts().present).toBe(true);
    state.stock[`Branch 1:${product.code}`] = 0;
    product.last_received_relative_days = { "Branch 1": 0 };
    expect(facts().present).toBe(true);
    product.last_received_relative_days = {};
    const invoice = structuredClone(
      state.invoices!.find((row) => row.status === "posted")!,
    );
    invoice.id = "fictional-lookup-delivery";
    invoice.branch = "Branch 1";
    invoice.lines = [
      {
        ...invoice.lines[0],
        company_id: product.company_id,
        product_code: product.code,
        qty_invoiced: 1,
        qty_received_at_posting: 1,
      },
    ];
    state.invoices!.push(invoice);
    expect(facts().present).toBe(true);
    expect(facts().price).toBeNull();
    product.branch_prices = { "Branch 1": "4.99" };
    expect(facts().price).toBe("4.99");
    expect(Object.keys(facts()).sort()).toEqual([
      "at_other_locations",
      "code",
      "other_prices",
      "present",
      "price",
    ]);
  });
  it.each([
    "owner",
    "manager",
    "branch_supervisor",
    "floor_worker",
    "cashier",
  ] as RoleId[])(
    "%s receives only assigned other-store prices and no private evidence",
    (role) => {
      const { state, actor, product, facts } = fixture(role);
      product.branch_prices = { "Branch 2": "5.49", "Branch 3": "987.65" };
      product.last_cost_before_tax = "876.5432";
      product.price_provenance!["Branch 2"] = {
        invoice_number: "PRIVATE-INVOICE",
        calculated_price: "5.49",
      };
      const result = facts();
      // Owners and managers are canonically assigned all stores; other roles are limited to their explicit pair.
      expect(result.other_prices).toContainEqual({
        location: "Branch 2",
        price: "5.49",
      });
      if (role !== "owner" && role !== "manager")
        expect(JSON.stringify(result)).not.toMatch(/Branch 3|987\.65/);
      expect(JSON.stringify(result)).not.toMatch(
        /876\.5432|PRIVATE-INVOICE|invoice_number|cost|supplier|actor|margin/,
      );
      expect(result.at_other_locations).toBe(true);
      const otherCompany = {
        ...structuredClone(product),
        company_id: "foreign-company",
        code: "FOREIGN",
      };
      state.products.push(otherCompany);
      const before = structuredClone(state);
      const rows = lookupBranchCatalog(state, actor);
      expect(rows.some((row) => row.code === "FOREIGN")).toBe(false);
      rows.find((row) => row.code === product.code)!.other_prices[0].price =
        "0.01";
      expect(state).toEqual(before);
    },
  );
  it("recognizes a genuine all-store approval and a later branch override", () => {
    const { state, actor, product, facts } = fixture("manager");
    applyApprovedPrice(state, actor, product.code, "4.99", "all", "Branch 1");
    expect(facts().price).toBe("4.99");
    expect(
      lookupBranchCatalog(
        state,
        actorAtLocation(state, actor, "Branch 2"),
      ).find((row) => row.code === product.code)?.price,
    ).toBe("4.99");
    applyApprovedPrice(
      state,
      actor,
      product.code,
      "6.49",
      "branch",
      "Branch 1",
    );
    expect(facts().price).toBe("6.49");
  });
  it("rejected and pending proposals cannot approve the current branch", () => {
    const { state, product, facts } = fixture();
    const source = structuredClone(
      state.approvals.find((row) => row.type === "price_change")!,
    );
    state.approvals.push({
      ...source,
      id: "fictional-proposal",
      product_code: product.code,
      branch: "Branch 1",
      status: "pending",
      proposed_price: product.selling_price,
    });
    expect(facts().price).toBeNull();
    state.approvals.at(-1)!.status = "rejected";
    expect(facts().price).toBeNull();
  });
  it("recognizes an actual Owner/Manager product creation at the rule price as an accepted all-store decision", () => {
    const { state, actor } = fixture("manager");
    const added = addProduct(state, actor, {
      name_en: "Fictional approved pear",
      name_fa: "گلابی نمونه",
      description_en: "",
      description_fa: "",
      unit_size: "500 g",
      ai_category: "",
      pricing_category: "grocery",
      barcode: "DEMO-FICTIONAL-PEAR",
      main_supplier: state.products.find((row) => row.code === "0009")!
        .main_supplier,
      date_tracking: false,
      scope: "all",
      last_cost_before_tax: "1.4000",
    });
    expect(
      lookupBranchCatalog(state, actor).find((row) => row.code === added.code)
        ?.price,
    ).toBe(added.selling_price);
  });
  it("rejects forged identities, aggregates and another company's records", () => {
    const { state, actor, product } = fixture();
    expect(() => lookupBranchCatalog(state, { ...actor })).toThrow();
    expect(() =>
      lookupBranchCatalog(state, actorAtLocation(state, actor, "all")),
    ).toThrow();
    product.company_id = "foreign-company";
    expect(
      lookupBranchCatalog(state, actor).some(
        (row) => row.code === product.code,
      ),
    ).toBe(false);
  });
});
