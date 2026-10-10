import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  addManualLine,
  companyDate,
  createInvoice,
  invoiceBlockers,
  postInvoice,
  recalculateInvoice,
  receiveShort,
} from "./invoice";
import {
  effectiveApprovalLocation,
  effectiveInvoiceLocation,
  effectiveExpiryLocation,
  invoiceLocationMovePreview,
  lastReceivedByLocation,
  movePostedInvoice,
  receivedLog,
  projectExpiryLocation,
  projectInvoiceLocation,
  setInvoiceLocation,
  suggestedInvoiceLocation,
} from "./received";
import {
  ledgerSummary,
  postPayment,
  type OperationalLedger,
  type OperationsContext,
} from "./operations";
import { supplierPage } from "./suppliers";
import { supplierBalanceSummary } from "./supplier-balances";
import { manualPrice, setManualPriceMarker } from "./manual-prices";
import type { DemoState } from "./types";

function context(state: DemoState, branch = "Branch 1"): OperationsContext {
  return {
    company_id: state.config.company.seed_key,
    role: "supervisor",
    branch,
    actor: "Ali",
  };
}

function reviewed(): DemoState {
  const state = initialState();
  state.invoice = createInvoice(state, "Branch 1", true);
  state.invoice.supplier = "Fresh Valley Foods";
  state.invoice.supplier_confirmed = true;
  state.invoice.supplier_invoice_number = "FICTIONAL-C-100";
  state.invoice.file_name = "fictional-c.png";
  state.invoice.file_data = "data:image/png;base64,ZGVtbw==";
  state.invoice.file_type = "image/png";
  addManualLine(state, "0002");
  const line = state.invoice.lines[0];
  line.unit_cost_before_tax = "1.4000";
  line.qty_invoiced = 36;
  line.qty_received_at_posting = 36;
  line.units_per_case = 12;
  recalculateInvoice(state.invoice, state.config);
  line.review_confirmed = true;
  line.date_confirmed = true;
  if (line.date_tracking) {
    line.date_value = "2027-01-01";
    line.date_type = "expiry";
  }
  return state;
}

function posted(): DemoState {
  const state = reviewed();
  postInvoice(state, "supervisor", "Branch 1", "Ali");
  return state;
}

function outstanding(state: DemoState, branch: string): string {
  return (
    ledgerSummary(
      state,
      context(state, branch),
      state.invoice.supplier,
    ).invoices.find(
      (invoice) =>
        invoice.invoice_id === state.invoice.id && invoice.branch === branch,
    )?.amount ?? "0.00"
  );
}

