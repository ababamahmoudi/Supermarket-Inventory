import {
  returnPhotoReference,
  type ReturnPhotoAttachment,
} from "./return-file-access";
import {
  returnPickupValuationEvidence,
  closePurchaseEvidence,
} from "./purchase-evidence.internal";
import type { AuthenticatedActor, Capability } from "./authority-types";
import { freshActor } from "./authority";
import { can, requireCapability, requireConcreteLocation } from "./permissions";
import {
  actorAudit,
  domainScope,
  guardDomain,
  selectedLocations,
} from "./domain-authority";
import Decimal from "decimal.js";
import {
  signedReturnPickupQuantities,
  retainedReturnSettlementEvidence,
} from "./signed-return-pickups";
import { companyDate } from "./invoice";
import { configuredBranches } from "./settings";
import { configSeed } from "./config";
import { configuredRoleLabel } from "./role-config";
import { appendSeenReceipt, recordNoteCompletion } from "./note-engagement";
import {
  notifyBuiltinNote,
  markLinkedNoteNotificationsRead,
} from "./note-notifications";
import { projectExpiryLocation } from "./received";
import {
  createReturnMemo,
  syncReturnCreditAlertsForReturn,
} from "./return-workflow";
import type {
  Branch,
  CompanyConfig,
  DemoState,
  LedgerEntry,
  NoteRecord,
  ReturnRecord,
} from "./types";

export type OperationsContext = AuthenticatedActor;
export type Disposition =
  "supplier_held" | "unsafe_on_site" | "recovered_sellable";
export interface EvidenceEvent {
  id: string;
  kind: string;
  at: string;
  by: string;
  actor_user_id?: string;
  actor_role_snapshot?: AuthenticatedActor["role"];
  actor_username?: string;
  device_id?: string;
  note?: string;
  document?: string;
  photo?: string;
  quantities?: Record<string, number>;
  representative?: string;
  received_date?: string;
  product_code?: string;
  actual_qty?: number;
  invoice_id?: string;
  shortfalls?: Record<
    string,
    {
      reason: string;
      outcome: "keep_for_next_pickup" | "put_back_on_shelf" | "throw_away";
      quantity: number;
    }
  >;
  corrects_event_id?: string;
  before_quantities?: Record<string, number>;
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
  submitted_by_user_id?: string;
  submitted_by_role_snapshot?: AuthenticatedActor["role"];
  posted_by_user_id?: string;
  posted_by_role_snapshot?: AuthenticatedActor["role"];
  at: string;
  posted_by?: string;
  item_amounts?: Record<string, string>;
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
function returnQuantity(
  state: DemoState,
  line: ReturnRecord["lines"][number],
  value: number,
  allowZero = false,
) {
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.code === line.product_code,
  );
  if (!product) fail("product");
  const weighted =
    line.quantity_unit === "lb" ||
    (!line.quantity_unit && product.sold_by === "weight");
  if (!weighted) return quantity(value, allowZero);
  const amount = new Decimal(value);
  if (
    !amount.isFinite() ||
    amount.lt(0) ||
    (!allowZero && amount.eq(0)) ||
    !amount.eq(amount.toDecimalPlaces(3)) ||
    amount.gt(Number.MAX_SAFE_INTEGER)
  )
    fail("weight_quantity");
  return amount.toNumber();
}
function operationGuard(
  state: DemoState,
  context: OperationsContext,
  capability: Capability,
  record?: {
    company_id: string;
    branch?: string;
    id?: string;
    status?: string;
  },
  mutation = false,
) {
  try {
    return guardDomain(state, context, capability, record, mutation);
  } catch {
    return fail("scope");
  }
}
const belongs = (
  record: { company_id: string; branch: Branch },
  context: OperationsContext,
) =>
  record.company_id === context.company_id &&
  (context.branch === "all"
    ? context.allowed_branches.includes(record.branch)
    : record.branch === context.branch);
