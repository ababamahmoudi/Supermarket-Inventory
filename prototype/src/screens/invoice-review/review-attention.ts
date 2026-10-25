import {
  invoiceCheckField,
  visibleInvoiceCheckFields,
} from "../../invoice-checks";
import type { InvoiceReadDTO } from "../../invoice-projections";

export function invoiceCheckTarget(field: string, line?: number): string {
  const key = invoiceCheckField(field);
  const suffix: Record<string, string> =
    line === undefined
      ? {
          supplier_invoice_number: "number",
          final_total: "final-total",
          invoice_date: "date",
          received_at: "received-date",
          receiving_employee: "employee",
        }
      : {
          description: "name-en",
          supplier_item_code: "supplier-code",
          quantity_entered: "invoiced",
          qty_received_at_posting: "delivered",
          quantity_unit: "unit",
          units_per_case: "pack",
          unit_cost_before_tax: "cost",
          case_cost_before_tax: "case-cost",
          line_total: "line-total",
          pricing_category: "category",
          date_value: "date",
          date_tracking: "date-tracking",
        };
  return line === undefined
    ? `invoice-${suffix[key] ?? key.replaceAll("_", "-")}`
    : `invoice-line-${line}-${suffix[key] ?? key}`;
}
export function nextInvoiceAttention(
  invoice: InvoiceReadDTO,
): { target: string; line?: number } | undefined {
  const headers = visibleInvoiceCheckFields(invoice);
  const details = headers.find(
    (field) =>
      !["subtotal", "tax", "final_total"].includes(invoiceCheckField(field)),
  );
  if (details) return { target: invoiceCheckTarget(details) };
  for (const [index, line] of invoice.lines.entries()) {
    const field = visibleInvoiceCheckFields(line)[0];
    if (field) return { target: invoiceCheckTarget(field, index), line: index };
    if (!line.review_confirmed)
      return {
        target: invoiceCheckTarget(
          line.product_code === "NEW" && !line.pricing_category
            ? "pricing_category"
            : "confirm",
          index,
        ),
        line: index,
      };
  }
  for (const [index, charge] of (invoice.other_charges ?? []).entries()) {
    const field = visibleInvoiceCheckFields(charge)[0];
    if (field) return { target: `invoice-check-charge-${index}-${field}` };
  }
  if (headers[0]) return { target: invoiceCheckTarget(headers[0]) };
}

/** Explicit evidence navigation may open a closed disclosure before focusing. */
export function revealInvoiceReviewTarget(
  root: HTMLElement,
  target: string,
): void {
  const details = root.querySelector<HTMLElement>(".receiving-details");
  if (
    target === "invoice-details-fields" ||
    (document.getElementById(target) &&
      details?.contains(document.getElementById(target))) ||
    /invoice-(received-|employee)/.test(target)
  )
    details
      ?.querySelector<HTMLButtonElement>(
        ".receiving-details-phone-toggle[aria-expanded='false']",
      )
      ?.click();
  if (
    /^invoice-(subtotal|tax|final-total)$/.test(target) &&
    !document.getElementById(target)
  )
    root
      .querySelector<HTMLButtonElement>(
        ".receiving-totals-actions button[aria-expanded='false']",
      )
      ?.click();
  if (
    /invoice-(received-|employee)/.test(target) &&
    !document.getElementById(target)
  )
    root
      .querySelector<HTMLButtonElement>(".receiving-received-field button")
      ?.click();
  const lineTotal = target.match(/^invoice-line-(\d+)-line-total$/);
  if (lineTotal && !document.getElementById(target))
    document
      .getElementById(`invoice-line-${lineTotal[1]}-detail`)
      ?.querySelector<HTMLButtonElement>(".receiving-printed-total button")
      ?.click();
  const charge = target.match(/^invoice-check-charge-(\d+)-/);
  if (charge && !document.getElementById(target))
    root
      .querySelector<HTMLAnchorElement>(`[data-charge-index='${charge[1]}']`)
      ?.click();
  let ancestor = document.getElementById(target)?.closest("details");
  while (ancestor) {
    ancestor.open = true;
    ancestor = ancestor.parentElement?.closest("details") ?? null;
  }
}
export function focusInvoiceReviewTarget(target: string): void {
  const element = document.getElementById(target);
  const control = element?.matches("input,textarea,button,select")
    ? element
    : (element?.querySelector<HTMLElement>(
        "input,textarea,button,[tabindex='0']",
      ) ?? element);
  control?.scrollIntoView({ block: "center", behavior: "smooth" });
  control?.focus({ preventScroll: true });
}
