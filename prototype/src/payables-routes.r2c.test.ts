import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { payablesBoard } from "./payables-board";

describe("R2c 3.3 protected supplier statement routes", () => {
  it.each(["owner", "manager"] as const)(
    "resolves stable supplier IDs for %s without changing ledger evidence",
    (role) => {
      const state = initialState();
      const actor = authenticatedTestActor(state, role, {
        selection: { kind: "all_locations" },
      });
      const supplier = state.suppliers!.find(
        (supplier) => supplier.name === "Fresh Valley Foods",
      )!;
      const before = JSON.stringify(state);
      const byId = payablesBoard(state, actor, supplier.id);
      const byName = payablesBoard(state, actor, supplier.name);
      expect(byId.selectedSupplier).toBe(supplier.name);
      expect(byId.summary).toEqual(byName.summary);
      expect(
        byId.overview.find((row) => row.supplier === supplier.name)
          ?.supplier_id,
      ).toBe(supplier.id);
      expect(JSON.stringify(state)).toBe(before);
    },
  );
  it("never resolves foreign, unknown or forged supplier identities", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager");
    state.suppliers!.push({
      ...state.suppliers![0],
      id: "foreign-only-supplier",
      company_id: "different-company",
      name: "Private Foreign Supplier",
    });
    state.ledger.push({
      ...state.ledger[0],
      id: "foreign-only-entry",
      company_id: "different-company",
      supplier: "Private Foreign Supplier",
      amount: "999.00",
    });
    const result = payablesBoard(state, actor, "foreign-only-supplier");
    expect(result.selectedSupplier).toBe("");
    expect(JSON.stringify(result)).not.toContain("Private Foreign Supplier");
    expect(
      result.overview.some(
        (row) => row.supplier_id === "foreign-only-supplier",
      ),
    ).toBe(false);
    expect(payablesBoard(state, actor, "unknown-id").selectedSupplier).toBe("");
    const foreign = initialState();
    foreign.config.company.seed_key = "different-company";
    expect(() =>
      payablesBoard(
        state,
        authenticatedTestActor(foreign, "manager"),
        state.suppliers![0].id,
      ),
    ).toThrow();
  });
  it.each(["branch_supervisor", "floor_worker", "cashier"] as const)(
    "denies %s statement and overview reads",
    (role) => {
      const state = initialState();
      const actor = authenticatedTestActor(state, role, {
        locations: ["Branch 1"],
      });
      expect(() =>
        payablesBoard(state, actor, state.suppliers![0].id),
      ).toThrow();
    },
  );
});
