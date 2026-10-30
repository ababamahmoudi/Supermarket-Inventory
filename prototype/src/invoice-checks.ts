import { receivingPriceProblem } from "./invoice-receiving-price";
import {
  refreshFreeCaseAnswer,
  validFreeCaseGroup,
} from "./invoice-free-cases";
import { invoiceLineAmount, invoicePaperTotalMismatch } from "./invoice-weight";
import Decimal from "decimal.js";
import { createId } from "./ids";
import { costPerUnit, packUnits } from "./supplier-items";
import type { AuthenticatedActor } from "./authority-types";
import { requireInvoiceAuthority } from "./invoice-authority";
import type {
  DemoState,
  InvoiceLine,
  CompanyConfig,
  DemoInvoice,
  InvoiceCheckReceipts,
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
        invoice_number: "supplier_invoice_number",
        invoice_date_as_printed: "invoice_date",
        invoice_total: "final_total",
        units_received: "qty_received_at_posting",
        pack_text: "pack_size",
        english_name: "description",
        name_en: "description",
        new_name_en: "description",
        product_name: "description",
        printed_description: "description",
        qty_received: "qty_received_at_posting",
        delivered_quantity: "qty_received_at_posting",
        quantity_invoiced: "quantity_entered",
        source_quantity: "quantity_entered",
        source_received_quantity: "qty_received_at_posting",
        source_quantity_unit: "quantity_unit",
        source_cost_before_tax: "unit_cost_before_tax",
        cost_per_case_before_tax: "case_cost_before_tax",
        import_currency: "currency",
        quantity: "quantity_entered",
        qty_invoiced: "quantity_entered",
        unit: "quantity_unit",
        supplier_sku: "supplier_item_code",
        cost_per_unit_before_tax: "unit_cost_before_tax",
        handwritten_notes: "import_handwritten_notes",
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
  "supplier_tax_number",
  "supplier_item_code",
  "pack_size",
  "payment_terms",
  "due_date",
  "new_name_fa",
  "import_handwritten_notes",
]);
export function isEmptyOptionalInvoiceField(
  record: object,
  field: string,
): boolean {
  const key = invoiceCheckField(field);
  const value = (record as Record<string, unknown>)[key];
  return (
    optionalInvoiceFields.has(key) &&
    (Array.isArray(value)
      ? value.every((item) => String(item ?? "").trim() === "")
      : String(value ?? "").trim() === "")
  );
}
// Only checks with a human label and a real receiving control can block review.
// Unsupported reader metadata remains source evidence rather than an invisible task.
const reviewableInvoiceFields = new Set([
  "free_case_decision",
  "supplier",
  "supplier_invoice_number",
  "invoice_date",
  "received_at",
  "receiving_employee",
  "payment_terms",
  "due_date",
  "order_id",
  "order_reference",
  "bill_to",
  "ship_to",
  "currency",
  "supplier_tax_number",
  "subtotal",
  "tax",
  "final_total",
  "description",
  "new_name_fa",
  "product_code",
  "supplier_item_id",
  "supplier_item_code",
  "quantity_entered",
  "qty_received_at_posting",
  "quantity_unit",
  "units_per_case",
  "unit_cost_before_tax",
  "case_cost_before_tax",
  "case_weight",
  "line_total",
  "pricing_category",
  "date_value",
  "date_tracking",
  "date_type",
  "taxable",
  "barcode",
  "lot_number",
  "expiry_as_printed",
  "handwritten_note",
  "manual_price_decision",
  "refused_units",
  "short_dated",
  "confirm",
  "line_type",
  "pack_size",
  "import_handwritten_notes",
  "delivery_reference",
  "amount",
]);
export function isReviewableInvoiceCheck(field: string): boolean {
  return (
    !field.startsWith("calculated:") &&
    reviewableInvoiceFields.has(invoiceCheckField(field))
  );
}
export function visibleInvoiceCheckFields(record: {
  low_confidence_fields?: string[];
}): string[] {
  const seen = new Set<string>();
  return (record.low_confidence_fields ?? []).filter((field) => {
    if (!isReviewableInvoiceCheck(field)) return false;
    const key = invoiceCheckField(field);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Adopt the receiving defaults on an authorized draft, preserving explicit date choices. */
export function normalizeInvoiceReceivingReview(invoice: DemoInvoice): void {
  if (invoice.status === "posted" || invoice.status === "cancelled") return;
  const required = [
    "supplier",
    "supplier_invoice_number",
    "invoice_date",
    "final_total",
  ] as const;
  invoice.low_confidence_fields = [
    ...new Set([
      ...visibleInvoiceCheckFields(invoice).filter(
        (field) =>
          !(
            invoice.imported_received_source === "invoice_date" &&
            invoiceCheckField(field) === "received_at"
          ),
      ),
      ...required.filter((field) => !String(invoice[field] ?? "").trim()),
    ]),
  ];
  fillCalculatedInvoiceTotals(invoice);
  invoice.supplier_review_required = false;
  for (const [index, line] of invoice.lines.entries()) {
    line.id ??= `${invoice.id}:line:${line.import_line_index ?? index}`;
    line.low_confidence_fields = visibleInvoiceCheckFields(line);
    if (
      line.free_case_group &&
      !validFreeCaseGroup(line) &&
      !line.low_confidence_fields.includes("free_case_decision")
    )
      line.low_confidence_fields.push("free_case_decision");
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
  now = new Date(),
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
  acknowledgeRecordCheck(record, actor.user_id, field, now);
}

/** Receipts use canonical field names; aliases are one human question. */
function acknowledgeRecordCheck(
  record: {
    low_confidence_fields?: string[];
    checked_fields?: InvoiceCheckReceipts;
  },
  userId: string,
  field: string,
  now = new Date(),
): void {
  const key = invoiceCheckField(field);
  if (
    !(record.low_confidence_fields ?? []).some(
      (value) => invoiceCheckField(value) === key,
    )
  )
    return;
  record.low_confidence_fields = record.low_confidence_fields?.filter(
    (value) => invoiceCheckField(value) !== key,
  );
  record.checked_fields ??= {};
  record.checked_fields[key] = {
    checked_by_user_id: userId,
    checked_at: now.toISOString(),
  };
}

export function acknowledgeInvoiceOtherChargeCheck(
  state: DemoState,
  actor: AuthenticatedActor,
  index: number,
  field: string,
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
  const charge = state.invoice.other_charges?.[index];
  if (!charge) throw new Error("Choose an invoice charge.");
  acknowledgeRecordCheck(charge, actor.user_id, field);
}

/** An explicit absence is a review decision; an unflagged empty field stays quiet. */
export function acknowledgeInvoiceFieldAbsence(
  state: DemoState,
  actor: AuthenticatedActor,
  field: string,
  lineIndex?: number,
  now = new Date(),
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
  if (!record || !isEmptyOptionalInvoiceField(record, field))
    throw new Error("Choose an empty optional invoice field.");
  const key = invoiceCheckField(field);
  if (
    !visibleInvoiceCheckFields(record).some(
      (value) => invoiceCheckField(value) === key,
    )
  )
    return;
  acknowledgeInvoiceCheck(state, actor, field, lineIndex);
  record.checked_fields ??= {};
  record.checked_fields[key] = {
    checked_by_user_id: actor.user_id,
    checked_at: now.toISOString(),
  };
  state.activity.push({
    id: createId("invoice-check"),
    company_id: state.invoice.company_id,
    branch: state.invoice.branch,
    action: "Invoice field not on the invoice",
    by: actor.username,
    actor_user_id: actor.user_id,
    actor_username: actor.username,
    actor_role_snapshot: actor.role,
    at: now.toISOString(),
    reversible: false,
    entity_type: "invoice",
    entity_id: state.invoice.id,
    after: {
      field: key,
      ...(lineIndex === undefined
        ? {}
        : {
            line_id: state.invoice.lines[lineIndex].id,
            line_index: lineIndex,
          }),
      absent_on_invoice: true,
    },
  });
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
  if (
    line.sold_by !== "weight" &&
    state.products.some(
      (product) =>
        product.company_id === state.invoice.company_id &&
        product.code === line.product_code &&
        product.sold_by === "weight",
    )
  )
    throw new InvoiceLineConfirmationError(
      "quantity_unit",
      "This product is sold by weight. Choose Weight (lb) or Weight (kg).",
    );
  if (line.free_case_group && !validFreeCaseGroup(line))
    throw new InvoiceLineConfirmationError(
      "free_case_decision",
      "Answer the free-case question before confirming this line.",
    );
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
  if (receivingPriceProblem(state, lineIndex))
    throw new InvoiceLineConfirmationError(
      "selling_price",
      "Enter a positive selling price and review it again after cost or category changes.",
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
  if (invoicePaperTotalMismatch(line))
    throw new InvoiceLineConfirmationError(
      "line_total",
      "Check the line arithmetic against the paper total, or acknowledge that the paper total is wrong.",
    );
  for (const field of [...(line.low_confidence_fields ?? [])])
    acknowledgeRecordCheck(line, actor.user_id, field);
  line.low_confidence_fields = [];
  line.taxable_inferred = false;
  line.review_confirmed = true;
  line.review_changed_after_confirmation = false;
}

/** A distinct decision; ordinary Confirm must not silently waive a money mismatch. */
export function acknowledgeInvoicePaperTotal(
  state: DemoState,
  actor: AuthenticatedActor,
  lineIndex: number,
): void {
  requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  const line = state.invoice.lines[lineIndex];
  if (
    !line ||
    state.invoice.status === "posted" ||
    !invoicePaperTotalMismatch(line)
  )
    throw new Error("Choose a draft line with a paper total difference.");
  line.paper_total_acknowledgement = {
    paper: line.paper_line_total!,
    calculated: invoiceLineAmount(line),
    checked_by_user_id: actor.user_id,
    checked_at: new Date().toISOString(),
  };
  acknowledgeRecordCheck(line, actor.user_id, "line_total");
  line.review_confirmed = false;
  state.activity.push({
    id: createId("invoice-paper-total"),
    company_id: state.invoice.company_id,
    branch: state.invoice.branch,
    action: "Invoice paper total acknowledged as wrong",
    by: actor.username,
    actor_user_id: actor.user_id,
    actor_username: actor.username,
    actor_role_snapshot: actor.role,
    at: line.paper_total_acknowledgement.checked_at,
    reversible: false,
    entity_type: "invoice",
    entity_id: state.invoice.id,
    after: {
      line_id: line.id,
      line_index: lineIndex,
      paper_total_acknowledgement: structuredClone(
        line.paper_total_acknowledgement,
      ),
    },
  });
}

/** Complete supported missing-paper combinations; provenance is quiet, never an invented AI question. */
export function fillCalculatedInvoiceTotals(invoice: {
  status?: DemoInvoice["status"];
  subtotal: string;
  tax: string;
  final_total: string;
  low_confidence_fields?: string[];
  calculated_fields?: string[];
  calculated_from_lines?: boolean;
  lines?: { line_total?: string }[];
  other_charges?: { amount: string }[];
}): void {
  const legacyCalculated = (invoice.low_confidence_fields ?? [])
    .filter((field) => field.startsWith("calculated:"))
    .map(invoiceCheckField);
  if (legacyCalculated.length) {
    invoice.calculated_fields = [
      ...new Set([...(invoice.calculated_fields ?? []), ...legacyCalculated]),
    ];
    invoice.low_confidence_fields = invoice.low_confidence_fields?.filter(
      (field) => !field.startsWith("calculated:"),
    );
  }
  const valid = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value);
  const fill = (field: "subtotal" | "tax" | "final_total", value: Decimal) => {
    invoice[field] = value.toFixed(2);
    invoice.low_confidence_fields = [
      ...(invoice.low_confidence_fields ?? []).filter(
        (key) => invoiceCheckField(key) !== field,
      ),
    ];
    invoice.calculated_fields = [
      ...new Set([...(invoice.calculated_fields ?? []), field]),
    ];
  };
  const subtotalFromLines = () => {
    const items = (invoice.lines ?? []).map(
      (line) => line.line_total?.trim() ?? "",
    );
    const charges = (invoice.other_charges ?? []).map((charge) =>
      charge.amount.trim(),
    );
    if (
      !items.every(valid) ||
      !charges.every((amount) => /^-?\d+(?:\.\d{1,2})?$/.test(amount))
    )
      return;
    const subtotal = [...items, ...charges].reduce(
      (sum, amount) => sum.plus(amount),
      new Decimal(0),
    );
    return subtotal.gte(0) ? subtotal : undefined;
  };
  const refreshFromLines =
    ["draft", "review"].includes(invoice.status ?? "") &&
    invoice.calculated_from_lines === true &&
    invoice.calculated_fields?.includes("subtotal");
  if (refreshFromLines) {
    const subtotal = subtotalFromLines();
    if (subtotal) fill("subtotal", subtotal);
    else invoice.subtotal = "";
    const calculatedTax = invoice.calculated_fields?.includes("tax");
    const calculatedFinal = invoice.calculated_fields?.includes("final_total");
    const unresolved = (field: "tax" | "final_total") => {
      invoice[field] = "";
      invoice.calculated_fields = invoice.calculated_fields?.filter(
        (key) => key !== field,
      );
    };
    // Only a CURRENT calculated dependent may change; printed and human values
    // remain independent reconciliation evidence. Two calculated dependents
    // cannot supply each other's missing source amount.
    if (calculatedTax && calculatedFinal) {
      unresolved("tax");
      unresolved("final_total");
    } else if (calculatedFinal) {
      if (valid(invoice.subtotal) && valid(invoice.tax))
        fill("final_total", new Decimal(invoice.subtotal).plus(invoice.tax));
      else unresolved("final_total");
    } else if (calculatedTax) {
      if (valid(invoice.subtotal) && valid(invoice.final_total)) {
        const tax = new Decimal(invoice.final_total).minus(invoice.subtotal);
        if (tax.gte(0)) fill("tax", tax);
        else unresolved("tax");
      } else unresolved("tax");
    }
  } else if (
    !invoice.subtotal.trim() &&
    !invoice.tax.trim() &&
    !invoice.final_total.trim() &&
    invoice.lines?.length
  ) {
    const subtotal = subtotalFromLines();
    if (subtotal) {
      fill("subtotal", subtotal);
      invoice.calculated_from_lines = true;
    }
  }
  // Keep the existing supported two-amount completion. An incomplete line-derived
  // subtotal must never be reconstructed from retained tax/total headers.
  if (
    !refreshFromLines &&
    !invoice.subtotal.trim() &&
    !invoice.tax.trim() &&
    valid(invoice.final_total)
  ) {
    fill("subtotal", new Decimal(invoice.final_total));
    fill("tax", new Decimal(0));
  } else if (
    !refreshFromLines &&
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
  const preserveFreeCaseAnswer = validFreeCaseGroup(line);
  line.pricing_category = category;
  delete line.known_delivery;
  line.review_changed_after_confirmation ||= Boolean(line.review_confirmed);
  line.review_confirmed = false;
  if (line.taxable_inferred) {
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
  // A genuine category choice changes inferred tax, not the receiver's valid
  // paid/free answer. Never refresh an answer that was stale before this edit.
  if (preserveFreeCaseAnswer) refreshFreeCaseAnswer(line);
}
