import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  addManualLine,
  createInvoice,
  postInvoice,
  recalculateInvoice,
  setInvoiceLineQuantity,
  receiveShort,
} from "./invoice";
import {
  correctPostedInvoice,
  invoiceContentCorrectionPreview,
  attachPostedInvoiceOriginal,
} from "./invoice-corrections";
import {
  effectiveInvoiceVersion,
  invoiceContentVersions,
  invoiceVersion,
} from "./invoice-version";
import {
  receivedLog,
  invoiceLocationMovePreview,
  movePostedInvoice,
} from "./received";
import { companyDate } from "./invoice";
import {
  ledgerSummary,
  postPayment,
  type OperationsContext,
} from "./operations";
import type { DemoState } from "./types";

function context(state: DemoState, branch = "Branch 1"): OperationsContext {
  return {
    company_id: state.config.company.seed_key,
    branch,
    role: "supervisor",
    actor: "Ali",
  };
}
function posted(taxable = false, delivered = 10) {
  const state = initialState();
  state.invoice = createInvoice(state, "Branch 1", true);
  Object.assign(state.invoice, {
    supplier: "Fresh Valley Foods",
    supplier_invoice_number: "CORRECTION-100",
    supplier_confirmed: true,
    file_name: "retained-original.png",
    file_type: "image/png",
    file_data: "data:image/png;base64,cmV0YWluZWQ=",
  });
  addManualLine(state, taxable ? "0009" : "0002");
  const line = state.invoice.lines[0];
  setInvoiceLineQuantity(line, "10", "units", 1);
  line.qty_received_at_posting = delivered;
  line.unit_cost_before_tax = "1.0000";
  recalculateInvoice(state.invoice, state.config);
  line.review_confirmed = true;
  line.date_tracking = false;
  line.date_confirmed = true;
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Cost evidence corrected in the fictional demo.",
  };
  postInvoice(state, "supervisor", "Branch 1", "Ali");
  return state;
}
function input(state: DemoState, cost = "2.0000") {
  const lines = structuredClone(
    effectiveInvoiceVersion(state, state.invoice).lines,
  );
  lines[0].unit_cost_before_tax = cost;
  return { lines, reason: "Correct the supplier's recorded unit cost." };
}
function apply(
  state: DemoState,
  proposal = input(state),
  request = "correction-request-1",
) {
  const preview = invoiceContentCorrectionPreview(
    state,
    context(state),
    state.invoice.id,
    proposal,
  );
  return correctPostedInvoice(
    state,
    context(state),
    state.invoice.id,
    proposal,
    preview.snapshot,
    request,
  );
}
function liability(state: DemoState, branch = "Branch 1") {
  return ledgerSummary(
    state,
    context(state, branch),
    state.invoice.supplier,
  ).invoices.find(
    (row) => row.invoice_id === state.invoice.id && row.branch === branch,
  )?.amount;
}

