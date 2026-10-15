import { freshActor } from "./authority";
import { cloneWithAuthority } from "./authority";
import { can, requireCapability } from "./permissions";
import { actorAudit, domainScope } from "./domain-authority";
import Decimal from "decimal.js";
import {
  signedReturnPickupQuantities,
  retainedReturnSettlementEvidence,
} from "./signed-return-pickups";
import { companyDate } from "./invoice";
import {
  OperationError,
  receiveReplacement,
  submitFinancialClaim,
  type OperationalReturn,
  type OperationsContext,
} from "./operations";
import { syncReturnCreditAlertsForReturn } from "./return-workflow";
import type { DemoState, ReturnLine } from "./types";

export type ItemResolutionKind =
  "credited" | "cash_or_other" | "replaced" | "outstanding" | "written_off";
export interface ItemResolutionInput {
  product_code: string;
  kind: ItemResolutionKind;
  quantity: number;
  document?: string;
  amount?: string;
  invoice_id?: string;
  expected_date?: string;
  note?: string;
  replacement_product_code?: string;
  replacement_quantity?: number;
  received_date?: string;
  representative?: string;
}
export function returnItemProgress(
  record: OperationalReturn,
  line: ReturnLine,
) {
  const quantity = (kind: "credited" | "written_off") =>
    (record.claims ?? [])
      .filter(
        (claim) =>
          claim.status === "posted" &&
          (kind === "written_off"
            ? claim.type === "no_compensation"
            : claim.type !== "no_compensation"),
      )
      .reduce(
        (total, claim) => total.plus(claim.covers[line.product_code] ?? 0),
        new Decimal(0),
      )
      .toNumber();
  const credited = quantity("credited");
  const writtenOff = quantity("written_off");
  const replacement = (record.evidence ?? [])
    .filter((event) => event.kind === "replacement")
    .reduce(
      (total, event) => total.plus(event.quantities?.[line.product_code] ?? 0),
      new Decimal(0),
    )
    .toNumber();
  const retained = retainedReturnSettlementEvidence(record);
  const settled = retained.quantities.get(line.product_code) ?? 0;
  const replaced =
    replacement ||
    (record.replacement_received && record.lines.length === 1
      ? record.replacement_received.covers_original_qty
      : 0);
  const pending = (record.claims ?? [])
    .filter((claim) => claim.status === "submitted")
    .reduce(
      (total, claim) => total.plus(claim.covers[line.product_code] ?? 0),
      new Decimal(0),
    )
    .toNumber();
  const signed = signedReturnPickupQuantities(record);
  const actualSigned = signed.get(line.product_code) ?? 0;
  const pickedUp = signed.has(line.product_code)
    ? actualSigned
    : (line.picked_up ?? (record.replacement_received ? line.qty : 0));
  return {
    credited,
    written_off: writtenOff,
    replaced,
    pending,
    picked_up: pickedUp,
    resolved: settled,
    outstanding: Decimal.max(
      0,
      new Decimal(pickedUp).minus(settled),
    ).toNumber(),
    available:
      record.status === "resolved" || retained.blocked.has(line.product_code)
        ? 0
        : Decimal.max(
            0,
            new Decimal(actualSigned).minus(settled).minus(pending),
          ).toNumber(),
  };
}
const validDate = (value?: string) =>
  !!value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
