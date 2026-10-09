import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { initialState } from "./store";
import { companyDate } from "./invoice";
import { dashboardArrivals, dashboardPurchases } from "./dashboard-data";
import { invoiceLocationMovePreview, movePostedInvoice } from "./received";
import type { OperationsContext } from "./operations";

function context(
  state: ReturnType<typeof initialState>,
  branch = "all",
): OperationsContext {
  return {
    company_id: state.config.company.seed_key,
    branch,
    role: "supervisor",
    actor: "Demo Supervisor",
  };
}

describe("C1 dashboard uses receiving evidence rather than inventory estimates", () => {
  it("keeps arrivals unchanged when obsolete estimated stock changes", () => {
    const state = initialState();
    const before = dashboardArrivals(state, context(state));
    expect(before.length).toBeGreaterThan(0);
    state.stock = { "Warehouse:0001": 999999, "Branch 1:0001": -999999 };
    expect(dashboardArrivals(state, context(state))).toEqual(before);
    expect(dashboardArrivals(state, context(state, "Warehouse"))).toEqual([]);
    expect(() =>
      dashboardArrivals(state, { ...context(state), role: "cashier" }),
    ).toThrow();
    expect(() =>
      dashboardArrivals(state, {
        ...context(state),
        company_id: "other-company",
      }),
    ).toThrow();
  });

  it("moves recorded purchases with the invoice without turning unpaid liability into purchases", () => {
    const state = initialState();
    const today = companyDate(state.config);
    const invoice = state.invoices!.find(
      (row) =>
        row.status === "posted" &&
        row.invoice_date?.startsWith(today.slice(0, 7)),
    )!;
    expect(invoice).toBeDefined();
    const original = JSON.stringify(invoice);
    const all = context(state);
    const before = dashboardPurchases(state, all, today);
    const preview = invoiceLocationMovePreview(
      state,
      all,
      invoice.id,
      "Warehouse",
    );
    movePostedInvoice(
      state,
      all,
      invoice.id,
      "Warehouse",
      "Delivered to Warehouse",
      preview.snapshot,
    );
    expect(JSON.stringify(invoice)).toBe(original);
    expect(dashboardPurchases(state, all, today)).toEqual(before);
    const warehouse = dashboardPurchases(
      state,
      context(state, "Warehouse"),
      today,
    );
    expect(warehouse.suppliers.length).toBeGreaterThan(0);
    const correctionIds = new Set(
      state.invoice_location_corrections!.flatMap((row) => [
        row.ledger_in_id,
        row.ledger_out_id,
      ]),
    );
    const actualPurchases = state.ledger
      .filter(
        (row) =>
          row.invoice_id === invoice.id &&
          !correctionIds.has(row.id) &&
          row.type !== "payment" &&
          row.type !== "credit",
      )
      .reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
    expect(
      warehouse.suppliers
        .reduce((sum, row) => sum.plus(row.amount), new Decimal(0))
        .toFixed(2),
    ).toBe(actualPurchases.toFixed(2));
    expect(
      dashboardPurchases(
        state,
        context(state, "Branch 1"),
        today,
      ).suppliers.some(
        (row) =>
          row.supplier === invoice.supplier &&
          row.amount === warehouse.suppliers[0].amount,
      ),
    ).toBe(false);
  });
});
