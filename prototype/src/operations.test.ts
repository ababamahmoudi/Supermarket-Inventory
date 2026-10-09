import { afterEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { initialState } from "./store";
import { invoiceLocationMovePreview, movePostedInvoice } from "./received";
import {
  addNote,
  cancelReturn,
  clearExpiry,
  companyTimestamp,
  ledgerCsv,
  ledgerSummary,
  markLedgerDispute,
  monthEndDate,
  postLedgerAdjustment,
  postPayment,
  postReturnClaim,
  receiveReplacement,
  recordPickup,
  reviewCancellation,
  scopedRecords,
  submitFinancialClaim,
  suggestAllocations,
  updateNoteStatus,
  type OperationsContext,
  type OperationalReturn,
} from "./operations";
const worker: OperationsContext = {
  company_id: "super-arzon",
  branch: "Branch 1",
  role: "floor_worker",
  actor: "Demo Floor Worker",
};
const supervisor: OperationsContext = {
  ...worker,
  role: "supervisor",
  actor: "Demo Supervisor",
};
function invoiceState() {
  const state = initialState();
  // Financial cases use one explicit invoice, independent of historical demo receipts.
  state.invoice.status = "posted";
  state.invoices = [];
  state.ledger = [];
  state.returns[0].linked_invoice = state.invoice.id;
  state.ledger.push(
    {
      id: "invoice-1",
      company_id: worker.company_id,
      branch: worker.branch,
      supplier: "Fresh Valley Foods",
      type: "invoice",
      amount: "177.02",
      date: "2026-10-01",
      reference: "FV-20417",
      invoice_id: state.invoice.id,
      currency: "CAD",
    },
    {
      id: "short-1",
      company_id: worker.company_id,
      branch: worker.branch,
      supplier: "Fresh Valley Foods",
      type: "short_deduction",
      amount: "-7.23",
      date: "2026-10-01",
      reference: "FV-SHORT",
      invoice_id: state.invoice.id,
      currency: "CAD",
    },
  );
  return state;
}
describe("return physical receipts and safe cancellation", () => {
  it("requires a signed slip and representative and never deducts stock again at pickup", () => {
    const state = initialState();
    const returnId = state.returns[0].id;
    const originalStock = { ...state.stock };
    expect(() =>
      recordPickup(state, worker, returnId, {
        quantities: { "0003": 3 },
        representative: "",
        slip: "",
      }),
    ).toThrow("pickup_evidence");
    recordPickup(state, worker, returnId, {
      quantities: { "0003": 2 },
      representative: "Fictional Rep",
      slip: "SIGNED-DEMO-001",
    });
    expect(state.stock).toEqual(originalStock);
    expect(state.returns[0].lines[0].picked_up).toBe(2);
    expect(() =>
      recordPickup(state, worker, returnId, {
        quantities: { "0003": 2 },
        representative: "Fictional Rep",
        slip: "SIGNED-DEMO-002",
      }),
    ).toThrow("pickup_cap");
  });
  it("adds actual substitute units with explicit original coverage without Payables and prevents duplicate receipt", () => {
    const state = initialState();
    const record = state.returns[0];
    const stockBefore = state.stock["Branch 1:0002"];
    const ledgerBefore = structuredClone(state.ledger);
    const receipt = {
      product_code: "0002",
      qty: 2,
      covers: { "0003": 1 },
      date: "2026-10-06",
      representative: "Fictional Rep",
      receipt: "REPLACE-DEMO-001",
    };
    receiveReplacement(state, worker, record.id, receipt);
    receiveReplacement(state, worker, record.id, receipt);
    expect(state.stock["Branch 1:0002"]).toBe(stockBefore + 2);
    expect(state.ledger).toEqual(ledgerBefore);
    expect(record.lines[0].settled).toBe(1);
    expect(record.status).toBe("partially_resolved");
    expect(() =>
      receiveReplacement(state, worker, record.id, {
        ...receipt,
        receipt: "REPLACE-DEMO-002",
        covers: { "0003": 3 },
      }),
    ).toThrow("coverage");
  });
  it("counts seeded replacement coverage and cannot settle the original quantity twice", () => {
    const state = initialState();
    const record = state.returns[1];
    const stockBefore = state.stock["Branch 1:0001"];
    const ledgerBefore = structuredClone(state.ledger);
    expect(() =>
      receiveReplacement(state, worker, record.id, {
        product_code: "0001",
        qty: 2,
        covers: { "0001": 2 },
        date: "2026-10-06",
        representative: "Fictional Rep",
        receipt: "REPLACE-2",
      }),
    ).toThrow("coverage");
    expect(state.stock["Branch 1:0001"]).toBe(stockBefore);
    expect(state.ledger).toEqual(ledgerBefore);
  });
  it("restores zero supplier-held originals and retains a partial replacement through Supervisor review", () => {
    const state = initialState();
    const record = state.returns[1];
    const originalStock = { ...state.stock };
    const ledgerBefore = structuredClone(state.ledger);
    cancelReturn(state, worker, record.id, {
      reason: "Supplier disputed remaining claim",
      dispositions: { "0001": "supplier_held" },
      recovered: { "0001": 0 },
      safe: false,
    });
    expect(record.status).toBe("cancellation_review");
    expect(state.stock).toEqual(originalStock);
    expect(record.replacement_received?.qty).toBe(1);
    expect(state.ledger).toEqual(ledgerBefore);
    expect(() =>
      reviewCancellation(state, worker, record.id, {
        accept: true,
        settlement_retained: true,
        note: "Retained the replacement",
      }),
    ).toThrow("supervisor");
    reviewCancellation(state, supervisor, record.id, {
      accept: true,
      settlement_retained: true,
      note: "Checked receipt; existing replacement retained",
    });
    expect(record.status).toBe("cancelled");
    expect(state.stock).toEqual(originalStock);
  });
  it("restores only explicitly recovered safe originals once; damaged goods stay excluded", () => {
    const state = initialState();
    const record = state.returns[0];
    const stockBefore = state.stock["Branch 1:0003"];
    expect(() =>
      cancelReturn(state, worker, record.id, {
        reason: "Recovered two",
        dispositions: { "0003": "supplier_held" },
        recovered: { "0003": 2 },
        safe: true,
      }),
    ).toThrow("safe");
    cancelReturn(state, worker, record.id, {
      reason: "Two physically recovered; one remaining damaged",
      dispositions: { "0003": "recovered_sellable" },
      recovered: { "0003": 2 },
      safe: true,
    });
    expect(state.stock["Branch 1:0003"]).toBe(stockBefore + 2);
    expect(record.original_units_recovered).toBe(2);
    expect(record.status).toBe("cancelled");
    expect(() =>
      cancelReturn(state, worker, record.id, {
        reason: "Repeat",
        dispositions: { "0003": "recovered_sellable" },
        recovered: { "0003": 2 },
        safe: true,
      }),
    ).toThrow("closed");
  });
  it("never reads or mutates another company or an unassigned branch", () => {
    const state = initialState();
    const stockBefore = { ...state.stock };
    expect(() =>
      recordPickup(
        state,
        { ...worker, company_id: "other-company" },
        state.returns[0].id,
        { quantities: { "0003": 1 }, representative: "Demo", slip: "Demo" },
      ),
    ).toThrow("scope");
    expect(() =>
      recordPickup(
        state,
        { ...worker, branch: "Branch 2" },
        state.returns[0].id,
        { quantities: { "0003": 1 }, representative: "Demo", slip: "Demo" },
      ),
    ).toThrow("scope");
    expect(
      scopedRecords(state.returns, { ...worker, company_id: "other-company" }),
    ).toEqual([]);
    expect(state.stock).toEqual(stockBefore);
  });
});
describe("financial return claims", () => {
  it("keeps worker claims outside Payables until a Supervisor verifies/posts once", () => {
    const state = invoiceState();
    const record = state.returns[0] as OperationalReturn;
    submitFinancialClaim(state, worker, record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 3 },
      invoice_id: state.invoice.id,
      document: "DEMO-CREDIT-001",
    });
    const claimId = record.claims![0].id;
    expect(state.ledger).toHaveLength(2);
    expect(() =>
      postReturnClaim(state, worker, record.id, claimId, "5.40"),
    ).toThrow("supervisor");
    postReturnClaim(state, supervisor, record.id, claimId, "5.40");
    postReturnClaim(state, supervisor, record.id, claimId, "5.40");
    expect(state.ledger).toHaveLength(3);
    expect(ledgerSummary(state, supervisor, record.supplier).balance).toBe(
      "164.39",
    );
    expect(
      ledgerSummary(state, supervisor, record.supplier).invoices[0].amount,
    ).toBe("164.39");
    expect(record.status).toBe("resolved");
  });
  it("requires supplier document, one existing matching invoice, and blocks duplicate evidence", () => {
    const state = invoiceState();
    const record = state.returns[0];
    expect(() =>
      submitFinancialClaim(state, worker, record.id, {
        type: "credit_current_invoice",
        covers: { "0003": 1 },
        invoice_id: state.invoice.id,
      }),
    ).toThrow("credit_document");
    expect(() =>
      submitFinancialClaim(state, worker, record.id, {
        type: "credit_current_invoice",
        covers: { "0003": 1 },
        invoice_id: "unrelated",
        document: "D1",
      }),
    ).toThrow("invoice");
    submitFinancialClaim(state, worker, record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 1 },
      invoice_id: state.invoice.id,
      document: "D1",
    });
    expect(() =>
      submitFinancialClaim(state, worker, record.id, {
        type: "credit_later_invoice",
        covers: { "0003": 1 },
        invoice_id: state.invoice.id,
        document: "D2",
      }),
    ).toThrow("single_credit");
    expect(() =>
      receiveReplacement(state, worker, record.id, {
        product_code: "0003",
        qty: 3,
        covers: { "0003": 3 },
        date: "2026-10-06",
        representative: "Demo",
        receipt: "R1",
      }),
    ).toThrow("coverage");
  });
  it("only lets a Supervisor close without compensation and requires a reason", () => {
    const state = initialState();
    const record = state.returns[0];
    expect(() =>
      submitFinancialClaim(state, worker, record.id, {
        type: "no_compensation",
        covers: { "0003": 3 },
        reason: "Supplier refused",
      }),
    ).toThrow("supervisor");
    expect(() =>
      submitFinancialClaim(state, supervisor, record.id, {
        type: "no_compensation",
        covers: { "0003": 3 },
      }),
    ).toThrow("reason");
  });
});
describe("notes and expiry are company and branch scoped", () => {
  it("blocks plain built-in notes for another company or an unavailable location before changing any record", () => {
    const state = initialState();
    const before = structuredClone(state);
    expect(() =>
      addNote(
        state,
        { ...worker, company_id: "another-company" },
        {
          type: "to_order",
          text: "No product needed to exercise company guard",
        },
      ),
    ).toThrow("scope");
    expect(state).toEqual(before);
    expect(() =>
      addNote(
        state,
        { ...worker, branch: "missing-location" },
        {
          type: "note_to_supervisor",
          text: "Unassigned location cannot create a note",
        },
      ),
    ).toThrow("scope");
    expect(state).toEqual(before);
    state.config.branches.find((branch) => branch.code === "W1")!.active =
      false;
    const deactivated = structuredClone(state);
    expect(() =>
      addNote(
        state,
        { ...supervisor, branch: "Warehouse" },
        {
          type: "to_order",
          text: "Inactive Warehouse cannot create a note",
        },
      ),
    ).toThrow("scope");
    expect(state).toEqual(deactivated);
  });
  it("allows Warehouse built-in notes with the same scoped history and author evidence as store locations", () => {
    const state = initialState();
    const ledgerBefore = structuredClone(state.ledger);
    addNote(
      state,
      { ...supervisor, branch: "Warehouse" },
      {
        type: "to_order",
        text: "Fictional Warehouse order reminder",
      },
    );
    expect(state.notes[0]).toMatchObject({
      company_id: supervisor.company_id,
      branch: "Warehouse",
      type: "to_order",
      text: "Fictional Warehouse order reminder",
      by: supervisor.actor,
    });
    expect(state.activity[0]).toMatchObject({
      company_id: supervisor.company_id,
      branch: "Warehouse",
      by: supervisor.actor,
    });
    expect(state.ledger).toEqual(ledgerBefore);
  });
  it("records store-use physical movement once with author/time and no ledger change", () => {
    const state = initialState();
    const ledgerBefore = structuredClone(state.ledger);
    state.stock["Branch 1:0006"] = 10;
    addNote(state, worker, {
      type: "store_use",
      text: "Used for fictional staff lunch",
      product_code: "0006",
      qty: 2,
    });
    expect(state.stock["Branch 1:0006"]).toBe(8);
    expect(state.notes[0]).toMatchObject({
      company_id: worker.company_id,
      branch: worker.branch,
      by: worker.actor,
      qty: 2,
    });
    expect(state.notes[0].created_at).toBeTruthy();
    expect(state.ledger).toEqual(ledgerBefore);
    expect(state.stock_movements?.at(-1)).toMatchObject({
      company_id: worker.company_id,
      branch: worker.branch,
      product_code: "0006",
      type: "store_use",
      qty: -2,
      reference: "Used for fictional staff lunch",
      by: worker.actor,
    });
    expect(() =>
      addNote(state, worker, { type: "store_use", text: "Missing product" }),
    ).toThrow("store_use");
    expect(() =>
      addNote(
        state,
        { ...worker, role: "cashier" },
        { type: "to_order", text: "Forbidden" },
      ),
    ).toThrow("role");
  });
  it("records actual store use above an obsolete aggregate while rejecting invalid quantities without partial events", () => {
    const state = initialState();
    state.stock["Branch 1:0006"] = 0;
    const ledgerBefore = structuredClone(state.ledger);
    const movementCount = state.stock_movements!.length;
    addNote(state, worker, {
      type: "store_use",
      text: "Actual recorded use without inventory",
      product_code: "0006",
      qty: 120,
    });
    expect(state.notes[0]).toMatchObject({
      branch: worker.branch,
      company_id: worker.company_id,
      qty: 120,
      product_code: "0006",
    });
    expect(state.stock_movements).toHaveLength(movementCount + 1);
    expect(state.stock_movements?.at(-1)).toMatchObject({
      branch: worker.branch,
      company_id: worker.company_id,
      qty: -120,
      type: "store_use",
      product_code: "0006",
    });
    expect(state.ledger).toEqual(ledgerBefore);
    const after = structuredClone(state);
    for (const qty of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        addNote(state, worker, {
          type: "store_use",
          text: "Invalid actual quantity",
          product_code: "0006",
          qty,
        }),
      ).toThrow("quantity");
      expect(state).toEqual(after);
    }
  });
  it("keeps unread Supervisor notes restricted and history remains after seen/done", () => {
    const state = initialState();
    const note = state.notes.find(
      (item) => item.type === "note_to_supervisor",
    )!;
    expect(() => updateNoteStatus(state, worker, note.id, "read")).toThrow(
      "supervisor",
    );
    expect(() =>
      updateNoteStatus(
        state,
        { ...supervisor, company_id: "another" },
        note.id,
        "resolved",
      ),
    ).toThrow("scope");
    updateNoteStatus(state, supervisor, note.id, "read");
    expect(note.status).toBe("read");
    updateNoteStatus(state, supervisor, note.id, "resolved");
    expect(state.notes).toContain(note);
  });
  it("clears one active expiry without deleting it and reset restores both seed examples", () => {
    const state = initialState();
    const expiryId = state.expiry[0].id;
    expect(() =>
      clearExpiry(state, { ...worker, branch: "Branch 2" }, expiryId),
    ).toThrow("scope");
    clearExpiry(state, worker, expiryId);
    expect(state.expiry[0].status).toBe("cleared");
    expect(state.expiry).toHaveLength(2);
    expect(
      initialState().expiry.every((item) => item.status === "active"),
    ).toBe(true);
  });
  it("clears date tracking at the corrected receiving location while preserving its original invoice assignment", () => {
    const state = initialState();
    const entry = state.expiry[0];
    const originalLocation = entry.branch;
    const invoiceId = entry.invoice_id!;
    const invoiceBefore = structuredClone(
      state.invoices!.find((invoice) => invoice.id === invoiceId),
    );
    const preview = invoiceLocationMovePreview(
      state,
      supervisor,
      invoiceId,
      "Warehouse",
    );
    movePostedInvoice(
      state,
      supervisor,
      invoiceId,
      "Warehouse",
      "Delivery belongs at Warehouse",
      preview.snapshot,
    );
    const beforeClearing = structuredClone(state);
    expect(() => clearExpiry(state, worker, entry.id)).toThrow("scope");
    expect(state).toEqual(beforeClearing);
    expect(() =>
      clearExpiry(
        state,
        { ...worker, branch: "Warehouse", company_id: "another-company" },
        entry.id,
      ),
    ).toThrow("scope");
    expect(state).toEqual(beforeClearing);
    clearExpiry(state, { ...worker, branch: "Warehouse" }, entry.id);
    expect(entry.status).toBe("cleared");
    expect(entry.branch).toBe(originalLocation);
    expect(state.invoices!.find((invoice) => invoice.id === invoiceId)).toEqual(
      invoiceBefore,
    );
    expect(state.activity[0]).toMatchObject({
      action: "expiry_cleared",
      branch: "Warehouse",
      company_id: worker.company_id,
      by: worker.actor,
      product_code: entry.product_code,
    });
  });
});
describe("supplier ledger and payment allocations", () => {
  it("reconciles gross invoice, short deduction, partial cheque payment and unpaid amount without double counting", () => {
    const state = invoiceState();
    const supplier = "Fresh Valley Foods";
    expect(ledgerSummary(state, supervisor, supplier).balance).toBe("169.79");
    const allocations = suggestAllocations(
      state,
      supervisor,
      supplier,
      "50.00",
    );
    const input = {
      supplier,
      amount: "50.00",
      date: "2026-10-06",
      cheque: "DEMO-1001",
      receipt: "DEMO-PAY-001",
      allocations,
    };
    postPayment(state, supervisor, input);
    postPayment(state, supervisor, input);
    const summary = ledgerSummary(state, supervisor, supplier);
    expect(summary.balance).toBe("119.79");
    expect(summary.invoices[0].amount).toBe("119.79");
    expect(summary.unapplied_credit).toBe("0.00");
    expect(state.ledger).toHaveLength(3);
    expect(summary.rows[2].cheque_number).toBe("DEMO-1001");
    expect(summary.rows[2].payment_date).toBe("2026-10-06");
  });
  it("preserves an overpayment as unapplied credit and totals reconcile exactly with opening/adjustment entries", () => {
    const state = invoiceState();
    const supplier = "Fresh Valley Foods";
    postLedgerAdjustment(state, supervisor, {
      supplier,
      type: "opening_balance",
      amount: "10.00",
      date: "2026-09-30",
      reference: "DEMO-OPEN",
      note: "Verified fictional opening",
    });
    postLedgerAdjustment(state, supervisor, {
      supplier,
      type: "adjustment",
      amount: "-1.25",
      date: "2026-10-06",
      reference: "DEMO-ADJ",
      note: "Documented fictional correction",
    });
    postPayment(state, supervisor, {
      supplier,
      amount: "200.00",
      date: "2026-10-06",
      cheque: "",
      receipt: "P1",
      allocations: suggestAllocations(state, supervisor, supplier, "200.00"),
    });
    const summary = ledgerSummary(state, supervisor, supplier);
    expect(summary.balance).toBe("-21.46");
    expect(summary.invoices[0].amount).toBe("0.00");
    expect(summary.unapplied_credit).toBe("30.21");
    expect(summary.unallocated_debits).toBe("8.75");
    expect(
      new Decimal(summary.invoices[0].amount)
        .plus(summary.unallocated_debits)
        .minus(summary.unapplied_credit)
        .toFixed(2),
    ).toBe(summary.balance);
  });
  it("caps editable allocations and never mixes company, branch, supplier or currency", () => {
    const state = invoiceState();
    const supplier = "Fresh Valley Foods";
    const originalCount = state.ledger.length;
    expect(() =>
      postPayment(state, worker, {
        supplier,
        amount: "50.00",
        date: "2026-10-06",
        cheque: "",
        receipt: "P1",
        allocations: [],
      }),
    ).toThrow("supervisor");
    expect(() =>
      postPayment(
        state,
        { ...supervisor, branch: "Branch 2" },
        {
          supplier,
          amount: "50.00",
          date: "2026-10-06",
          cheque: "",
          receipt: "P1",
          allocations: [{ invoice_id: state.invoice.id, amount: "50.00" }],
        },
      ),
    ).toThrow("allocation");
    expect(() =>
      postPayment(state, supervisor, {
        supplier,
        amount: "50.00",
        date: "2026-10-06",
        cheque: "",
        receipt: "P1",
        allocations: [{ invoice_id: state.invoice.id, amount: "60.00" }],
      }),
    ).toThrow("allocation");
    expect(
      ledgerSummary(state, { ...supervisor, company_id: "another" }, supplier)
        .rows,
    ).toEqual([]);
    expect(ledgerSummary(state, supervisor, "HomeWare Imports").rows).toEqual(
      [],
    );
    expect(state.ledger).toHaveLength(originalCount);
    expect(() =>
      postPayment(state, supervisor, {
        supplier,
        amount: "50.001",
        date: "2026-10-06",
        cheque: "",
        receipt: "P1",
        allocations: [],
      }),
    ).toThrow("amount");
  });
  it("exports exact decimal amounts and quoted multilingual evidence; month-end excludes later payments", () => {
    const state = invoiceState();
    const supplier = "Fresh Valley Foods";
    postPayment(state, supervisor, {
      supplier,
      amount: "50.00",
      date: "2026-11-01",
      cheque: "DEMO-1001",
      receipt: "P1",
      note: 'Demo "signed", رسید',
      allocations: suggestAllocations(state, supervisor, supplier, "50.00"),
    });
    const october = ledgerSummary(state, supervisor, supplier, "2026-10-31");
    expect(october.balance).toBe("169.79");
    const csv = ledgerCsv(ledgerSummary(state, supervisor, supplier), supplier);
    expect(csv).toContain('"-50.00"');
    expect(csv).toContain('"Demo ""signed"", رسید"');
    expect(csv).toContain('"119.79"');
    expect(csv).toContain('"CAD"');
  });
});

