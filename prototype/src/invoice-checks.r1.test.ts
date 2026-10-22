import { describe, expect, it } from "vitest";
import { resolveApproval } from "./approvals";
import { initialState } from "./store";
import { authenticatedTestActor } from "./authority-test-fixture";
import { invoiceWorkspaceRead } from "./invoice-workspace-read";
import {
  createInvoice,
  invoiceBlockers,
  postInvoice,
  recalculateInvoice,
} from "./invoice";
import {
  acknowledgeInvoiceCheck,
  confirmInvoiceLineChecks,
  invoiceCheckCount,
  invoiceCheckField,
  invoiceTotalsCheck,
  setInvoiceLineCategory,
} from "./invoice-checks";

function reviewed() {
  const state = initialState();
  const actor = authenticatedTestActor(state, "manager");
  state.invoice = createInvoice(state, actor, "Branch 1");
  state.invoice.file_name = "fictional.png";
  state.invoice.file_type = "image/png";
  state.invoice.file_data = "data:image/png;base64,ZmljdGlvbmFs";
  state.invoice.lines = [state.invoice.lines[0]];
  const line = state.invoice.lines[0];
  Object.assign(line, {
    quantity_unit: "units",
    quantity_entered: "2",
    qty_invoiced: 2,
    qty_received_at_posting: 2,
    unit_cost_before_tax: "1.0000",
    case_cost_before_tax: undefined,
    low_confidence_fields: [],
    tax_profile: "non_taxable",
    taxable: false,
    date_tracking: false,
    date_confirmed: true,
  });
  recalculateInvoice(state.invoice, state.config);
  line.review_confirmed = true;
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Fictional review",
  };
  return { state, actor, line };
}

