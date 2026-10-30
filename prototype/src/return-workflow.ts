import { requireSystemReconciliation } from "./authority-repository";
import { businessFingerprint } from "./business-fingerprint";
import type { SystemAttribution, Capability } from "./authority-types";
import { freshActor } from "./authority";
import {
  pickupLineValuations,
  returnEvidenceActor,
  type InternalPurchaseEvidence,
} from "./purchase-evidence.internal";
import { requireCapability } from "./permissions";
import { actorAudit, domainScope } from "./domain-authority";
import Decimal from "decimal.js";
import { retainedReturnSettlementEvidence } from "./signed-return-pickups";
import { companyDate } from "./invoice";
import {
  OperationError,
  type OperationalReturn,
  type OperationsContext,
} from "./operations";
import { branchLabel } from "./settings";
import { supplierMatches, supplierRecords } from "./supplier-editor";
import type { DemoState, ReturnRecord } from "./types";
import {
  returnAcquisitionAmount,
  type ReturnAcquisitionBasis,
} from "./invoice-free-acquisition";

export interface ReturnMemoLine {
  acquisition_basis?: ReturnAcquisitionBasis;
  product_code: string;
  name_en: string;
  name_fa: string;
  quantity: number;
  quantity_unit: "units" | "lb";
  unit_cost: string;
  cost_source: string;
  expected_credit: string;
}
export interface ReturnMemo {
  id: string;
  reference: string;
  company_id: string;
  branch: string;
  return_id: string;
  supplier: string;
  company_name: string;
  location_name_en: string;
  location_name_fa: string;
  picked_up_at: string;
  date: string;
  created_by: string;
  created_by_user_id?: string;
  created_by_role_snapshot?: OperationsContext["role"];
  representative: string;
  signed_evidence_reference: string;
  pickup_request_id?: string;
  currency: string;
  deduct_expected_credit: boolean;
  lines: ReturnMemoLine[];
  expected_credit: string;
  document_language?: "en" | "bilingual";
  location_address?: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_email?: string;
  correction_of?: string;
}
export interface ReturnPickupCorrection {
  id: string;
  company_id: string;
  branch: string;
  return_id: string;
  memo_id: string;
  previous_memo_id: string;
  reason: string;
  by: string;
  at: string;
  before: Record<string, number>;
  after: Record<string, number>;
}
export type ReturnUiStatus =
  "waiting_for_pickup" | "waiting_for_credit" | "closed" | "cancelled";
export type ReturnClosureSubtype = "credited" | "replaced" | "written_off";
export interface PendingReturnCredit {
  return_id: string;
  memo_id: string;
  reference: string;
  supplier: string;
  branch: string;
  company_id: string;
  amount: string;
  picked_up_at: string;
}

