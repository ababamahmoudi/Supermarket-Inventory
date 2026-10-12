import Decimal from "decimal.js";
import type { DemoInvoice } from "./types";

export function paymentTermsDays(value: string): number | undefined {
  if (/^(?:cash on delivery|cod|due on receipt)$/i.test(value.trim())) return 0;
  const fixed: Record<string, number> = {
    weekly: 7,
    monthly: 30,
    "every 2 weeks": 14,
  };
  if (fixed[value.trim().toLowerCase()] !== undefined)
    return fixed[value.trim().toLowerCase()];
  const match = value.match(/^(?:net\s*)?(\d+)(?:\s*days?)?$/i);
  const days = match ? Number(match[1]) : undefined;
  return days !== undefined && Number.isSafeInteger(days) && days >= 0
    ? days
    : undefined;
}

export function invoiceComputedTotal(
  invoice: Pick<DemoInvoice, "subtotal" | "tax">,
): string | undefined {
  if (
    ![invoice.subtotal, invoice.tax].every((value) =>
      /^\d+(?:\.\d{1,2})?$/.test(value),
    )
  )
    return undefined;
  return new Decimal(invoice.subtotal).plus(invoice.tax).toFixed(2);
}

export function setInvoiceAmount(
  invoice: DemoInvoice,
  field: "subtotal" | "tax" | "final_total",
  value: string,
): void {
  invoice[field] = value;
  const computed = invoiceComputedTotal(invoice);
  if (field === "final_total") {
    invoice.final_total_manual =
      computed === undefined ||
      !/^\d+(?:\.\d{1,2})?$/.test(value) ||
      !new Decimal(value).eq(computed);
  } else if (!invoice.final_total_manual && computed !== undefined)
    invoice.final_total = computed;
}

export function invoiceTotalDiffers(invoice: DemoInvoice): boolean {
  const computed = invoiceComputedTotal(invoice);
  return (
    computed !== undefined &&
    /^\d+(?:\.\d{1,2})?$/.test(invoice.final_total) &&
    !new Decimal(invoice.final_total).eq(computed)
  );
}

export function refreshInvoiceDueDate(invoice: DemoInvoice): void {
  const days =
    invoice.payment_term_days ?? paymentTermsDays(invoice.payment_terms ?? "");
  if (
    invoice.due_date_manual ||
    days === undefined ||
    !/^\d{4}-\d{2}-\d{2}$/.test(invoice.invoice_date ?? "")
  )
    return;
  const date = new Date(`${invoice.invoice_date}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return;
  date.setUTCDate(date.getUTCDate() + days);
  invoice.due_date =
    Number.isFinite(date.getTime()) && date.getUTCFullYear() <= 9999
      ? date.toISOString().slice(0, 10)
      : "";
}

export function setInvoicePaymentTerms(
  invoice: DemoInvoice,
  value: string,
): void {
  invoice.payment_terms = value;
  invoice.payment_term_days = paymentTermsDays(value);
  invoice.due_date_manual = false;
  refreshInvoiceDueDate(invoice);
}
