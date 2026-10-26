import { describe, expect, it } from "vitest";
import { actorAtLocation, AuthorityError } from "./authority";
import { authenticatedTestActor } from "./authority-test-fixture";
import { initialState } from "./e1-bootstrap";
import { postPayment } from "./operations";
import { supplierBalanceSummary } from "./supplier-balances";
import { suppliersOverview } from "./suppliers";

describe("supplier statement destinations", () => {
  it("does not offer a statement for a registry-only supplier or an unposted draft", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager");
    state.suppliers!.find(
      (supplier) => supplier.name === "Corner Spice Co.",
    )!.status = "proposed";
    state.invoice.supplier = "Corner Spice Co.";
    state.invoice.status = "draft";
    const before = JSON.stringify(state);
    expect(
      suppliersOverview(state, actor).find(
        (supplier) => supplier.name === "Corner Spice Co.",
      )?.financial,
    ).toMatchObject({ balance: "0.00", has_statement: false });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("retains a fully paid statement and limits its availability to the actual location history", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager");
    const supplier = "Sunrise Beverages";
    const outstanding = supplierBalanceSummary(
      state,
      actor,
      supplier,
    ).invoices.find((invoice) => invoice.amount === "96.40")!;
    postPayment(state, actor, {
      supplier,
      amount: "96.40",
      date: state.demo_fixture_anchor_date!,
      cheque: "FICTIONAL-FULL-PAYMENT",
      receipt: "FICTIONAL-PAID-STATEMENT",
      allocations: [{ invoice_id: outstanding.invoice_id, amount: "96.40" }],
    });
    const before = JSON.stringify(state);
    expect(
      suppliersOverview(state, actor).find((row) => row.name === supplier)
        ?.financial,
    ).toMatchObject({ balance: "0.00", overdue: "0.00", has_statement: true });
    // This supplier has no receipt or payment history in Branch 3.
    expect(
      suppliersOverview(state, actorAtLocation(state, actor, "Branch 3")).find(
        (row) => row.name === supplier,
      )?.financial,
    ).toMatchObject({ balance: "0.00", has_statement: false });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("keeps a retained balance snapshot actionable without inventing ledger rows", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager");
    state.demo_fixture_schema = undefined;
    state.ledger = [];
    state.invoices = [];
    state.invoice.status = "empty";
    state.returns = [];
    const before = JSON.stringify(state);
    const summary = supplierBalanceSummary(state, actor, "Fresh Valley Foods");
    expect(summary.rows).toEqual([]);
    expect(summary.snapshot_date).toBeDefined();
    expect(
      suppliersOverview(state, actor).find(
        (supplier) => supplier.name === "Fresh Valley Foods",
      )?.financial,
    ).toMatchObject({ balance: summary.balance, has_statement: true });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("keeps statement availability inside the existing financial projection and company guard", () => {
    const state = initialState();
    for (const role of ["floor_worker", "branch_supervisor"] as const) {
      const actor = authenticatedTestActor(state, role);
      for (const supplier of suppliersOverview(state, actor)) {
        expect(supplier).not.toHaveProperty("financial");
        expect(supplier).not.toHaveProperty("has_statement");
      }
    }
    expect(() =>
      suppliersOverview(state, authenticatedTestActor(state, "cashier")),
    ).toThrow(AuthorityError);
    const foreign = initialState();
    foreign.config.company.seed_key = "fictional-other-company";
    const foreignActor = authenticatedTestActor(foreign, "manager");
    expect(() => suppliersOverview(state, foreignActor)).toThrow(
      AuthorityError,
    );
  });
});