describe("Received and receiving locations", () => {
  it("lists only actual posted deliveries, converts retained cases, deduplicates workspace and combines filters", () => {
    const state = reviewed();
    const all = context(state, "all");
    expect(receivedLog(state, all, { search: "FICTIONAL-C-100" })).toEqual([]);
    postInvoice(state, "supervisor", "Branch 1");
    const rows = receivedLog(state, all, {
      search: "FICTIONAL-C-100",
      product: "0002",
      supplier: "Fresh Valley Foods",
      location: "Branch 1",
      from: companyDate(state.config),
      to: companyDate(state.config),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      invoice_id: state.invoice.id,
      units: 36,
      units_per_case: 12,
      cases: "3",
      branch: "Branch 1",
    });
    expect(
      receivedLog(state, all, {
        search: "FICTIONAL-C-100",
        location: "Warehouse",
      }),
    ).toEqual([]);
    expect(
      lastReceivedByLocation(state, all, "0002").find(
        (row) => row.branch === "Branch 1",
      )?.invoice_id,
    ).toBe(state.invoice.id);
  });

  it("keeps worker, Cashier and foreign-company receipts scoped, including direct query filters", () => {
    const state = posted();
    const all = context(state, "all");
    const foreign = structuredClone(state.invoice);
    foreign.id = "foreign";
    foreign.company_id = "other-company";
    foreign.lines.forEach((line) => {
      line.company_id = "other-company";
    });
    state.invoices!.push(foreign);
    expect(
      receivedLog(state, all).some((row) => row.invoice_id === "foreign"),
    ).toBe(false);
    expect(receivedLog(state, { ...all, company_id: "other-company" })).toEqual(
      [],
    );
    expect(receivedLog(state, { ...all, role: "cashier" })).toEqual([]);
    expect(receivedLog(state, { ...all, role: "floor_worker" })).toEqual([]);
    expect(
      receivedLog(
        state,
        { ...all, role: "floor_worker", branch: "Branch 2" },
        { search: "FICTIONAL-C-100", location: "Branch 1" },
      ),
    ).toEqual([]);
  });

  it("suggests Ship to without silently changing location and lets the owning worker retarget the draft to Warehouse", () => {
    const state = reviewed();
    state.invoice.ship_to = "Ship to: North York";
    expect(suggestedInvoiceLocation(state, state.invoice)).toBe("Branch 1");
    state.invoice.ship_to = "Ship to: Warehouse";
    expect(suggestedInvoiceLocation(state, state.invoice)).toBe("Warehouse");
    expect(state.invoice.branch).toBe("Branch 1");
    setInvoiceLocation(state, "floor_worker", "Branch 1", "Warehouse");
    expect(state.invoice.handling_branch).toBe("Branch 1");
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).not.toContain(
      "branch",
    );
    expect(invoiceBlockers(state, "floor_worker", "Branch 2")).toContain(
      "branch",
    );
    expect(() =>
      setInvoiceLocation(state, "floor_worker", "Branch 2", "Branch 3"),
    ).toThrow();
    expect(() =>
      setInvoiceLocation(state, "cashier", "Branch 1", "Branch 3"),
    ).toThrow();
    expect(() =>
      setInvoiceLocation(state, "supervisor", "all", "outside-company"),
    ).toThrow();
    state.invoice.lines.forEach((line) => {
      line.review_confirmed = true;
    });
    postInvoice(state, "floor_worker", "Branch 1");
    expect(
      receivedLog(state, context(state, "Warehouse"), {
        search: "FICTIONAL-C-100",
      }),
    ).toHaveLength(1);
    expect(
      receivedLog(
        state,
        { ...context(state), role: "floor_worker" },
        { search: "FICTIONAL-C-100" },
      ),
    ).toEqual([]);
  });

  it("records each later short delivery once and preserves initial receipt quantity/date", () => {
    const state = reviewed();
    state.invoice.lines[0].qty_received_at_posting = 24;
    postInvoice(state, "supervisor", "Branch 1");
    receiveShort(state, "0002", 12, "C-LATER-1", "supervisor", "Branch 1");
    receiveShort(state, "0002", 12, "C-LATER-1", "supervisor", "Branch 1");
    const rows = receivedLog(state, context(state, "all"), {
      search: "FICTIONAL-C-100",
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.units).sort((a, b) => a - b)).toEqual([
      12, 24,
    ]);
    expect(rows.filter((row) => row.kind === "short_delivery")).toHaveLength(1);
    expect(Decimal.sum(...rows.map((row) => row.units)).toString()).toBe("36");
  });
});