describe("R1 human review and invoice charges", () => {
  it("keeps a valid imported cost distinct from the required new-product category", () => {
    const { state, actor, line } = reviewed();
    Object.assign(line, {
      product_code: "NEW",
      pricing_category: "",
      new_name_en: "Fictional new product",
      unit_cost_before_tax: "2.0000",
    });
    let detail = invoiceWorkspaceRead(state, actor).lineDetails[0];
    expect(detail.costValid).toBe(true);
    expect(detail.price).toBeNull();
    // The existing pricing guard still blocks posting; the workspace presents
    // the missing category separately from the valid printed cost.
    expect(invoiceBlockers(state, actor)).toEqual(["cost"]);
    line.unit_cost_before_tax = "unreadable";
    detail = invoiceWorkspaceRead(state, actor).lineDetails[0];
    expect(detail.costValid).toBe(false);
    expect(detail.price).toBeNull();
  });
  it("maps check fields to the existing editable values and counts headers, items and charges", () => {
    expect(invoiceCheckField("supplier_name")).toBe("supplier");
    expect(invoiceCheckField("supplier_sku")).toBe("supplier_item_code");
    expect(invoiceCheckField("quantity")).toBe("quantity_entered");
    expect(invoiceCheckField("unit")).toBe("quantity_unit");
    expect(
      invoiceCheckCount({
        low_confidence_fields: ["supplier"],
        lines: [{ low_confidence_fields: ["description", "quantity_entered"] }],
        other_charges: [{ low_confidence_fields: ["taxable"] }],
      }),
    ).toBe(4);
  });

  it("Looks right clears only that field and posting remains blocked until the human checks all fields", () => {
    const { state, actor, line } = reviewed();
    state.invoice.low_confidence_fields = ["supplier_invoice_number"];
    line.low_confidence_fields = ["unit_cost_before_tax", "description"];
    expect(invoiceBlockers(state, actor)).toContain("checks");
    expect(() => postInvoice(state, actor)).toThrow(/checks/);
    acknowledgeInvoiceCheck(state, actor, "supplier_invoice_number");
    acknowledgeInvoiceCheck(state, actor, "description", 0);
    expect(line.low_confidence_fields).toEqual(["unit_cost_before_tax"]);
    expect(() => confirmInvoiceLineChecks(state, actor, 0)).toThrow(
      "Confirm all of them?",
    );
    confirmInvoiceLineChecks(state, actor, 0, true);
    expect(invoiceCheckCount(state.invoice)).toBe(0);
    expect(line.review_confirmed).toBe(true);
    expect(invoiceBlockers(state, actor)).not.toContain("checks");
  });

  it("keeps review acknowledgements behind the canonical actor and invoice permissions", () => {
    const { state, line } = reviewed();
    line.low_confidence_fields = ["description"];
    const cashier = authenticatedTestActor(state, "cashier", {
      locations: ["Branch 1"],
    });
    expect(() =>
      acknowledgeInvoiceCheck(state, cashier, "description", 0),
    ).toThrow();
    expect(line.low_confidence_fields).toEqual(["description"]);
  });

  it("reconciles signed deposits, fees, discounts and credits exactly using Decimal", () => {
    expect(
      invoiceTotalsCheck({
        lines: [{ line_total: "1.15" }, { line_total: "2.05" }],
        other_charges: [
          { amount: "2.50" },
          { amount: "1.25" },
          { amount: "-0.10" },
          { amount: "-0.35" },
        ],
        subtotal: "6.50",
        tax: "0.85",
        final_total: "7.35",
      }),
    ).toEqual({});
    expect(
      invoiceTotalsCheck({
        lines: [{ line_total: "2.00" }],
        other_charges: [{ amount: "-0.50" }],
        subtotal: "1.60",
        tax: "0.10",
        final_total: "1.75",
      }),
    ).toEqual({ subtotalDifference: "0.10", totalDifference: "0.05" });
    expect(
      invoiceTotalsCheck({
        lines: [{ line_total: "" }],
        subtotal: "",
        tax: "",
        final_total: "",
      }),
    ).toEqual({});
  });

  it("includes every charge type in the normal subtotal and payable without creating a product or receipt", () => {
    const { state, actor, line } = reviewed();
    state.invoice.other_charges = [
      {
        line_type: "deposit",
        description: "Fictional deposit",
        amount: "4.00",
        taxable: false,
      },
      {
        line_type: "fee",
        description: "Fictional fee",
        amount: "3.00",
        taxable: false,
      },
      {
        line_type: "discount",
        description: "Fictional discount",
        amount: "-1.00",
        taxable: false,
      },
      {
        line_type: "credit",
        description: "Fictional credit",
        amount: "-2.00",
        taxable: false,
      },
    ];
    recalculateInvoice(state.invoice, state.config);
    line.review_confirmed = true;
    expect(state.invoice.subtotal).toBe("6.00");
    expect(state.invoice.final_total).toBe("6.00");
    expect(state.invoice.payable_after_open_shorts).toBe("6.00");
    expect(invoiceTotalsCheck(state.invoice)).toEqual({});
    const products = state.products.length;
    expect(invoiceBlockers(state, actor)).toEqual([]);
    expect(postInvoice(state, actor)).toBe(true);
    expect(state.products).toHaveLength(products);
    expect(
      state.ledger.find((entry) => entry.id === `${state.invoice.id}:posted`)
        ?.amount,
    ).toBe("6.00");
    expect(
      state.stock_movements?.filter(
        (entry) => entry.invoice_id === state.invoice.id,
      ),
    ).toHaveLength(1);
  });

  it("keeps null tax highlighted while it follows the chosen category until a person acknowledges it", () => {
    const { state, actor, line } = reviewed();
    line.taxable_inferred = true;
    line.low_confidence_fields = ["taxable"];
    setInvoiceLineCategory(line, "grocery_taxable", state.config);
    expect(line.taxable).toBe(true);
    expect(line.low_confidence_fields).toEqual(["taxable"]);
    acknowledgeInvoiceCheck(state, actor, "taxable", 0);
    setInvoiceLineCategory(line, "grocery", state.config);
    expect(line.taxable).toBe(true);
    expect(line.low_confidence_fields).toEqual([]);
  });
  it("retains a new product barcode but rechecks the normal collision rule at posting and approval", () => {
    const { state, actor, line } = reviewed();
    line.product_code = "NEW";
    line.new_name_en = "Fictional R1 barcode product";
    line.new_name_fa = "";
    line.barcode = state.products[1].barcode;
    expect(invoiceBlockers(state, actor)).toContain("barcode");
    line.barcode = "fictional-r1-unique-barcode";
    expect(postInvoice(state, actor)).toBe(true);
    const pending = state.products.find(
      (product) => product.name_en === line.new_name_en,
    )!;
    expect(pending.barcode).toBe("fictional-r1-unique-barcode");
    expect(pending.status).toBe("pending_approval");
    const approval = state.approvals.find(
      (item) =>
        item.product_code === pending.code &&
        item.type === "new_product" &&
        item.status === "pending",
    )!;
    state.products[1].barcode = pending.barcode;
    expect(() =>
      resolveApproval(state, actor, approval.id, "approve", "all", "Branch 1"),
    ).toThrow(/barcode/);
    expect(approval.status).toBe("pending");
    expect(pending.status).toBe("pending_approval");
  });

  it("retains imported printed totals during line recalculation so differences remain reviewable", () => {
    const { state } = reviewed();
    state.invoice.reading_record = {
      source: "imported",
      file_name: "fictional.json",
      page_sha256s: [],
      models: [],
      reading_cost_usd: "0.00",
      exported_at: "2026-10-21",
      ai_source: "Fictional model",
    };
    state.invoice.subtotal = "2.05";
    state.invoice.tax = "0.00";
    state.invoice.final_total = "2.10";
    recalculateInvoice(state.invoice, state.config);
    expect(state.invoice.subtotal).toBe("2.05");
    expect(state.invoice.final_total).toBe("2.10");
    expect(invoiceTotalsCheck(state.invoice)).toEqual({
      subtotalDifference: "0.05",
      totalDifference: "0.05",
    });
  });
});
