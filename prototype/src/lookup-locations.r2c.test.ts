import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { migrateE1BusinessState } from "./e1-state-migration";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { lookupLocationRows } from "./lookup-locations";
import type { RoleId } from "./authority-types";

describe("R2c 0.13 protected All locations Lookup", () => {
  it.each([
    "owner",
    "manager",
    "branch_supervisor",
    "floor_worker",
    "cashier",
  ] as RoleId[])("%s gets only authorized public branch facts", (role) => {
    const state = migrateE1BusinessState(initialState());
    const actor = authenticatedTestFixture(state, role, {
      locations: ["Branch 1", "Branch 2"],
      selection: { kind: "all_my_locations" },
    }).actor;
    const product = state.products.find((row) => row.code === "0009")!;
    product.selling_price = "4.49";
    product.branch_prices = { "Branch 1": "5.49", "Branch 2": "6.49" };
    product.last_cost_before_tax = "987.6543";
    const before = structuredClone(state);
    const rows = lookupLocationRows(state, actor, product.code);
    expect(rows.find((row) => row.location === "Branch 1")?.price).toBe("5.49");
    if (role === "owner" || role === "manager")
      expect(rows.find((row) => row.location === "Branch 2")?.price).toBe(
        "6.49",
      );
    else
      expect(rows.map((row) => row.location)).toEqual(["Branch 1", "Branch 2"]);
    expect(JSON.stringify(rows)).not.toMatch(
      /987\.6543|unit_cost|invoice_number|supplier|actor_user_id/,
    );
    for (const row of rows)
      expect(Object.keys(row).sort()).toEqual(
        [
          "dates",
          "sells_here",
          "offer_label",
          "on_sale",
          "sale_last_day",
          "next_expiry",
          ...(row.delivered ? ["delivered"] : []),
          "location",
          "price",
        ].sort(),
      );
    expect(state).toEqual(before);
  });
  it("keeps dates within company and permitted branches and returns no writable references", () => {
    const state = migrateE1BusinessState(initialState());
    const actor = authenticatedTestFixture(state, "cashier", {
      locations: ["Branch 1", "Branch 2"],
      selection: { kind: "all_my_locations" },
    }).actor;
    const company = actor.company_id;
    const date = {
      ...state.expiry[0],
      product_code: "0009",
      company_id: company,
      branch: "Branch 1",
      date: "2027-01-01",
      status: "active" as const,
      invoice_id: undefined,
    };
    state.expiry = [
      date,
      {
        ...date,
        id: "foreign",
        company_id: "foreign-company",
        date: "2027-02-02",
      },
      { ...date, id: "other-branch", branch: "Branch 3", date: "2027-03-03" },
    ];
    const rows = lookupLocationRows(state, actor, "0009");
    expect(rows[0].dates).toEqual([
      { date: "2027-01-01", type: date.date_type ?? "expiry" },
    ]);
    rows[0].dates[0].date = "2030-01-01";
    expect(state.expiry[0].date).toBe("2027-01-01");
  });
  it.each(["unknown", "foreign", "archived"])(
    "rejects an unavailable %s product",
    (kind) => {
      const state = migrateE1BusinessState(initialState());
      const actor = authenticatedTestFixture(state, "manager", {
        selection: { kind: "all_my_locations" },
      }).actor;
      const product = state.products.find((row) => row.code === "0009")!;
      if (kind === "foreign") product.company_id = "foreign-company";
      if (kind === "archived") product.status = "archived";
      expect(() =>
        lookupLocationRows(
          state,
          actor,
          kind === "unknown" ? "unknown" : product.code,
        ),
      ).toThrow();
    },
  );
  it("rejects forged identity rather than trusting a familiar role", () => {
    const state = migrateE1BusinessState(initialState());
    const actor = authenticatedTestFixture(state, "manager").actor;
    expect(() => lookupLocationRows(state, { ...actor }, "0009")).toThrow();
  });
});

it("D5 aggregate facts never turn an unapproved company default or a warehouse into a charging price", () => {
  const state = migrateE1BusinessState(initialState());
  const actor = authenticatedTestFixture(state, "manager", {
    selection: { kind: "all_locations" },
  }).actor;
  const product = state.products.find((row) => row.code === "0009")!;
  product.branch_prices = {};
  product.manual_prices = {};
  product.price_provenance = {};
  state.approvals = state.approvals.filter(
    (row) => row.product_code !== product.code,
  );
  state.activity = state.activity.filter(
    (row) => row.product_code !== product.code,
  );
  const rows = lookupLocationRows(state, actor, product.code);
  expect(rows.every((row) => row.price === null)).toBe(true);
  expect(rows.find((row) => row.location === "Warehouse")).toMatchObject({
    price: null,
    sells_here: false,
  });
  product.branch_prices = { "Branch 1": "4.49" };
  expect(
    lookupLocationRows(state, actor, product.code).find(
      (row) => row.location === "Branch 1",
    )?.price,
  ).toBe("4.49");
});