/** Validate and append all item decisions on a private draft before committing any of them. */
export function recordItemResolutions(
  state: DemoState,
  context: OperationsContext,
  returnId: string,
  items: ItemResolutionInput[],
) {
  context = freshActor(state, context);
  if (
    context.company_id !== state.config.company.seed_key ||
    context.branch === "all"
  )
    throw new OperationError("scope");
  const records = state.returns.filter(
    (item) =>
      item.id === returnId &&
      item.company_id === context.company_id &&
      item.branch === context.branch,
  );
  if (records.length !== 1) throw new OperationError("scope");
  const record = records[0] as OperationalReturn;
  requireCapability(
    state,
    context,
    "returns.operational_resolve",
    domainScope(state, record, true),
  );
  if (["cancelled", "cancellation_review", "resolved"].includes(record.status))
    throw new OperationError("closed");
  const signed = signedReturnPickupQuantities(record);
  const retained = retainedReturnSettlementEvidence(record);
  if (items.some((item) => retained.blocked.has(item.product_code)))
    throw new OperationError("return_settlement_evidence");
  if (items.some((item) => (signed.get(item.product_code) ?? 0) <= 0))
    throw new OperationError("pickup_required");
  if (
    !items.length ||
    new Set(items.map((item) => item.product_code)).size !== items.length
  )
    throw new OperationError("product");
  const next = cloneWithAuthority(state);
  const nextRecord = next.returns[
    state.returns.indexOf(record)
  ] as OperationalReturn;
  const credits = new Map<
    string,
    {
      document: string;
      invoice_id: string;
      type: "credit_current_invoice" | "cash_or_other";
      covers: Record<string, number>;
      amount?: Decimal;
      item_amounts: Record<string, string>;
      notes: string[];
    }
  >();
  for (const input of items) {
    const line = nextRecord.lines.find(
      (item) => item.product_code === input.product_code,
    );
    if (!line) throw new OperationError("product");
    const count = new Decimal(input.quantity);
    if (
      !count.isFinite() ||
      count.lt(0) ||
      count.gt(returnItemProgress(nextRecord, line).available)
    )
      throw new OperationError("coverage");
    const weight =
      line.quantity_unit === "lb" ||
      (!line.quantity_unit &&
        next.products.find(
          (product) =>
            product.company_id === context.company_id &&
            product.code === line.product_code,
        )?.sold_by === "weight");
    if (!count.eq(count.toDecimalPlaces(weight ? 3 : 0)))
      throw new OperationError(weight ? "weight_quantity" : "quantity");
    const saveOutstanding = (outstandingQuantity: number) => {
      if (!validDate(input.expected_date))
        throw new OperationError("outstanding_date");
      line.outstanding_expected_date = input.expected_date;
      line.outstanding_note = input.note?.trim();
      const at = new Date().toISOString();
      (nextRecord.evidence ??= []).push({
        id: `return-outstanding-${Date.now()}-${line.product_code}`,
        kind: "outstanding",
        at,
        by: context.actor,
        ...actorAudit(state, context),
        received_date: input.expected_date,
        note: input.note?.trim(),
        quantities: {
          [line.product_code]: outstandingQuantity,
        },
      });
      next.activity.unshift({
        id: `return-outstanding-audit-${Date.now()}-${line.product_code}`,
        company_id: context.company_id,
        branch: context.branch,
        action: "return_resolution_outstanding",
        by: context.actor,
        ...actorAudit(state, context),
        at,
        product_code: line.product_code,
        reversible: false,
      });
    };
    if (input.kind === "outstanding") {
      if (returnItemProgress(nextRecord, line).outstanding > 0)
        saveOutstanding(returnItemProgress(nextRecord, line).outstanding);
      continue;
    }
    const leftover = new Decimal(returnItemProgress(nextRecord, line).available)
      .minus(count)
      .toNumber();
    if (leftover > 0) saveOutstanding(leftover);
    if (!count.gt(0)) throw new OperationError("quantity");
    if (input.kind === "replaced") {
      receiveReplacement(next, context, returnId, {
        product_code: input.replacement_product_code ?? line.product_code,
        qty: input.replacement_quantity ?? 0,
        covers: { [line.product_code]: count.toNumber() },
        date: input.received_date ?? companyDate(next.config),
        representative: input.representative ?? "",
        receipt: input.document ?? "",
        note: input.note,
      });
    } else if (input.kind === "written_off") {
      submitFinancialClaim(next, context, returnId, {
        type: "no_compensation",
        covers: { [line.product_code]: count.toNumber() },
        reason: input.note,
      });
    } else if (input.kind === "credited" || input.kind === "cash_or_other") {
      if (!input.document?.trim()) throw new OperationError("credit_document");
      if (input.kind === "credited" && !input.invoice_id)
        throw new OperationError("invoice");
      let amount: Decimal | undefined;
      if (
        input.amount !== undefined ||
        can(
          state,
          context,
          "returns.credit_post",
          domainScope(state, record, true),
        ).allowed
      ) {
        try {
          amount = new Decimal(input.amount ?? "");
        } catch {
          throw new OperationError("amount");
        }
        if (
          !amount.isFinite() ||
          !amount.gt(0) ||
          !amount.eq(amount.toDecimalPlaces(2))
        )
          throw new OperationError("amount");
      }
      const document = input.document.trim();
      const key = `${input.kind}:${document}`;
      const prior = credits.get(key);
      if (prior && prior.invoice_id !== input.invoice_id)
        throw new OperationError("single_invoice");
      const group = prior ?? {
        document,
        invoice_id: input.invoice_id ?? "",
        type:
          input.kind === "credited"
            ? ("credit_current_invoice" as const)
            : ("cash_or_other" as const),
        covers: {},
        item_amounts: {},
        notes: [],
      };
      group.covers[line.product_code] = count.toNumber();
      if (amount) {
        group.amount = (group.amount ?? new Decimal(0)).plus(amount);
        group.item_amounts[line.product_code] = amount.toFixed(2);
      }
      if (input.note?.trim()) group.notes.push(input.note.trim());
      credits.set(key, group);
    } else throw new OperationError("claim");
  }
  for (const group of credits.values())
    submitFinancialClaim(next, context, returnId, {
      type: group.type,
      document: group.document,
      invoice_id: group.invoice_id,
      covers: group.covers,
      amount: group.amount?.toFixed(2),
      item_amounts: group.amount ? group.item_amounts : undefined,
      reason: group.notes.join("\n") || undefined,
    });
  syncReturnCreditAlertsForReturn(
    next,
    context,
    nextRecord,
    "returns.operational_resolve",
  );
  Object.assign(state, next);
}
