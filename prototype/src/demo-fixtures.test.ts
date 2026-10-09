import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "./store";
import {
  DEMO_FIXTURE_BACKUP_KEY,
  hydrateDemoFixture,
  restoreDemoFixture,
} from "./demo-fixtures";
import { ledgerSummary, type OperationsContext } from "./operations";
import {
  dashboardArrivals,
  companyWeekStart,
  dashboardPriceChanges,
  dashboardPurchases,
} from "./dashboard-data";
import { companyDate } from "./invoice";
import type { DemoState } from "./types";

const context: OperationsContext = {
  company_id: "super-arzon",
  branch: "Branch 1",
  role: "supervisor",
  actor: "Demo Supervisor",
};

function legacyState() {
  const state = initialState();
  delete state.demo_fixture_schema;
  delete state.demo_fixture_anchor_date;
  state.invoices = [];
  state.ledger = [];
  state.stock_movements = [];
  state.activity = [];
  state.stock = Object.fromEntries(
    state.products.flatMap((product) =>
      ["Branch 1", "Branch 2", "Branch 3"].map((branch) => [
        `${branch}:${product.code}`,
        branch === "Branch 1" && product.code === "0001" ? 1 : 0,
      ]),
    ),
  );
  return state;
}

describe("explicit fictional demo documents", () => {
  it("makes every posted invoice total reconcile to quantities, four-decimal costs, tax and allocated payments", () => {
    const state = initialState();
    for (const invoice of state.invoices!) {
      expect(invoice.status).toBe("posted");
      expect(invoice.company_id).toBe(context.company_id);
      expect(invoice.supplier_invoice_number).not.toBe("FV-20417");
      for (const line of invoice.lines) {
        expect(
          new Decimal(line.unit_cost_before_tax)
            .times(line.qty_invoiced)
            .toFixed(2),
        ).toBe(line.line_total);
        expect(line.unit_cost_before_tax).toMatch(/^\d+\.\d{4}$/);
      }
      expect(
        Decimal.sum(...invoice.lines.map((line) => line.line_total)).toFixed(2),
      ).toBe(invoice.subtotal);
      expect(
        Decimal.sum(
          ...invoice.lines.map((line) => line.line_tax ?? "0"),
        ).toFixed(2),
      ).toBe(invoice.tax);
      expect(new Decimal(invoice.subtotal).plus(invoice.tax).toFixed(2)).toBe(
        invoice.final_total,
      );
      expect(
        state.ledger.find(
          (row) => row.invoice_id === invoice.id && row.type === "invoice",
        )?.amount,
      ).toBe(invoice.final_total);
    }
    expect(state.invoice.status).toBe("empty");
    expect(
      Decimal.sum(...state.ledger.map((row) => row.amount)).toFixed(2),
    ).toBe("2368.29");
  });

  it("retains historical physical count, receipt, return and store-use movements without exposing inventory", () => {
    const state = initialState();
    for (const [key, quantity] of Object.entries(state.stock)) {
      const expected = state
        .stock_movements!.filter(
          (move) => `${move.branch}:${move.product_code}` === key,
        )
        .reduce((sum, move) => sum + move.qty, 0);
      expect(quantity, key).toBe(expected);
      expect(quantity).toBeGreaterThanOrEqual(0);
    }
    expect(state.stock["Branch 1:0008"]).toBe(0);
    expect(state.stock["Branch 2:0008"]).toBeGreaterThan(0);
    expect(state.stock["Branch 3:0003"]).toBeGreaterThan(0);
    expect(state.stock_movements!.some((move) => move.type === "return")).toBe(
      true,
    );
    expect(
      state.stock_movements!.some((move) => move.type === "store_use"),
    ).toBe(true);
  });

  it("links initial approvals to an earlier posted invoice with consistent cost, margin, author and dates", () => {
    const state = initialState();
    const approval = state.approvals.find(
      (item) => item.id === "demo-lavash-price",
    )!;
    const invoice = state.invoices!.find(
      (item) => item.id === approval.invoice_ids![0],
    )!;
    expect(invoice.supplier_invoice_number).toBe("FV-20390");
    expect(approval.unit_cost).toBe("1.5500");
    expect(new Decimal(approval.margin!).times(100).toFixed(2)).toBe("48.16");
    expect(approval.triggered_by).toBe("Demo Floor Worker");
    expect(approval.created_at).toBe(invoice.posted_at);
    expect(
      state.returns.every((record) => record.created_by && record.created_at),
    ).toBe(true);
    expect(
      state.expiry.every(
        (record) => record.invoice_number && record.received_date,
      ),
    ).toBe(true);
  });

  it("backs up, verifies and restores old user edits while upgrading once without duplicating documents", () => {
    const old = legacyState();
    old.products[0].name_en = "My retained product";
    old.stock["Branch 1:0001"] += 5;
    old.returns[0].status = "picked_up";
    const original = JSON.stringify(old);
    const migrated = restoreDemoFixture(old, localStorage);
    expect(localStorage.getItem(DEMO_FIXTURE_BACKUP_KEY)).toBe(original);
    const restoredBackup: DemoState = JSON.parse(
      localStorage.getItem(DEMO_FIXTURE_BACKUP_KEY)!,
    );
    expect(restoredBackup).toEqual(old);
    expect(old.demo_fixture_schema).toBeUndefined();
    expect(migrated.products[0].name_en).toBe("My retained product");
    expect(migrated.returns[0].status).toBe("picked_up");
    expect(migrated.stock["Branch 1:0001"]).toBe(
      initialState().stock["Branch 1:0001"] + 5,
    );
    const again = hydrateDemoFixture(migrated);
    expect(again).toBe(migrated);
    expect(again.invoices).toHaveLength(12);
    expect(again.ledger).toHaveLength(24);
  });

  it("keeps old data intact when a verified backup cannot be made", () => {
    const old = legacyState();
    const storage = {
      setItem: () => {
        throw new Error("quota");
      },
      getItem: () => null,
    };
    expect(restoreDemoFixture(old, storage)).toBe(old);
    expect(
      restoreDemoFixture(old, {
        setItem: () => undefined,
        getItem: () => "unverified",
      }),
    ).toBe(old);
  });
});

