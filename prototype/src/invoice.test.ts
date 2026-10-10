import { describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { initialState } from "./store";
import { pendingPrice } from "./catalog";
import {
  addManualLine,
  createInvoice,
  cumulativeAllocation,
  invoiceBlockers,
  lineShort,
  postInvoice,
  recalculateInvoice,
  receiveShort,
  shortTotals,
  type InvoiceStockMovement,
} from "./invoice";
import type { DemoState } from "./types";

function movements(state: DemoState): InvoiceStockMovement[] {
  return (
    (
      state as DemoState & { stock_movements?: InvoiceStockMovement[] }
    ).stock_movements?.filter((entry) =>
      entry.id.startsWith(`${state.invoice.id}:`),
    ) ?? []
  );
}

function invoiceLedger(state: DemoState) {
  return state.ledger.filter((entry) => entry.invoice_id === state.invoice.id);
}
const seedStock = initialState().stock;

function reviewed(): DemoState {
  const state = initialState();
  state.invoice = createInvoice(state, "Branch 1");
  state.invoice.file_name = "fictional-original.png";
  state.invoice.file_type = "image/png";
  state.invoice.file_data = "data:image/png;base64,ZGVtby1vbmx5";
  state.invoice.lines.forEach((line) => {
    line.review_confirmed = true;
    line.date_confirmed = true;
    if (line.date_tracking) {
      line.date_value = "2027-01-01";
      line.date_type = "expiry";
    }
    line.quantity_unit = "units";
    line.quantity_entered = String(line.qty_invoiced);
    line.case_cost_before_tax = undefined;
  });
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Fictional label was unreadable; Supervisor can follow up.",
  };
  return state;
}

