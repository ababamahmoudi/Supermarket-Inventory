import Decimal from "decimal.js";
import { freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { can, requireCapability } from "./permissions";
import { domainScope, selectedLocations } from "./domain-authority";
import {
  retainedReturnSettlementEvidence,
  signedReturnPickupQuantities,
} from "./signed-return-pickups";
import { returnUnpickedQuantity, type OperationalReturn } from "./operations";
import type { DemoState } from "./types";
const Amount = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_UP,
});
export interface ReturnOverviewCredit {
  return_id: string;
  amount: string | null;
  currency: string | null;
}
function validAmount(value: unknown, places: number): Decimal | null {
  if (
    typeof value !== "string" ||
    !new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(value)
  )
    return null;
  const parsed = new Amount(value);
  return parsed.isFinite() && parsed.gte(0) ? parsed : null;
}
function credit(
  record: OperationalReturn,
): Omit<ReturnOverviewCredit, "return_id"> {
  const activeMemos = (record.pickup_memos ?? []).filter(
    (memo) =>
      memo.company_id === record.company_id &&
      memo.branch === record.branch &&
      memo.return_id === record.id &&
      memo.signed_evidence_reference?.trim() &&
      memo.representative?.trim() &&
      !(record.pickup_memos ?? []).some(
        (next) => next.correction_of === memo.id,
      ),
  );
  const currencies = new Set(
    [record.currency, ...activeMemos.map((memo) => memo.currency)].filter(
      (value): value is string => value !== undefined,
    ),
  );
  const currency =
    currencies.size === 1 && /^[A-Z]{3}$/.test([...currencies][0])
      ? [...currencies][0]
      : null;
  if (
    !currency ||
    !record.lines.length ||
    record.lines.some((line) => {
      const quantity = new Amount(line.qty);
      return (
        !quantity.isFinite() ||
        quantity.lte(0) ||
        !quantity.eq(
          quantity.toDecimalPlaces(line.quantity_unit === "lb" ? 3 : 0),
        ) ||
        quantity.gt(Number.MAX_SAFE_INTEGER)
      );
    })
  )
    return { amount: null, currency };
  const settled = retainedReturnSettlementEvidence(record);
  if (settled.blocked.size) return { amount: null, currency };
  const signed = signedReturnPickupQuantities(record);
  if (
    record.lines.some(
      (line) =>
        !new Amount(line.picked_up ?? 0).eq(signed.get(line.product_code) ?? 0),
    )
  )
    return { amount: null, currency };
  const frozenCosts = record.lines.map((line) =>
    validAmount(line.unit_cost, 4),
  );
  const hasOriginalCosts = !!record.currency && frozenCosts.every(Boolean);
  if (record.status === "cancelled" && hasOriginalCosts)
    return { amount: "0.00", currency };
  const codes = new Set(record.lines.map((line) => line.product_code));
  const totals = new Map<string, Decimal>();
  for (const memo of activeMemos)
    for (const line of memo.lines) {
      if (!codes.has(line.product_code)) return { amount: null, currency };
      totals.set(
        line.product_code,
        (totals.get(line.product_code) ?? new Amount(0)).plus(line.quantity),
      );
    }
  if (
    record.lines.some(
      (line) =>
        !(totals.get(line.product_code) ?? new Amount(0)).eq(
          signed.get(line.product_code) ?? 0,
        ),
    )
  )
    return { amount: null, currency };
  // A legacy record cannot extend signed valuation to unknown unpicked goods.
  if (
    !hasOriginalCosts &&
    (!activeMemos.length ||
      record.lines.some((line) => returnUnpickedQuantity(record, line) > 0))
  )
    return { amount: null, currency };
  const consumed = new Map<string, Decimal>(
    [...settled.quantities].map(([code, quantity]) => [
      code,
      new Amount(quantity),
    ]),
  );
  let total = new Amount(0);
  for (const memo of activeMemos)
    for (const line of memo.lines) {
      const retained = validAmount(line.expected_credit, 2);
      if (!retained || line.quantity <= 0) return { amount: null, currency };
      const used = Amount.min(
        line.quantity,
        consumed.get(line.product_code) ?? 0,
      );
      consumed.set(
        line.product_code,
        Amount.max(
          0,
          new Amount(consumed.get(line.product_code) ?? 0).minus(used),
        ),
      );
      // Match the existing provisional-credit rule: prorate the retained cents,
      // then round each signed memo line half-up before adding it to the total.
      total = total.plus(
        retained
          .times(new Amount(line.quantity).minus(used))
          .div(line.quantity)
          .toDecimalPlaces(2),
      );
    }
  if (hasOriginalCosts)
    record.lines.forEach((line, index) => {
      // Unpicked expected credit is a separate line at the original frozen cost.
      total = total.plus(
        new Amount(returnUnpickedQuantity(record, line))
          .times(frozenCosts[index]!)
          .toDecimalPlaces(2),
      );
    });
  return {
    amount:
      ["resolved", "cancelled"].includes(record.status) && total.gt(0)
        ? null
        : total.toFixed(2),
    currency,
  };
}
/** Informational retained credit only. Reading creates no ledger/stock/pickup side effects. */
export function returnOverviewCredits(
  state: DemoState,
  actor: AuthenticatedActor,
): ReturnOverviewCredit[] {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "returns.amount_read", domainScope(state));
  const locations = new Set(selectedLocations(state, actor, true));
  return state.returns
    .filter(
      (record) =>
        record.company_id === actor.company_id &&
        locations.has(record.branch) &&
        can(state, actor, "returns.amount_read", domainScope(state, record))
          .allowed,
    )
    .map((record) => {
      try {
        return { return_id: record.id, ...credit(record as OperationalReturn) };
      } catch {
        return {
          return_id: record.id,
          amount: null,
          currency:
            record.currency && /^[A-Z]{3}$/.test(record.currency)
              ? record.currency
              : null,
        };
      }
    });
}