export function returnUiStatus(
  record: Pick<ReturnRecord, "status" | "lines">,
): ReturnUiStatus {
  if (record.status === "cancelled") return "cancelled";
  if (record.status === "resolved") return "closed";
  if (
    record.status === "open" &&
    !record.lines.some((line) => (line.picked_up ?? 0) > 0)
  )
    return "waiting_for_pickup";
  return "waiting_for_credit";
}
export function returnClosureSubtype(
  record: Omit<OperationalReturn, "pickup_memos">,
): ReturnClosureSubtype | undefined {
  if (record.status !== "resolved") return undefined;
  const events = record.evidence ?? [];
  const actualKinds = new Set(
    events
      .filter(
        (event) =>
          event.kind === "replacement" || event.kind === "claim_posted",
      )
      .map((event) =>
        event.kind === "replacement"
          ? "replaced"
          : record.claims?.find(
                (claim) =>
                  claim.document === event.document &&
                  claim.status === "posted",
              )?.type === "no_compensation"
            ? "written_off"
            : "credited",
      ),
  );
  if (
    record.lines.some(
      (line) =>
        line.pickup_shortfall &&
        line.pickup_shortfall.outcome !== "keep_for_next_pickup",
    )
  )
    actualKinds.add("written_off");
  if (actualKinds.size > 1) return undefined;
  if (record.closure_subtype) return record.closure_subtype;
  const claims = record.claims ?? [];
  if (
    claims.some(
      (claim) => claim.status === "posted" && claim.type !== "no_compensation",
    ) ||
    record.credit_document ||
    record.compensation_amount
  )
    return "credited";
  if (
    claims.some(
      (claim) => claim.status === "posted" && claim.type === "no_compensation",
    ) ||
    record.resolution === "no_compensation"
  )
    return "written_off";
  if (record.replacement_received || record.resolution?.includes("replacement"))
    return "replaced";
  return undefined;
}
export function returnUiStatusLabel(
  status: string,
  t: (en: string, fa: string) => string,
) {
  return (
    {
      waiting_for_pickup: t("Waiting for pickup", "در انتظار جمع‌آوری"),
      waiting_for_credit: t("Waiting for credit", "در انتظار اعتبار"),
      closed: t("Closed", "بسته‌شده"),
      cancelled: t("Cancelled", "لغوشده"),
      credited: t("Credited", "اعتبار دریافت‌شده"),
      replaced: t("Replaced", "جایگزین‌شده"),
      written_off: t("Written off", "سوخت‌شده"),
    }[status] ?? status
  );
}
export function returnStatusLabel(
  record: Omit<OperationalReturn, "pickup_memos">,
  t: (en: string, fa: string) => string,
) {
  const status = returnUiStatus(record);
  const outcome = returnClosureSubtype(record);
  return `${returnUiStatusLabel(status, t)}${outcome ? ` (${returnUiStatusLabel(outcome, t)})` : ""}`;
}
export const returnSettings = (state: DemoState) =>
  state.config.returns ?? {
    deduct_expected_credit_at_pickup: true,
    waiting_credit_days: 14,
  };