describe("receipt retries, cancelled claims and historical summaries", () => {
  it("does not count a signed pickup twice and blocks a reused slip with different actual quantities", () => {
    const state = initialState();
    const record = state.returns[0];
    const pickup = {
      quantities: { "0003": 1 },
      representative: "Demo Rep",
      slip: " PICKUP-001 ",
    };
    recordPickup(state, worker, record.id, pickup);
    recordPickup(state, worker, record.id, { ...pickup, slip: "PICKUP-001" });
    expect(record.lines[0].picked_up).toBe(1);
    expect((record as OperationalReturn).evidence).toHaveLength(1);
    expect(() =>
      recordPickup(state, worker, record.id, {
        ...pickup,
        quantities: { "0003": 2 },
      }),
    ).toThrow("duplicate_document");
    expect(record.lines[0].picked_up).toBe(1);
  });
  it("preserves actual replacement product, quantities, date and representative while rejecting changed duplicate receipt data", () => {
    const state = initialState();
    const record = state.returns[0] as OperationalReturn;
    const stockBefore = state.stock["Branch 1:0002"];
    const receipt = {
      product_code: "0002",
      qty: 2,
      covers: { "0003": 1 },
      date: "2026-10-06",
      representative: "Demo Rep",
      receipt: " REPLACEMENT-1 ",
    };
    receiveReplacement(state, worker, record.id, receipt);
    expect(record.evidence?.[0]).toMatchObject({
      product_code: "0002",
      actual_qty: 2,
      received_date: "2026-10-06",
      representative: "Demo Rep",
      document: "REPLACEMENT-1",
    });
    expect(() =>
      receiveReplacement(state, worker, record.id, { ...receipt, qty: 3 }),
    ).toThrow("duplicate_document");
    expect(state.stock["Branch 1:0002"]).toBe(stockBefore + 2);
  });
  it("does not resurrect a cancelled return by posting its preserved unverified claim", () => {
    const state = invoiceState();
    const record = state.returns[0] as OperationalReturn;
    submitFinancialClaim(state, worker, record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 3 },
      invoice_id: state.invoice.id,
      document: "PENDING-CREDIT",
    });
    cancelReturn(state, worker, record.id, {
      reason: "Withdraw unsettled claim",
      dispositions: { "0003": "supplier_held" },
      recovered: { "0003": 0 },
      safe: false,
    });
    const before = structuredClone(state.ledger);
    expect(() =>
      postReturnClaim(
        state,
        supervisor,
        record.id,
        record.claims![0].id,
        "5.40",
      ),
    ).toThrow("closed");
    expect(state.ledger).toEqual(before);
    expect(record.status).toBe("cancelled");
    expect(record.claims![0].status).toBe("submitted");
  });
  it("preserves a supplier return credit on an already-paid invoice as unapplied credit, without a negative invoice", () => {
    const state = invoiceState();
    const supplier = "Fresh Valley Foods";
    const record = state.returns[0] as OperationalReturn;
    postPayment(state, supervisor, {
      supplier,
      amount: "169.79",
      date: "2026-10-06",
      cheque: "DEMO-1001",
      receipt: "PAID",
      allocations: suggestAllocations(state, supervisor, supplier, "169.79"),
    });
    submitFinancialClaim(state, worker, record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 3 },
      invoice_id: state.invoice.id,
      document: "LATER-CREDIT",
    });
    postReturnClaim(state, supervisor, record.id, record.claims![0].id, "5.40");
    const summary = ledgerSummary(state, supervisor, supplier);
    expect(summary.invoices[0].amount).toBe("0.00");
    expect(summary.balance).toBe("-5.40");
    expect(summary.unapplied_credit).toBe("5.40");
    expect(record.linked_invoice).toBe(state.invoice.id);
    cancelReturn(state, worker, record.id, {
      reason: "Credit retained after reviewed closure",
      dispositions: { "0003": "supplier_held" },
      recovered: { "0003": 0 },
      safe: false,
    });
    expect(record.status).toBe("cancellation_review");
    expect(ledgerSummary(state, supervisor, supplier).balance).toBe("-5.40");
  });
  it("uses exact calendar month boundaries including leap February and excludes later financial records", () => {
    expect(monthEndDate("2026-02")).toBe("2026-02-28");
    expect(monthEndDate("2028-02")).toBe("2028-02-29");
    expect(monthEndDate("2026-10")).toBe("2026-10-31");
    expect(() => monthEndDate("2026-13")).toThrow("month");
    const state = invoiceState();
    const supplier = "Fresh Valley Foods";
    postPayment(state, supervisor, {
      supplier,
      amount: "50.00",
      date: "2026-11-01",
      cheque: "",
      receipt: "NOVEMBER",
      allocations: suggestAllocations(state, supervisor, supplier, "50.00"),
    });
    const october = ledgerSummary(
      state,
      supervisor,
      supplier,
      monthEndDate("2026-10"),
    );
    expect(october.rows).toHaveLength(2);
    expect(october.balance).toBe("169.79");
    expect(october.invoices[0].amount).toBe("169.79");
    const november = ledgerSummary(
      state,
      supervisor,
      supplier,
      monthEndDate("2026-11"),
    );
    expect(november.rows).toHaveLength(3);
    expect(november.balance).toBe("119.79");
  });
  it("records a dispute with immutable original amount, separate evidence history and Supervisor scope", () => {
    const state = invoiceState();
    const original = structuredClone(state.ledger[0]);
    expect(() =>
      markLedgerDispute(state, worker, original.id, "Not agreed"),
    ).toThrow("supervisor");
    expect(() =>
      markLedgerDispute(
        state,
        { ...supervisor, branch: "Branch 2" },
        original.id,
        "Not agreed",
      ),
    ).toThrow("scope");
    markLedgerDispute(
      state,
      supervisor,
      original.id,
      "Demo missing signed copy",
    );
    expect(state.ledger[0].amount).toBe(original.amount);
    expect(state.ledger[0].reference).toBe(original.reference);
    const summary = ledgerSummary(state, supervisor, "Fresh Valley Foods");
    expect(summary.rows[0].dispute_history?.[0]).toMatchObject({
      note: "Demo missing signed copy",
      by: supervisor.actor,
    });
    expect(ledgerCsv(summary, "Fresh Valley Foods")).toContain(
      "Demo missing signed copy",
    );
    expect(summary.balance).toBe("169.79");
  });
  it("cannot duplicate a cheque payment by adding whitespace to its preserved receipt identifier", () => {
    const state = invoiceState();
    const supplier = "Fresh Valley Foods";
    const payment = {
      supplier,
      amount: "50.00",
      date: "2026-10-06",
      cheque: "",
      receipt: " PAYMENT-001 ",
      allocations: suggestAllocations(state, supervisor, supplier, "50.00"),
    };
    postPayment(state, supervisor, payment);
    postPayment(state, supervisor, { ...payment, receipt: "PAYMENT-001" });
    expect(state.ledger.filter((item) => item.type === "payment")).toHaveLength(
      1,
    );
    expect(ledgerSummary(state, supervisor, supplier).balance).toBe("119.79");
  });
});

