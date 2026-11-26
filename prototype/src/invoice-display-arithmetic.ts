import Decimal from "decimal.js";
import type { InvoiceEditableLine } from "./invoice-edit-types";
import type { FreeCaseView } from "./invoice-free-cases";
import { lineShort, lineRefused, shortTotals, refusedTotals } from "./invoice";
import { invoiceLineAmount, invoicePaperTotalMismatch } from "./invoice-weight";

type DisplayLine = InvoiceEditableLine & { free_case?: FreeCaseView };

/** Receiving screens consume protected arithmetic facts without private source members. */
export function invoiceDisplayLineAmount(line: DisplayLine): string {
  return (
    line.free_case?.financial?.amount ??
    (line.free_case && !line.free_case.answer
      ? line.free_case.paid_amount
      : undefined) ??
    invoiceLineAmount(line)
  );
}
export function invoiceDisplayLineShort(line: DisplayLine) {
  return line.free_case?.financial?.short ?? lineShort(line);
}
export function invoiceDisplayLineRefused(line: DisplayLine) {
  return line.free_case?.financial?.refused ?? lineRefused(line);
}
function totals(lines: readonly DisplayLine[], kind: "open_short" | "refused") {
  let beforeTax = new Decimal(0),
    tax = new Decimal(0);
  for (const line of lines) {
    const amount =
      line.free_case?.financial?.[kind] ??
      (kind === "open_short"
        ? shortTotals({ lines: [line] })
        : refusedTotals({ lines: [line] }));
    beforeTax = beforeTax.plus(amount.beforeTax);
    tax = tax.plus(amount.tax);
  }
  return {
    beforeTax: beforeTax.toFixed(2),
    tax: tax.toFixed(2),
    total: beforeTax.plus(tax).toFixed(2),
  };
}
export function invoiceDisplayShortTotals(invoice: {
  lines: readonly DisplayLine[];
}) {
  return totals(invoice.lines, "open_short");
}
export function invoiceDisplayRefusedTotals(invoice: {
  lines: readonly DisplayLine[];
}) {
  return totals(invoice.lines, "refused");
}
export function invoiceDisplayPaperMismatch(line: DisplayLine) {
  // The explicit question decides physical/pricing treatment; generic cost-fix
  // suggestions cannot answer it or overwrite the retained paid paper basis.
  if (line.free_case && !line.free_case.answer) return undefined;
  const financial = line.free_case?.financial;
  if (!financial) return invoicePaperTotalMismatch(line);
  const paper = line.paper_line_total;
  if (
    !paper ||
    !/^\d+(?:\.\d{1,2})?$/.test(paper) ||
    new Decimal(financial.amount).minus(paper).abs().lte("0.01")
  )
    return undefined;
  const checked = line.paper_total_acknowledgement;
  return checked?.paper === paper &&
    checked.calculated === financial.amount &&
    checked.checked_by_user_id &&
    checked.checked_at
    ? undefined
    : { paper, calculated: financial.amount };
}
