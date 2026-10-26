import { returnItemProgress } from "./return-item-resolutions";
import { businessAuditRead } from "./business-audit-read";
import { returnClosureSubtype } from "./return-workflow";
import type { AuthenticatedActor } from "./authority-types";
import { can, requireCapability } from "./permissions";
import { domainScope, selectedLocations } from "./domain-authority";
import type { DemoState } from "./types";
import type { EvidenceEvent, OperationalReturn } from "./operations";
import type { ReturnMemo, ReturnMemoLine } from "./return-workflow";

export type ReturnMemoRead = Omit<
  ReturnMemo,
  "currency" | "deduct_expected_credit" | "expected_credit" | "lines"
> & {
  currency?: string;
  deduct_expected_credit?: boolean;
  expected_credit?: string;
  lines: (Omit<
    ReturnMemoLine,
    "unit_cost" | "cost_source" | "expected_credit"
  > & {
    unit_cost?: string;
    cost_source?: string;
    expected_credit?: string;
  })[];
};

export type ReturnEvidenceRead = Omit<EvidenceEvent, "photo"> & {
  photo_available: boolean;
};
export type OperationalReturnRead = Omit<
  OperationalReturn,
  "pickup_memos" | "evidence"
> & {
  pickup_memos?: ReturnMemoRead[];
  evidence?: ReturnEvidenceRead[];
  /** Computed against retained canonical evidence before money is omitted. */
  line_progress: Record<string, ReturnType<typeof returnItemProgress>>;
};

const privateKeys = new Set([
  "source_receipt",
  "creation_request_id",
  "creation_fingerprint",
  "unit_cost",
  "unit_cost_before_tax",
  "cost_source",
  "expected_credit",
  "amount",
  "item_amounts",
  "credit_amount",
  "verified_amount",
  "balance",
  "compensation_amount",
  "deduct_expected_credit",
  "currency",
]);

function operationalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(operationalValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !privateKeys.has(key))
      .map(([key, item]) => [key, operationalValue(item)]),
  );
}

/** Safe copy only. The retained signed memo and financial evidence never change. */
export function returnView(
  state: DemoState,
  actor: AuthenticatedActor,
  returnId: string,
) {
  const record: OperationalReturn | undefined = state.returns.find(
    (item) =>
      item.id === returnId && item.company_id === state.config.company.seed_key,
  );
  if (!record) throw new Error("Return not found");
  requireCapability(state, actor, "returns.read", domainScope(state, record));
  const progress = Object.fromEntries(
    record.lines.map((line) => [
      line.product_code,
      returnItemProgress(record, line),
    ]),
  );
  const operational = {
    ...record,
    creation_request_id: undefined,
    creation_fingerprint: undefined,
    closure_subtype: returnClosureSubtype(record),
    line_progress: progress,
    evidence: record.evidence?.map(({ photo, ...event }) => ({
      ...event,
      photo_available: Boolean(photo),
    })),
  };
  return can(state, actor, "returns.amount_read", domainScope(state, record))
    .allowed
    ? (businessAuditRead(operational) as OperationalReturnRead)
    : (businessAuditRead(
        operationalValue(operational),
      ) as OperationalReturnRead);
}

export function returnViews(state: DemoState, actor: AuthenticatedActor) {
  requireCapability(state, actor, "returns.read", domainScope(state));
  const locations = new Set(selectedLocations(state, actor, true));
  return state.returns
    .filter(
      (record) =>
        record.company_id === state.config.company.seed_key &&
        locations.has(record.branch) &&
        can(state, actor, "returns.read", domainScope(state, record)).allowed,
    )
    .map((record) => returnView(state, actor, record.id));
}

/** Printing uses exactly the same money projection as the on-screen detail. */
export function returnMemoView(
  state: DemoState,
  actor: AuthenticatedActor,
  returnId: string,
  memoId: string,
) {
  const record = returnView(state, actor, returnId);
  const memo = record.pickup_memos?.find((item) => item.id === memoId);
  if (!memo) throw new Error("Return memo not found");
  return memo;
}
