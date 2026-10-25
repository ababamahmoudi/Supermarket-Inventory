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
          supplier: "supplier",
          supplier_invoice_number: "number",
          invoice_date: "date",
          received_at: "received-date",
          receiving_employee: "employee",
          payment_terms: "payment-terms",
          due_date: "due-date",
          order_id: "order",
          order_reference: "order-reference",
          bill_to: "bill-to",
          ship_to: "ship-to",
          currency: "currency",
          supplier_tax_number: "supplier-tax-number",
          subtotal: "subtotal",
          tax: "tax",
          final_total: "final-total",
        }
      : {
          description: "name-en",
          new_name_fa: "name-fa",
          product_code: "matching",
          supplier_item_id: "matching",
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
          date_type: "date-type",
          taxable: "taxable",
          barcode: "barcode",
          lot_number: "lot_number",
          expiry_as_printed: "expiry_as_printed",
          handwritten_note: "handwritten_note",
          manual_price_decision: "manual",
          refused_units: "refused",
          short_dated: "short-dated",
          confirm: "confirm",
        };
  if (suffix[key])
    return line === undefined
      ? `invoice-${suffix[key]}`
      : `invoice-line-${line}-${suffix[key]}`;
  return line === undefined
    ? `invoice-check-header-input-${key}`
    : `invoice-check-line-${line}-input-${key}`;
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
    if (field)
      return {
        target: `invoice-check-charge-${index}-input-${invoiceCheckField(field)}`,
      };
  }
  if (headers[0]) return { target: invoiceCheckTarget(headers[0]) };
}

/** Explicit evidence navigation may open a closed disclosure before focusing. */
export function revealInvoiceReviewTarget(
  root: HTMLElement,
  target: string,
): void {
  if (target === "invoice-original-field")
    root
      .querySelector<HTMLButtonElement>(
        ".original-viewer[data-hidden='true'] .original-viewer-hide",
      )
      ?.click();
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
  const refused = target.match(/^invoice-line-(\d+)-refused$/);
  if (refused && !document.getElementById(target))
    document
      .getElementById(`invoice-line-${refused[1]}-detail`)
      ?.querySelector<HTMLButtonElement>(".receiving-line-report")
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
  const orderLine = target.match(
    /^invoice-order-line-(\d+)-(?:extra|price)-decision$/,
  );
  const missingOrder = target.match(/^invoice-order-missing-(.+)-decision$/);
  const orderRow = orderLine
    ? root.querySelector<HTMLElement>(
        `.invoice-order-card tr[data-invoice-line="${orderLine[1]}"]`,
      )
    : missingOrder
      ? [
          ...root.querySelectorAll<HTMLElement>(
            ".invoice-order-card tr[data-order-line]",
          ),
        ].find(
          (row) =>
            row.dataset.orderLine === decodeURIComponent(missingOrder[1]),
        )
      : undefined;
  if (!document.getElementById(target))
    orderRow
      ?.querySelector<HTMLButtonElement>(
        ".table-details-toggle[aria-expanded='false']",
      )
      ?.click();
  let ancestor = document.getElementById(target)?.closest("details");
  while (ancestor) {
    ancestor.open = true;
    ancestor = ancestor.parentElement?.closest("details") ?? null;
  }
}
export function focusInvoiceReviewTarget(
  target: string,
  root: HTMLElement = document.body,
): () => void {
  let stopped = false;
  let frame = 0;
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(attempt);
  });
  function attempt() {
    if (stopped || !root.isConnected) return;
    revealInvoiceReviewTarget(root, target);
    const element = document.getElementById(target);
    const attach =
      target === "invoice-original-field"
        ? [
            ...(element?.querySelectorAll<HTMLElement>(
              "[data-invoice-attach],.original-viewer-phone-trigger",
            ) ?? []),
          ].find((node) => node.getClientRects().length > 0)
        : undefined;
    const control =
      (target === "invoice-review-header" ? element : undefined) ??
      attach ??
      (element?.matches("input,textarea,button,select,a")
        ? element
        : (element?.querySelector<HTMLElement>(
            "input,textarea,button,[tabindex='0']",
          ) ?? element));
    if (
      !control ||
      !control.getClientRects().length ||
      control.matches(":disabled")
    )
      return;
    stopped = true;
    observer.disconnect();
    control.scrollIntoView({ block: "center", behavior: "smooth" });
    control.focus({ preventScroll: true });
  }
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["open", "aria-expanded", "hidden"],
  });
  attempt();
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}
