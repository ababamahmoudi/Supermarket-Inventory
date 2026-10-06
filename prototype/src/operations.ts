import Decimal from "decimal.js";
import { companyDate } from "./invoice";
import type {
  Branch,
  CompanyConfig,
  DemoState,
  LedgerEntry,
  NoteRecord,
  ReturnRecord,
  Role,
} from "./types";

export interface OperationsContext {
  company_id: string;
  branch: Branch;
  role: Role;
  actor: string;
}
export type Disposition =
  "supplier_held" | "unsafe_on_site" | "recovered_sellable";
export interface EvidenceEvent {
  id: string;
  kind: string;
  at: string;
  by: string;
  note?: string;
  document?: string;
  photo?: string;
  quantities?: Record<string, number>;
  representative?: string;
  received_date?: string;
  product_code?: string;
  actual_qty?: number;
}
export interface ReturnClaim {
  id: string;
  type:
    | "credit_current_invoice"
    | "credit_later_invoice"
    | "cash_or_other"
    | "no_compensation";
  status: "submitted" | "posted" | "disputed";
  covers: Record<string, number>;
  amount?: string;
  document?: string;
  invoice_id?: string;
  reason?: string;
  submitted_by: string;
  at: string;
  posted_by?: string;
}
export type OperationalReturn = ReturnRecord & {
  evidence?: EvidenceEvent[];
  recovered?: Record<string, number>;
  claims?: ReturnClaim[];
  cancellation_dispositions?: Record<string, Disposition>;
  previous_status?: ReturnRecord["status"];
  terms_version?: string;
};
export interface Allocation {
  invoice_id: string;
  amount: string;
}
export type OperationalLedger = LedgerEntry & {
  allocations?: Allocation[];
  payment_date?: string;
  posted_by?: string;
  disputed?: boolean;
  dispute_note?: string;
  dispute_history?: EvidenceEvent[];
  due_date?: string;
};
export interface InvoiceOutstanding {
  invoice_id: string;
  reference: string;
  amount: string;
  date: string;
  due_date?: string;
  branch: Branch;
}
export interface LedgerSummary {
  balance: string;
  invoices: InvoiceOutstanding[];
  unapplied_credit: string;
  unallocated_debits: string;
  rows: OperationalLedger[];
}
export class OperationError extends Error {
  constructor(public key: string) {
    super(key);
    this.name = "OperationError";
  }
}
function fail(key: string): never {
  throw new OperationError(key);
}
const id = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();
export const decimalAmount = (value: string) => {
  try {
    const amount = new Decimal(value);
    if (!amount.isFinite()) fail("amount");
    return amount;
  } catch {
    return fail("amount");
  }
};
const exactMoney = (value: string) => {
  const amount = decimalAmount(value);
  if (!amount.eq(amount.toDecimalPlaces(2))) fail("amount");
  return amount.toFixed(2);
};
const quantity = (value: number, allowZero = false) => {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1))
    fail("quantity");
  return value;
};
const canOperate = (context: OperationsContext) => {
  if (context.role === "cashier") fail("role");
  if (context.branch === "all") fail("branch");
};
const supervisor = (context: OperationsContext) => {
  canOperate(context);
  if (context.role !== "supervisor") fail("supervisor");
};
const belongs = (
  record: { company_id: string; branch: Branch },
  context: OperationsContext,
) =>
  record.company_id === context.company_id &&
  (context.branch === "all" || record.branch === context.branch);