describe("immutable invoice content corrections", () => {
  it("appends cost deltas once, retains originals/files/previous versions and creates non-reversible History", () => {
    const state = posted();
    const original = structuredClone(state.invoice);
    const first = apply(state);
    expect(state.invoice).toEqual(original);
    expect(state.invoices?.find((row) => row.id === original.id)).toEqual(
      original,
    );
    expect(first.before.file_data).toBeUndefined();
    expect(first.after.file_data).toBeUndefined();
    expect(first.payable_delta).toBe("10.00");
    expect(liability(state)).toBe("20.00");
    expect(effectiveInvoiceVersion(state, original).file_data).toBe(
      original.file_data,
    );
    const frozenFirst = structuredClone(first);
    apply(state, input(state, "3.0000"), "correction-request-2");
    expect(first).toEqual(frozenFirst);
    expect(invoiceContentVersions(state, original)).toHaveLength(3);
    expect(invoiceVersion(state, original, first.id).invoice.final_total).toBe(
      "20.00",
    );
    expect(invoiceVersion(state, original, "original").invoice).toEqual(
      original,
    );
    expect(liability(state)).toBe("30.00");
    expect(state.activity.at(-1)).toMatchObject({
      entity_type: "invoice_content_correction",
      reversible: false,
    });
    const counts = [
      state.ledger.length,
      state.activity.length,
      state.approvals.length,
    ];
    correctPostedInvoice(
      state,
      context(state),
      original.id,
      input({ ...state, invoice: original }, "2.0000"),
      first.snapshot,
      "correction-request-1",
    );
    expect([
      state.ledger.length,
      state.activity.length,
      state.approvals.length,
    ]).toEqual(counts);
  });
  it("preserves legacy tax/header discrepancies and applies only the changed line's tax delta", () => {
    const state = posted(true);
    state.invoice.tax = "10.00";
    state.invoice.final_total = "20.00";
    delete state.invoice.lines[0].line_tax;
    const retained = state.invoices!.find(
      (row) => row.id === state.invoice.id,
    )!;
    Object.assign(retained, structuredClone(state.invoice));
    state.ledger.find(
      (row) => row.invoice_id === state.invoice.id && row.type === "invoice",
    )!.amount = "20.00";
    const preview = invoiceContentCorrectionPreview(
      state,
      context(state),
      state.invoice.id,
      input(state),
    );
    expect(preview.after.tax).toBe("11.30");
    expect(preview.after.final_total).toBe("31.30");
    expect(preview.payable_delta).toBe("11.30");
  });
  it("uses updated case cost without replaying original receipt quantities", () => {
    const state = posted();
    const old = state.invoice.lines[0];
    setInvoiceLineQuantity(old, "2", "cases", 5);
    old.case_cost_before_tax = "5.0000";
    Object.assign(
      state.invoices!.find((row) => row.id === state.invoice.id)!,
      structuredClone(state.invoice),
    );
    const movementCount = state.stock_movements!.length;
    const result = apply(state);
    expect(result.after.lines[0].case_cost_before_tax).toBe("10.0000");
    expect(result.after.lines[0].line_total).toBe("20.00");
    expect(state.stock_movements).toHaveLength(movementCount);
    expect(
      receivedLog(state, context(state)).find(
        (row) => row.invoice_id === state.invoice.id,
      ),
    ).toMatchObject({ units: 10, cases: "2", units_per_case: 5 });
  });
  it("projects corrected products/quantities through Received while original physical events remain", () => {
    const state = posted();
    const proposal = input(state);
    proposal.lines[0].product_code = "0005";
    setInvoiceLineQuantity(proposal.lines[0], "12", "units", 1);
    proposal.lines[0].qty_received_at_posting = 12;
    const originalMovement = structuredClone(state.stock_movements!.at(-1));
    const result = apply(state, proposal);
    expect(result.physical_movement_ids).toHaveLength(2);
    expect(state.stock_movements).toContainEqual(originalMovement);
    expect(
      receivedLog(state, context(state)).filter(
        (row) => row.invoice_id === state.invoice.id,
      ),
    ).toEqual([expect.objectContaining({ product_code: "0005", units: 12 })]);
    expect(state.invoice.lines[0].product_code).toBe("0002");
  });
  it("retains allocated payments and exposes excess credit without destroying allocations", () => {
    const state = posted();
    postPayment(state, context(state), {
      supplier: state.invoice.supplier,
      amount: "8.00",
      date: companyDate(state.config),
      cheque: "",
      receipt: "CORRECTION-PAY",
      allocations: [{ invoice_id: state.invoice.id, amount: "8.00" }],
    });
    const payment = structuredClone(state.ledger.at(-1));
    const result = apply(state, input(state, "0.5000"));
    expect(result.excess_allocated_credit).toBe("3.00");
    expect(liability(state)).toBe("-3.00");
    expect(state.ledger).toContainEqual(payment);
  });
  it("revalidates scope, reason, allocation/version/file context and makes failed saves atomic", () => {
    const state = posted();
    const proposal = input(state);
    const preview = invoiceContentCorrectionPreview(
      state,
      context(state),
      state.invoice.id,
      proposal,
    );
    const unchanged = structuredClone(state);
    expect(() =>
      correctPostedInvoice(
        state,
        { ...context(state), role: "floor_worker" },
        state.invoice.id,
        proposal,
        preview.snapshot,
        "x",
      ),
    ).toThrow(/Supervisor/);
    expect(() =>
      correctPostedInvoice(
        state,
        context(state),
        state.invoice.id,
        { ...proposal, reason: "" },
        preview.snapshot,
        "x",
      ),
    ).toThrow(/reason/);
    expect(state).toEqual(unchanged);
    state.invoice.file_data = "data:image/png;base64,bmV3LWZpbGU=";
    Object.assign(
      state.invoices!.find((row) => row.id === state.invoice.id)!,
      structuredClone(state.invoice),
    );
    const changed = structuredClone(state);
    expect(() =>
      correctPostedInvoice(
        state,
        context(state),
        state.invoice.id,
        proposal,
        preview.snapshot,
        "x",
      ),
    ).toThrow(/changed/);
    expect(state).toEqual(changed);
  });
  it("supersedes only eligible source pending proposals and retains tracked-date evidence", () => {
    const state = posted();
    const line = state.invoice.lines[0];
    line.date_tracking = true;
    line.date_value = "2027-01-01";
    line.date_type = "expiry";
    Object.assign(
      state.invoices!.find((row) => row.id === state.invoice.id)!,
      structuredClone(state.invoice),
    );
    state.expiry.push({
      id: `${state.invoice.id}:date:0:expiry`,
      company_id: state.invoice.company_id,
      branch: "Branch 1",
      product_code: line.product_code,
      invoice_id: state.invoice.id,
      invoice_number: state.invoice.supplier_invoice_number,
      invoice_line_index: 0,
      status: "active",
      date: "2027-01-01",
      expires_in_days: 10,
      source: "invoice",
    });
    const proposal = input(state);
    proposal.lines[0].date_value = "2027-02-01";
    const pending = state.approvals
      .filter(
        (row) =>
          row.source_invoice_id === state.invoice.id &&
          row.status === "pending",
      )
      .map((row) => row.id);
    const result = apply(state, proposal);
    expect(
      pending.every(
        (id) =>
          state.approvals.find((row) => row.id === id)!.status === "superseded",
      ),
    ).toBe(true);
    expect(
      state.expiry.find((row) => row.id === result.removed_date_ids[0]),
    ).toMatchObject({
      date: "2027-01-01",
      status: "removed",
      correction_id: result.id,
    });
    expect(
      state.expiry.find((row) => row.id === result.date_ids[0]),
    ).toMatchObject({
      date: "2027-02-01",
      status: "active",
      source: "correction",
      previous_entry_id: result.removed_date_ids[0],
    });
  });
  it("corrects an unrelated line of a normal seed invoice without a blanket payment/order block", () => {
    const state = initialState();
    state.invoice = structuredClone(
      state.invoices!.find(
        (row) => row.supplier_invoice_number === "FV-20390",
      )!,
    );
    const lines = structuredClone(state.invoice.lines);
    const index = lines.findIndex((line) => line.product_code === "0002");
    expect(index).toBeGreaterThanOrEqual(0);
    lines[index].unit_cost_before_tax = "1.0100";
    const preview = invoiceContentCorrectionPreview(
      state,
      context(state, "all"),
      state.invoice.id,
      { lines, reason: "Correct bean unit cost." },
    );
    expect(preview.blockers).toEqual([]);
    correctPostedInvoice(
      state,
      context(state, "all"),
      state.invoice.id,
      { lines, reason: "Correct bean unit cost." },
      preview.snapshot,
      "seed-correction",
    );
    expect(state.invoice.supplier_invoice_number).toBe("FV-20390");
  });
  it("blocks only affected linked order receipt lines while allowing cost and date corrections", () => {
    const state = posted();
    state.invoice.lines[0].order_item_id = "retained-order-line";
    Object.assign(
      state.invoices!.find((row) => row.id === state.invoice.id)!,
      structuredClone(state.invoice),
    );
    expect(
      invoiceContentCorrectionPreview(
        state,
        context(state),
        state.invoice.id,
        input(state),
      ).blockers,
    ).toEqual([]);
    const proposal = input(state);
    proposal.lines[0].qty_received_at_posting = 9;
    const preview = invoiceContentCorrectionPreview(
      state,
      context(state),
      state.invoice.id,
      proposal,
    );
    expect(preview.blockers[0]).toMatch(/retained order receipt/);
    const before = structuredClone(state);
    expect(() =>
      correctPostedInvoice(
        state,
        context(state),
        state.invoice.id,
        proposal,
        preview.snapshot,
        "blocked",
      ),
    ).toThrow(/retained order receipt/);
    expect(state).toEqual(before);
  });
  it("preserves later short evidence and rejects unsafe monetary changes", () => {
    const state = posted();
    state.invoice.lines[0].qty_later_received = 1;
    Object.assign(
      state.invoices!.find((row) => row.id === state.invoice.id)!,
      structuredClone(state.invoice),
    );
    const preview = invoiceContentCorrectionPreview(
      state,
      context(state),
      state.invoice.id,
      input(state),
    );
    expect(preview.blockers[0]).toMatch(/later short delivery/);
  });
  it("applies safe corrections at the effective moved location", () => {
    const state = posted();
    const move = invoiceLocationMovePreview(
      state,
      context(state),
      state.invoice.id,
      "Branch 2",
    );
    movePostedInvoice(
      state,
      context(state),
      state.invoice.id,
      "Branch 2",
      "Correct receiving location",
      move.snapshot,
    );
    const proposal = input(state);
    const preview = invoiceContentCorrectionPreview(
      state,
      context(state, "Branch 2"),
      state.invoice.id,
      proposal,
    );
    correctPostedInvoice(
      state,
      context(state, "Branch 2"),
      state.invoice.id,
      proposal,
      preview.snapshot,
      "after-move",
    );
    expect(state.ledger.at(-1)).toMatchObject({
      branch: "Branch 2",
      amount: "10.00",
    });
    expect(
      receivedLog(state, context(state, "Branch 2")).find(
        (row) => row.invoice_id === state.invoice.id,
      ),
    ).toMatchObject({ branch: "Branch 2" });
  });
  it("attaches a manual original once without rewriting retained financial or line evidence", () => {
    const state = posted();
    delete state.invoice.file_data;
    delete state.invoices!.find((row) => row.id === state.invoice.id)!
      .file_data;
    const lines = structuredClone(state.invoice.lines);
    const ledger = structuredClone(state.ledger);
    attachPostedInvoiceOriginal(state, context(state), state.invoice.id, {
      file_name: "receipt.pdf",
      file_type: "application/pdf",
      file_data: "data:application/pdf;base64,JVBERg==",
    });
    expect(state.invoice.lines).toEqual(lines);
    expect(state.ledger).toEqual(ledger);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Attach original",
      reversible: false,
    });
    expect(() =>
      attachPostedInvoiceOriginal(state, context(state), state.invoice.id, {
        file_name: "other.pdf",
        file_type: "application/pdf",
        file_data: "data:application/pdf;base64,JVBERg==",
      }),
    ).toThrow(/existing original/);
  });
  it("preserves merged pending contributor attribution and unrelated proposals", () => {
    const state = posted();
    const merged = {
      ...structuredClone(state.approvals[0]),
      id: "merged-pending",
      company_id: state.invoice.company_id,
      product_code: "0002",
      branch: "Branch 1",
      status: "pending" as const,
      source_invoice_id: state.invoice.id,
      invoice_ids: ["retained-older-contributor", state.invoice.id],
    };
    state.approvals.push(merged);
    const unrelated = structuredClone(
      state.approvals.find((row) => row.product_code !== "0002")!,
    );
    const result = apply(state);
    expect(merged.status).toBe("superseded");
    const replacement = state.approvals.find(
      (row) => row.id === result.approval_ids[0],
    )!;
    expect(replacement.invoice_ids).toEqual(
      expect.arrayContaining(["retained-older-contributor", state.invoice.id]),
    );
    expect(state.approvals).toContainEqual(unrelated);
  });
  it("permits partial-return-safe quantity changes and blocks destroying picked-up coverage", () => {
    const state = posted();
    const record = structuredClone(state.returns[0]);
    record.id = "linked-pickup";
    record.company_id = state.invoice.company_id;
    record.linked_invoice = state.invoice.id;
    record.lines[0].product_code = "0002";
    record.lines[0].picked_up = 4;
    record.lines = [record.lines[0]];
    state.returns.push(record);
    const proposal = input(state);
    proposal.lines[0].qty_received_at_posting = 9;
    expect(
      invoiceContentCorrectionPreview(
        state,
        context(state),
        state.invoice.id,
        proposal,
      ).blockers,
    ).toEqual([]);
    proposal.lines[0].qty_received_at_posting = 3;
    expect(
      invoiceContentCorrectionPreview(
        state,
        context(state),
        state.invoice.id,
        proposal,
      ).blockers[0],
    ).toMatch(/picked-up supplier return evidence/);
  });
  it("keeps later short delivery operational evidence outside immutable correction snapshots", () => {
    const state = posted(false, 8);
    const proposal = input(state, "1.0000");
    proposal.lines[0].date_tracking = true;
    proposal.lines[0].date_value = "2027-04-01";
    proposal.lines[0].date_type = "expiry";
    const correction = apply(state, proposal);
    const snapshot = structuredClone(correction.after);
    expect(
      receiveShort(
        state,
        "0002",
        2,
        "AFTER-CORRECTION-SHORT",
        "supervisor",
        "Branch 1",
        0,
        "Ali",
      ),
    ).toBe("2.00");
    expect(correction.after).toEqual(snapshot);
    expect(
      effectiveInvoiceVersion(state, state.invoice).lines[0],
    ).toMatchObject({ date_value: "2027-04-01", qty_later_received: 2 });
    expect(liability(state)).toBe("10.00");
    expect(
      receiveShort(
        state,
        "0002",
        2,
        "AFTER-CORRECTION-SHORT",
        "supervisor",
        "Branch 1",
        0,
        "Ali",
      ),
    ).toBe("0.00");
  });
  it("uses effective newer product receipts when deciding the current regular cost source", () => {
    const state = posted();
    const original = structuredClone(state.invoice);
    state.invoice = createInvoice(state, "Branch 1", true);
    Object.assign(state.invoice, {
      supplier: original.supplier,
      supplier_invoice_number: "NEWER-100",
      supplier_confirmed: true,
      file_name: original.file_name,
      file_type: original.file_type,
      file_data: original.file_data,
    });
    addManualLine(state, "0002");
    Object.assign(state.invoice.lines[0], {
      qty_invoiced: 10,
      qty_received_at_posting: 10,
      unit_cost_before_tax: "5.0000",
      quantity_unit: "units",
      quantity_entered: "10",
      case_cost_before_tax: undefined,
      date_tracking: false,
      date_confirmed: true,
    });
    recalculateInvoice(state.invoice, state.config);
    state.invoice.lines[0].review_confirmed = true;
    postInvoice(state, "supervisor", "Branch 1");
    state.invoice.posted_at = "2099-01-01T00:00:00.000Z";
    Object.assign(
      state.invoices!.find((row) => row.id === state.invoice.id)!,
      structuredClone(state.invoice),
    );
    const changed = input(state, "5.0000");
    changed.lines[0].product_code = "0005";
    apply(state, changed, "newer-product-correction");
    state.invoice = original;
    const preview = invoiceContentCorrectionPreview(
      state,
      context(state),
      original.id,
      input(state),
    );
    expect(preview.approval_changes).toEqual([
      expect.objectContaining({
        product_code: "0002",
        updates_regular_cost: true,
      }),
    ]);
  });
});
