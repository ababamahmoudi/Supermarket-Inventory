import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInvoice, postInvoice, receiveShort } from "./invoice";
import { postPayment, type OperationsContext } from "./operations";
import { DemoProvider, initialState, STORAGE_KEY, useDemo } from "./store";
import {
  supplierBalanceCsv,
  supplierBalanceOverview,
  supplierBalanceSummary,
} from "./supplier-balances";
import type { DemoState } from "./types";

const supervisor: OperationsContext = {
  company_id: "super-arzon",
  branch: "Branch 1",
  role: "supervisor",
  actor: "Demo Supervisor",
};
const freshValley = "Fresh Valley Foods";

function postDemoInvoice(state: DemoState, quantityReceived = 8) {
  state.invoice = createInvoice(state, "Branch 1");
  state.invoice.file_name = "fictional-original.png";
  state.invoice.file_data = "data:image/png;base64,ZGVtby1vbmx5";
  for (const line of state.invoice.lines) {
    line.review_confirmed = true;
    line.date_confirmed = true;
    if (line.product_code === "0009")
      line.qty_received_at_posting = quantityReceived;
  }
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Fictional label needs the Supervisor's review.",
  };
  expect(postInvoice(state, "floor_worker", "Branch 1")).toBe(true);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("supplier figures from explicit fictional posted invoices", () => {
  it("reconciles the supplied totals, open invoices and overdue amounts to the same ledger", () => {
    const state = initialState();
    const before = structuredClone(state);
    const rows = supplierBalanceOverview(state, supervisor);
    expect(rows).toHaveLength(5);
    expect(
      rows.find((row) => row.supplier === "Corner Spice Co."),
    ).toMatchObject({ balance: "0.00", overdue: "0.00" });
    expect(Decimal.sum(...rows.map((row) => row.balance)).toFixed(2)).toBe(
      "2368.29",
    );
    expect(Decimal.sum(...rows.map((row) => row.overdue)).toFixed(2)).toBe(
      "306.40",
    );
    expect(state.invoices).toHaveLength(12);
    expect(state.ledger).toHaveLength(24);
    expect(
      rows.reduce(
        (sum, row) =>
          sum +
          supplierBalanceSummary(
            state,
            supervisor,
            row.supplier,
          ).invoices.filter((invoice) => new Decimal(invoice.amount).gt(0))
            .length,
        0,
      ),
    ).toBe(5);
    expect(state).toEqual(before);
  });

  it("adds the newly posted FV-20417 to the separate earlier FV-20390", () => {
    const state = initialState();
    const baselineCount = state.ledger.length;
    expect(supplierBalanceSummary(state, supervisor, freshValley).balance).toBe(
      "169.79",
    );
    postDemoInvoice(state);
    const summary = supplierBalanceSummary(state, supervisor, freshValley);
    expect(summary.balance).toBe("339.58");
    expect(summary.snapshot_balance).toBe("0.00");
    expect(
      summary.invoices.find((row) => row.reference === "FV-20390")?.amount,
    ).toBe("169.79");
    expect(
      summary.invoices.find((row) => row.reference === "FV-20417")?.amount,
    ).toBe("169.79");
    expect(state.ledger).toHaveLength(baselineCount + 2);
  });

  it("uses actual amounts when the current invoice is posted without shorts", () => {
    const state = initialState();
    postDemoInvoice(state, 12);
    expect(supplierBalanceSummary(state, supervisor, freshValley).balance).toBe(
      "346.81",
    );
  });

  it("restores later receipts and allocates payments against the actual current invoice", () => {
    const state = initialState();
    postDemoInvoice(state);
    receiveShort(
      state,
      "0009",
      2,
      "ACTUAL-DELIVERY",
      "floor_worker",
      "Branch 1",
    );
    expect(supplierBalanceSummary(state, supervisor, freshValley).balance).toBe(
      "343.20",
    );
    postPayment(state, supervisor, {
      supplier: freshValley,
      amount: "50.00",
      date: state.demo_fixture_anchor_date!,
      cheque: "DEMO-1001",
      receipt: "ACTUAL-PAYMENT",
      allocations: [{ invoice_id: state.invoice.id, amount: "50.00" }],
    });
    const summary = supplierBalanceSummary(state, supervisor, freshValley);
    expect(summary.balance).toBe("293.20");
    expect(
      summary.invoices.find((row) => row.invoice_id === state.invoice.id)
        ?.amount,
    ).toBe("123.41");
    expect(summary.snapshot_balance).toBe("0.00");
  });

  it("adds other invoice ledger rows and reports no separate demo balance", () => {
    const state = initialState();
    state.ledger.push({
      id: "new-receipt",
      company_id: supervisor.company_id,
      branch: "Branch 1",
      supplier: freshValley,
      type: "invoice",
      amount: "20.00",
      date: state.demo_fixture_anchor_date!,
      reference: "FV-NEW-DOCUMENT",
      invoice_id: "new-document",
      currency: state.config.company.currency,
    });
    expect(
      supplierBalanceSummary(state, supervisor, freshValley),
    ).toMatchObject({ balance: "189.79", snapshot_balance: "0.00" });
  });

  it("reduces overdue only when payment is allocated to an overdue invoice", () => {
    const state = initialState();
    const supplier = "Golden Grain Distributors";
    const overdueInvoice = supplierBalanceSummary(
      state,
      supervisor,
      supplier,
    ).invoices.find((row) => row.reference === "GG-11842")!;
    postPayment(state, supervisor, {
      supplier,
      amount: "50.00",
      date: state.demo_fixture_anchor_date!,
      cheque: "DEMO-1002",
      receipt: "OVERDUE-PAYMENT",
      allocations: [{ invoice_id: overdueInvoice.invoice_id, amount: "50.00" }],
    });
    expect(supplierBalanceSummary(state, supervisor, supplier)).toMatchObject({
      balance: "792.10",
      overdue: "160.00",
      snapshot_balance: "0.00",
    });
  });

  it("removes the next due date when the last outstanding invoice is paid", () => {
    const state = initialState();
    const supplier = "Sunrise Beverages";
    const overdueInvoice = supplierBalanceSummary(
      state,
      supervisor,
      supplier,
    ).invoices.find((row) => new Decimal(row.amount).gt(0))!;
    postPayment(state, supervisor, {
      supplier,
      amount: "96.40",
      date: state.demo_fixture_anchor_date!,
      cheque: "DEMO-1003",
      receipt: "PAID-SUNRISE",
      allocations: [{ invoice_id: overdueInvoice.invoice_id, amount: "96.40" }],
    });
    expect(supplierBalanceSummary(state, supervisor, supplier)).toMatchObject({
      balance: "0.00",
      overdue: "0.00",
      next_due_date: undefined,
    });
  });

  it("keeps document dates after refresh while overdue follows the calendar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T16:00:00Z"));
    const state = initialState();
    const original = supplierBalanceSummary(
      state,
      supervisor,
      "Golden Grain Distributors",
    );
    expect(original.next_due_date).toBe("2026-10-10");
    const restored: DemoState = JSON.parse(JSON.stringify(state));
    vi.setSystemTime(new Date("2026-10-15T16:00:00Z"));
    const later = supplierBalanceSummary(
      restored,
      supervisor,
      "Golden Grain Distributors",
    );
    expect(restored.demo_fixture_anchor_date).toBe("2026-10-07");
    expect(later.overdue).toBe("842.10");
    expect(later.balance).toBe(original.balance);
  });

  it("calculates month-end balances from the dated documents, not a snapshot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T16:00:00Z"));
    const state = initialState();
    expect(
      supplierBalanceSummary(state, supervisor, freshValley, "2026-09-30"),
    ).toMatchObject({
      balance: "0.00",
      overdue: "0.00",
      snapshot_balance: "0.00",
    });
  });

  it("isolates branches and includes their invoices in all-branch scope", () => {
    const state = initialState();
    for (const branch of ["Branch 2", "Branch 3"] as const) {
      const rows = supplierBalanceOverview(state, { ...supervisor, branch });
      expect(
        rows.every((row) => row.balance === "0.00" && row.overdue === "0.00"),
      ).toBe(true);
    }
    const all = supplierBalanceOverview(state, {
      ...supervisor,
      branch: "all",
    });
    expect(Decimal.sum(...all.map((row) => row.balance)).toFixed(2)).toBe(
      "2368.29",
    );
  });

  it("rejects non-Supervisors and another company's requested scope", () => {
    const state = initialState();
    for (const role of ["floor_worker", "cashier"] as const) {
      expect(() =>
        supplierBalanceSummary(state, { ...supervisor, role }, freshValley),
      ).toThrow("supervisor");
      expect(() =>
        supplierBalanceOverview(state, { ...supervisor, role }),
      ).toThrow("supervisor");
    }
    expect(() =>
      supplierBalanceSummary(
        state,
        { ...supervisor, company_id: "another-company" },
        freshValley,
      ),
    ).toThrow("scope");
  });

  it("keeps Branch 1 overdue unchanged after an unallocated Branch 2 payment", () => {
    const state = initialState();
    postPayment(
      state,
      { ...supervisor, branch: "Branch 2" },
      {
        supplier: "Golden Grain Distributors",
        amount: "50.00",
        date: state.demo_fixture_anchor_date!,
        cheque: "DEMO-B2",
        receipt: "BRANCH-TWO-PAYMENT",
        allocations: [],
      },
    );
    expect(
      supplierBalanceSummary(state, supervisor, "Golden Grain Distributors"),
    ).toMatchObject({ balance: "842.10", overdue: "210.00" });
    expect(
      supplierBalanceSummary(
        state,
        { ...supervisor, branch: "all" },
        "Golden Grain Distributors",
      ),
    ).toMatchObject({ balance: "792.10", overdue: "210.00" });
  });

  it("ignores foreign records and another currency", () => {
    const state = initialState();
    state.ledger.push({
      id: "foreign-ledger",
      company_id: "another-company",
      branch: "Branch 1",
      supplier: "Private foreign supplier",
      type: "invoice",
      amount: "9999.00",
      date: state.demo_fixture_anchor_date!,
      reference: "PRIVATE",
      currency: "CAD",
    });
    expect(
      supplierBalanceOverview(state, supervisor).map((row) => row.supplier),
    ).not.toContain("Private foreign supplier");
    state.config.company.currency = "USD";
    expect(supplierBalanceSummary(state, supervisor, freshValley).balance).toBe(
      "0.00",
    );
  });

  it("exports invoice and payment records supporting the displayed balance", () => {
    const state = initialState();
    const summary = supplierBalanceSummary(
      state,
      supervisor,
      "Golden Grain Distributors",
    );
    const csv = supplierBalanceCsv(summary, "Golden Grain Distributors");
    expect(csv).not.toContain('"Demo balance"');
    expect(csv).toContain('"GG-11842"');
    expect(csv).toContain('"Balance","","","","","","842.10"');
  });
});

