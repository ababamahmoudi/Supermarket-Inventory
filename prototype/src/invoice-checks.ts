import Decimal from "decimal.js";
import { costPerUnit, packUnits } from "./supplier-items";
import type { AuthenticatedActor } from "./authority-types";
import { requireInvoiceAuthority } from "./invoice-authority";
import type {
  DemoState,
  InvoiceLine,
  CompanyConfig,
  DemoInvoice,
} from "./types";
import {
  validCost,
  validInvoiceLineQuantity,
  validInvoiceLineReceived,
} from "./invoice";

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
    )[field.replace(/^calculated:/, "")] ?? field.replace(/^calculated:/, "")
  );
}

const optionalInvoiceFields = new Set([
  "barcode",
  "lot_number",
  "expiry_as_printed",
  "handwritten_note",
  "order_reference",
  "bill_to",
  "ship_to",
]);
export function visibleInvoiceCheckFields(record: {
  low_confidence_fields?: string[];
}): string[] {
  const values = record as Record<string, unknown>;
  return (record.low_confidence_fields ?? []).filter((field) => {
    const key = invoiceCheckField(field);
    return (
      !optionalInvoiceFields.has(key) || String(values[key] ?? "").trim() !== ""
    );
  });
}

/** Adopt the receiving defaults on an authorized draft, preserving explicit date choices. */
export function normalizeInvoiceReceivingReview(invoice: DemoInvoice): void {
  if (invoice.status === "posted") return;
  const required = [
    "supplier",
    "supplier_invoice_number",
    "invoice_date",
    "final_total",
  ] as const;
  invoice.low_confidence_fields = [
    ...new Set([
      ...visibleInvoiceCheckFields(invoice),
      ...required.filter((field) => !String(invoice[field] ?? "").trim()),
    ]),
  ];
  fillCalculatedInvoiceTotals(invoice);
  invoice.supplier_review_required = false;
  for (const [index, line] of invoice.lines.entries()) {
    line.id ??= `${invoice.id}:line:${line.import_line_index ?? index}`;
    line.low_confidence_fields = visibleInvoiceCheckFields(line);
    line.date_tracking ??= false;
    if (!line.date_tracking) line.date_confirmed = true;
  }
  for (const charge of invoice.other_charges ?? [])
    charge.low_confidence_fields = visibleInvoiceCheckFields(charge);
}

export function invoiceCheckCount(invoice: {
  low_confidence_fields?: string[];
  lines: { low_confidence_fields?: string[] }[];
  other_charges?: { low_confidence_fields?: string[] }[];
}): number {
  return (
    visibleInvoiceCheckFields(invoice).length +
    invoice.lines.reduce(
      (sum, line) => sum + visibleInvoiceCheckFields(line).length,
      0,
    ) +
    (invoice.other_charges ?? []).reduce(
      (sum, line) => sum + visibleInvoiceCheckFields(line).length,
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
    (value) =>
      value !== field && invoiceCheckField(value) !== invoiceCheckField(field),
  );
}

export class InvoiceLineConfirmationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "InvoiceLineConfirmationError";
  }
}

/** Confirmation covers all highlighted fields after checking the actual receiving facts. */
export function confirmInvoiceLineChecks(
  state: DemoState,
  actor: AuthenticatedActor,
  lineIndex: number,
  _acknowledgeAll = false,
): void {
  void _acknowledgeAll; // Retained for existing callers; confirmation now always covers the line.
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
  if (line.product_code === "NEW" && !line.new_name_en?.trim())
    throw new InvoiceLineConfirmationError(
      "new_name_en",
      "Enter an English name for the new product.",
    );
  if (
    line.product_code === "NEW" &&
    !state.config.pricing_categories.some(
      (category) => category.key === line.pricing_category,
    )
  )
    throw new InvoiceLineConfirmationError(
      "pricing_category",
      "Choose a pricing category for the new product.",
    );
  if (!validInvoiceLineQuantity(line))
    throw new InvoiceLineConfirmationError(
      "quantity_entered",
      "Enter a valid quantity greater than zero.",
    );
  if (!validInvoiceLineReceived(line))
    throw new InvoiceLineConfirmationError(
      "qty_received_at_posting",
      "Enter delivered units between zero and the invoiced quantity.",
    );
  if (!validCost(line.unit_cost_before_tax))
    throw new InvoiceLineConfirmationError(
      "unit_cost_before_tax",
      "Enter a nonnegative cost with up to four decimal places.",
    );
  if (line.sold_by !== "weight" && line.quantity_unit === "cases") {
    try {
      if (
        packUnits(
          line.quantity_entered ?? "",
          "cases",
          line.units_per_case ?? 1,
        ) !== line.qty_invoiced
      )
        throw new Error("quantity");
    } catch {
      throw new InvoiceLineConfirmationError(
        "quantity_entered",
        "Check cases invoiced and units per case.",
      );
    }
    if (!validCost(line.case_cost_before_tax ?? ""))
      throw new InvoiceLineConfirmationError(
        "case_cost_before_tax",
        "Enter a nonnegative case cost with up to four decimal places.",
      );
    if (
      costPerUnit(line.case_cost_before_tax!, line.units_per_case ?? 1) !==
      new Decimal(line.unit_cost_before_tax).toFixed(4)
    )
      throw new InvoiceLineConfirmationError(
        "case_cost_before_tax",
        "Check that the case cost matches the unit cost and units per case.",
      );
  }
  line.low_confidence_fields = [];
  line.taxable_inferred = false;
  line.review_confirmed = true;
  line.review_changed_after_confirmation = false;
}

/** Complete supported missing-paper combinations and retain each calculated question. */
export function fillCalculatedInvoiceTotals(invoice: {
  subtotal: string;
  tax: string;
  final_total: string;
  low_confidence_fields?: string[];
}): void {
  const valid = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value);
  const fill = (field: "subtotal" | "tax" | "final_total", value: Decimal) => {
    invoice[field] = value.toFixed(2);
    invoice.low_confidence_fields = [
      ...(invoice.low_confidence_fields ?? []).filter(
        (key) => invoiceCheckField(key) !== field,
      ),
      `calculated:${field}`,
    ];
  };
  if (
    !invoice.subtotal.trim() &&
    !invoice.tax.trim() &&
    valid(invoice.final_total)
  ) {
    fill("subtotal", new Decimal(invoice.final_total));
    fill("tax", new Decimal(0));
  } else if (
    !invoice.subtotal.trim() &&
    valid(invoice.final_total) &&
    valid(invoice.tax)
  ) {
    const subtotal = new Decimal(invoice.final_total).minus(invoice.tax);
    if (subtotal.gte(0)) fill("subtotal", subtotal);
  } else if (
    !invoice.tax.trim() &&
    valid(invoice.final_total) &&
    valid(invoice.subtotal)
  ) {
    const tax = new Decimal(invoice.final_total).minus(invoice.subtotal);
    if (tax.gte(0)) fill("tax", tax);
  } else if (
    !invoice.final_total.trim() &&
    valid(invoice.subtotal) &&
    valid(invoice.tax)
  ) {
    fill("final_total", new Decimal(invoice.subtotal).plus(invoice.tax));
  }
  for (const field of ["subtotal", "tax", "final_total"] as const)
    if (
      !invoice[field].trim() &&
      !(invoice.low_confidence_fields ?? []).some(
        (key) => invoiceCheckField(key) === field,
      )
    )
      (invoice.low_confidence_fields ??= []).push(field);
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
  line.review_changed_after_confirmation ||= Boolean(line.review_confirmed);
  line.review_confirmed = false;
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