describe("invoice review and posting", () => {
  it("saves a manual draft without an original, then requires attachment and explicit line review before posting", () => {
    const state = initialState();
    state.invoice = createInvoice(state, "Branch 1", true);
    expect(state.invoice.status).toBe("draft");
    expect(state.invoice.file_data).toBeUndefined();
    addManualLine(state, "0002");
    expect(state.invoice.subtotal).toBe("0.98");
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toEqual(
      expect.arrayContaining(["file", "review", "date"]),
    );
    expect(() => postInvoice(state, "floor_worker", "Branch 1")).toThrow();
    expect(invoiceLedger(state)).toHaveLength(0);
  });

  it("posts delivered stock and financial entries once, without inventing approvals for unchanged-price lines", () => {
    const state = reviewed();
    state.invoice.lines.find(
      (line) => line.product_code === "0009",
    )!.qty_received_at_posting = 8;
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toEqual([]);
    expect(postInvoice(state, "floor_worker", "Branch 1")).toBe(true);
    expect(state.stock["Branch 1:0009"]).toBe(seedStock["Branch 1:0009"] + 8);
    expect(state.stock["Branch 2:0009"]).toBe(seedStock["Branch 2:0009"]);
    expect(state.invoice.payable_after_open_shorts).toBe("169.79");
    expect(
      Decimal.sum(...invoiceLedger(state).map((entry) => entry.amount)).toFixed(
        2,
      ),
    ).toBe("169.79");
    expect(
      state.approvals.filter(
        (proposal) =>
          proposal.product_code === "0002" || proposal.product_code === "0005",
      ),
    ).toHaveLength(0);
    expect(
      state.approvals.filter((proposal) => proposal.product_code === "0006"),
    ).toHaveLength(1);
    expect(
      state.products.filter(
        (product) => product.name_en === "Dried Barberries 100 g",
      ),
    ).toHaveLength(1);
    expect(
      state.invoice.lines.find((line) => line.new_name_en)?.product_code,
    ).toBe("0015");
    expect(
      state.alerts.filter((alert) => alert.type === "lower_price"),
    ).toHaveLength(1);
    const saved = structuredClone(state);
    expect(postInvoice(state, "floor_worker", "Branch 1")).toBe(false);
    expect(state).toEqual(saved);
  });

  it("requires an explicit date answer on every line and a date for Yes", () => {
    const state = reviewed();
    const rice = state.invoice.lines[0];
    rice.pricing_category = "rice";
    rice.date_confirmed = false;
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toContain(
      "date",
    );
    rice.date_tracking = true;
    rice.date_confirmed = true;
    rice.date_value = undefined;
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toContain(
      "date",
    );
    rice.date_value = "2026-12-01";
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).not.toContain(
      "date",
    );
    rice.date_tracking = false;
    rice.date_value = undefined;
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).not.toContain(
      "date",
    );
  });

  it("creates proposals only on posting and refreshes cost, margin, invoice and poster together", () => {
    const state = reviewed();
    const lavash = state.invoice.lines.find(
      (line) => line.product_code === "0006",
    )!;
    lavash.unit_cost_before_tax = "1.60";
    const before = structuredClone(state.approvals);
    expect(
      before.every((item) => !item.invoice_ids?.includes(state.invoice.id)),
    ).toBe(true);
    expect(state.approvals).toEqual(before);
    postInvoice(state, "supervisor", "Branch 1", "Ali");
    const approval = state.approvals.find(
      (item) =>
        item.product_code === "0006" &&
        item.invoice_ids?.includes(state.invoice.id),
    )!;
    expect(approval).toMatchObject({
      unit_cost: "1.60",
      invoice_number: "FV-20417",
      triggered_by: "Ali",
      proposed_price: "2.99",
    });
    expect(new Decimal(approval.margin!).times(100).toFixed(2)).toBe("46.49");
    expect(approval.posted_at).toBeTruthy();
    expect(
      state.products.find((product) => product.code === "0006")!
        .price_provenance?.["Branch 1"],
    ).toMatchObject({ invoice_number: "FV-20417", calculated_price: "2.99" });
  });

  it("creates distinct invoice IDs on an HTTP address without crypto.randomUUID", () => {
    vi.stubGlobal("crypto", undefined);
    try {
      const state = initialState();
      const first = createInvoice(state, "Branch 1");
      const second = createInvoice(state, "Branch 1");
      expect(first.id).toMatch(/^invoice-/);
      expect(second.id).not.toBe(first.id);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps an unchanged-price minimum-margin review instead of silently changing the register price", () => {
    const state = reviewed();
    const line = state.invoice.lines.find(
      (item) => item.product_code === "0002",
    )!;
    line.unit_cost_before_tax = "1.12";
    recalculateInvoice(state.invoice, state.config);
    state.invoice.lines.forEach((item) => {
      item.review_confirmed = true;
      item.date_confirmed = true;
    });
    postInvoice(state, "floor_worker", "Branch 1");
    const approval = state.approvals.find(
      (item) => item.product_code === "0002",
    )!;
    expect(approval.type).toBe("margin_review");
    expect(approval.proposed_price).toBe("1.49");
    expect(approval.current_price).toBe("1.49");
    expect(
      state.products.find((product) => product.code === "0002")!.selling_price,
    ).toBe("1.49");
    expect(
      pendingPrice(
        state,
        state.products.find((product) => product.code === "0002")!,
        "Branch 1",
      ),
    ).toBeNull();
  });

  it("deduplicates identical margin contexts and keeps changed costs or rules as fresh reviews", () => {
    const state = reviewed();
    const postCost = (cost: string) => {
      state.invoice = reviewed().invoice;
      state.invoice.lines.find(
        (line) => line.product_code === "0002",
      )!.unit_cost_before_tax = cost;
      recalculateInvoice(state.invoice, state.config);
      state.invoice.lines.forEach((line) => {
        line.review_confirmed = true;
        line.date_confirmed = true;
      });
      postInvoice(state, "floor_worker", "Branch 1");
    };
    postCost("1.12");
    postCost("1.12");
    let reviews = state.approvals.filter(
      (item) => item.product_code === "0002" && item.type === "margin_review",
    );
    expect(reviews).toHaveLength(1);
    expect(reviews[0].invoice_ids).toHaveLength(2);
    postCost("1.1201");
    reviews = state.approvals.filter(
      (item) => item.product_code === "0002" && item.type === "margin_review",
    );
    expect(reviews).toHaveLength(2);
    state.config.pricing_categories.find(
      (category) => category.key === "grocery",
    )!.minimum_margin = "0.26";
    postCost("1.1201");
    expect(
      state.approvals.filter(
        (item) => item.product_code === "0002" && item.type === "margin_review",
      ),
    ).toHaveLength(3);
  });

  it("appends new invoice evidence to an acknowledged margin context without reopening it", () => {
    const state = reviewed();
    const receiveCost = () => {
      state.invoice = reviewed().invoice;
      state.invoice.lines.find(
        (line) => line.product_code === "0002",
      )!.unit_cost_before_tax = "1.12";
      recalculateInvoice(state.invoice, state.config);
      state.invoice.lines.forEach((line) => {
        line.review_confirmed = true;
        line.date_confirmed = true;
      });
      postInvoice(state, "floor_worker", "Branch 1");
    };
    receiveCost();
    const acknowledgment = state.approvals.find(
      (item) => item.product_code === "0002" && item.type === "margin_review",
    )!;
    acknowledgment.status = "approved";
    acknowledgment.acknowledgment_reason =
      "Supervisor checked the same received cost and kept the approved price.";
    const reviewId = acknowledgment.id;
    receiveCost();
    const reviews = state.approvals.filter(
      (item) => item.product_code === "0002" && item.type === "margin_review",
    );
    expect(reviews).toHaveLength(1);
    expect(reviews[0].id).toBe(reviewId);
    expect(reviews[0].status).toBe("approved");
    expect(reviews[0].acknowledgment_reason).toContain(
      "kept the approved price",
    );
    expect(reviews[0].invoice_ids).toHaveLength(2);
  });

  it("treats an approval in another branch as no approved price in the receiving branch", () => {
    const state = reviewed();
    const product = state.products.find((item) => item.code === "0015")!;
    product.status = "active";
    product.selling_price = "";
    product.branch_prices = { "Branch 2": "5.49" };
    postInvoice(state, "floor_worker", "Branch 1");
    expect(
      state.invoice.lines.find((line) => line.product_code === "0015")!
        .current_selling_price,
    ).toBeNull();
    expect(
      state.approvals.find(
        (item) => item.product_code === "0015" && item.branch === "Branch 1",
      )!.type,
    ).toBe("new_product");
    expect(product.branch_prices["Branch 2"]).toBe("5.49");
    expect(product.selling_price).toBe("");
  });

  it.each([
    ["cashier", "Branch 1", "permission"],
    ["floor_worker", "Branch 2", "branch"],
  ] as const)("blocks posting for %s in %s", (role, branch, reason) => {
    const state = reviewed();
    expect(invoiceBlockers(state, role, branch)).toContain(reason);
    expect(() => postInvoice(state, role, branch)).toThrow(reason);
    expect(invoiceLedger(state)).toHaveLength(0);
  });

  it("cannot post a foreign-company invoice or product line", () => {
    const state = reviewed();
    state.invoice.lines[0].company_id = "other-company";
    expect(() => postInvoice(state, "supervisor", "Branch 1")).toThrow(
      "company",
    );
    expect(invoiceLedger(state)).toHaveLength(0);
  });

  it("validates every calculation before any stock, product, or ledger posting", () => {
    const state = reviewed();
    state.config.pricing_categories.find(
      (category) => category.key === "grocery_taxable",
    )!.cost_divisor = "0";
    const before = structuredClone(state);
    expect(() => postInvoice(state, "floor_worker", "Branch 1")).toThrow(
      "cost",
    );
    expect(state).toEqual(before);
  });

  it("requires a note for unknown lower-price information and confirms a proposed supplier before posting", () => {
    const state = reviewed();
    state.invoice.lower_price_answers = { same_expiry: "unknown", note: "" };
    state.invoice.supplier_confirmed = false;
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toEqual(
      expect.arrayContaining(["lower_price", "supplier_pending"]),
    );
    state.invoice.lower_price_answers = { same_expiry: "no_previous_stock" };
    state.invoice.supplier_confirmed = true;
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toEqual([]);
  });

  it("does not invent a same-supplier receipt history for a different branch", () => {
    const state = reviewed();
    state.invoice.branch = "Branch 2";
    state.invoice.lower_price_answers = undefined;
    expect(invoiceBlockers(state, "supervisor", "Branch 2")).not.toContain(
      "lower_price",
    );
  });

  it("uses the latest posted supplier receipt in the same branch, while drafts do not change the comparison", () => {
    const state = reviewed();
    postInvoice(state, "floor_worker", "Branch 1");
    state.invoice = createInvoice(state, "Branch 1");
    const juice = state.invoice.lines.find(
      (line) => line.product_code === "0003",
    )!;
    juice.unit_cost_before_tax = "1.90";
    state.invoice.lower_price_answers = undefined;
    // 1.90 exceeds the actual previous receipt of 1.80, although it is below the original seed cost of 1.95.
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).not.toContain(
      "lower_price",
    );
    juice.unit_cost_before_tax = "1.70";
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toContain(
      "lower_price",
    );
    const unrelatedDraft = createInvoice(state, "Branch 1");
    unrelatedDraft.lines.find(
      (line) => line.product_code === "0003",
    )!.unit_cost_before_tax = "1.60";
    state.invoices!.push(unrelatedDraft);
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toContain(
      "lower_price",
    );
  });

  it("creates an alert instead of blocking a discrepancy in invoice totals", () => {
    const state = reviewed();
    state.invoice.final_total = "178.00";
    expect(postInvoice(state, "floor_worker", "Branch 1")).toBe(true);
    expect(
      state.alerts.filter((alert) => alert.type === "tax_discrepancy"),
    ).toHaveLength(1);
  });
});

