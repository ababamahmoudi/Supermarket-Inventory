import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { BrowserAuthorityRepository } from "./authority-repository";
import { initializeAuthority } from "./authority-initialization";
import {
  configuredDemoPeople,
  configuredDemoComputers,
} from "./e1-seed-fixtures";
import { initialState } from "./e1-bootstrap";
import { calculatePrice } from "./pricing";
import {
  migratePriceEndingRule,
  upgradePriceEndingRule,
} from "./price-ending-migration";
import type { DemoState } from "./types";

function oldState() {
  const state = initialState();
  delete state.price_ending_rule_schema;
  (
    state.config.rounding_bands as Record<string, unknown>
  ).final_ending_adjustment = {
    source_endings: ["0.49"],
    target_ending: "0.99",
  };
  state.config.special_corrections = [
    { from: "2.49", to: "2.99" },
    { from: "3.49", to: "3.99" },
  ];
  return state;
}

describe("Ali's 2026-11-15 price-ending rule upgrade", () => {
  it("replaces the all-.49 rule in saved browser data, backs it up first and leaves prices alone", async () => {
    const factory = new IDBFactory();
    const repository = new BrowserAuthorityRepository(factory);
    const state = oldState();
    await initializeAuthority(repository, {
      state,
      demo_users: configuredDemoPeople(),
      registered_computers: configuredDemoComputers(),
    });
    const company = state.config.company.seed_key;
    const prior = await repository.loadBusiness<DemoState>(company);
    await migratePriceEndingRule(repository, company);
    const after = await repository.loadBusiness<DemoState>(company);
    expect(after.state.price_ending_rule_schema).toBe(2);
    expect(after.state.config.special_corrections).toEqual([
      { from: "1.49", to: "1.99" },
      { from: "2.49", to: "2.99" },
      { from: "3.49", to: "3.99" },
    ]);
    expect(after.state.config.rounding_bands).not.toHaveProperty(
      "final_ending_adjustment",
    );
    expect(after.state.products).toEqual(prior.state.products);
    expect(after.state.approvals).toEqual(prior.state.approvals);
    expect(
      calculatePrice("31.50", "kitchenware", after.state.config),
    ).toMatchObject({
      selling_price: "52.49",
    });
    expect(calculatePrice("1.00", "grocery", after.state.config)).toMatchObject(
      {
        selling_price: "1.99",
        rounded_up_from: "1.49",
      },
    );
    // Running again is a no-op.
    const revision = after.revision;
    await migratePriceEndingRule(repository, company);
    expect((await repository.loadBusiness<DemoState>(company)).revision).toBe(
      revision,
    );
  });

  it("keeps a company's own correction list", () => {
    const state = oldState();
    state.config.special_corrections = [{ from: "2.49", to: "2.79" }];
    upgradePriceEndingRule(state);
    expect(state.config.special_corrections).toEqual([
      { from: "2.49", to: "2.79" },
    ]);
    expect(state.price_ending_rule_schema).toBe(2);
  });
});
