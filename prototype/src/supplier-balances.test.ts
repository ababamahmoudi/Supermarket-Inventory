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

describe("supplier figures from the owner's demo snapshot", () => {
  it("loads all suppliers and the exact supplied branch totals without inventing records", () => {
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
    expect(state).toEqual(before);
    expect(state.ledger).toEqual([]);
  });

  it("does not double the Fresh Valley figure after its actual invoice posts", () => {
    const state = initialState();
    expect(supplierBalanceSummary(state, supervisor, freshValley).balance).toBe(
      "169.79",
    );
    postDemoInvoice(state);
    const summary = supplierBalanceSummary(state, supervisor, freshValley);
    expect(summary.balance).toBe("169.79");
    expect(summary.snapshot_balance).toBe("0.00");
    expect(summary.rows).toHaveLength(2);
    expect(state.ledger).toHaveLength(2);
  });

  it("uses actual amounts when the original invoice is posted without shorts", () => {
    const state = initialState();
    postDemoInvoice(state, 12);
    expect(supplierBalanceSummary(state, supervisor, freshValley).balance).toBe(
      "177.02",
    );
  });

  it("includes later short receipts and real payment allocations without recreating the seed balance", () => {
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
      "173.41",
    );
    postPayment(state, supervisor, {
      supplier: freshValley,
      amount: "50.00",
      date: state.supplier_balance_snapshot_date!,
      cheque: "DEMO-1001",
      receipt: "ACTUAL-PAYMENT",
      allocations: [{ invoice_id: state.invoice.id, amount: "50.00" }],
    });
    const summary = supplierBalanceSummary(state, supervisor, freshValley);
    expect(summary.balance).toBe("123.41");
    expect(summary.invoices[0].amount).toBe("123.41");
    expect(summary.snapshot_balance).toBe("0.00");
  });

  it("adds other invoices to the supplied figure instead of discarding it", () => {
    const state = initialState();
    state.ledger.push({
      id: "new-receipt",
      company_id: supervisor.company_id,
      branch: "Branch 1",
      supplier: freshValley,
      type: "invoice",
      amount: "20.00",
      date: state.supplier_balance_snapshot_date!,
      reference: "FV-NEW-DOCUMENT",
      invoice_id: "new-document",
      currency: state.config.company.currency,
    });
    expect(supplierBalanceSummary(state, supervisor, freshValley).balance).toBe(
      "189.79",
    );
    expect(
      supplierBalanceSummary(state, supervisor, freshValley).snapshot_balance,
    ).toBe("169.79");
  });

  it("applies actual payments against seed figures and their overdue amounts", () => {
    const state = initialState();
    postPayment(state, supervisor, {
      supplier: "Golden Grain Distributors",
      amount: "50.00",
      date: state.supplier_balance_snapshot_date!,
      cheque: "DEMO-1002",
      receipt: "SEED-BALANCE-PAYMENT",
      allocations: [],
    });
    const summary = supplierBalanceSummary(
      state,
      supervisor,
      "Golden Grain Distributors",
    );
    expect(summary.balance).toBe("792.10");
    expect(summary.overdue).toBe("160.00");
    expect(summary.snapshot_balance).toBe("842.10");
    expect(summary.rows).toHaveLength(1);
    expect(state.ledger[0].type).toBe("payment");
  });

  it("removes the next due date when an aggregate demo balance has been paid", () => {
    const state = initialState();
    postPayment(state, supervisor, {
      supplier: "Sunrise Beverages",
      amount: "96.40",
      date: state.supplier_balance_snapshot_date!,
      cheque: "DEMO-1003",
      receipt: "PAID-SUNRISE",
      allocations: [],
    });
    expect(
      supplierBalanceSummary(state, supervisor, "Sunrise Beverages"),
    ).toMatchObject({
      balance: "0.00",
      overdue: "0.00",
      next_due_date: undefined,
    });
  });

  it("anchors snapshot relative dates across refresh and later calendar days", () => {
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
    expect(later.snapshot_date).toBe("2026-10-07");
    expect(later.next_due_date).toBe(original.next_due_date);
    expect(later.balance).toBe(original.balance);
  });

  it("does not imply balances before the supplied snapshot existed", () => {
    const state = initialState();
    state.supplier_balance_snapshot_date = "2026-10-07";
    expect(
      supplierBalanceSummary(state, supervisor, freshValley, "2026-09-30"),
    ).toMatchObject({
      balance: "0.00",
      overdue: "0.00",
      snapshot_balance: "0.00",
    });
  });

  it("isolates branches and includes the selected company's figures in all-branch scope", () => {
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
        {
          ...supervisor,
          company_id: "another-company",
        },
        freshValley,
      ),
    ).toThrow("scope");
  });

  it("does not clear Branch 1 overdue amounts with an unallocated Branch 2 payment", () => {
    const state = initialState();
    postPayment(
      state,
      { ...supervisor, branch: "Branch 2" },
      {
        supplier: "Golden Grain Distributors",
        amount: "50.00",
        date: state.supplier_balance_snapshot_date!,
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

  it("ignores foreign ledger records and never seeds another company or another currency", () => {
    const state = initialState();
    state.ledger.push({
      id: "foreign-ledger",
      company_id: "another-company",
      branch: "Branch 1",
      supplier: "Private foreign supplier",
      type: "invoice",
      amount: "9999.00",
      date: state.supplier_balance_snapshot_date!,
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
    state.config.company.seed_key = "another-company";
    expect(
      supplierBalanceSummary(
        state,
        {
          ...supervisor,
          company_id: "another-company",
        },
        freshValley,
      ).snapshot_balance,
    ).toBe("0.00");
  });

  it("exports the same final balance and explicitly separates the demo snapshot", () => {
    const state = initialState();
    const summary = supplierBalanceSummary(
      state,
      supervisor,
      "Golden Grain Distributors",
    );
    const csv = supplierBalanceCsv(summary, "Golden Grain Distributors");
    expect(csv).toContain('"Demo balance","Golden Grain Distributors"');
    expect(csv).toContain('"Balance","","","","","","842.10"');
    expect(state.ledger).toEqual([]);
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
