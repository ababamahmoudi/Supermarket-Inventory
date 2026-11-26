import Decimal from "decimal.js";

export interface InvoiceTotalsAlertFacts {
  /** The subtotal printed on the paper invoice. */
  paperSubtotal: string;
  /** Item lines plus other charges, as entered. */
  calculated: string;
  /** Subtotal on paper minus calculated (may be negative). */
  difference: string;
  tax: string;
  total: string;
  /**
   * "tax" only when the lines already agree with the paper subtotal, so the
   * tax itself is what differs; otherwise "totals".
   */
  kind: "totals" | "tax";
}

function money(value?: string): Decimal | null {
  try {
    return value?.trim() && new Decimal(value).isFinite()
      ? new Decimal(value)
      : null;
  } catch {
    return null;
  }
}

/**
 * PR 29 (Ali, 2026-11-20): the totals alert shows Subtotal on paper,
 * Calculated from the lines, the Difference and Tax · invoice total on paper,
 * all worked out with Decimal from the posted invoice.
 */
export function invoiceTotalsAlertFacts(invoice: {
  subtotal?: string;
  tax?: string;
  final_total?: string;
  lines: { line_total?: string }[];
  other_charges?: { amount: string }[];
}): InvoiceTotalsAlertFacts {
  const calculated = [
    ...invoice.lines.map((line) => line.line_total),
    ...(invoice.other_charges ?? []).map((charge) => charge.amount),
  ].reduce<Decimal>(
    (sum, value) => sum.plus(money(value) ?? 0),
    new Decimal(0),
  );
  const paper = money(invoice.subtotal) ?? new Decimal(0);
  const difference = paper.minus(calculated);
  return {
    paperSubtotal: paper.toFixed(2),
    calculated: calculated.toFixed(2),
    difference: difference.toFixed(2),
    tax: (money(invoice.tax) ?? new Decimal(0)).toFixed(2),
    total: (money(invoice.final_total) ?? new Decimal(0)).toFixed(2),
    kind: difference.isZero() ? "tax" : "totals",
  };
}