describe("append-only posted invoice relocation", () => {
  it("projects date tracking with its source invoice and leaves recorded dates and header intact", () => {
    const state = reviewed();
    state.invoice.lines[0].date_tracking = true;
    state.invoice.lines[0].date_value = "2027-01-01";
    postInvoice(state, "supervisor", "Branch 1");
    const date = state.expiry.find(
      (entry) => entry.invoice_id === state.invoice.id,
    )!;
    const original = structuredClone(date);
    const preview = invoiceLocationMovePreview(
      state,
      context(state),
      state.invoice.id,
      "Warehouse",
    );
    movePostedInvoice(
      state,
      context(state),
      state.invoice.id,
      "Warehouse",
      "Move delivery",
      preview.snapshot,
    );
    expect(effectiveExpiryLocation(state, date)).toBe("Warehouse");
    expect(projectExpiryLocation(state, date).branch).toBe("Warehouse");
    expect(date).toEqual(original);
    expect(
      effectiveInvoiceLocation(
        state,
        projectInvoiceLocation(state, state.invoice),
      ),
    ).toBe("Warehouse");
    expect(
      effectiveExpiryLocation(state, { ...date, company_id: "other-company" }),
    ).toBe("Branch 1");
    expect(
      effectiveExpiryLocation(state, { ...date, invoice_id: undefined }),
    ).toBe("Branch 1");
  });

  it("moves receipts, supplier outstanding and latest approvals while retaining original documents and allocations", () => {
    const state = posted();
    postPayment(state, context(state), {
      supplier: state.invoice.supplier,
      amount: "20.00",
      date: companyDate(state.config),
      cheque: "C-TEST",
      receipt: "C-PAYMENT",
      allocations: [{ invoice_id: state.invoice.id, amount: "20.00" }],
    });
    const originalInvoice = structuredClone(state.invoice);
    const originalRows = structuredClone(state.ledger);
    const originalMovements = structuredClone(state.stock_movements);
    const originalApprovals = structuredClone(state.approvals);
    const before = supplierBalanceSummary(
      state,
      context(state, "all"),
      state.invoice.supplier,
    ).balance;
    const preview = invoiceLocationMovePreview(
      state,
      context(state, "all"),
      state.invoice.id,
      "Warehouse",
    );
    expect(preview.outstanding_amount).toBe("30.40");
    expect(preview.allocations).toHaveLength(1);
    const correction = movePostedInvoice(
      state,
      context(state, "all"),
      state.invoice.id,
      "Warehouse",
      "Correct the receiving location",
      preview.snapshot,
    );
    expect(state.invoice).toEqual(originalInvoice);
    expect(
      state.invoices!.find((invoice) => invoice.id === state.invoice.id),
    ).toEqual(originalInvoice);
    expect(state.ledger.slice(0, originalRows.length)).toEqual(originalRows);
    expect(state.stock_movements!.slice(0, originalMovements!.length)).toEqual(
      originalMovements,
    );
    expect(state.approvals).toEqual(originalApprovals);
    expect(effectiveInvoiceLocation(state, state.invoice)).toBe("Warehouse");
    expect(outstanding(state, "Branch 1")).toBe("0.00");
    expect(outstanding(state, "Warehouse")).toBe("30.40");
    expect(
      supplierBalanceSummary(
        state,
        context(state, "all"),
        state.invoice.supplier,
      ).balance,
    ).toBe(before);
    expect(
      receivedLog(state, context(state, "all"), { search: "FICTIONAL-C-100" }),
    ).toHaveLength(1);
    expect(
      receivedLog(state, context(state, "Warehouse"), {
        search: "FICTIONAL-C-100",
      })[0].units,
    ).toBe(36);
    const proposal = state.approvals.find(
      (approval) => approval.source_invoice_id === state.invoice.id,
    )!;
    expect(effectiveApprovalLocation(state, proposal)).toBe("Warehouse");
    expect(
      supplierPage(
        state,
        context(state, "Warehouse"),
        state.invoice.supplier,
      ).invoices.find((invoice) => invoice.id === state.invoice.id)?.financial
        ?.outstanding,
    ).toBe("30.40");
    expect(
      state.activity.find((entry) => entry.id === `${correction.id}:history`)
        ?.reversible,
    ).toBe(false);
    expect(
      (state.ledger as OperationalLedger[]).find(
        (row) => row.reference === "C-PAYMENT",
      )?.allocations,
    ).toEqual([{ invoice_id: state.invoice.id, amount: "20.00" }]);
  });

  it("conserves balances through multiple moves and later short receipts at the effective destination", () => {
    const state = reviewed();
    state.invoice.lines[0].qty_received_at_posting = 24;
    postInvoice(state, "supervisor", "Branch 1");
    const companyBefore = supplierBalanceSummary(
      state,
      context(state, "all"),
      state.invoice.supplier,
    ).balance;
    for (const target of ["Warehouse", "Branch 2", "Branch 1"]) {
      const preview = invoiceLocationMovePreview(
        state,
        context(state, "all"),
        state.invoice.id,
        target,
      );
      movePostedInvoice(
        state,
        context(state, "all"),
        state.invoice.id,
        target,
        "Location correction",
        preview.snapshot,
      );
      expect(effectiveInvoiceLocation(state, state.invoice)).toBe(target);
      expect(outstanding(state, target)).toBe("33.60");
      expect(
        supplierBalanceSummary(
          state,
          context(state, "all"),
          state.invoice.supplier,
        ).balance,
      ).toBe(companyBefore);
    }
    const preview = invoiceLocationMovePreview(
      state,
      context(state, "all"),
      state.invoice.id,
      "Warehouse",
    );
    movePostedInvoice(
      state,
      context(state, "all"),
      state.invoice.id,
      "Warehouse",
      "Warehouse receipt",
      preview.snapshot,
    );
    expect(() =>
      receiveShort(state, "0002", 12, "WRONG", "floor_worker", "Branch 1"),
    ).toThrow();
    receiveShort(state, "0002", 12, "C-LATE-MOVED", "supervisor", "Warehouse");
    expect(outstanding(state, "Warehouse")).toBe("50.40");
    expect(
      receivedLog(state, context(state, "Warehouse"), {
        search: "FICTIONAL-C-100",
      }).reduce((sum, row) => sum + row.units, 0),
    ).toBe(36);
    expect(
      receivedLog(state, context(state), { search: "FICTIONAL-C-100" }),
    ).toEqual([]);
  });

  it("moves a fully paid receipt without replaying payment or adding liability", () => {
    const state = posted();
    postPayment(state, context(state), {
      supplier: state.invoice.supplier,
      amount: "50.40",
      date: companyDate(state.config),
      cheque: "",
      receipt: "C-PAID",
      allocations: [{ invoice_id: state.invoice.id, amount: "50.40" }],
    });
    const preview = invoiceLocationMovePreview(
      state,
      context(state, "all"),
      state.invoice.id,
      "Warehouse",
    );
    expect(preview.outstanding_amount).toBe("0.00");
    movePostedInvoice(
      state,
      context(state, "all"),
      state.invoice.id,
      "Warehouse",
      "Correct a paid receipt",
      preview.snapshot,
    );
    expect(outstanding(state, "Warehouse")).toBe("0.00");
    expect(
      state.ledger.filter((row) => row.reference === "C-PAID"),
    ).toHaveLength(1);
    expect(
      receivedLog(state, context(state, "Warehouse"), {
        search: "FICTIONAL-C-100",
      }),
    ).toHaveLength(1);
  });

  it("rejects unauthorized, stale, repeated, inactive and missing-reason moves atomically", () => {
    const state = posted();
    const preview = invoiceLocationMovePreview(
      state,
      context(state, "all"),
      state.invoice.id,
      "Warehouse",
    );
    const unchanged = structuredClone(state);
    for (const role of ["cashier", "floor_worker"] as const)
      expect(() =>
        movePostedInvoice(
          state,
          { ...context(state), role },
          state.invoice.id,
          "Warehouse",
          "Correction",
          preview.snapshot,
        ),
      ).toThrow();
    expect(() =>
      movePostedInvoice(
        state,
        context(state),
        state.invoice.id,
        "Warehouse",
        "",
        preview.snapshot,
      ),
    ).toThrow("reason");
    expect(() =>
      invoiceLocationMovePreview(
        state,
        { ...context(state), company_id: "other-company" },
        state.invoice.id,
        "Warehouse",
      ),
    ).toThrow();
    expect(() =>
      invoiceLocationMovePreview(
        state,
        context(state),
        state.invoice.id,
        "Branch 1",
      ),
    ).toThrow();
    expect(state).toEqual(unchanged);
    postPayment(state, context(state), {
      supplier: state.invoice.supplier,
      amount: "1.00",
      date: companyDate(state.config),
      cheque: "",
      receipt: "C-STALE",
      allocations: [{ invoice_id: state.invoice.id, amount: "1.00" }],
    });
    const beforeStale = structuredClone(state);
    expect(() =>
      movePostedInvoice(
        state,
        context(state),
        state.invoice.id,
        "Warehouse",
        "Correction",
        preview.snapshot,
      ),
    ).toThrow("changed");
    expect(state).toEqual(beforeStale);
    const fresh = invoiceLocationMovePreview(
      state,
      context(state),
      state.invoice.id,
      "Warehouse",
    );
    movePostedInvoice(
      state,
      context(state),
      state.invoice.id,
      "Warehouse",
      "Correction",
      fresh.snapshot,
    );
    const after = structuredClone(state);
    expect(() =>
      movePostedInvoice(
        state,
        context(state),
        state.invoice.id,
        "Warehouse",
        "Correction",
        fresh.snapshot,
      ),
    ).toThrow();
    expect(state).toEqual(after);
    state.config.branches.find(
      (location) => location.id === "Branch 2",
    )!.active = false;
    expect(() =>
      invoiceLocationMovePreview(
        state,
        context(state),
        state.invoice.id,
        "Branch 2",
      ),
    ).toThrow();
  });
});

