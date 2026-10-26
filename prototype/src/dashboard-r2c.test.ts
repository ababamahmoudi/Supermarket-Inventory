import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { initialState } from "./store";
import { dashboardPurchases, dashboardSummary } from "./dashboard-data";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import type { PriceUpdateTask } from "./price-updates";

const now = new Date("2026-10-26T16:00:00Z");
const manager = (state: ReturnType<typeof initialState>, branch = "all") =>
  authenticatedTestActor(state, "manager", {
    selection:
      branch === "all"
        ? { kind: "all_locations" }
        : { kind: "location", location_id: branch },
  });
function task(
  state: ReturnType<typeof initialState>,
  branch: string,
  id: string,
): PriceUpdateTask {
  return {
    id,
    company_id: state.config.company.seed_key,
    branch,
    product_code: "0006",
    version: 1,
    status: "pending",
    old_price: { price: "1.99", regular_price: "1.99", unit: "each" },
    new_price: { price: "2.99", regular_price: "2.99", unit: "each" },
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    effective_at: now.toISOString(),
    due_at: now.toISOString(),
    reason: "approved_price",
    steps: [],
  };
}
describe("R2c Group1 canonical dashboard", () => {
  it("uses eight Mon–Sun calendar weeks with the current week last, across a year boundary", () => {
    const state = initialState();
    const october = dashboardPurchases(
      state,
      manager(state),
      "2026-10-26",
    ).weeks;
    expect(october).toHaveLength(8);
    expect(october[0]).toMatchObject({
      start: "2026-09-07",
      end: "2026-09-13",
    });
    expect(october[7]).toMatchObject({
      start: "2026-10-26",
      end: "2026-11-01",
    });
    const january = dashboardPurchases(
      state,
      manager(state),
      "2027-01-01",
    ).weeks;
    expect(january[7]).toMatchObject({
      start: "2026-12-28",
      end: "2027-01-03",
    });
    expect(
      january.every(
        (week) => new Date(`${week.start}T12:00:00Z`).getUTCDay() === 1,
      ),
    ).toBe(true);
  });
  it("projects exact recorded invoice totals and a Decimal sum of the monthly supplier ranking", () => {
    const state = initialState();
    const actor = manager(state);
    const summary = dashboardSummary(state, actor, now);
    expect(summary.recentInvoices.length).toBeGreaterThan(0);
    for (const row of summary.recentInvoices) {
      const invoice = [state.invoice, ...(state.invoices ?? [])].find(
        (item) => item.id === row.id,
      )!;
      expect(row.total).toBe(invoice.final_total);
    }
    expect(summary.purchaseMonthTotal).toBe(
      summary.purchases.suppliers
        .reduce((total, row) => total.plus(row.amount), new Decimal(0))
        .toFixed(2),
    );
    expect(summary.purchases.suppliers.map((row) => row.amount)).toEqual(
      [...summary.purchases.suppliers]
        .sort((a, b) => new Decimal(b.amount).cmp(a.amount))
        .map((row) => row.amount),
    );
  });
  it("scopes recent invoices to their effective selected location, including All locations", () => {
    const state = initialState();
    const local = dashboardSummary(state, manager(state, "Branch 1"), now);
    expect(local.recentInvoices.length).toBeGreaterThan(0);
    expect(local.recentInvoices.every((row) => row.branch === "Branch 1")).toBe(
      true,
    );
    const all = dashboardSummary(state, manager(state), now);
    expect(all.recentInvoices.some((row) => row.branch !== "Branch 1")).toBe(
      true,
    );
  });
  it("counts only current pending tasks in the selected company and allowed location", () => {
    const state = initialState();
    state.price_update_tasks = [
      task(state, "Branch 1", "local"),
      task(state, "Branch 2", "other-branch"),
      { ...task(state, "Branch 1", "foreign"), company_id: "foreign-company" },
      { ...task(state, "Branch 1", "finished"), status: "done" },
    ];
    const local = dashboardSummary(state, manager(state, "Branch 1"), now);
    expect(local.priceUpdates.map((row) => row.id)).toEqual(["local"]);
    expect(local.priceUpdates[0]).toMatchObject({
      price: "2.99",
      oldPrice: "1.99",
      unit: "each",
    });
    expect(
      dashboardSummary(state, manager(state), now)
        .priceUpdates.map((row) => row.id)
        .sort(),
    ).toEqual(["local", "other-branch"]);
  });
  it("new product rows have a first price without an old comparison; price changes keep the real old value", () => {
    const state = initialState();
    const actor = manager(state);
    const summary = dashboardSummary(state, actor, now);
    const product = summary.approvalRows.find(
      (row) => row.kind === "new_product",
    );
    const change = summary.approvalRows.find(
      (row) => row.kind === "price_change",
    );
    expect(product).toBeDefined();
    expect(product?.oldPrice).toBeNull();
    expect(new Decimal(product!.price).gt(0)).toBe(true);
    expect(change).toBeDefined();
    expect(new Decimal(change!.oldPrice!).gt(0)).toBe(true);
    expect(
      summary.approvalRows.every(
        (row) => row.margin === null || new Decimal(row.margin).isFinite(),
      ),
    ).toBe(true);
  });
  it("sale requests are reviewed with canonical margin and configured minimum, without authorizing approval", () => {
    const state = initialState();
    const request = state.sale_requests?.find(
      (row) => row.status === "pending",
    );
    expect(request).toBeDefined();
    request!.requested_price = "0.50";
    const before = JSON.stringify(state);
    const row = dashboardSummary(state, manager(state), now).approvalRows.find(
      (item) => item.id === request!.id,
    )!;
    expect(row.kind).toBe("sale_request");
    expect(row.requiresReview).toBe(true);
    expect(row.belowMinimum).toBe(true);
    expect(new Decimal(row.margin!).lt(0)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
  it("does not return foreign approvals or expose the company dashboard to operational roles", () => {
    const state = initialState();
    const template = state.approvals.find((row) => row.status === "pending")!;
    state.approvals.push({
      ...template,
      id: "foreign-approval",
      company_id: "foreign-company",
    });
    expect(
      dashboardSummary(state, manager(state), now).approvalRows.map(
        (row) => row.id,
      ),
    ).not.toContain("foreign-approval");
    for (const role of [
      "cashier",
      "floor_worker",
      "branch_supervisor",
    ] as const)
      expect(() =>
        dashboardSummary(state, authenticatedTestActor(state, role), now),
      ).toThrow();
    const actor = manager(state);
    const foreign = cloneWithAuthority(state);
    foreign.config.company.seed_key = "foreign-company";
    expect(() => dashboardSummary(foreign, actor, now)).toThrow();
  });
});
