import Decimal from "decimal.js";
import { companyDate } from "./invoice";
import {
  OperationError,
  type OperationalReturn,
  type OperationsContext,
} from "./operations";
import { branchLabel } from "./settings";
import { supplierItemFacts } from "./supplier-items";
import { supplierMatches, supplierRecords } from "./supplier-editor";
import type { DemoState, ReturnRecord } from "./types";

export interface ReturnMemoLine {
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
  representative: string;
  signed_evidence_reference: string;
  currency: string;
  deduct_expected_credit: boolean;
  lines: ReturnMemoLine[];
  expected_credit: string;
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

export function returnUiStatus(record: ReturnRecord): ReturnUiStatus {
  if (record.status === "cancelled") return "cancelled";
  if (record.status === "resolved") return "closed";
  if (
    record.status === "open" &&
    !(
      record.pickup_memos?.length ||
      record.lines.some((line) => (line.picked_up ?? 0) > 0)
    )
  )
    return "waiting_for_pickup";
  return "waiting_for_credit";
}
export function returnClosureSubtype(
  record: ReturnRecord,
): ReturnClosureSubtype | undefined {
  if (record.status !== "resolved") return undefined;
  if (record.closure_subtype) return record.closure_subtype;
  const claims = (record as OperationalReturn).claims ?? [];
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
  record: ReturnRecord,
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
  if (context.role !== "supervisor") throw new OperationError("supervisor");
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
  syncReturnCreditAlerts(state);
  state.activity.unshift({
    id: `return-settings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    company_id: context.company_id,
    branch: "all",
    action: "Return settings changed",
    by: context.actor,
    at: new Date().toISOString(),
    reversible: true,
    scope: "all",
    entity_type: "settings",
    entity_id: "returns",
    before,
    after: structuredClone(settings),
  });
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
  },
  at = new Date().toISOString(),
): ReturnMemo {
  if (
    context.company_id !== state.config.company.seed_key ||
    record.company_id !== context.company_id ||
    context.branch !== record.branch ||
    context.role === "cashier"
  )
    throw new OperationError("scope");
  const sameSupplier = supplierRecords(state).find(
    (supplier) =>
      supplier.company_id === context.company_id &&
      supplierMatches(supplier, record.supplier),
  );
  const matches = (name: string) =>
    sameSupplier
      ? supplierMatches(sameSupplier, name)
      : name === record.supplier;
  const facts = supplierItemFacts(
    state,
    context.company_id,
    record.supplier,
    record.branch,
  );
  const lines = record.lines
    .filter((line) => (input.quantities[line.product_code] ?? 0) > 0)
    .map((line) => {
      const product = state.products.find(
        (item) =>
          item.company_id === context.company_id &&
          item.code === line.product_code,
      );
      if (!product) throw new OperationError("product");
      const purchases = facts
        .filter((fact) => fact.product_code === line.product_code)
        .flatMap((fact) => fact.history)
        .filter(
          (purchase) =>
            !record.linked_invoice ||
            purchase.invoice_id === record.linked_invoice,
        )
        .sort((a, b) => b.at.localeCompare(a.at));
      const purchase = purchases[0];
      const sameLatest = purchases.filter((item) => item.at === purchase?.at);
      if (
        sameLatest.some(
          (item) =>
            item.unit_cost_before_tax !== purchase?.unit_cost_before_tax,
        )
      )
        throw new OperationError("return_cost");
      const storedCost = (line as typeof line & { unit_cost?: string })
        .unit_cost;
      const sourceCost =
        storedCost ??
        purchase?.unit_cost_before_tax ??
        (matches(product.main_supplier)
          ? product.last_cost_before_tax
          : undefined);
      if (!sourceCost) throw new OperationError("return_cost");
      let cost: Decimal;
      try {
        cost = new Decimal(sourceCost).toDecimalPlaces(
          4,
          Decimal.ROUND_HALF_UP,
        );
      } catch {
        throw new OperationError("return_cost");
      }
      if (!cost.isFinite() || cost.lt(0))
        throw new OperationError("return_cost");
      const quantity = input.quantities[line.product_code];
      return {
        product_code: line.product_code,
        name_en: product.name_en,
        name_fa: product.name_fa,
        quantity,
        quantity_unit:
          line.quantity_unit ?? (product.sold_by === "weight" ? "lb" : "units"),
        unit_cost: cost.toFixed(4),
        cost_source: storedCost
          ? `return-line:${record.id}:${line.product_code}`
          : purchase
            ? `invoice:${purchase.invoice_id}:${purchase.line_index}`
            : `catalog-last-cost:${product.code}`,
        expected_credit: cost
          .times(quantity)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toFixed(2),
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
    representative: input.representative.trim(),
    signed_evidence_reference: input.slip.trim(),
    currency: state.config.company.currency,
    deduct_expected_credit:
      returnSettings(state).deduct_expected_credit_at_pickup,
    lines,
    expected_credit: lines
      .reduce((total, line) => total.plus(line.expected_credit), new Decimal(0))
      .toFixed(2),
  };
}

/** Remaining quantities consume oldest pickup snapshots, preserving partial coverage. */
export function pendingReturnCredits(
  state: DemoState,
  context: OperationsContext,
  throughDate?: string,
): PendingReturnCredit[] {
  if (context.role !== "supervisor") throw new OperationError("supervisor");
  if (context.company_id !== state.config.company.seed_key)
    throw new OperationError("scope");
  return state.returns
    .filter(
      (record) =>
        record.company_id === context.company_id &&
        (context.branch === "all" || record.branch === context.branch),
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
              event.kind.startsWith("cancellation")) &&
            companyDate(state.config, new Date(event.at)) > throughDate,
        );
      if (returnUiStatus(record) !== "waiting_for_credit" && !futureOutcome)
        return [];
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
            : (line.settled ??
              line.replaced ??
              (record.replacement_received && record.lines.length === 1
                ? record.replacement_received.covers_original_qty
                : 0)),
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
              new Decimal(line.expected_credit)
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
export function syncReturnCreditAlerts(
  state: DemoState,
  asOf = companyDate(state.config),
) {
  const company = state.config.company.seed_key;
  const threshold = returnSettings(state).waiting_credit_days;
  for (const record of state.returns.filter(
    (item) => item.company_id === company,
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
    const id = `return-credit-overdue:${company}:${record.id}`;
    const existing = state.alerts.filter(
      (alert) =>
        alert.company_id === company &&
        alert.type === "return_credit_overdue" &&
        alert.return_id === record.id,
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

export function returnFinancialFingerprint(state: DemoState, id: string) {
  const record = state.returns.find(
    (item) =>
      item.id === id && item.company_id === state.config.company.seed_key,
  );
  return JSON.stringify({
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