function getReturn(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
): OperationalReturn {
  canOperate(context);
  const record = state.returns.find(
    (item) => item.id === returnId && belongs(item, context),
  ) as OperationalReturn | undefined;
  if (!record) fail("scope");
  // Seed replacement evidence is an existing receipt, never receive it again.
  if (record.replacement_received && record.lines.length === 1) {
    record.lines[0].settled ??= record.replacement_received.covers_original_qty;
    record.lines[0].picked_up ??= record.lines[0].qty;
  }
  return record;
}
function audit(
  state: DemoState,
  context: OperationsContext,
  action: string,
  product_code?: string,
) {
  state.activity.unshift({
    id: id("activity"),
    company_id: context.company_id,
    branch: context.branch,
    action,
    by: context.actor,
    at: now(),
    product_code,
  });
}
export interface PhysicalStockMovement {
  id: string;
  company_id: string;
  branch: Branch;
  product_code: string;
  qty: number;
  type: string;
  reference: string;
  by: string;
  at: string;
}
function stock(
  state: DemoState,
  context: OperationsContext,
  product: string,
  delta: number,
  type: string,
  reference: string,
) {
  if (
    !state.products.some(
      (item) => item.company_id === context.company_id && item.code === product,
    )
  )
    fail("product");
  const key = `${context.branch}:${product}`;
  const next = (state.stock[key] ?? 0) + delta;
  if (!Number.isSafeInteger(next) || next < 0) fail("stock");
  state.stock[key] = next;
  const physicalState = state as DemoState & {
    stock_movements?: PhysicalStockMovement[];
  };
  (physicalState.stock_movements ??= []).push({
    id: id("movement"),
    company_id: context.company_id,
    branch: context.branch,
    product_code: product,
    qty: delta,
    type,
    reference,
    by: context.actor,
    at: now(),
  });
}
function history(
  record: OperationalReturn,
  context: OperationsContext,
  event: Omit<EvidenceEvent, "id" | "at" | "by">,
) {
  (record.evidence ??= []).push({
    id: id("evidence"),
    at: now(),
    by: context.actor,
    ...event,
  });
}
function settled(line: ReturnRecord["lines"][number]) {
  return line.settled ?? line.replaced ?? 0;
}
function validateCoverage(
  record: OperationalReturn,
  covers: Record<string, number>,
  includePending = true,
) {
  let total = 0;
  for (const [code, count] of Object.entries(covers)) {
    quantity(count, true);
    const line = record.lines.find((item) => item.product_code === code);
    if (!line) fail("product");
    const pending = includePending
      ? (record.claims ?? [])
          .filter((claim) => claim.status === "submitted")
          .reduce((sum, claim) => sum + (claim.covers[code] ?? 0), 0)
      : 0;
    if (count + settled(line) + pending > line.qty) fail("coverage");
    total += count;
  }
  if (total === 0) fail("quantity");
}
function applyCoverage(
  record: OperationalReturn,
  covers: Record<string, number>,
) {
  for (const line of record.lines)
    line.settled = settled(line) + (covers[line.product_code] ?? 0);
  record.status = record.lines.every((line) => settled(line) >= line.qty)
    ? "resolved"
    : "partially_resolved";
}
export function recordPickup(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  input: {
    quantities: Record<string, number>;
    representative: string;
    slip: string;
    photo?: string;
    note?: string;
  },
) {
  const record = getReturn(state, context, returnId);
  if (record.status === "cancelled" || record.status === "cancellation_review")
    fail("closed");
  if (!input.representative.trim() || !input.slip.trim())
    fail("pickup_evidence");
  const existingPickup = record.evidence?.find(
    (event) => event.kind === "pickup" && event.document === input.slip.trim(),
  );
  if (existingPickup) {
    const sameQuantities = record.lines.every(
      (line) =>
        (existingPickup.quantities?.[line.product_code] ?? 0) ===
        (input.quantities[line.product_code] ?? 0),
    );
    if (
      !sameQuantities ||
      existingPickup.representative !== input.representative.trim()
    )
      fail("duplicate_document");
    return;
  }
  let total = 0;
  for (const line of record.lines) {
    const count = quantity(input.quantities[line.product_code] ?? 0, true);
    if (
      count +
        (line.picked_up ?? 0) +
        (record.recovered?.[line.product_code] ?? 0) >
      line.qty
    )
      fail("pickup_cap");
    total += count;
  }
  if (total === 0) fail("quantity");
  for (const line of record.lines)
    line.picked_up =
      (line.picked_up ?? 0) + (input.quantities[line.product_code] ?? 0);
  record.supplier_rep_name = input.representative.trim();
  record.signed_pickup_slip_reference = input.slip.trim();
  if (record.status === "open") record.status = "picked_up";
  history(record, context, {
    kind: "pickup",
    document: input.slip.trim(),
    representative: input.representative.trim(),
    photo: input.photo,
    note: input.note,
    quantities: input.quantities,
  });
  audit(state, context, "return_pickup");
}
export function receiveReplacement(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  input: {
    product_code: string;
    qty: number;
    covers: Record<string, number>;
    date: string;
    representative: string;
    note?: string;
    photo?: string;
    receipt: string;
    fully?: boolean;
  },
) {
  const record = getReturn(state, context, returnId);
  if (record.status === "cancelled" || record.status === "cancellation_review")
    fail("closed");
  const existingReplacement = record.evidence?.find(
    (event) =>
      event.kind === "replacement" && event.document === input.receipt.trim(),
  );
  if (existingReplacement) {
    const sameCoverage = record.lines.every(
      (line) =>
        (existingReplacement.quantities?.[line.product_code] ?? 0) ===
        (input.covers[line.product_code] ?? 0),
    );
    if (
      existingReplacement.product_code !== input.product_code ||
      existingReplacement.actual_qty !== input.qty ||
      !sameCoverage
    )
      fail("duplicate_document");
    return;
  }
  quantity(input.qty);
  if (!input.date || !input.representative.trim() || !input.receipt.trim())
    fail("replacement_evidence");
  validateCoverage(record, input.covers);
  if (
    input.fully &&
    record.lines.some(
      (line) =>
        settled(line) + (input.covers[line.product_code] ?? 0) !== line.qty,
    )
  )
    fail("coverage");
  stock(
    state,
    context,
    input.product_code,
    input.qty,
    "replacement_received",
    input.receipt,
  );
  applyCoverage(record, input.covers);
  record.resolution = "replacement_received";
  record.replacement_received = {
    product_code: input.product_code,
    qty: input.qty,
    covers_original_qty: Object.values(input.covers).reduce(
      (sum, value) => sum + value,
      0,
    ),
  };
  history(record, context, {
    kind: "replacement",
    document: input.receipt.trim(),
    representative: input.representative.trim(),
    received_date: input.date,
    product_code: input.product_code,
    actual_qty: input.qty,
    photo: input.photo,
    note: `${input.date} | ${input.representative} | ${input.product_code} × ${input.qty}${input.note ? ` | ${input.note}` : ""}`,
    quantities: input.covers,
  });
  audit(state, context, "replacement_received", input.product_code);
}
export function submitFinancialClaim(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  input: Omit<ReturnClaim, "id" | "status" | "submitted_by" | "at">,
) {
  const record = getReturn(state, context, returnId);
  if (record.status === "cancelled" || record.status === "cancellation_review")
    fail("closed");
  if (input.type === "no_compensation") {
    supervisor(context);
    if (!input.reason?.trim()) fail("reason");
  } else if (!input.document?.trim()) fail("credit_document");
  if (input.amount !== undefined && decimalAmount(input.amount).lte(0))
    fail("amount");
  if (input.amount !== undefined) exactMoney(input.amount);
  const credit =
    input.type === "credit_current_invoice" ||
    input.type === "credit_later_invoice";
  if (credit) {
    if (
      !input.invoice_id ||
      !state.ledger.some(
        (entry) =>
          belongs(entry, context) &&
          entry.supplier === record.supplier &&
          entry.type === "invoice" &&
          entry.invoice_id === input.invoice_id,
      )
    )
      fail("invoice");
    if (record.linked_invoice && record.linked_invoice !== input.invoice_id)
      fail("single_invoice");
    if (
      (record.claims ?? []).some(
        (claim) =>
          claim.type.startsWith("credit_") && claim.status !== "disputed",
      )
    )
      fail("single_credit");
  }
  if (
    input.document &&
    (state.returns as OperationalReturn[]).some(
      (item) =>
        item.company_id === context.company_id &&
        item.supplier === record.supplier &&
        (item.claims ?? []).some(
          (claim) => claim.document?.trim() === input.document?.trim(),
        ),
    )
  )
    fail("duplicate_document");
  validateCoverage(record, input.covers);
  (record.claims ??= []).push({
    ...input,
    id: id("claim"),
    status: "submitted",
    submitted_by: context.actor,
    at: now(),
  });
  record.status = "claim_pending";
  history(record, context, {
    kind: "claim",
    document: input.document,
    note: input.reason,
    quantities: input.covers,
  });
  audit(state, context, "return_claim_submitted");
}
export function postReturnClaim(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  claimId: string,
  amountInput?: string,
) {
  supervisor(context);
  const record = getReturn(state, context, returnId);
  const claim = record.claims?.find((item) => item.id === claimId);
  if (!claim) fail("claim");
  if (claim.status === "posted") return;
  if (record.status === "cancelled" || record.status === "cancellation_review")
    fail("closed");
  if (claim.status !== "submitted") fail("claim");
  validateCoverage(record, claim.covers, false);
  if (claim.type !== "no_compensation") {
    if (!claim.document?.trim()) fail("credit_document");
    const amount = exactMoney(amountInput ?? claim.amount ?? "0");
    if (decimalAmount(amount).lte(0)) fail("amount");
    const credit = claim.type.startsWith("credit_");
    if (
      credit &&
      record.linked_invoice &&
      record.linked_invoice !== claim.invoice_id
    )
      fail("single_invoice");
    if (
      state.ledger.some(
        (entry) =>
          entry.company_id === context.company_id &&
          entry.supplier === record.supplier &&
          entry.reference === claim.document &&
          entry.type === "credit",
      )
    )
      fail("duplicate_document");
    let allocations: Allocation[] = [];
    if (credit) {
      const invoice = ledgerSummary(
        state,
        context,
        record.supplier,
      ).invoices.find(
        (item) =>
          item.invoice_id === claim.invoice_id &&
          item.branch === context.branch,
      );
      if (!invoice) fail("invoice");
      const allocated = Decimal.min(amount, Decimal.max("0", invoice.amount));
      if (allocated.gt(0))
        allocations = [
          { invoice_id: claim.invoice_id!, amount: allocated.toFixed(2) },
        ];
      validateAllocations(state, context, record.supplier, amount, allocations);
    }
    state.ledger.push({
      id: `return-credit-${claim.id}`,
      company_id: context.company_id,
      branch: context.branch,
      supplier: record.supplier,
      type: "credit",
      amount: decimalAmount(amount).negated().toFixed(2),
      date: companyDate(state.config),
      reference: claim.document.trim(),
      invoice_id: credit ? claim.invoice_id : undefined,
      currency: state.config.company.currency,
      allocations,
      posted_by: context.actor,
    } as OperationalLedger);
    claim.amount = amount;
    record.compensation_amount = amount;
    record.credit_document = claim.document;
    if (credit) record.linked_invoice = claim.invoice_id;
  }
  claim.status = "posted";
  claim.posted_by = context.actor;
  applyCoverage(record, claim.covers);
  history(record, context, {
    kind: "claim_posted",
    document: claim.document,
    quantities: claim.covers,
  });
  audit(state, context, "return_claim_posted");
}
export function cancelReturn(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  input: {
    reason: string;
    dispositions: Record<string, Disposition>;
    recovered: Record<string, number>;
    safe: boolean;
  },
) {
  const record = getReturn(state, context, returnId);
  if (record.status === "cancelled" || record.status === "cancellation_review")
    fail("closed");
  if (!input.reason.trim()) fail("reason");
  let recoveredTotal = 0;
  for (const line of record.lines) {
    if (!input.dispositions[line.product_code]) fail("disposition");
    const count = quantity(input.recovered[line.product_code] ?? 0, true);
    if (
      count > 0 &&
      (input.dispositions[line.product_code] !== "recovered_sellable" ||
        !input.safe)
    )
      fail("safe");
    if (count + (record.recovered?.[line.product_code] ?? 0) > line.qty)
      fail("recovery_cap");
    recoveredTotal += count;
  }
  // A physical recovery is explicit and separate from paperwork cancellation.
  for (const line of record.lines) {
    const count = input.recovered[line.product_code] ?? 0;
    if (count > 0) {
      stock(
        state,
        context,
        line.product_code,
        count,
        "return_original_recovered",
        record.id,
      );
      (record.recovered ??= {})[line.product_code] =
        (record.recovered?.[line.product_code] ?? 0) + count;
    }
  }
  if (recoveredTotal > 0) {
    history(record, context, {
      kind: "original_recovery",
      note: "Physically received and confirmed safe/sellable",
      quantities: input.recovered,
    });
    audit(state, context, "return_original_recovered");
  }
  record.original_units_recovered += recoveredTotal;
  record.cancellation_reason = input.reason.trim();
  record.cancellation_dispositions = input.dispositions;
  const existingSettlement =
    record.lines.some((line) => settled(line) > 0) ||
    !!record.replacement_received ||
    record.claims?.some((claim) => claim.status === "posted");
  record.previous_status = record.status;
  record.status = existingSettlement ? "cancellation_review" : "cancelled";
  history(record, context, {
    kind: "cancellation_requested",
    note: input.reason,
    quantities: input.recovered,
  });
  audit(
    state,
    context,
    existingSettlement ? "return_cancellation_review" : "return_cancelled",
  );
}
export function reviewCancellation(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  input: { accept: boolean; settlement_retained: boolean; note: string },
) {
  supervisor(context);
  const record = getReturn(state, context, returnId);
  if (record.status !== "cancellation_review") fail("review");
  if (!input.note.trim() || (input.accept && !input.settlement_retained))
    fail("settlement_review");
  record.status = input.accept
    ? "cancelled"
    : (record.previous_status ?? "partially_resolved");
  history(record, context, {
    kind: input.accept
      ? "cancellation_approved_retained_settlement"
      : "cancellation_declined",
    note: input.note,
  });
  audit(
    state,
    context,
    input.accept
      ? "return_cancellation_approved"
      : "return_cancellation_declined",
  );
}
export function addNote(
  state: DemoState,
  context: OperationsContext,
  input: {
    type: NoteRecord["type"];
    text: string;
    product_code?: string;
    qty?: number;
  },
) {
  canOperate(context);
  if (!input.text.trim()) fail("text");
  if (
    input.product_code &&
    !state.products.some(
      (item) =>
        item.company_id === context.company_id &&
        item.code === input.product_code,
    )
  )
    fail("product");
  if (input.qty !== undefined) quantity(input.qty);
  if (input.type === "store_use") {
    if (!input.product_code || input.qty === undefined) fail("store_use");
    stock(
      state,
      context,
      input.product_code,
      -input.qty,
      "store_use",
      input.text.trim(),
    );
  }
  state.notes.unshift({
    ...input,
    text: input.text.trim(),
    id: id("note"),
    company_id: context.company_id,
    branch: context.branch,
    status: "open",
    by: context.actor,
    created_at: now(),
  });
  audit(
    state,
    context,
    input.type === "store_use" ? "store_use_recorded" : "note_added",
    input.product_code,
  );
}
export function updateNoteStatus(
  state: DemoState,
  context: OperationsContext,
  noteId: string,
  status: NoteRecord["status"],
) {
  canOperate(context);
  const note = state.notes.find(
    (item) => item.id === noteId && belongs(item, context),
  );
  if (!note) fail("scope");
  if (note.type === "note_to_supervisor" && context.role !== "supervisor")
    fail("supervisor");
  note.status = status;
  const recordedNote = note as NoteRecord & {
    seen_by?: string;
    seen_at?: string;
    done_by?: string;
    done_at?: string;
  };
  if (status === "read") {
    recordedNote.seen_by = context.actor;
    recordedNote.seen_at = now();
  }
  if (status === "resolved") {
    recordedNote.done_by = context.actor;
    recordedNote.done_at = now();
  }
  audit(
    state,
    context,
    status === "read" ? "note_seen" : "note_resolved",
    note.product_code,
  );
}
export function clearExpiry(
  state: DemoState,
  context: OperationsContext,
  expiryId: string,
) {
  canOperate(context);
  const entry = state.expiry.find(
    (item) => item.id === expiryId && belongs(item, context),
  );
  if (!entry) fail("scope");
  entry.status = "cleared";
  audit(state, context, "expiry_cleared", entry.product_code);
}
/** Keep evidence in UTC; show its timestamp in the configured business timezone. */
export function companyTimestamp(
  config: CompanyConfig,
  timestamp: string,
): string {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.company.timezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const part = (key: string) =>
    parts.find((item) => item.type === key)?.value ?? "";
  return `${companyDate(config, date)} ${part("hour")}:${part("minute")}`;
}

