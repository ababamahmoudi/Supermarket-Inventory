import Decimal from "decimal.js";
import type { InvoiceCreditAllocation } from "./types";
import type { InvoiceEditableLine } from "./invoice-edit-types";
import { invoiceLineId } from "./invoice-line-links";

type AllocationCharge = {
  amount: string;
  low_confidence_fields?: string[];
  applies_to?: "invoice_total" | "chosen_items";
  chosen_line_ids?: string[];
  allocations?: InvoiceCreditAllocation[];
};

type AllocationInvoice = {
  status?: string;
  lines: InvoiceEditableLine[];
  other_charges?: AllocationCharge[];
};

const HALF_UP = Decimal.ROUND_HALF_UP;

function decimal(value: string | undefined): Decimal | null {
  try {
    const parsed = new Decimal(String(value ?? "").trim());
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/** A discount or credit is a charge with a negative amount. */
export function isInvoiceCredit(charge: { amount: string }): boolean {
  return Boolean(decimal(charge.amount)?.isNegative());
}

/** The unit cost used for pricing and stock: the allocated cost when a credit applies. */
export function invoiceLineCost(line: {
  unit_cost_before_tax: string;
  allocated_unit_cost_before_tax?: string;
}): string {
  return line.allocated_unit_cost_before_tax ?? line.unit_cost_before_tax;
}

/**
 * Split one credit's pre-tax amount across the chosen lines in proportion to
 * their paper line totals. Shares round half-up to cents; the last chosen line
 * takes the remainder so the shares add up exactly. Decimal only.
 */
export function splitInvoiceCredit(
  credit: Decimal.Value,
  lineTotals: readonly Decimal.Value[],
): string[] {
  const total = new Decimal(credit).abs();
  const weights = lineTotals.map((value) => new Decimal(value));
  const sum = Decimal.sum(0, ...weights);
  if (!weights.length || sum.lte(0)) return [];
  const shares = weights.map((weight, index) =>
    index === weights.length - 1
      ? new Decimal(0)
      : total.times(weight).div(sum).toDecimalPlaces(2, HALF_UP),
  );
  shares[shares.length - 1] = total.minus(Decimal.sum(0, ...shares));
  return shares.map((share) => share.toFixed(2));
}

/**
 * Recompute every chosen-items credit on a draft: each chosen line's unit cost
 * goes down by its share. Paper line totals, subtotal, tax, total and payable
 * never change. An unanswered credit becomes an `applies_to` check.
 */
export function allocateInvoiceCredits(invoice: AllocationInvoice): void {
  if (invoice.status === "posted" || invoice.status === "cancelled") return;
  for (const line of invoice.lines) {
    delete line.allocated_unit_cost_before_tax;
    delete line.allocated_source_cost_before_tax;
  }
  const reductions = new Map<number, Decimal>();
  for (const charge of invoice.other_charges ?? []) {
    delete charge.allocations;
    const credit = isInvoiceCredit(charge);
    const checks = charge.low_confidence_fields ?? [];
    if (!credit) {
      delete charge.applies_to;
      delete charge.chosen_line_ids;
      if (checks.includes("applies_to"))
        charge.low_confidence_fields = checks.filter(
          (field) => field !== "applies_to",
        );
      continue;
    }
    const chosen = (charge.chosen_line_ids ?? [])
      .map((id) =>
        invoice.lines.findIndex(
          (line, index) => invoiceLineId(line, index) === id,
        ),
      )
      .filter(
        (index) =>
          index >= 0 && decimal(invoice.lines[index].line_total)?.gt(0),
      );
    const answered =
      charge.applies_to === "invoice_total" ||
      (charge.applies_to === "chosen_items" && chosen.length > 0);
    if (!answered && !checks.includes("applies_to"))
      charge.low_confidence_fields = [...checks, "applies_to"];
    if (charge.applies_to !== "chosen_items" || !chosen.length) continue;
    const shares = splitInvoiceCredit(
      charge.amount,
      chosen.map((index) => invoice.lines[index].line_total),
    );
    charge.allocations = chosen.map((index, position) => {
      const line = invoice.lines[index];
      const before = reductions.get(index) ?? new Decimal(0);
      const after = before.plus(shares[position]);
      reductions.set(index, after);
      const paper = new Decimal(line.line_total);
      const ratio = Decimal.max(0, paper.minus(after)).div(paper);
      const baseCost = decimal(line.unit_cost_before_tax) ?? new Decimal(0);
      const previous = paper.minus(before).div(paper);
      return {
        line_id: invoiceLineId(line, index),
        amount: new Decimal(shares[position]).negated().toFixed(2),
        unit_cost_before: baseCost.times(previous).toFixed(4, HALF_UP),
        unit_cost_after: baseCost.times(ratio).toFixed(4, HALF_UP),
      };
    });
  }
  for (const [index, reduction] of reductions) {
    const line = invoice.lines[index];
    const paper = new Decimal(line.line_total);
    const ratio = Decimal.max(0, paper.minus(reduction)).div(paper);
    const cost = decimal(line.unit_cost_before_tax);
    if (cost)
      line.allocated_unit_cost_before_tax = cost
        .times(ratio)
        .toFixed(4, HALF_UP);
    const source = decimal(line.source_cost_before_tax);
    if (line.sold_by === "weight" && source)
      line.allocated_source_cost_before_tax = source
        .times(ratio)
        .toFixed(4, HALF_UP);
  }
}

/** The History record of every answered credit on an invoice. */
export function invoiceCreditHistory(invoice: {
  lines: (InvoiceEditableLine & { new_name_en?: string })[];
  other_charges?: (AllocationCharge & { description: string })[];
}) {
  return (invoice.other_charges ?? []).flatMap((charge, index) =>
    charge.applies_to && isInvoiceCredit(charge)
      ? [
          {
            charge_index: index,
            description: charge.description,
            amount: charge.amount,
            applies_to: charge.applies_to,
            allocations: structuredClone(charge.allocations ?? []),
            line_names: Object.fromEntries(
              (charge.allocations ?? []).map((allocation) => {
                const line = invoice.lines.find(
                  (item, position) =>
                    invoiceLineId(item, position) === allocation.line_id,
                );
                return [
                  allocation.line_id,
                  line?.new_name_en || line?.description || allocation.line_id,
                ];
              }),
            ),
          },
        ]
      : [],
  );
}