function getReturn(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
): OperationalReturn {
  try {
    freshActor(state, context);
  } catch {
    fail("scope");
  }
  const records = state.returns.filter(
    (item) =>
      item.id === returnId &&
      item.company_id === state.config.company.seed_key &&
      belongs(item, context),
  );
  if (records.length !== 1) fail("scope");
  const record = records[0] as OperationalReturn;
  operationGuard(state, context, "returns.read", record);
  // Retained legacy evidence is read without filling or rewriting its projections.
  return record;
}
function audit(
  state: DemoState,
  context: OperationsContext,
  action: string,
  product_code?: string,
  origin = context.branch,
) {
  state.activity.unshift({
    id: id("activity"),
    company_id: context.company_id,
    branch: origin,
    action,
    by: context.actor,
    ...actorAudit(state, context),
    at: now(),
    product_code,
  });
  return state.activity[0];
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
  quantity_unit?: "units" | "lb";
}
function stock(
  state: DemoState,
  context: OperationsContext,
  product: string,
  delta: number,
  type: string,
  reference: string,
  unit: "units" | "lb" = "units",
  origin = context.branch,
) {
  if (
    !state.products.some(
      (item) => item.company_id === context.company_id && item.code === product,
    )
  )
    fail("product");
  const key = `${origin}:${product}`;
  const next = (state.stock[key] ?? 0) + delta;
  // An incomplete sales ledger cannot establish available stock in Phase 1.
  if (unit === "units") {
    if (!Number.isSafeInteger(next)) fail("quantity");
    state.stock[key] = next;
  }
  const physicalState = state as DemoState & {
    stock_movements?: PhysicalStockMovement[];
  };
  (physicalState.stock_movements ??= []).push({
    id: id("movement"),
    company_id: context.company_id,
    branch: origin,
    product_code: product,
    qty: delta,
    quantity_unit: unit,
    type,
    reference,
    by: context.actor,
    ...actorAudit(state, context),
    at: now(),
  });
}
function history(
  state: DemoState,
  record: OperationalReturn,
  context: OperationsContext,
  event: Omit<EvidenceEvent, "id" | "at" | "by">,
) {
  (record.evidence ??= []).push({
    id: id("evidence"),
    at: now(),
    by: context.actor,
    ...actorAudit(state, context),
    ...structuredClone(event),
  });
}
function settled(line: ReturnRecord["lines"][number], record?: ReturnRecord) {
  return record
    ? (retainedReturnSettlementEvidence(record).quantities.get(
        line.product_code,
      ) ?? 0)
    : Math.max(line.settled ?? 0, line.replaced ?? 0);
}
export function returnUnpickedQuantity(
  record: Pick<ReturnRecord, "lines" | "replacement_received"> &
    Pick<OperationalReturn, "recovered">,
  line: ReturnRecord["lines"][number],
) {
  const discarded =
    line.pickup_shortfall?.outcome === "throw_away"
      ? line.pickup_shortfall.quantity
      : 0;
  return Decimal.max(
    0,
    new Decimal(line.qty)
      .minus(
        line.picked_up ??
          (record.replacement_received && record.lines.length === 1
            ? line.qty
            : 0),
      )
      .minus(record.recovered?.[line.product_code] ?? 0)
      .minus(discarded),
  ).toNumber();
}
function disposedQuantity(line: ReturnRecord["lines"][number]) {
  return line.pickup_shortfall &&
    line.pickup_shortfall.outcome !== "keep_for_next_pickup"
    ? line.pickup_shortfall.quantity
    : 0;
}
function requireSignedPickup(
  record: OperationalReturn,
  codes?: readonly string[],
) {
  const signed = signedReturnPickupQuantities(record);
  if (!signed.size || codes?.some((code) => (signed.get(code) ?? 0) <= 0))
    fail("pickup_required");
  return signed;
}
function validateCoverage(
  state: DemoState,
  record: OperationalReturn,
  covers: Record<string, number>,
  includePending = true,
) {
  const signed = requireSignedPickup(
    record,
    Object.entries(covers)
      .filter(([, count]) => count > 0)
      .map(([code]) => code),
  );
  const retained = retainedReturnSettlementEvidence(record);
  let total = 0;
  for (const [code, count] of Object.entries(covers)) {
    if (count > 0 && retained.blocked.has(code))
      fail("return_settlement_evidence");
    const line = record.lines.find((item) => item.product_code === code);
    if (!line) fail("product");
    returnQuantity(state, line, count, true);
    const pending = includePending
      ? (record.claims ?? [])
          .filter((claim) => claim.status === "submitted")
          .reduce(
            (sum, claim) => sum.plus(claim.covers[code] ?? 0),
            new Decimal(0),
          )
          .toNumber()
      : 0;
    if (
      new Decimal(count)
        .plus(settled(line, record))
        .plus(pending)
        .gt(signed.get(code) ?? 0)
    )
      fail("coverage");
    total += count;
  }
  if (total === 0) fail("quantity");
}
function applyCoverage(
  record: OperationalReturn,
  covers: Record<string, number>,
) {
  for (const line of record.lines)
    line.settled = new Decimal(settled(line, record))
      .plus(covers[line.product_code] ?? 0)
      .toNumber();
  record.status = record.lines.every((line) =>
    new Decimal(settled(line, record))
      .plus(disposedQuantity(line))
      .gte(line.qty),
  )
    ? "resolved"
    : record.lines.some((line) => (line.picked_up ?? 0) > 0)
      ? "partially_resolved"
      : "open";
  return record.status;
}
export function recordPickup(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  input: {
    quantities: Record<string, number>;
    representative: string;
    slip: string;
    photo?: ReturnPhotoAttachment;
    note?: string;
    shortfalls?: Record<
      string,
      {
        reason: string;
        outcome: "keep_for_next_pickup" | "put_back_on_shelf" | "throw_away";
      }
    >;
  },
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  const record = getReturn(state, context, returnId);
  operationGuard(state, context, "returns.pickup_record", record, true);
  const photoReference = input.photo
    ? returnPhotoReference(
        state,
        context,
        record.id,
        "returns.pickup_record",
        input.photo,
      )
    : undefined;
  if (
    record.status === "cancelled" ||
    record.status === "cancellation_review" ||
    record.status === "resolved"
  )
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
      existingPickup.representative !== input.representative.trim() ||
      Object.entries(existingPickup.shortfalls ?? {}).some(
        ([code, decision]) =>
          input.shortfalls?.[code]?.reason.trim() !== decision.reason ||
          input.shortfalls?.[code]?.outcome !== decision.outcome,
      )
    )
      fail("duplicate_document");
    return;
  }
  const shortfalls: NonNullable<EvidenceEvent["shortfalls"]> = {};
  let total = 0;
  for (const line of record.lines) {
    const count = returnQuantity(
      state,
      line,
      input.quantities[line.product_code] ?? 0,
      true,
    );
    const remaining = returnUnpickedQuantity(record, line);
    if (new Decimal(count).gt(remaining)) fail("pickup_cap");
    const leftover = new Decimal(remaining).minus(count).toNumber();
    if (leftover > 0) {
      const decision = input.shortfalls?.[line.product_code];
      if (!decision?.reason.trim()) fail("pickup_shortfall_reason");
      if (
        !decision ||
        !["keep_for_next_pickup", "put_back_on_shelf", "throw_away"].includes(
          decision.outcome,
        )
      )
        fail("pickup_shortfall_outcome");
      shortfalls[line.product_code] = {
        reason: decision.reason.trim(),
        outcome: decision.outcome,
        quantity: leftover,
      };
    }
    total += count;
  }
  if (total === 0 && !Object.keys(shortfalls).length) fail("quantity");
  if (
    Object.keys(input.quantities).some(
      (code) => !record.lines.some((line) => line.product_code === code),
    )
  )
    fail("product");
  const evidence = returnPickupValuationEvidence(state, context, record);
  let memo: ReturnType<typeof createReturnMemo>;
  try {
    memo = createReturnMemo(state, context, record, input, evidence);
  } finally {
    closePurchaseEvidence(evidence);
  }
  for (const line of record.lines) {
    line.picked_up = new Decimal(line.picked_up ?? 0)
      .plus(input.quantities[line.product_code] ?? 0)
      .toNumber();
    line.quantity_unit ??= memo.lines.find(
      (item) => item.product_code === line.product_code,
    )?.quantity_unit;
    line.unit_cost ??= memo.lines.find(
      (item) => item.product_code === line.product_code,
    )?.unit_cost;
    const shortfall = shortfalls[line.product_code];
    if (shortfall) {
      line.pickup_shortfall = structuredClone(shortfall);
      if (shortfall.outcome === "put_back_on_shelf") {
        stock(
          state,
          context,
          line.product_code,
          shortfall.quantity,
          "return_original_recovered",
          memo.reference,
          line.quantity_unit,
          record.branch,
        );
        (record.recovered ??= {})[line.product_code] = new Decimal(
          record.recovered?.[line.product_code] ?? 0,
        )
          .plus(shortfall.quantity)
          .toNumber();
        record.original_units_recovered = new Decimal(
          record.original_units_recovered,
        )
          .plus(shortfall.quantity)
          .toNumber();
      }
    } else if (line.pickup_shortfall?.outcome === "keep_for_next_pickup")
      delete line.pickup_shortfall;
  }
  record.supplier_rep_name = input.representative.trim();
  record.signed_pickup_slip_reference = input.slip.trim();
  (record.pickup_memos ??= []).push(memo);
  record.picked_up_at ??= memo.picked_up_at;
  record.pickup_completed = true;
  if (
    record.lines.every((line) =>
      new Decimal(settled(line, record))
        .plus(disposedQuantity(line))
        .gte(line.qty),
    )
  ) {
    record.status = "resolved";
    record.closure_subtype = "written_off";
  } else if (record.lines.some((line) => (line.picked_up ?? 0) > 0))
    record.status = "picked_up";
  history(state, record, context, {
    kind: "pickup",
    document: input.slip.trim(),
    representative: input.representative.trim(),
    photo: photoReference,
    note: input.note,
    quantities: input.quantities,
    shortfalls,
  });
  audit(state, context, "return_pickup", undefined, record.branch);
  syncReturnCreditAlertsForReturn(
    state,
    context,
    record,
    "returns.pickup_record",
  );
}
export function canCorrectReturnPickup(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  const record = state.returns.find(
    (item) =>
      item.id === returnId && item.company_id === state.config.company.seed_key,
  );
  return Boolean(
    record &&
    can(state, context, "returns.pickup_correct", {
      ...domainScope(state, record, true),
      location_policy: "retained_correction",
    }).allowed,
  );
}
/** Correct only the latest pickup snapshot, retaining its signed original and every posted settlement. */
export function correctReturnPickup(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  input: {
    memo_id: string;
    quantities: Record<string, number>;
    reason: string;
    shortfalls?: Record<
      string,
      {
        reason: string;
        outcome: "keep_for_next_pickup" | "put_back_on_shelf" | "throw_away";
      }
    >;
  },
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  if (!canCorrectReturnPickup(state, context, returnId))
    fail("pickup_authority");
  const record = getReturn(state, context, returnId);
  requireCapability(state, context, "returns.pickup_correct", {
    ...domainScope(state, record, true),
    location_policy: "retained_correction",
  });
  if (["cancelled", "cancellation_review"].includes(record.status))
    fail("closed");
  if (!input.reason.trim()) fail("reason");
  const original = record.pickup_memos?.at(-1);
  if (!original || original.id !== input.memo_id)
    fail("pickup_correction_conflict");
  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  const shortfalls: NonNullable<EvidenceEvent["shortfalls"]> = {};
  const shelfDeltas: Record<string, number> = {};
  for (const line of record.lines) {
    const oldCount =
      original.lines.find((item) => item.product_code === line.product_code)
        ?.quantity ?? 0;
    before[line.product_code] = oldCount;
    const newCount = returnQuantity(
      state,
      line,
      input.quantities[line.product_code] ?? 0,
      true,
    );
    after[line.product_code] = newCount;
    const oldShortfall = line.pickup_shortfall;
    const oldShelf =
      oldShortfall?.outcome === "put_back_on_shelf" ? oldShortfall.quantity : 0;
    const otherRecovered = new Decimal(
      record.recovered?.[line.product_code] ?? 0,
    ).minus(oldShelf);
    const cumulative = new Decimal(line.picked_up ?? 0)
      .minus(oldCount)
      .plus(newCount);
    const claimed = (record.claims ?? [])
      .filter((claim) => claim.status === "submitted")
      .reduce(
        (total, claim) => total.plus(claim.covers[line.product_code] ?? 0),
        new Decimal(0),
      );
    if (
      cumulative.lt(new Decimal(settled(line, record)).plus(claimed)) ||
      cumulative.plus(otherRecovered).gt(line.qty) ||
      cumulative.lt(0)
    )
      fail("pickup_correction_conflict");
    const leftover = new Decimal(line.qty)
      .minus(cumulative)
      .minus(otherRecovered)
      .toNumber();
    if (leftover > 0) {
      const choice = input.shortfalls?.[line.product_code];
      if (!choice?.reason.trim()) fail("pickup_shortfall_reason");
      if (
        !choice ||
        !["keep_for_next_pickup", "put_back_on_shelf", "throw_away"].includes(
          choice.outcome,
        )
      )
        fail("pickup_shortfall_outcome");
      shortfalls[line.product_code] = {
        reason: choice.reason.trim(),
        outcome: choice.outcome,
        quantity: leftover,
      };
    }
    shelfDeltas[line.product_code] = new Decimal(
      shortfalls[line.product_code]?.outcome === "put_back_on_shelf"
        ? leftover
        : 0,
    )
      .minus(oldShelf)
      .toNumber();
  }
  if (
    Object.keys(input.quantities).some(
      (code) => !record.lines.some((line) => line.product_code === code),
    )
  )
    fail("product");
  const at = now();
  const evidence = returnPickupValuationEvidence(
    state,
    context,
    record,
    "return_pickup_correct",
  );
  let memo: ReturnType<typeof createReturnMemo>;
  try {
    memo = createReturnMemo(
      state,
      context,
      record,
      {
        quantities: after,
        representative: original.representative,
        slip: original.signed_evidence_reference,
      },
      evidence,
      at,
    );
  } finally {
    closePurchaseEvidence(evidence);
  }
  memo.correction_of = original.id;
  const correction = {
    id: id("pickup-correction"),
    company_id: context.company_id,
    branch: record.branch,
    return_id: record.id,
    memo_id: memo.id,
    previous_memo_id: original.id,
    reason: input.reason.trim(),
    by: context.actor,
    ...actorAudit(state, context),
    at,
    before,
    after,
  };
  for (const line of record.lines) {
    line.picked_up = new Decimal(line.picked_up ?? 0)
      .minus(before[line.product_code])
      .plus(after[line.product_code])
      .toNumber();
    const delta = shelfDeltas[line.product_code];
    if (delta) {
      stock(
        state,
        context,
        line.product_code,
        delta,
        "return_pickup_correction",
        correction.id,
        line.quantity_unit,
        record.branch,
      );
      (record.recovered ??= {})[line.product_code] = new Decimal(
        record.recovered?.[line.product_code] ?? 0,
      )
        .plus(delta)
        .toNumber();
      record.original_units_recovered = new Decimal(
        record.original_units_recovered,
      )
        .plus(delta)
        .toNumber();
    }
    if (shortfalls[line.product_code])
      line.pickup_shortfall = structuredClone(shortfalls[line.product_code]);
    else delete line.pickup_shortfall;
  }
  (record.pickup_memos ??= []).push(memo);
  (record.pickup_corrections ??= []).push(correction);
  record.status = record.lines.every((line) =>
    new Decimal(settled(line, record))
      .plus(disposedQuantity(line))
      .gte(line.qty),
  )
    ? "resolved"
    : record.lines.some((line) => (line.picked_up ?? 0) > 0)
      ? "partially_resolved"
      : "open";
  if (record.status !== "resolved") delete record.closure_subtype;
  history(state, record, context, {
    kind: "pickup_correction",
    document: memo.reference,
    corrects_event_id: original.id,
    before_quantities: before,
    quantities: after,
    shortfalls,
    note: input.reason.trim(),
  });
  audit(state, context, "return_pickup_corrected", undefined, record.branch);
  syncReturnCreditAlertsForReturn(
    state,
    context,
    record,
    "returns.pickup_correct",
  );
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
    photo?: ReturnPhotoAttachment;
    receipt: string;
    invoice_id?: string;
    fully?: boolean;
  },
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  const record = getReturn(state, context, returnId);
  operationGuard(state, context, "returns.operational_resolve", record, true);
  const photoReference = input.photo
    ? returnPhotoReference(
        state,
        context,
        record.id,
        "returns.operational_resolve",
        input.photo,
      )
    : undefined;
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
      !sameCoverage ||
      existingReplacement.representative !== input.representative.trim() ||
      existingReplacement.received_date !== input.date
    )
      fail("duplicate_document");
    return;
  }
  if (record.status === "resolved") fail("closed");
  const replacementProduct = state.products.find(
    (item) =>
      item.company_id === context.company_id &&
      item.code === input.product_code,
  );
  const replacementUnit =
    replacementProduct?.sold_by === "weight" ? "lb" : "units";
  returnQuantity(
    state,
    {
      product_code: input.product_code,
      qty: input.qty,
      reason: "",
      quantity_unit: replacementUnit,
    },
    input.qty,
  );
  if (!input.date || !input.representative.trim() || !input.receipt.trim())
    fail("replacement_evidence");
  if (
    input.invoice_id &&
    ![...(state.invoices ?? []), state.invoice].some(
      (invoice) =>
        invoice.id === input.invoice_id &&
        invoice.company_id === context.company_id &&
        invoice.branch === record.branch &&
        invoice.supplier === record.supplier &&
        invoice.status === "posted",
    )
  )
    fail("invoice");
  validateCoverage(state, record, input.covers);
  if (
    input.fully &&
    record.lines.some(
      (line) =>
        !new Decimal(settled(line, record))
          .plus(input.covers[line.product_code] ?? 0)
          .eq(line.qty),
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
    replacementUnit,
    record.branch,
  );
  const coverageStatus = applyCoverage(record, input.covers);
  record.resolution = "replacement_received";
  if (coverageStatus === "resolved") record.closure_subtype = "replaced";
  record.replacement_received = {
    product_code: input.product_code,
    qty: input.qty,
    covers_original_qty: Object.values(input.covers).reduce(
      (sum, value) => sum + value,
      0,
    ),
  };
  history(state, record, context, {
    kind: "replacement",
    document: input.receipt.trim(),
    representative: input.representative.trim(),
    received_date: input.date,
    product_code: input.product_code,
    actual_qty: input.qty,
    invoice_id: input.invoice_id,
    photo: photoReference,
    note: `${input.date} | ${input.representative} | ${input.product_code} × ${input.qty}${input.note ? ` | ${input.note}` : ""}`,
    quantities: input.covers,
  });
  audit(
    state,
    context,
    "replacement_received",
    input.product_code,
    record.branch,
  );
  syncReturnCreditAlertsForReturn(
    state,
    context,
    record,
    "returns.operational_resolve",
  );
}
export function submitFinancialClaim(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  input: Omit<ReturnClaim, "id" | "status" | "submitted_by" | "at">,
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  const record = getReturn(state, context, returnId);
  operationGuard(state, context, "returns.operational_resolve", record, true);
  if (
    record.status === "cancelled" ||
    record.status === "cancellation_review" ||
    record.status === "resolved"
  )
    fail("closed");
  if (input.type === "no_compensation") {
    operationGuard(state, context, "returns.credit_post", record, true);
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
    const linkedInvoice =
      record.linked_invoice ??
      record.claims?.find(
        (claim) =>
          claim.type.startsWith("credit_") && claim.status !== "disputed",
      )?.invoice_id;
    if (linkedInvoice && linkedInvoice !== input.invoice_id)
      fail("single_invoice");
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
  validateCoverage(state, record, input.covers);
  (record.claims ??= []).push({
    ...structuredClone(input),
    id: id("claim"),
    status: "submitted",
    submitted_by: context.actor,
    submitted_by_user_id: context.user_id,
    submitted_by_role_snapshot: context.role,
    at: now(),
  });
  record.status = "claim_pending";
  history(state, record, context, {
    kind: "claim",
    document: input.document,
    note: input.reason,
    quantities: input.covers,
  });
  audit(state, context, "return_claim_submitted", undefined, record.branch);
}
export function postReturnClaim(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  claimId: string,
  amountInput?: string,
  itemAmountsInput?: Record<string, string>,
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  const record = getReturn(state, context, returnId);
  requireCapability(state, context, "returns.credit_post", {
    ...domainScope(state, record, true),
    location_policy: "retained_correction",
  });
  const claim = record.claims?.find((item) => item.id === claimId);
  if (!claim) fail("claim");
  if (claim.status === "posted") return;
  if (
    record.status === "cancelled" ||
    record.status === "cancellation_review" ||
    record.status === "resolved"
  )
    fail("closed");
  if (claim.status !== "submitted") fail("claim");
  validateCoverage(state, record, claim.covers, false);
  if (claim.type !== "no_compensation") {
    if (!claim.document?.trim()) fail("credit_document");
    const amount = exactMoney(amountInput ?? claim.amount ?? "0");
    if (decimalAmount(amount).lte(0)) fail("amount");
    const coveredCodes = Object.keys(claim.covers).filter(
      (code) => claim.covers[code] > 0,
    );
    const itemAmounts =
      itemAmountsInput ??
      claim.item_amounts ??
      (coveredCodes.length === 1 ? { [coveredCodes[0]]: amount } : undefined);
    if (
      !itemAmounts ||
      Object.keys(itemAmounts).length !== coveredCodes.length ||
      coveredCodes.some(
        (code) => !itemAmounts[code] || decimalAmount(itemAmounts[code]).lte(0),
      ) ||
      Object.keys(itemAmounts).some((code) => !coveredCodes.includes(code)) ||
      !Object.values(itemAmounts)
        .reduce((sum, value) => sum.plus(exactMoney(value)), new Decimal(0))
        .eq(amount)
    )
      fail("item_credit_amount");
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
      branch: record.branch,
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
    claim.item_amounts = structuredClone(itemAmounts);
    record.compensation_amount = amount;
    record.credit_document = claim.document;
    if (credit) record.linked_invoice = claim.invoice_id;
  }
  const coverageStatus = applyCoverage(record, claim.covers);
  claim.status = "posted";
  claim.posted_by = context.actor;
  claim.posted_by_user_id = context.user_id;
  claim.posted_by_role_snapshot = context.role;
  record.resolution = claim.type;
  if (coverageStatus === "resolved")
    record.closure_subtype =
      claim.type === "no_compensation" ? "written_off" : "credited";
  history(state, record, context, {
    kind: "claim_posted",
    document: claim.document,
    quantities: claim.covers,
  });
  audit(state, context, "return_claim_posted", undefined, record.branch);
  syncReturnCreditAlertsForReturn(
    state,
    context,
    record,
    "returns.credit_post",
  );
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
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  const record = getReturn(state, context, returnId);
  operationGuard(state, context, "returns.operational_resolve", record, true);
  if (record.status === "cancelled" || record.status === "cancellation_review")
    fail("closed");
  if (!input.reason.trim()) fail("reason");
  let recoveredTotal = 0;
  for (const line of record.lines) {
    if (!input.dispositions[line.product_code]) fail("disposition");
    const count = returnQuantity(
      state,
      line,
      input.recovered[line.product_code] ?? 0,
      true,
    );
    if (
      count > 0 &&
      (input.dispositions[line.product_code] !== "recovered_sellable" ||
        !input.safe)
    )
      fail("safe");
    if (
      new Decimal(count)
        .plus(record.recovered?.[line.product_code] ?? 0)
        .plus(
          line.pickup_shortfall?.outcome === "throw_away"
            ? line.pickup_shortfall.quantity
            : 0,
        )
        .gt(line.qty)
    )
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
        line.quantity_unit ??
          (state.products.find(
            (item) =>
              item.company_id === context.company_id &&
              item.code === line.product_code,
          )?.sold_by === "weight"
            ? "lb"
            : "units"),
        record.branch,
      );
      (record.recovered ??= {})[line.product_code] = new Decimal(
        record.recovered?.[line.product_code] ?? 0,
      )
        .plus(count)
        .toNumber();
    }
  }
  if (recoveredTotal > 0) {
    history(state, record, context, {
      kind: "original_recovery",
      note: "Physically received and confirmed safe/sellable",
      quantities: input.recovered,
    });
    audit(
      state,
      context,
      "return_original_recovered",
      undefined,
      record.branch,
    );
  }
  record.original_units_recovered = new Decimal(record.original_units_recovered)
    .plus(recoveredTotal)
    .toNumber();
  record.cancellation_reason = input.reason.trim();
  record.cancellation_dispositions = input.dispositions;
  const existingSettlement =
    record.lines.some((line) => settled(line, record) > 0) ||
    !!record.replacement_received ||
    record.claims?.some((claim) => claim.status === "posted");
  record.previous_status = record.status;
  record.status = existingSettlement ? "cancellation_review" : "cancelled";
  history(state, record, context, {
    kind: "cancellation_requested",
    note: input.reason,
    quantities: input.recovered,
  });
  audit(
    state,
    context,
    existingSettlement ? "return_cancellation_review" : "return_cancelled",
    undefined,
    record.branch,
  );
  syncReturnCreditAlertsForReturn(
    state,
    context,
    record,
    "returns.operational_resolve",
  );
}
export function reviewCancellation(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  input: { accept: boolean; settlement_retained: boolean; note: string },
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  const record = getReturn(state, context, returnId);
  requireCapability(state, context, "returns.financial_cancel_review", {
    ...domainScope(state, record, true),
    location_policy: "retained_correction",
  });
  if (record.status !== "cancellation_review") fail("review");
  if (!input.note.trim() || (input.accept && !input.settlement_retained))
    fail("settlement_review");
  record.status = input.accept
    ? "cancelled"
    : (record.previous_status ?? "partially_resolved");
  history(state, record, context, {
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
    undefined,
    record.branch,
  );
  syncReturnCreditAlertsForReturn(
    state,
    context,
    record,
    "returns.financial_cancel_review",
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
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  requireConcreteLocation(state, context);
  operationGuard(
    state,
    context,
    "notes.entry_add",
    { company_id: state.config.company.seed_key, branch: context.branch },
    true,
  );
  if (
    context.company_id !== state.config.company.seed_key ||
    !configuredBranches(state.config).includes(context.branch)
  )
    fail("scope");
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
  const note: NoteRecord = {
    ...input,
    text: input.text.trim(),
    id: id("note"),
    company_id: context.company_id,
    branch: context.branch,
    status: "open",
    seen_receipts: [],
    by: context.actor,
    ...actorAudit(state, context),
    created_at: now(),
  };
  state.notes.unshift(note);
  notifyBuiltinNote(state, note);
  audit(
    state,
    context,
    input.type === "store_use" ? "store_use_recorded" : "note_added",
    input.product_code,
  );
}
export function markNoteSeen(
  state: DemoState,
  context: OperationsContext,
  noteId: string,
  at = new Date(),
) {
  context = freshActor(state, context);
  const note = state.notes.find(
    (item) => item.id === noteId && belongs(item, context),
  );
  if (!note || note.archived) fail("scope");
  operationGuard(state, context, "notes.read", note);
  operationGuard(state, context, "notes.mark_seen", note, true);
  const receipt = appendSeenReceipt(note, context, at);
  markLinkedNoteNotificationsRead(state, context, note, at);
  if (!receipt) return;
  const entry = audit(
    state,
    context,
    "note_seen",
    note.product_code,
    note.branch,
  );
  entry.at = at.toISOString();
  entry.entity_type = "note";
  entry.entity_id = note.id;
  entry.before = { receipt: null };
  entry.after = { receipt: structuredClone(receipt) };
}
export function updateNoteStatus(
  state: DemoState,
  context: OperationsContext,
  noteId: string,
  status: NoteRecord["status"],
) {
  if (status === "read") return markNoteSeen(state, context, noteId);
  if (!["open", "resolved"].includes(status)) fail("status");
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  try {
    freshActor(state, context);
  } catch {
    fail("scope");
  }
  const note = state.notes.find(
    (item) => item.id === noteId && belongs(item, context),
  );
  if (!note) fail("scope");
  operationGuard(
    state,
    context,
    note.type === "note_to_supervisor"
      ? "notes.status_manage"
      : "notes.operational_status",
    note,
    true,
  );
  if (
    note.archived ||
    status === "ordered" ||
    (note.status === "ordered" && status !== "open")
  )
    fail("status");
  if (note.status === status) return;
  note.status = status;
  recordNoteCompletion(note, context, status === "resolved");
  const entry = audit(
    state,
    context,
    status === "open" ? "note_reopened" : "note_resolved",
    note.product_code,
    note.branch,
  );
  entry.entity_type = "note";
  entry.entity_id = note.id;
}
export function clearExpiry(
  state: DemoState,
  context: OperationsContext,
  expiryId: string,
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  try {
    freshActor(state, context);
  } catch {
    fail("scope");
  }
  const entry = state.expiry.find(
    (item) =>
      item.id === expiryId &&
      belongs(projectExpiryLocation(state, item), context),
  );
  if (!entry) fail("scope");
  operationGuard(
    state,
    context,
    "dates.remove",
    projectExpiryLocation(state, entry),
    true,
  );
  entry.status = "cleared";
  audit(state, context, "expiry_cleared", entry.product_code);
}
/** Keep evidence in UTC; show its timestamp in the configured business timezone. */
export function companyTimestamp(
  config: Pick<CompanyConfig, "company">,
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
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  operationGuard(state, context, "payables.read");
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
    if (
      row.type === "invoice" ||
      (row.type === "adjustment" && row.invoice_id)
    ) {
      const invoiceId = row.invoice_id ?? row.id;
      if (
        !invoices.some(
          (invoice) =>
            invoice.invoice_id === invoiceId && invoice.branch === row.branch,
        )
      ) {
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
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
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
  const summary = ledgerSummary(state, context, supplier);
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
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  requireConcreteLocation(state, context);
  operationGuard(
    state,
    context,
    "payables.write",
    { company_id: state.config.company.seed_key, branch: context.branch },
    true,
  );
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
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  requireConcreteLocation(state, context);
  operationGuard(
    state,
    context,
    "payables.write",
    { company_id: state.config.company.seed_key, branch: context.branch },
    true,
  );
  if (input.type === "opening_balance")
    operationGuard(
      state,
      context,
      "payables.opening_balance_write",
      { company_id: state.config.company.seed_key, branch: context.branch },
      true,
    );
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
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  requireConcreteLocation(state, context);
  operationGuard(
    state,
    context,
    "payables.write",
    { company_id: state.config.company.seed_key, branch: context.branch },
    true,
  );
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
    ...actorAudit(state, context),
    at: now(),
    note: note.trim(),
  });
  audit(state, context, "supplier_dispute_recorded");
}

export function ledgerCsv(
  state: DemoState,
  context: OperationsContext,
  supplier: string,
  throughDate?: string,
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  const summary = ledgerSummary(state, context, supplier, throughDate);
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
  state: DemoState,
  records: T[],
  context: OperationsContext,
  capability: Capability,
) {
  try {
    context = freshActor(state, context);
  } catch {
    fail("scope");
  }
  operationGuard(state, context, capability);
  const selected = new Set(selectedLocations(state, context, true));
  return records.filter(
    (record) =>
      record.company_id === state.config.company.seed_key &&
      (record.branch === "all" || selected.has(record.branch)) &&
      can(state, context, capability, domainScope(state, record)).allowed,
  );
}
export function operationError(
  key: string,
  t: (en: string, fa: string) => string,
  config: Pick<CompanyConfig, "roles"> = configSeed,
) {
  const managersEn = `${configuredRoleLabel(config.roles, "owner", "en")} or ${configuredRoleLabel(config.roles, "manager", "en")}`;
  const managersFa = `${configuredRoleLabel(config.roles, "owner", "fa")} یا ${configuredRoleLabel(config.roles, "manager", "fa")}`;
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
      `Ask an ${managersEn} to verify and post this action.`,
      `برای تأیید و ثبت این کار از ${managersFa} کمک بگیرید.`,
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
    weight_quantity: [
      "Enter a positive weight in lb with up to three decimal places; zero means not received.",
      "وزن مثبت بر حسب پوند با حداکثر سه رقم اعشار وارد کنید؛ صفر یعنی دریافت‌نشده.",
    ],
    product: [
      "Choose a product from this company.",
      "یک محصول از همین شرکت انتخاب کنید.",
    ],
    stock: [
      "Check the actual quantity before recording this movement.",
      "پیش از ثبت این جابه‌جایی، تعداد واقعی را بررسی کنید.",
    ],
    pickup_evidence: [
      "Add the representative name and signed slip reference before handing over goods.",
      "پیش از تحویل کالا، نام نماینده و مرجع رسید امضاشده را وارد کنید.",
    ],
    pickup_cap: [
      "Pickup quantity exceeds the original units still awaiting pickup.",
      "تعداد جمع‌آوری از تعداد اصلی منتظر جمع‌آوری بیشتر است.",
    ],
    pickup_required: [
      "Record the actual pickup and signed paper evidence before recording a resolution.",
      "پیش از ثبت حل‌وفصل، جمع‌آوری واقعی و مدرک کاغذی امضاشده را ثبت کنید.",
    ],
    pickup_shortfall_reason: [
      "Enter a reason for each quantity not picked up.",
      "برای هر تعداد جمع‌آوری‌نشده دلیل وارد کنید.",
    ],
    pickup_shortfall_outcome: [
      "Choose what happens to the goods not picked up.",
      "نتیجه کالای جمع‌آوری‌نشده را انتخاب کنید.",
    ],
    pickup_authority: [
      "Only an authorized Owner or Manager can correct a pickup.",
      "فقط مالک یا مدیر مجاز می‌تواند جمع‌آوری را اصلاح کند.",
    ],
    pickup_correction_conflict: [
      "This pickup has changed or has settled quantities. Review the current pickup and resolution before correcting it.",
      "این جمع‌آوری تغییر کرده یا تعداد تسویه‌شده دارد. پیش از اصلاح، جمع‌آوری و حل‌وفصل جاری را بررسی کنید.",
    ],
    outstanding_date: [
      "Enter an expected date for each outstanding item.",
      "برای هر قلم باقی‌مانده تاریخ مورد انتظار وارد کنید.",
    ],
    return_settlement_evidence: [
      "Review the retained settlement evidence before recording another outcome.",
      "پیش از ثبت نتیجه دیگر، مدارک تسویه نگهداری‌شده را بررسی کنید.",
    ],
    item_credit_amount: [
      "Enter each item's actual credit amount. Their total must match the verified credit note.",
      "مبلغ واقعی اعتبار هر قلم را وارد کنید. جمع آن‌ها باید با یادداشت اعتبار تأییدشده برابر باشد.",
    ],
    coverage: [
      "Covered original quantities exceed the unsettled return. Check each line.",
      "تعداد اصلی پوشش‌داده‌شده از مرجوعی حل‌نشده بیشتر است. هر ردیف را بررسی کنید.",
    ],
    return_changed: [
      "This return or its payable changed. Review it again before posting.",
      "این مرجوعی یا پرداختنی آن تغییر کرده است. پیش از ثبت دوباره بررسی کنید.",
    ],
    return_cost: [
      "Review the original purchase cost for this return before recording pickup.",
      "پیش از ثبت جمع‌آوری، هزینه خرید اصلی این مرجوعی را بررسی کنید.",
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
      `Choose a return awaiting ${managersEn} cancellation review.`,
      `مرجوعی منتظر بررسی لغو ${managersFa} را انتخاب کنید.`,
    ],
    text: [
      "Add a short note before saving.",
      "پیش از ذخیره، یک یادداشت کوتاه وارد کنید.",
    ],
    store_use: [
      "Store use needs a product and actual quantity.",
      "مصرف فروشگاه به محصول و تعداد واقعی نیاز دارد.",
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