describe("business timezone accounting boundary", () => {
  afterEach(() => vi.useRealTimers());
  it("books an October Toronto return credit in October despite its November UTC evidence timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T02:00:00Z"));
    const state = invoiceState();
    const record = state.returns[0] as OperationalReturn;
    submitFinancialClaim(state, worker, record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 3 },
      invoice_id: state.invoice.id,
      document: "OCTOBER-CREDIT",
    });
    postReturnClaim(state, supervisor, record.id, record.claims![0].id, "5.40");
    const ledgerCredit = state.ledger.find((item) => item.type === "credit")!;
    expect(ledgerCredit.date).toBe("2026-10-31");
    expect(record.claims![0].at).toBe("2026-11-01T02:00:00.000Z");
    expect(record.evidence!.at(-1)!.at).toBe("2026-11-01T02:00:00.000Z");
    expect(
      ledgerSummary(state, supervisor, record.supplier, monthEndDate("2026-10"))
        .balance,
    ).toBe("164.39");
    expect(companyTimestamp(state.config, record.claims![0].at)).toBe(
      "2026-10-31 22:00",
    );
  });
  it("uses the configured timezone rather than assuming Toronto for every company", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T02:00:00Z"));
    const state = invoiceState();
    state.config.company.timezone = "UTC";
    const record = state.returns[0] as OperationalReturn;
    submitFinancialClaim(state, worker, record.id, {
      type: "credit_current_invoice",
      covers: { "0003": 3 },
      invoice_id: state.invoice.id,
      document: "UTC-CREDIT",
    });
    postReturnClaim(state, supervisor, record.id, record.claims![0].id, "5.40");
    expect(state.ledger.find((item) => item.type === "credit")!.date).toBe(
      "2026-11-01",
    );
    expect(
      ledgerSummary(state, supervisor, record.supplier, monthEndDate("2026-10"))
        .balance,
    ).toBe("169.79");
    expect(companyTimestamp(state.config, record.claims![0].at)).toBe(
      "2026-11-01 02:00",
    );
  });
});