describe("short delivery cumulative allocations", () => {
  it("deducts exactly 7.23, receives 8 now, then restores 3.62 and 3.61 while adding only two new units each time", () => {
    const state = reviewed();
    const chips = state.invoice.lines.find(
      (line) => line.product_code === "0009",
    )!;
    chips.qty_received_at_posting = 8;
    expect(lineShort(chips)).toEqual({
      quantity: 4,
      beforeTax: "6.40",
      tax: "0.83",
      total: "7.23",
    });
    postInvoice(state, "floor_worker", "Branch 1");
    const originalMovements = structuredClone(movements(state));
    expect(originalMovements).toHaveLength(6);
    expect(
      originalMovements.find((entry) => entry.product_code === "0009"),
    ).toMatchObject({
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      qty: 8,
      type: "received",
      by: "Demo Floor Worker",
    });
    expect(
      receiveShort(
        state,
        "0009",
        2,
        "FICTITIOUS-DELIVERY-1",
        "floor_worker",
        "Branch 1",
      ),
    ).toBe("3.62");
    expect(state.stock["Branch 1:0009"]).toBe(seedStock["Branch 1:0009"] + 10);
    expect(state.invoice.payable_after_open_shorts).toBe("173.41");
    expect(
      receiveShort(
        state,
        "0009",
        2,
        "FICTITIOUS-DELIVERY-2",
        "floor_worker",
        "Branch 1",
      ),
    ).toBe("3.61");
    expect(state.stock["Branch 1:0009"]).toBe(seedStock["Branch 1:0009"] + 12);
    expect(movements(state).slice(0, 6)).toEqual(originalMovements);
    expect(
      movements(state)
        .filter((entry) => entry.type === "short_resolved_received")
        .map((entry) => entry.qty),
    ).toEqual([2, 2]);
    expect(
      movements(state)
        .filter((entry) => entry.product_code === "0009")
        .reduce((sum, entry) => sum + entry.qty, 0),
    ).toBe(12);
    expect(state.invoice.payable_after_open_shorts).toBe("177.02");
    expect(shortTotals(state.invoice).total).toBe("0.00");
    expect(
      Decimal.sum(
        ...state.ledger
          .filter((entry) => entry.type === "short_restoration")
          .map((entry) => entry.amount),
      ).toFixed(2),
    ).toBe("7.23");
    expect(
      Decimal.sum(...invoiceLedger(state).map((entry) => entry.amount)).toFixed(
        2,
      ),
    ).toBe("177.02");
  });

  it("conserves the original tax across every valid partition, not just the two demo deliveries", () => {
    for (const partition of [[1, 1, 1, 1], [3, 1], [1, 3], [4], [2, 2]]) {
      let delivered = 0;
      let totalTax = new Decimal(0);
      for (const quantity of partition) {
        const delta = new Decimal(
          cumulativeAllocation("0.83", delivered + quantity, 4),
        ).minus(cumulativeAllocation("0.83", delivered, 4));
        delivered += quantity;
        totalTax = totalTax.plus(delta);
      }
      expect(totalTax.toFixed(2)).toBe("0.83");
    }
  });

  it("rejects overdelivery and makes retrying the same receipt harmless", () => {
    const state = reviewed();
    state.invoice.lines.find(
      (line) => line.product_code === "0009",
    )!.qty_received_at_posting = 8;
    postInvoice(state, "floor_worker", "Branch 1");
    expect(() =>
      receiveShort(state, "0009", 5, "TOO-MANY", "floor_worker", "Branch 1"),
    ).toThrow("remaining");
    expect(state.stock["Branch 1:0009"]).toBe(seedStock["Branch 1:0009"] + 8);
    receiveShort(state, "0009", 2, "SAME-RECEIPT", "floor_worker", "Branch 1");
    const saved = structuredClone(state);
    expect(
      receiveShort(
        state,
        "0009",
        2,
        "SAME-RECEIPT",
        "floor_worker",
        "Branch 1",
      ),
    ).toBe("0.00");
    expect(state).toEqual(saved);
    expect(() =>
      receiveShort(state, "0009", 1, "CROSS-BRANCH", "supervisor", "Branch 2"),
    ).toThrow("permitted");
  });

  it("normalizes delivery references before recording and deduplicating whitespace retries", () => {
    const state = reviewed();
    state.invoice.lines.find(
      (line) => line.product_code === "0009",
    )!.qty_received_at_posting = 8;
    postInvoice(state, "floor_worker", "Branch 1");
    expect(
      receiveShort(state, "0009", 2, "  DEMO-X  ", "floor_worker", "Branch 1"),
    ).toBe("3.62");
    expect(state.invoice.short_receipt_keys).toEqual(["DEMO-X"]);
    expect(
      state.ledger.find((entry) => entry.type === "short_restoration")!
        .reference,
    ).toBe("DEMO-X");
    expect(
      movements(state).find(
        (entry) => entry.type === "short_resolved_received",
      )!.reference,
    ).toBe("DEMO-X");
    const saved = structuredClone(state);
    expect(
      receiveShort(state, "0009", 2, "DEMO-X", "floor_worker", "Branch 1"),
    ).toBe("0.00");
    expect(
      receiveShort(
        state,
        "0009",
        2,
        " \tDEMO-X\n ",
        "floor_worker",
        "Branch 1",
      ),
    ).toBe("0.00");
    expect(state).toEqual(saved);
    expect(state.stock["Branch 1:0009"]).toBe(seedStock["Branch 1:0009"] + 10);
    expect(state.invoice.payable_after_open_shorts).toBe("173.41");
  });
});
