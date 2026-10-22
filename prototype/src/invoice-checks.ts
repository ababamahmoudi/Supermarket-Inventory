import Decimal from "decimal.js";
import type { AuthenticatedActor } from "./authority-types";
import { requireInvoiceAuthority } from "./invoice-authority";
import type { DemoState, InvoiceLine, CompanyConfig } from "./types";

/** Export schema names resolve to the existing editable invoice fields. */
export function invoiceCheckField(field: string): string {
  return (
    (
      {
        supplier_name: "supplier",
        quantity: "quantity_entered",
        qty_invoiced: "quantity_entered",
        unit: "quantity_unit",
        supplier_sku: "supplier_item_code",
        cost_per_unit_before_tax: "unit_cost_before_tax",
      } as Record<string, string>
    )[field] ?? field
  );
}

export function invoiceCheckCount(invoice: {
  low_confidence_fields?: string[];
  lines: { low_confidence_fields?: string[] }[];
  other_charges?: { low_confidence_fields?: string[] }[];
}): number {
  return (
    (invoice.low_confidence_fields?.length ?? 0) +
    invoice.lines.reduce(
      (sum, line) => sum + (line.low_confidence_fields?.length ?? 0),
      0,
    ) +
    (invoice.other_charges ?? []).reduce(
      (sum, line) => sum + (line.low_confidence_fields?.length ?? 0),
      0,
    )
  );
}

export function acknowledgeInvoiceCheck(
  state: DemoState,
  actor: AuthenticatedActor,
  field: string,
  lineIndex?: number,
): void {
  requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  if (state.invoice.status === "posted")
    throw new Error("Choose a draft invoice.");
  const record =
    lineIndex === undefined ? state.invoice : state.invoice.lines[lineIndex];
  if (!record) throw new Error("Choose an invoice line.");
  if (lineIndex !== undefined && field === "taxable")
    state.invoice.lines[lineIndex].taxable_inferred = false;
  record.low_confidence_fields = record.low_confidence_fields?.filter(
    (value) => value !== field,
  );
}

export function confirmInvoiceLineChecks(
  state: DemoState,
  actor: AuthenticatedActor,
  lineIndex: number,
  acknowledgeAll = false,
): void {
  requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  const line = state.invoice.lines[lineIndex];
  if (!line || state.invoice.status === "posted")
    throw new Error("Choose a draft invoice line.");
  if (line.low_confidence_fields?.length && !acknowledgeAll)
    throw new Error("This line has fields to check. Confirm all of them?");
  line.low_confidence_fields = [];
  line.taxable_inferred = false;
  line.review_confirmed = true;
}

export function invoiceTotalsCheck(invoice: {
  subtotal?: string;
  tax?: string;
  final_total?: string;
  lines: { line_total?: string }[];
  other_charges?: { amount: string }[];
}): { subtotalDifference?: string; totalDifference?: string } {
  const decimal = (value?: string) => {
    try {
      return value?.trim() && new Decimal(value).isFinite()
        ? new Decimal(value)
        : undefined;
    } catch {
      return undefined;
    }
  };
  const subtotal = decimal(invoice.subtotal);
  const tax = decimal(invoice.tax);
  const total = decimal(invoice.final_total);
  const amounts = [
    ...invoice.lines.map((line) => decimal(line.line_total)),
    ...(invoice.other_charges ?? []).map((line) => decimal(line.amount)),
  ];
  const result: { subtotalDifference?: string; totalDifference?: string } = {};
  if (
    subtotal &&
    amounts.every((amount): amount is Decimal => amount !== undefined)
  ) {
    const difference = subtotal.minus(
      amounts.reduce((sum, amount) => sum.plus(amount), new Decimal(0)),
    );
    if (!difference.isZero()) result.subtotalDifference = difference.toFixed(2);
  }
  if (subtotal && tax && total) {
    const difference = total.minus(subtotal.plus(tax));
    if (!difference.isZero()) result.totalDifference = difference.toFixed(2);
  }
  return result;
}

/** An unmarked tax field follows the selected pricing category until a person checks it. */
export function setInvoiceLineCategory(
  line: Omit<InvoiceLine, "demo_note">,
  category: string,
  config: CompanyConfig,
): void {
  line.pricing_category = category;
  line.date_confirmed = false;
  if (!line.taxable_inferred) return;
  const categoryConfig = config.pricing_categories.find(
    (item) => item.key === category,
  );
  const profile = config.tax.profiles.find(
    (item) => item.key === categoryConfig?.default_tax_profile,
  );
  line.tax_profile = profile?.key ?? "non_taxable";
  line.taxable = profile ? new Decimal(profile.rate).gt(0) : false;
  line.line_tax = /^\d+(?:\.\d{1,2})?$/.test(line.line_total)
    ? new Decimal(line.line_total).times(profile?.rate ?? "0").toFixed(2)
    : "";
}