export function updateReturnSettings(
  state: DemoState,
  context: OperationsContext,
  settings: NonNullable<DemoState["config"]["returns"]>,
) {
  context = freshActor(state, context);
  requireCapability(state, context, "settings.manage", domainScope(state));
  if (context.company_id !== state.config.company.seed_key)
    throw new OperationError("scope");
  if (
    !Number.isSafeInteger(settings.waiting_credit_days) ||
    settings.waiting_credit_days < 1 ||
    typeof settings.deduct_expected_credit_at_pickup !== "boolean"
  )
    throw new OperationError("return_days");
  const before = structuredClone(returnSettings(state));
  state.config.returns = structuredClone(settings);
  syncReturnCreditAlertsForSettings(state, context);
  state.activity.unshift({
    id: `return-settings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    company_id: context.company_id,
    branch: "all",
    action: "Return settings changed",
    by: context.actor,
    ...actorAudit(state, context),
    at: new Date().toISOString(),
    reversible: true,
    scope: "all",
    entity_type: "settings",
    entity_id: "returns",
    before,
    after: structuredClone(settings),
  });
}

/** A receipt-cost snapshot must never be relabelled after company settings change. */
export function requireReturnSourceCurrency(
  state: DemoState,
  record: ReturnRecord,
) {
  if (
    record.creation_request_id &&
    (!record.currency || record.currency !== state.config.company.currency)
  )
    throw new OperationError("return_currency");
}

/** Prepare all snapshots before the caller changes a pickup or its evidence. */
export function createReturnMemo(
  state: DemoState,
  context: OperationsContext,
  record: ReturnRecord,
  input: {
    quantities: Record<string, number>;
    representative: string;
    slip: string;
    correction_of?: string;
    request_id?: string;
  },
  evidence: InternalPurchaseEvidence,
  at = new Date().toISOString(),
): ReturnMemo {
  context = freshActor(state, context);
  if (
    context.company_id !== state.config.company.seed_key ||
    record.company_id !== context.company_id ||
    !state.returns.includes(record)
  )
    throw new OperationError("scope");
  const evidenceActor = returnEvidenceActor(state, evidence, record);
  if (
    evidenceActor.user_id !== context.user_id ||
    evidenceActor.session_id !== context.session_id
  )
    throw new OperationError("scope");
  requireReturnSourceCurrency(state, record);
  const sameSupplier = supplierRecords(state).find(
    (supplier) =>
      supplier.company_id === context.company_id &&
      supplierMatches(supplier, record.supplier),
  );
  const valuations = pickupLineValuations(state, evidence);
  const lines = record.lines
    .filter((line) => (input.quantities[line.product_code] ?? 0) > 0)
    .map((line) => {
      const product = state.products.find(
        (item) =>
          item.company_id === context.company_id &&
          item.code === line.product_code,
      );
      if (!product) throw new OperationError("product");
      const valuation = valuations.find(
        (item) => item.product_code === line.product_code,
      );
      if (!valuation) throw new OperationError("return_cost");
      const cost = new Decimal(valuation.unit_cost);
      const quantity = input.quantities[line.product_code];
      const corrected = input.correction_of
        ? record.pickup_memos?.find((memo) => memo.id === input.correction_of)
        : undefined;
      if (input.correction_of && !corrected)
        throw new OperationError("return_cost");
      const offset = new Decimal(line.picked_up ?? 0)
        .minus(
          corrected?.lines.find(
            (item) => item.product_code === line.product_code,
          )?.quantity ?? 0,
        )
        .toNumber();
      const acquisition = valuation.acquisition_basis;
      return {
        product_code: line.product_code,
        name_en: product.name_en,
        name_fa: product.name_fa,
        quantity,
        quantity_unit:
          line.quantity_unit ?? (product.sold_by === "weight" ? "lb" : "units"),
        unit_cost: cost.toFixed(4),
        cost_source: valuation.cost_source,
        expected_credit: acquisition
          ? returnAcquisitionAmount(acquisition, offset, quantity)
          : cost
              .times(quantity)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
              .toFixed(2),
        ...(acquisition
          ? { acquisition_basis: { ...acquisition, offset } }
          : {}),
      };
    });
  const sequence =
    state.returns
      .filter((item) => item.company_id === context.company_id)
      .flatMap((item) => item.pickup_memos ?? [])
      .reduce(
        (max, memo) =>
          Math.max(max, Number(/^RM-(\d+)$/.exec(memo.reference)?.[1] ?? 0)),
        0,
      ) + 1;
  const reference = `RM-${String(sequence).padStart(4, "0")}`;
  return {
    id: `return-memo-${context.company_id}-${sequence}`,
    reference,
    company_id: context.company_id,
    branch: record.branch,
    return_id: record.id,
    supplier: record.supplier,
    company_name: state.config.company.name,
    location_name_en: branchLabel(state.config, record.branch, "en"),
    location_name_fa: branchLabel(state.config, record.branch, "fa"),
    picked_up_at: at,
    date: companyDate(state.config),
    created_by: context.actor,
    created_by_user_id: context.user_id,
    created_by_role_snapshot: context.role,
    representative: input.representative.trim(),
    signed_evidence_reference: input.slip.trim(),
    pickup_request_id: input.request_id,
    currency: record.creation_request_id
      ? record.currency!
      : state.config.company.currency,
    deduct_expected_credit:
      returnSettings(state).deduct_expected_credit_at_pickup,
    lines,
    expected_credit: lines
      .reduce((total, line) => total.plus(line.expected_credit), new Decimal(0))
      .toFixed(2),
    document_language: state.config.supplier_documents?.return_memo ?? "en",
    location_address: state.config.branches.find(
      (branch) =>
        (branch.id ?? branch.name) === record.branch ||
        branch.name === record.branch,
    )?.address,
    supplier_address: sameSupplier?.address,
    supplier_phone: sameSupplier?.phone,
    supplier_email: sameSupplier?.email,
  };
}

/** Remaining quantities consume oldest pickup snapshots, preserving partial coverage. */
export function pendingReturnCredits(
  state: DemoState,
  context: OperationsContext,
  throughDate?: string,
): PendingReturnCredit[] {
  context = freshActor(state, context);
  requireCapability(state, context, "returns.amount_read", domainScope(state));
  if (context.company_id !== state.config.company.seed_key)
    throw new OperationError("scope");
  return state.returns
    .filter(
      (record) =>
        record.company_id === context.company_id &&
        (context.branch === "all"
          ? context.allowed_branches.includes(record.branch)
          : record.branch === context.branch),
    )
    .flatMap((record) => {
      const evidence = (record as OperationalReturn).evidence ?? [];
      const settlements = evidence.filter(
        (event) =>
          event.kind === "replacement" || event.kind === "claim_posted",
      );
      const futureOutcome =
        throughDate &&
        evidence.some(
          (event) =>
            (event.kind === "replacement" ||
              event.kind === "claim_posted" ||
              event.kind === "pickup_correction" ||
              event.kind.startsWith("cancellation")) &&
            companyDate(state.config, new Date(event.at)) > throughDate,
        );
      if (returnUiStatus(record) !== "waiting_for_credit" && !futureOutcome)
        return [];
      const retainedSettlements = retainedReturnSettlementEvidence(record);
      const covered = new Map(
        record.lines.map((line) => [
          line.product_code,
          throughDate && settlements.length
            ? settlements
                .filter(
                  (event) =>
                    companyDate(state.config, new Date(event.at)) <=
                    throughDate,
                )
                .reduce(
                  (sum, event) =>
                    sum + (event.quantities?.[line.product_code] ?? 0),
                  0,
                )
            : (retainedSettlements.quantities.get(line.product_code) ?? 0),
        ]),
      );
      return (record.pickup_memos ?? [])
        .filter(
          (memo) =>
            memo.company_id === context.company_id &&
            memo.return_id === record.id &&
            memo.branch === record.branch &&
            memo.currency === state.config.company.currency,
        )
        .filter(
          (memo) =>
            !(record.pickup_memos ?? []).some(
              (correction) =>
                correction.correction_of === memo.id &&
                (!throughDate || correction.date <= throughDate),
            ),
        )
        .map((memo) => {
          const amount = memo.lines.reduce((total, line) => {
            const consumed = Math.min(
              line.quantity,
              covered.get(line.product_code) ?? 0,
            );
            covered.set(
              line.product_code,
              Decimal.max(
                0,
                new Decimal(covered.get(line.product_code) ?? 0).minus(
                  consumed,
                ),
              ).toNumber(),
            );
            // Deduct the frozen full line amount, with proportional remaining rounding.
            return total.plus(
              line.acquisition_basis
                ? returnAcquisitionAmount(
                    line.acquisition_basis,
                    (line.acquisition_basis.offset ?? 0) + consumed,
                    line.quantity - consumed,
                  )
                : new Decimal(line.expected_credit)
                    .times(new Decimal(line.quantity).minus(consumed))
                    .div(line.quantity)
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
            );
          }, new Decimal(0));
          return {
            return_id: record.id,
            memo_id: memo.id,
            reference: memo.reference,
            supplier: record.supplier,
            branch: record.branch,
            company_id: record.company_id,
            amount:
              memo.deduct_expected_credit &&
              (!throughDate || memo.date <= throughDate)
                ? amount.toFixed(2)
                : "0.00",
            picked_up_at: memo.picked_up_at,
          };
        })
        .filter((claim) => new Decimal(claim.amount).gt(0));
    });
}

/** System reconciliation uses a stable return ID; never modifies other companies. */
function syncReturnCreditAlertsDraft(
  state: DemoState,
  asOf = companyDate(state.config),
  changedReturn?: ReturnRecord,
) {
  const company = state.config.company.seed_key;
  const threshold = returnSettings(state).waiting_credit_days;
  for (const record of state.returns.filter(
    (item) =>
      item.company_id === company &&
      (changedReturn === undefined || item === changedReturn),
  )) {
    const pickup =
      record.pickup_memos?.[0]?.date ??
      (record.picked_up_at
        ? record.picked_up_at.length === 10
          ? record.picked_up_at
          : companyDate(state.config, new Date(record.picked_up_at))
        : undefined) ??
      (() => {
        const event = (record as OperationalReturn).evidence?.find(
          (item) => item.kind === "pickup",
        );
        return event
          ? companyDate(state.config, new Date(event.at))
          : undefined;
      })();
    const days = pickup
      ? Math.floor(
          (Date.parse(`${asOf}T00:00:00Z`) -
            Date.parse(`${pickup}T00:00:00Z`)) /
            86400000,
        )
      : 0;
    const overdue =
      returnUiStatus(record) === "waiting_for_credit" && days > threshold;
    const id = `return-credit-overdue:${company}:${record.branch}:${record.id}`;
    const existing = state.alerts.filter(
      (alert) =>
        alert.company_id === company &&
        alert.type === "return_credit_overdue" &&
        alert.return_id === record.id &&
        alert.branch === record.branch,
    );
    const canonical = (existing.find((alert) => alert.id === id) ??
      existing[0]) as
      | ((typeof existing)[number] & { return_credit_auto_resolved?: boolean })
      | undefined;
    if (overdue && !canonical)
      state.alerts.push({
        id,
        company_id: company,
        branch: record.branch,
        type: "return_credit_overdue",
        product_code: record.lines[0]?.product_code ?? "",
        return_id: record.id,
        supplier: record.supplier,
        status: "pending",
      });
    if (canonical && !overdue && canonical.status !== "resolved") {
      canonical.status = "resolved";
      canonical.return_credit_auto_resolved = true;
    }
    if (canonical && overdue && canonical.return_credit_auto_resolved) {
      canonical.status = "pending";
      delete canonical.return_credit_auto_resolved;
    }
    for (const duplicate of existing.filter((alert) => alert !== canonical))
      duplicate.status = "resolved";
  }
}

export function returnFinancialFingerprint(
  state: DemoState,
  context: OperationsContext,
  id: string,
) {
  context = freshActor(state, context);
  const records = state.returns.filter(
    (item) =>
      item.id === id &&
      item.company_id === context.company_id &&
      item.company_id === state.config.company.seed_key &&
      (context.branch === "all"
        ? context.allowed_branches.includes(item.branch)
        : item.branch === context.branch),
  );
  if (records.length !== 1) throw new OperationError("scope");
  const record = records[0];
  requireCapability(
    state,
    context,
    "returns.amount_read",
    domainScope(state, record),
  );
  return businessFingerprint({
    record,
    currency: state.config.company.currency,
    ledger: state.ledger.filter(
      (entry) =>
        entry.company_id === record?.company_id &&
        entry.supplier === record?.supplier &&
        entry.branch === record?.branch,
    ),
  });
}

/** Only the active repository callback reconciles automatic reminders company-wide. */
export function syncReturnCreditAlerts(
  state: DemoState,
  attribution: SystemAttribution,
  asOf = companyDate(state.config, new Date(attribution.applied_at)),
) {
  requireSystemReconciliation(state, attribution, "return_credit_reminders");
  return syncReturnCreditAlertsDraft(state, asOf);
}
export function syncReturnCreditAlertsForSettings(
  state: DemoState,
  actor: OperationsContext,
) {
  actor = freshActor(state, actor);
  requireCapability(
    state,
    actor,
    "settings.manage",
    domainScope(state, undefined, true),
  );
  return syncReturnCreditAlertsDraft(state);
}
/** Reconcile only the canonical return changed by an authorised transaction. */
export function syncReturnCreditAlertsForReturn(
  state: DemoState,
  actor: OperationsContext,
  record: ReturnRecord,
  source:
    | "returns.pickup_record"
    | "returns.pickup_correct"
    | "returns.operational_resolve"
    | "returns.credit_post"
    | "returns.financial_cancel_review",
) {
  actor = freshActor(state, actor);
  const allowed: readonly Capability[] = [
    "returns.pickup_record",
    "returns.pickup_correct",
    "returns.operational_resolve",
    "returns.credit_post",
    "returns.financial_cancel_review",
  ];
  if (!allowed.includes(source)) throw new OperationError("scope");
  if (
    !state.returns.includes(record) ||
    record.company_id !== actor.company_id ||
    record.company_id !== state.config.company.seed_key
  )
    throw new OperationError("scope");
  requireCapability(state, actor, source, {
    ...domainScope(state, record, true),
    location_policy: [
      "returns.pickup_correct",
      "returns.credit_post",
      "returns.financial_cancel_review",
    ].includes(source)
      ? "retained_correction"
      : "active_only",
  });
  return syncReturnCreditAlertsDraft(state, companyDate(state.config), record);
}
