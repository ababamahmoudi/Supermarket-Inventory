import Decimal from "decimal.js";
import { businessFingerprint } from "./business-fingerprint";
import { validFreeCaseGroup } from "./invoice-free-cases";
import { retainedReturnSettlementEvidence } from "./signed-return-pickups";
import type { DemoState, InvoiceLine, ReturnLine } from "./types";
import type { OperationalReturn } from "./operations";

export interface InvoiceFreeAcquisition {
  amount: string;
  quantity: number;
  unit_cost: string;
}

/** Exact source-backed claim allocation; rounded unit_cost is display evidence only. */
export interface ReturnAcquisitionBasis {
  source_key: string;
  source_amount: string;
  source_quantity: number;
  amount: string;
  quantity: number;
  /** A signed pickup/correction retains its own slice of the original claim. */
  offset?: number;
}

const money = (value: unknown): value is string =>
  typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value);
const units = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const allocate = (amount: string, quantity: number, total: number): Decimal =>
  new Decimal(amount)
    .times(quantity)
    .div(total)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** Actual acquired value after source-specific missing/refused/later quantities. */
export function invoiceFreeAcquisition(
  line: InvoiceLine,
): InvoiceFreeAcquisition | undefined {
  if (!line.free_case_group) return undefined;
  if (!validFreeCaseGroup(line))
    throw new Error("Review the free-case source before valuing its receipt.");
  const group = line.free_case_group;
  let quantity = 0;
  let amount = new Decimal(0);
  let refused = 0;
  let later = 0;
  for (const member of group.members) {
    if (group.decision === "mistake" && member.free) continue;
    const part = group.allocation.find((item) => item.member_id === member.id);
    if (
      !part ||
      !money(member.paper_amount) ||
      !units(member.qty) ||
      !member.qty
    )
      throw new Error("The free-case acquisition source is invalid.");
    const excluded = member.qty - part.received + part.refused;
    quantity += part.received - part.refused + part.later;
    refused += part.refused;
    later += part.later;
    // Missing/refused units share one cumulative allocation. Later delivery
    // restores only its own missing-member cents, never a free member's value.
    amount = amount
      .plus(member.paper_amount)
      .minus(allocate(member.paper_amount, excluded, member.qty))
      .plus(allocate(member.paper_amount, part.later, member.qty));
  }
  if (
    !units(quantity) ||
    refused !== (line.refused_units ?? 0) ||
    later !== (line.qty_later_received ?? 0) ||
    quantity !==
      line.qty_received_at_posting -
        (line.refused_units ?? 0) +
        (line.qty_later_received ?? 0) ||
    amount.lt(0)
  )
    throw new Error("Review the free-case receipt allocation.");
  return {
    amount: amount.toFixed(2),
    quantity,
    unit_cost: quantity
      ? amount.div(quantity).toFixed(4, Decimal.ROUND_HALF_UP)
      : "0.0000",
  };
}

export function freeAcquisitionSourceKey(
  company: string,
  invoice: string,
  index: number,
  line: InvoiceLine,
): string {
  return businessFingerprint({
    company,
    invoice,
    line: index,
    source: line.free_case_group?.source_fingerprint,
  });
}

function validBasis(basis: ReturnAcquisitionBasis): boolean {
  return (
    typeof basis.source_key === "string" &&
    !!basis.source_key &&
    money(basis.source_amount) &&
    money(basis.amount) &&
    units(basis.source_quantity) &&
    basis.source_quantity > 0 &&
    units(basis.quantity) &&
    basis.quantity > 0 &&
    basis.quantity <= basis.source_quantity &&
    new Decimal(basis.amount).lte(basis.source_amount) &&
    (basis.offset === undefined || units(basis.offset))
  );
}

/** Difference of cumulative cents makes split pickup/settlement conserve exactly. */
export function returnAcquisitionAmount(
  basis: ReturnAcquisitionBasis,
  offset: number,
  quantity: number,
): string {
  if (
    !validBasis(basis) ||
    !units(offset) ||
    !units(quantity) ||
    offset + quantity > basis.quantity
  )
    throw new Error("Review the exact return acquisition allocation.");
  return allocate(basis.amount, offset + quantity, basis.quantity)
    .minus(allocate(basis.amount, offset, basis.quantity))
    .toFixed(2);
}

export function groupedReturnLineAmount(
  line: Pick<ReturnLine, "qty" | "acquisition_basis">,
  offset = 0,
  quantity = line.qty,
): string | undefined {
  const basis = line.acquisition_basis;
  if (!basis) return undefined;
  if (basis.quantity !== line.qty)
    throw new Error("The grouped return quantity changed.");
  return returnAcquisitionAmount(basis, offset, quantity);
}

/** Reserve actual source value/units; physical recovery releases only unspent coverage. */
export function reserveFreeAcquisition(
  state: DemoState,
  company: string,
  sourceKey: string,
  source: InvoiceFreeAcquisition,
  quantity: number,
): ReturnAcquisitionBasis {
  if (
    !units(quantity) ||
    !quantity ||
    !units(source.quantity) ||
    !source.quantity
  )
    throw new Error("Choose a valid quantity from the grouped receipt.");
  let usedQuantity = 0;
  let usedAmount = new Decimal(0);
  for (const saved of state.returns) {
    if (saved.company_id !== company) continue;
    const record = saved as OperationalReturn;
    for (const line of record.lines) {
      const basis = line.acquisition_basis;
      if (!basis || basis.source_key !== sourceKey) continue;
      if (!validBasis(basis) || basis.quantity !== line.qty)
        throw new Error("Review earlier claims from this grouped receipt.");
      const recovered = Math.min(
        line.qty,
        record.recovered?.[line.product_code] ?? 0,
      );
      if (!units(recovered))
        throw new Error("Review recovered quantities from this receipt.");
      const settlement = retainedReturnSettlementEvidence(record);
      const covered = settlement.blocked.has(line.product_code)
        ? line.qty
        : (settlement.quantities.get(line.product_code) ?? 0);
      // Physical recovery can release an unclaimed tail. Compensation already
      // retained for those units never becomes another receipt claim budget.
      const retained = Math.max(line.qty - recovered, covered);
      if (!units(retained) || retained > line.qty)
        throw new Error("Review settled quantities from this receipt.");
      usedQuantity += retained;
      usedAmount = usedAmount.plus(returnAcquisitionAmount(basis, 0, retained));
    }
  }
  const remainingQuantity = source.quantity - usedQuantity;
  const remainingAmount = new Decimal(source.amount).minus(usedAmount);
  if (
    !units(remainingQuantity) ||
    quantity > remainingQuantity ||
    remainingAmount.lt(0)
  )
    throw new Error("This grouped receipt has no remaining claim coverage.");
  const amount = allocate(
    remainingAmount.toFixed(2),
    quantity,
    remainingQuantity,
  );
  return {
    source_key: sourceKey,
    source_amount: source.amount,
    source_quantity: source.quantity,
    amount: amount.toFixed(2),
    quantity,
  };
}