describe("dashboard content from the same scoped business records", () => {
  it("uses purchases only, ignoring payments, opening balances, foreign branches/companies and unrelated adjustments", () => {
    const state = initialState();
    const today = companyDate(state.config);
    const before = dashboardPurchases(state, context, today);
    const rows = state.ledger;
    rows.push(
      {
        id: "opening",
        company_id: context.company_id,
        branch: "Branch 1",
        supplier: "Fresh Valley Foods",
        type: "opening_balance",
        amount: "9999.00",
        date: today,
        reference: "OPEN",
        currency: "CAD",
      },
      {
        id: "foreign",
        company_id: "private-company",
        branch: "Branch 1",
        supplier: "Fresh Valley Foods",
        type: "invoice",
        amount: "9999.00",
        date: today,
        reference: "PRIVATE",
        invoice_id: state.invoices![0].id,
        currency: "CAD",
      },
      {
        id: "unrelated",
        company_id: context.company_id,
        branch: "Branch 1",
        supplier: "Fresh Valley Foods",
        type: "adjustment",
        amount: "9999.00",
        date: today,
        reference: "UNRELATED",
        currency: "CAD",
      },
    );
    expect(dashboardPurchases(state, context, today)).toEqual(before);
    expect(
      before.weeks.filter((week) => new Decimal(week.amount).gt(0)).length,
    ).toBeGreaterThan(0);
    const summary = ledgerSummary(state, context, "Fresh Valley Foods");
    expect(new Decimal(summary.balance).gt("169.79")).toBe(true);
  });

  it("subtracts a recorded linked purchase credit from monthly and weekly totals", () => {
    const state = initialState();
    const today = companyDate(state.config);
    const before = dashboardPurchases(state, context, today);
    const invoice = state.invoices!.find(
      (item) => item.supplier_invoice_number === "FV-20390",
    )!;
    state.ledger.push({
      id: "credit",
      company_id: context.company_id,
      branch: "Branch 1",
      supplier: invoice.supplier,
      type: "credit",
      amount: "-10.00",
      date: today,
      reference: "CREDIT",
      invoice_id: invoice.id,
      currency: "CAD",
    });
    const after = dashboardPurchases(state, context, today);
    expect(
      new Decimal(
        before.suppliers.find((row) => row.supplier === invoice.supplier)!
          .amount,
      )
        .minus(
          after.suppliers.find((row) => row.supplier === invoice.supplier)!
            .amount,
        )
        .toFixed(2),
    ).toBe("10.00");
    expect(
      new Decimal(before.weeks[7].amount)
        .minus(after.weeks[7].amount)
        .toFixed(2),
    ).toBe("10.00");
  });

  it("shows this week's actual arrivals and ignores retained counters and To order reminders", () => {
    const state = initialState();
    const today = companyDate(state.config);
    const rows = dashboardArrivals(state, context, today);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.units).toBeGreaterThan(0);
      expect(row.company_id).toBe(context.company_id);
      expect(row.branch).toBe(context.branch);
      expect(row.date >= companyWeekStart(today) && row.date <= today).toBe(
        true,
      );
      expect(row.invoice_number).not.toBe("");
      expect(row.received_by).not.toBe("");
    }
    state.stock["Branch 1:0008"] = 999999;
    state.notes.find((note) => note.id === "demo-note-1")!.status = "resolved";
    expect(dashboardArrivals(state, context, today)).toEqual(rows);
  });

  it("uses scoped actual receipts across all locations without duplicate entries or another company's documents", () => {
    const state = initialState();
    const today = companyDate(state.config);
    const invoice = state.invoices![0];
    state.invoices!.push({
      ...structuredClone(invoice),
      id: "this-week-other-location",
      branch: "Branch 2",
      supplier_invoice_number: "THIS-WEEK-OTHER-LOCATION",
      posted_at: `${today}T16:00:00Z`,
      received_at: `${today}T16:00:00Z`,
      invoice_date: today,
    });
    const branchRows = dashboardArrivals(state, context, today);
    const rows = dashboardArrivals(state, { ...context, branch: "all" }, today);
    expect(rows.filter((row) => row.branch === context.branch)).toEqual(
      branchRows,
    );
    expect(rows.some((row) => row.branch !== context.branch)).toBe(true);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    state.invoices!.push({
      ...structuredClone(invoice),
      id: "private-company-invoice",
      company_id: "private-company",
      posted_at: `${today}T16:00:00Z`,
      invoice_date: today,
    });
    expect(
      dashboardArrivals(state, { ...context, branch: "all" }, today),
    ).toEqual(rows);
  });

  it("shows actual price changes this company-timezone week, excluding metadata-only product edits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T16:00:00Z"));
    const state = initialState();
    const before = dashboardPriceChanges(state, context);
    expect(before.map((entry) => entry.product_code)).toEqual(["0004", "0007"]);
    const product = state.products[0];
    state.activity.push({
      id: "metadata",
      company_id: context.company_id,
      branch: "Branch 1",
      action: "Save product",
      by: "Demo Supervisor",
      at: new Date().toISOString(),
      product_code: product.code,
      before: { product },
      after: { product: { ...product, name_en: "Updated" } },
    });
    expect(dashboardPriceChanges(state, context)).toEqual(before);
    state.activity.push({
      id: "manual-price",
      company_id: context.company_id,
      branch: "Branch 1",
      action: "Save product",
      by: "Demo Supervisor",
      at: new Date().toISOString(),
      product_code: product.code,
      before: { product },
      after: { product: { ...product, selling_price: "24.99" } },
    });
    expect(dashboardPriceChanges(state, context)[0].id).toBe("manual-price");
    vi.useRealTimers();
  });

  it("rejects unauthorized company and role scopes", () => {
    const state = initialState();
    expect(() =>
      dashboardPurchases(state, { ...context, company_id: "foreign" }),
    ).toThrow("scope");
    expect(() =>
      dashboardArrivals(state, { ...context, role: "floor_worker" }),
    ).toThrow("supervisor");
    expect(() =>
      dashboardPriceChanges(state, { ...context, role: "cashier" }),
    ).toThrow("supervisor");
  });
});