describe("manual-priced invoice decisions", () => {
  function manualReceipt(cost = "1.4000", selling = "2.79") {
    const state = reviewed();
    const product = state.products.find((item) => item.code === "0002")!;
    product.selling_price = selling;
    product.branch_prices = {};
    setManualPriceMarker(state, product, "all", selling, "Ali");
    state.invoice.lines[0].unit_cost_before_tax = cost;
    recalculateInvoice(state.invoice, state.config);
    state.invoice.lines[0].review_confirmed = true;
    return { state, product };
  }
  it("requires Keep or Use before posting; Keep preserves manual provenance and updates regular cost", () => {
    const { state, product } = manualReceipt();
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toContain(
      "manual_price",
    );
    const before = structuredClone(state);
    expect(() => postInvoice(state, "supervisor", "Branch 1")).toThrow(
      "manual_price",
    );
    expect(state).toEqual(before);
    state.invoice.lines[0].manual_price_decision = "keep";
    postInvoice(state, "supervisor", "Branch 1");
    expect(product.selling_price).toBe("2.79");
    expect(product.last_cost_before_tax).toBe("1.4000");
    expect(manualPrice(state, product, "Branch 1")?.price).toBe("2.79");
    expect(
      state.approvals.filter(
        (approval) => approval.source_invoice_id === state.invoice.id,
      ),
    ).toEqual([]);
    expect(state.invoice.lines[0].calculated_selling_price).toBe("1.99");
  });
  it("Use creates a rule-price proposal even if the new rule equals the current manual price", () => {
    const { state, product } = manualReceipt("1.5500", "2.99");
    state.invoice.lines[0].manual_price_decision = "rule";
    postInvoice(state, "supervisor", "Branch 1");
    const approval = state.approvals.find(
      (entry) => entry.source_invoice_id === state.invoice.id,
    )!;
    expect(approval).toMatchObject({
      type: "price_change",
      proposed_price: "2.99",
      clear_manual_price: true,
      status: "pending",
    });
    expect(manualPrice(state, product, "Branch 1")?.price).toBe("2.99");
    expect(product.selling_price).toBe("2.99");
  });
  it("Keep evaluates below-margin review against actual manual price without changing it", () => {
    const { state, product } = manualReceipt("1.4000", "1.50");
    state.invoice.lines[0].manual_price_decision = "keep";
    postInvoice(state, "supervisor", "Branch 1");
    const approval = state.approvals.find(
      (entry) => entry.source_invoice_id === state.invoice.id,
    )!;
    expect(approval).toMatchObject({
      type: "margin_review",
      proposed_price: "1.50",
      current_price: "1.50",
      clear_manual_price: false,
    });
    expect(new Decimal(approval.margin!).times(100).toFixed(2)).toBe("6.67");
    expect(manualPrice(state, product, "Branch 1")?.price).toBe("1.50");
  });
});