function StateProbe() {
  const { state } = useDemo();
  return createElement(
    "output",
    { "data-testid": "saved-state" },
    JSON.stringify(state),
  );
}

function restore(state: DemoState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render(createElement(DemoProvider, null, createElement(StateProbe)));
  return JSON.parse(
    screen.getByTestId("saved-state").textContent!,
  ) as DemoState;
}

describe("configured minimum margins and safe saved-demo upgrades", () => {
  it("uses the configured quarter margin for all categories, including Rice", () => {
    expect(
      initialState().config.pricing_categories.every(
        (category) => category.minimum_margin === "0.25",
      ),
    ).toBe(true);
  });

  it("corrects the untouched old Rice default while preserving data and divisor edits", () => {
    const state = initialState();
    delete state.pricing_minimum_margin_schema;
    delete state.supplier_balance_snapshot_date;
    state.config.pricing_categories.find(
      (category) => category.key === "rice",
    )!.minimum_margin = "0.20";
    state.config.pricing_categories[0].cost_divisor = "0.70";
    state.products[0].name_en = "A user's saved product name";
    const restored = restore(state);
    expect(
      restored.config.pricing_categories.find(
        (category) => category.key === "rice",
      )!.minimum_margin,
    ).toBe("0.25");
    expect(restored.config.pricing_categories[0].cost_divisor).toBe("0.70");
    expect(restored.products[0].name_en).toBe(state.products[0].name_en);
    expect(restored.ledger).toEqual(state.ledger);
    expect(restored.supplier_balance_snapshot_date).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("preserves an explicit custom legacy margin and an inactive threshold", () => {
    const state = initialState();
    delete state.pricing_minimum_margin_schema;
    state.config.pricing_categories.find(
      (category) => category.key === "rice",
    )!.minimum_margin = "0.30";
    state.config.pricing_categories[0].minimum_margin = null;
    const restored = restore(state);
    expect(
      restored.config.pricing_categories.find(
        (category) => category.key === "rice",
      )!.minimum_margin,
    ).toBe("0.30");
    expect(restored.config.pricing_categories[0].minimum_margin).toBeNull();
  });

  it("corrects the old margin even after other audited settings changed", () => {
    const state = initialState();
    delete state.pricing_minimum_margin_schema;
    state.config.pricing_categories.find(
      (category) => category.key === "rice",
    )!.minimum_margin = "0.20";
    state.config.pricing_categories[0].cost_divisor = "0.70";
    state.activity.push({
      id: "settings-edit",
      company_id: supervisor.company_id,
      branch: "all",
      action: "settings_changed",
      by: "Demo Supervisor",
      at: new Date().toISOString(),
    });
    const restored = restore(state);
    expect(
      restored.config.pricing_categories.find(
        (category) => category.key === "rice",
      )!.minimum_margin,
    ).toBe("0.25");
    expect(restored.config.pricing_categories[0].cost_divisor).toBe("0.70");
    expect(restored.activity).toEqual(state.activity);
    expect(restored.pricing_minimum_margin_schema).toBe(2);
  });

  it("never overwrites a later Supervisor margin with the migrated defaults", () => {
    const state = initialState();
    state.config.pricing_categories.find(
      (category) => category.key === "rice",
    )!.minimum_margin = "0.20";
    const restored = restore(state);
    expect(
      restored.config.pricing_categories.find(
        (category) => category.key === "rice",
      )!.minimum_margin,
    ).toBe("0.20");
  });
});
