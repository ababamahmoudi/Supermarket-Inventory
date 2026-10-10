import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  addManualLine,
  createInvoice,
  postInvoice,
  recalculateInvoice,
  setInvoiceLineQuantity,
} from "./invoice";
import {
  correctPostedInvoice,
  invoiceContentCorrectionPreview,
} from "./invoice-corrections";
import { effectiveInvoiceVersion } from "./invoice-version";
import { productCostHistory, productStoreCost } from "./product-costs";
import { supplierItemFacts } from "./supplier-items";
import { orderCandidates } from "./orders";
import type { OperationsContext } from "./operations";
import type { DemoInvoice, DemoState } from "./types";

function context(state: DemoState): OperationsContext {
  return {
    company_id: state.config.company.seed_key,
    branch: "Branch 1",
    role: "supervisor",
    actor: "Ali",
  };
}

function freshState() {
  const state = initialState();
  state.invoices = [];
  state.ledger = [];
  state.approvals = [];
  state.invoice_content_corrections = [];
  return state;
}

function postCost(
  state: DemoState,
  number: string,
  cost: string,
  postedAt: string,
) {
  state.invoice = createInvoice(state, "Branch 1", true);
  Object.assign(state.invoice, {
    supplier: "Fresh Valley Foods",
    supplier_invoice_number: number,
    supplier_confirmed: true,
    invoice_date: postedAt.slice(0, 10),
    received_at: postedAt,
    file_name: "retained-cost-original.png",
    file_type: "image/png",
    file_data: "data:image/png;base64,cmV0YWluZWQ=",
  });
  addManualLine(state, "0002");
  const line = state.invoice.lines[0];
  setInvoiceLineQuantity(line, "10", "units", 1);
  Object.assign(line, {
    qty_received_at_posting: 10,
    unit_cost_before_tax: cost,
    date_tracking: false,
    date_confirmed: true,
  });
  recalculateInvoice(state.invoice, state.config);
  line.review_confirmed = true;
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Retain this receipt's cost evidence.",
  };
  postInvoice(state, "supervisor", "Branch 1", "Ali");
  state.invoice.posted_at = postedAt;
  Object.assign(
    state.invoices!.find((invoice) => invoice.id === state.invoice.id)!,
    structuredClone(state.invoice),
  );
  return structuredClone(state.invoice);
}

function correctCost(
  state: DemoState,
  original: DemoInvoice,
  cost: string,
  requestId: string,
  productCode?: string,
) {
  const lines = structuredClone(effectiveInvoiceVersion(state, original).lines);
  lines[0].unit_cost_before_tax = cost;
  if (productCode) lines[0].product_code = productCode;
  const input = {
    lines,
    reason: "Correct the recorded receipt cost and keep its original date.",
  };
  const preview = invoiceContentCorrectionPreview(
    state,
    context(state),
    original.id,
    input,
  );
  expect(preview.blockers).toEqual([]);
  return correctPostedInvoice(
    state,
    context(state),
    original.id,
    input,
    preview.snapshot,
    requestId,
  );
}

describe("Catalog cost history after posted invoice corrections", () => {
  it("projects the latest corrected cost once while retaining original receipt evidence and access scope", () => {
    const state = freshState();
    const original = postCost(
      state,
      "COST-LATEST",
      "1.0000",
      "2026-10-01T09:00:00.000Z",
    );
    const product = state.products.find((item) => item.code === "0002")!;
    correctCost(state, original, "2.0000", "catalog-cost-first");
    correctCost(state, original, "2.5000", "catalog-cost-second");

    expect(productStoreCost(state, context(state), product)).toBe("2.5000");
    expect(productCostHistory(state, context(state), product)).toEqual([
      expect.objectContaining({
        invoice_id: original.id,
        invoice_number: "COST-LATEST",
        unit_cost_before_tax: "2.5000",
        date: "2026-10-01",
        posted_at: original.posted_at,
      }),
    ]);
    expect(state.invoices!.find((item) => item.id === original.id)).toEqual(
      original,
    );
    expect(state.invoice).toEqual(original);
    const supplierItem = supplierItemFacts(
      state,
      context(state).company_id,
      original.supplier,
      "all",
    ).find((item) => item.product_code === product.code)!;
    expect(supplierItem.last_bought_unit_cost).toBe("2.5000");
    expect(supplierItem.history).toEqual([
      expect.objectContaining({
        invoice_id: original.id,
        unit_cost_before_tax: "2.5000",
        at: original.received_at,
        date: "2026-10-01",
        received_units: 10,
      }),
    ]);
    expect(
      productCostHistory(
        state,
        { ...context(state), role: "cashier" },
        product,
      ),
    ).toEqual([]);
    expect(
      productCostHistory(
        state,
        { ...context(state), branch: "Branch 2" },
        product,
      ),
    ).toEqual([]);
    expect(
      productStoreCost(
        state,
        { ...context(state), company_id: "another-company" },
        product,
      ),
    ).toBeNull();
  });

  it("keeps an older corrected receipt older than a newer accepted receipt", () => {
    const state = freshState();
    const older = postCost(
      state,
      "COST-OLDER",
      "1.0000",
      "2026-10-01T09:00:00.000Z",
    );
    const newer = postCost(
      state,
      "COST-NEWER",
      "3.0000",
      "2026-10-02T09:00:00.000Z",
    );
    const product = state.products.find((item) => item.code === "0002")!;
    const provenance = structuredClone(product.price_provenance);
    const result = correctCost(state, older, "2.0000", "catalog-cost-older");

    expect(result.at > newer.posted_at!).toBe(true);
    expect(
      productCostHistory(state, context(state), product).map((entry) => [
        entry.invoice_id,
        entry.unit_cost_before_tax,
        entry.posted_at,
      ]),
    ).toEqual([
      [newer.id, "3.0000", newer.posted_at],
      [older.id, "2.0000", older.posted_at],
    ]);
    expect(productStoreCost(state, context(state), product)).toBe("3.0000");
    expect(product.last_cost_before_tax).toBe("3.0000");
    expect(product.price_provenance).toEqual(provenance);
    const supplierItem = supplierItemFacts(
      state,
      context(state).company_id,
      newer.supplier,
      "all",
    ).find((item) => item.product_code === product.code)!;
    expect(supplierItem.last_bought_unit_cost).toBe("3.0000");
    expect(supplierItem.history.map((entry) => entry.invoice_id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect(supplierItem.history[1].unit_cost_before_tax).toBe("2.0000");
    expect(
      orderCandidates(state, context(state), newer.supplier).find(
        (item) => item.id === supplierItem.id,
      )?.expected_unit_cost,
    ).toBe("3.0000");
    expect(state.invoices!.find((item) => item.id === older.id)).toEqual(older);
  });

  it("attributes a corrected product line to its current product without rewriting the original", () => {
    const state = freshState();
    const original = postCost(
      state,
      "COST-PRODUCT",
      "1.0000",
      "2026-10-01T09:00:00.000Z",
    );
    correctCost(state, original, "2.0000", "catalog-cost-product", "0005");
    const oldProduct = state.products.find((item) => item.code === "0002")!;
    const currentProduct = state.products.find((item) => item.code === "0005")!;

    expect(productCostHistory(state, context(state), oldProduct)).toEqual([]);
    expect(productCostHistory(state, context(state), currentProduct)).toEqual([
      expect.objectContaining({
        invoice_id: original.id,
        unit_cost_before_tax: "2.0000",
        sold_by: "each",
      }),
    ]);
    expect(state.invoices!.find((item) => item.id === original.id)).toEqual(
      original,
    );
  });
});
