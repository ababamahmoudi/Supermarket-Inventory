import { describe, expect, it, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import { migrateE1BusinessState } from "./e1-state-migration";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { actorAtLocation } from "./authority";
import { lookupBranchCatalog } from "./lookup-branch";
import { applyApprovedPrice } from "./approvals";
import { addProduct } from "./manual-product";
import type { RoleId } from "./authority-types";
import { savePriceChange, endSale, saleCanonicalPrice } from "./sales";
import { companyDate } from "./invoice";
import { saveCompanySettings } from "./settings";

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
  function endedSale(weight = false, now = new Date(Date.now() - 1000)) {
    const context = fixture("manager");
    const { state, actor, product } = context;
    if (weight) {
      product.sold_by = "weight";
      product.unit_size = "lb";
    }
    const result = savePriceChange(
      state,
      actor,
      {
        product_code: product.code,
        mode: "sale",
        scope: "current",
        branches: ["Branch 1"],
        price: weight ? "17.00" : "7.99",
        price_unit: weight ? "kg" : "each",
        starts_on: companyDate(state.config, now),
        last_day: null,
        accept_below_margin: false,
        below_cost_reason: "",
        add_labels: false,
      },
      now,
    );
    expect(context.facts().price).toBe(
      saleCanonicalPrice(result.sales[0], state.config),
    );
    const sale = result.sales[0];
    endSale(
      state,
      actor,
      sale.id,
      { expected_revision: sale.revision },
      new Date(now.getTime() + 100),
    );
    return {
      ...context,
      sale: state.sales!.find((row) => row.id === sale.id)!,
    };
  }
  it("restores the actual approved sale's reviewed regular basis after End without writing a regular-price decision", () => {
    const { state, facts } = endedSale();
    const before = structuredClone(state);
    expect(facts().price).toBe("9.99");
    expect(facts().other_prices).toEqual([]);
    expect(state).toEqual(before);
    expect(
      state.activity
        .filter(
          (row) => row.product_code === "F-9100" && row.entity_type === "sale",
        )
        .map((row) => row.action),
    ).toEqual(["Start sale", "End sale"]);
    expect(
      state.activity.some(
        (row) =>
          row.product_code === "F-9100" && row.action === "Set regular price",
      ),
    ).toBe(false);
  });
  it("keeps the reviewed weighed basis in canonical lb after a kg sale ends", () => {
    const { sale, facts } = endedSale(true);
    expect(sale.price_unit).toBe("kg");
    expect(sale.regular_price_snapshot).toBe("9.99");
    expect(facts().price).toBe("9.99");
  });
  it("withholds a sale basis when a genuine currency change has the exact review timestamp", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const now = new Date();
      const { state, actor, sale, facts } = endedSale(false, now);
      saveCompanySettings(
        state,
        { ...state.config.company, currency: "USD" },
        actor,
      );
      const change = state.activity.find(
        (row) => row.entity_type === "settings" && row.entity_id === "company",
      )!;
      expect(change.at).toBe(sale.created_at);
      expect(change.before).toMatchObject({ currency: "CAD" });
      expect(change.after).toMatchObject({ currency: "USD" });
      const before = structuredClone(state);
      expect(facts().price).toBeNull();
      expect(state).toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });
  it("returns the reviewed basis at clock expiry before a lifecycle write, through a fresh Cashier query", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const now = new Date();
      const { state, actor, product } = fixture("manager");
      const result = savePriceChange(
        state,
        actor,
        {
          product_code: product.code,
          mode: "sale",
          scope: "current",
          branches: ["Branch 1"],
          price: "7.99",
          price_unit: "each",
          starts_on: companyDate(state.config, now),
          last_day: companyDate(state.config, now),
          accept_below_margin: false,
          below_cost_reason: "",
          add_labels: false,
        },
        now,
      );
      expect(result.sales[0].status).toBe("active");
      vi.setSystemTime(new Date(now.getTime() + 36 * 60 * 60 * 1000));
      const cashier = authenticatedTestFixture(state, "cashier", {
        locations: ["Branch 1"],
        selection: { kind: "location", location_id: "Branch 1" },
      }).actor;
      const before = structuredClone(state);
      expect(
        lookupBranchCatalog(state, cashier).find(
          (row) => row.code === product.code,
        )?.price,
      ).toBe("9.99");
      expect(
        state.sales!.find((row) => row.id === result.sales[0].id)?.status,
      ).toBe("active");
      expect(state).toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([
    "branch",
    "company",
    "unreviewed",
    "changed_default",
    "stopped",
    "currency",
  ] as const)(
    "cannot use a %s sale basis as this location's approval",
    (kind) => {
      const { state, actor, sale, facts } = endedSale();
      if (kind === "branch") sale.branch = sale.branch_id = "Branch 2";
      if (kind === "company") sale.company_id = "foreign-company";
      if (kind === "unreviewed") sale.created_by_role_snapshot = "floor_worker";
      if (kind === "changed_default")
        state.products.find((row) => row.code === "F-9100")!.selling_price =
          "10.99";
      if (kind === "stopped") Object.assign(sale, { status: "stopped" });
      if (kind === "currency")
        saveCompanySettings(
          state,
          { ...state.config.company, currency: "USD" },
          actor,
        );
      expect(facts().price).toBeNull();
    },
  );
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