export function monthEndDate(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail("month");
  const year = Number(month.slice(0, 4));
  if (year < 1000) fail("month");
  return new Date(Date.UTC(year, Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
}

export function ledgerSummary(
  state: DemoState,
  context: OperationsContext,
  supplier: string,
  throughDate?: string,
): LedgerSummary {
  if (context.role !== "supervisor") fail("supervisor");
  const rows = (state.ledger as OperationalLedger[]).filter(
    (row) =>
      belongs(row, context) &&
      row.supplier === supplier &&
      row.currency === state.config.company.currency &&
      (!throughDate || row.date <= throughDate),
  );
  const invoices: InvoiceOutstanding[] = [];
  let unallocated = new Decimal(0);
  let unallocatedDebits = new Decimal(0);
  for (const row of rows) {
    if (row.type === "invoice") {
      const invoiceId = row.invoice_id ?? row.id;
      if (!invoices.some((invoice) => invoice.invoice_id === invoiceId)) {
        const invoice =
          state.invoices?.find(
            (item) =>
              item.id === invoiceId && item.company_id === context.company_id,
          ) ?? (state.invoice.id === invoiceId ? state.invoice : undefined);
        invoices.push({
          invoice_id: invoiceId,
          reference: row.reference,
          amount: "0.00",
          date: row.date,
          due_date: row.due_date ?? invoice?.due_date,
          branch: row.branch,
        });
      }
    }
  }
  for (const row of rows) {
    const amount = decimalAmount(row.amount);
    const financial = row.type === "payment" || row.type === "credit";
    if (financial) {
      let allocated = new Decimal(0);
      for (const allocation of row.allocations ?? []) {
        const invoice = invoices.find(
          (item) =>
            item.invoice_id === allocation.invoice_id &&
            item.branch === row.branch,
        );
        if (invoice) {
          invoice.amount = decimalAmount(invoice.amount)
            .minus(allocation.amount)
            .toFixed(2);
          allocated = allocated.plus(allocation.amount);
        }
      }
      unallocated = unallocated.plus(amount.negated().minus(allocated));
    } else {
      const invoice = invoices.find(
        (item) =>
          item.invoice_id ===
            (row.invoice_id ?? (row.type === "invoice" ? row.id : "")) &&
          item.branch === row.branch,
      );
      if (invoice)
        invoice.amount = decimalAmount(invoice.amount).plus(amount).toFixed(2);
      else unallocatedDebits = unallocatedDebits.plus(amount);
    }
  }
  invoices.sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.date.localeCompare(b.date) ||
      a.invoice_id.localeCompare(b.invoice_id),
  );
  return {
    balance: rows
      .reduce((sum, row) => sum.plus(row.amount), new Decimal(0))
      .toFixed(2),
    invoices,
    unapplied_credit: unallocated.toFixed(2),
    unallocated_debits: unallocatedDebits.toFixed(2),
    rows,
  };
}
export function suggestAllocations(
  state: DemoState,
  context: OperationsContext,
  supplier: string,
  amountInput: string,
): Allocation[] {
  let remaining = decimalAmount(exactMoney(amountInput));
  if (remaining.lte(0)) fail("amount");
  return ledgerSummary(state, context, supplier).invoices.flatMap((invoice) => {
    const amount = Decimal.min(remaining, Decimal.max(0, invoice.amount));
    remaining = remaining.minus(amount);
    return amount.gt(0)
      ? [{ invoice_id: invoice.invoice_id, amount: amount.toFixed(2) }]
      : [];
  });
}
function validateAllocations(
  state: DemoState,
  context: OperationsContext,
  supplier: string,
  amountInput: string,
  allocations: Allocation[],
) {
  const summary = ledgerSummary(
    state,
    { ...context, role: "supervisor" },
    supplier,
  );
  const keys = new Set<string>();
  let allocated = new Decimal(0);
  for (const allocation of allocations) {
    if (keys.has(allocation.invoice_id)) fail("allocation");
    keys.add(allocation.invoice_id);
    const invoice = summary.invoices.find(
      (item) =>
        item.invoice_id === allocation.invoice_id &&
        item.branch === context.branch,
    );
    const amount = decimalAmount(exactMoney(allocation.amount));
    if (!invoice || amount.lt(0) || amount.gt(invoice.amount))
      fail("allocation");
    allocated = allocated.plus(amount);
  }
  if (allocated.gt(amountInput)) fail("allocation");
}
export function postPayment(
  state: DemoState,
  context: OperationsContext,
  input: {
    supplier: string;
    amount: string;
    date: string;
    cheque: string;
    note?: string;
    allocations: Allocation[];
    receipt: string;
  },
) {
  supervisor(context);
  if (
    state.ledger.some(
      (row) =>
        belongs(row, context) &&
        row.supplier === input.supplier &&
        row.type === "payment" &&
        row.reference === input.receipt.trim(),
    )
  )
    return;
  const amount = exactMoney(input.amount);
  if (decimalAmount(amount).lte(0)) fail("amount");
  if (!input.date || !input.receipt.trim()) fail("payment_evidence");
  validateAllocations(
    state,
    context,
    input.supplier,
    amount,
    input.allocations,
  );
  state.ledger.push({
    id: id("payment"),
    company_id: context.company_id,
    branch: context.branch,
    supplier: input.supplier,
    type: "payment",
    amount: decimalAmount(amount).negated().toFixed(2),
    date: input.date,
    payment_date: input.date,
    reference: input.receipt.trim(),
    cheque_number: input.cheque.trim(),
    currency: state.config.company.currency,
    note: input.note,
    allocations: input.allocations,
    posted_by: context.actor,
  } as OperationalLedger);
  audit(state, context, "payment_recorded");
}
export function postLedgerAdjustment(
  state: DemoState,
  context: OperationsContext,
  input: {
    supplier: string;
    type: "opening_balance" | "adjustment" | "credit";
    amount: string;
    date: string;
    reference: string;
    note: string;
  },
) {
  supervisor(context);
  const amount = exactMoney(input.amount);
  if (
    !input.note.trim() ||
    !input.reference.trim() ||
    !input.date ||
    decimalAmount(amount).isZero()
  )
    fail("adjustment_evidence");
  if (input.type === "credit" && decimalAmount(amount).gte(0))
    fail("credit_sign");
  if (
    input.type === "opening_balance" &&
    state.ledger.some(
      (row) =>
        belongs(row, context) &&
        row.supplier === input.supplier &&
        row.type === "opening_balance",
    )
  )
    fail("opening_exists");
  if (
    state.ledger.some(
      (row) =>
        belongs(row, context) &&
        row.supplier === input.supplier &&
        row.reference === input.reference.trim() &&
        row.type === input.type,
    )
  )
    fail("duplicate_document");
  state.ledger.push({
    id: id(input.type),
    company_id: context.company_id,
    branch: context.branch,
    supplier: input.supplier,
    type: input.type,
    amount,
    date: input.date,
    reference: input.reference.trim(),
    currency: state.config.company.currency,
    note: input.note,
    posted_by: context.actor,
  } as OperationalLedger);
  audit(state, context, "ledger_adjustment_recorded");
}
export function markLedgerDispute(
  state: DemoState,
  context: OperationsContext,
  ledgerId: string,
  note: string,
) {
  supervisor(context);
  const row = state.ledger.find(
    (item) => item.id === ledgerId && belongs(item, context),
  ) as OperationalLedger | undefined;
  if (!row) fail("scope");
  if (!note.trim()) fail("reason");
  row.disputed = true;
  row.dispute_note = note.trim();
  (row.dispute_history ??= []).push({
    id: id("dispute"),
    kind: "dispute_recorded",
    by: context.actor,
    at: now(),
    note: note.trim(),
  });
  audit(state, context, "supplier_dispute_recorded");
}

export function ledgerCsv(summary: LedgerSummary, supplier: string) {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    [
      "Supplier",
      "Branch",
      "Date",
      "Type",
      "Reference",
      "Currency",
      "Amount",
      "Cheque",
      "Note",
    ],
    ...summary.rows.map((row) => [
      supplier,
      row.branch,
      row.date,
      row.type,
      row.reference,
      row.currency,
      row.amount,
      row.cheque_number ?? "",
      [row.note, row.dispute_note].filter(Boolean).join(" | "),
    ]),
    ["Balance", "", "", "", "", "", summary.balance, "", ""],
  ];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
export function scopedRecords<T extends { company_id: string; branch: Branch }>(
  records: T[],
  context: OperationsContext,
) {
  return records.filter((record) => belongs(record, context));
}
export function operationError(
  key: string,
  t: (en: string, fa: string) => string,
) {
  const messages: Record<string, [string, string]> = {
    month: [
      "Choose a valid month for the month-end summary.",
      "برای خلاصه پایان ماه، یک ماه معتبر انتخاب کنید.",
    ],
    opening_exists: [
      "An opening balance is already recorded. Use a documented adjustment instead.",
      "مانده افتتاحیه قبلاً ثبت شده است. به‌جای آن تعدیل مستند ثبت کنید.",
    ],
    role: [
      "Cashiers can only use price lookup.",
      "صندوق‌دار فقط می‌تواند قیمت را جستجو کند.",
    ],
    supervisor: [
      "Ask a Supervisor to verify and post this action.",
      "برای تأیید و ثبت این کار از سرپرست کمک بگیرید.",
    ],
    branch: [
      "Choose one branch before recording this action.",
      "پیش از ثبت، یک شعبه انتخاب کنید.",
    ],
    scope: [
      "Choose a record in your company and branch.",
      "یک رکورد از شرکت و شعبه خود انتخاب کنید.",
    ],
    amount: [
      "Enter a valid amount with no more than two decimal places.",
      "مبلغ معتبر با حداکثر دو رقم اعشار وارد کنید.",
    ],
    quantity: [
      "Enter a positive whole quantity; use zero only for goods not received.",
      "تعداد صحیح مثبت وارد کنید؛ برای کالای دریافت‌نشده صفر وارد کنید.",
    ],
    product: [
      "Choose a product from this company.",
      "یک محصول از همین شرکت انتخاب کنید.",
    ],
    stock: [
      "The quantity exceeds estimated sellable stock. Check the stock first.",
      "تعداد از موجودی قابل‌فروش بیشتر است. ابتدا موجودی را بررسی کنید.",
    ],
    pickup_evidence: [
      "Add the representative name and signed slip reference before handing over goods.",
      "پیش از تحویل کالا، نام نماینده و مرجع رسید امضاشده را وارد کنید.",
    ],
    pickup_cap: [
      "Pickup quantity exceeds the original units still awaiting pickup.",
      "تعداد جمع‌آوری از تعداد اصلی منتظر جمع‌آوری بیشتر است.",
    ],
    coverage: [
      "Covered original quantities exceed the unsettled return. Check each line.",
      "تعداد اصلی پوشش‌داده‌شده از مرجوعی حل‌نشده بیشتر است. هر ردیف را بررسی کنید.",
    ],
    replacement_evidence: [
      "Add actual quantity, date, representative, and replacement receipt reference.",
      "تعداد واقعی، تاریخ، نماینده و مرجع رسید جایگزین را وارد کنید.",
    ],
    closed: [
      "This return is closed or awaiting cancellation review.",
      "این مرجوعی بسته است یا منتظر بررسی لغو است.",
    ],
    credit_document: [
      "Add a fictional supplier credit document reference.",
      "مرجع ساختگی سند بستانکاری تأمین‌کننده را وارد کنید.",
    ],
    invoice: [
      "Choose a posted invoice for this supplier in this branch.",
      "فاکتور ثبت‌شده این تأمین‌کننده در این شعبه را انتخاب کنید.",
    ],
    single_invoice: [
      "A return can link to one credit invoice only.",
      "هر مرجوعی فقط به یک فاکتور بستانکاری متصل می‌شود.",
    ],
    single_credit: [
      "This return already has a credit claim. Review the existing claim.",
      "این مرجوعی قبلاً ادعای بستانکاری دارد. همان ادعا را بررسی کنید.",
    ],
    duplicate_document: [
      "This document was already recorded. Use the existing record.",
      "این سند قبلاً ثبت شده است. از رکورد موجود استفاده کنید.",
    ],
    reason: [
      "Add a reason so the history explains your decision.",
      "برای توضیح تصمیم در سابقه، دلیل وارد کنید.",
    ],
    disposition: [
      "Choose the actual location and condition for every original line.",
      "برای هر ردیف اصلی، محل و وضعیت واقعی را انتخاب کنید.",
    ],
    safe: [
      "Only physically recovered originals confirmed safe and sellable can return to stock.",
      "فقط اصل کالای بازیابی‌شده و تأییدشده سالم و قابل‌فروش به موجودی بازمی‌گردد.",
    ],
    recovery_cap: [
      "Recovery exceeds the original quantity not yet restored.",
      "بازیابی از تعداد اصلی که هنوز بازگردانده نشده بیشتر است.",
    ],
    settlement_review: [
      "Describe the settlement review and confirm existing compensation is retained.",
      "بررسی تسویه را توضیح دهید و نگهداری جبران قبلی را تأیید کنید.",
    ],
    review: [
      "Choose a return awaiting Supervisor cancellation review.",
      "مرجوعی منتظر بررسی لغو سرپرست را انتخاب کنید.",
    ],
    text: [
      "Add a short note before saving.",
      "پیش از ذخیره، یک یادداشت کوتاه وارد کنید.",
    ],
    store_use: [
      "Store use needs a product and actual quantity to deduct stock.",
      "مصرف فروشگاه برای کاهش موجودی به محصول و تعداد واقعی نیاز دارد.",
    ],
    allocation: [
      "Allocated amounts must fit each open invoice and the payment total.",
      "مبلغ تخصیص باید در مبلغ باز هر فاکتور و کل پرداخت جا بگیرد.",
    ],
    payment_evidence: [
      "Add a payment date and fictional receipt reference.",
      "تاریخ پرداخت و مرجع ساختگی رسید را وارد کنید.",
    ],
    adjustment_evidence: [
      "Add a non-zero amount, date, reference, and reason.",
      "مبلغ غیرصفر، تاریخ، مرجع و دلیل وارد کنید.",
    ],
    credit_sign: [
      "Enter a negative amount for a supplier credit.",
      "برای بستانکاری تأمین‌کننده مبلغ منفی وارد کنید.",
    ],
    claim: [
      "Choose a submitted claim that has not already been posted.",
      "ادعای ارسال‌شده و ثبت‌نشده را انتخاب کنید.",
    ],
  };
  const message = messages[key] ?? [
    "Check the form and try again.",
    "فرم را بررسی کنید و دوباره تلاش کنید.",
  ];
  return t(...message);
}
