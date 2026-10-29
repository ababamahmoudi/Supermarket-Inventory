import { effectiveInvoiceReceivedAt } from "./invoice-received-version";
import type { AuthenticatedActor } from "./authority-types";
import { can } from "./permissions";
import { businessAuditRead } from "./business-audit-read";
import {
  invoiceWorkspaceRead,
  type InvoiceWorkspaceRead,
} from "./invoice-workspace-read";
import { purchaseLocationScope } from "./purchase-authority";
import { freshActor } from "./authority";
import { invoiceVersion, effectiveInvoiceVersion } from "./invoice-version";
import { effectiveInvoiceLocation } from "./received";
import {
  invoiceAuthorityScope,
  requireInvoiceAuthority,
  canInvoiceAuthority,
} from "./invoice-authority";
import type { DemoInvoice, DemoState, InvoiceLine } from "./types";
import {
  invoiceCheckField,
  normalizeInvoiceReceivingReview,
} from "./invoice-checks";
import { invoiceRecords } from "./invoice-records";
import {
  projectLiveInvoiceReading,
  redactLiveReadingProvenance,
} from "./invoice-live-reading-projection";
import type { LiveInvoiceReadingView } from "./invoice-live-reading-types";

type InvoiceLineMoney =
  | "paper_line_total"
  | "paper_total_acknowledgement"
  | "weight_case_cost_basis"
  | "imported_unit_cost_basis"
  | "unit_cost_before_tax"
  | "case_cost_before_tax"
  | "converted_case_cost_before_tax"
  | "converted_case_units_per_case"
  | "source_cost_before_tax"
  | "line_total"
  | "line_tax"
  | "short_before_tax"
  | "short_tax";
export type InvoiceProductMatchReadDTO = Pick<
  NonNullable<InvoiceLine["reading_product_match"]>,
  "product_code" | "basis" | "earlier_delivery" | "requires_check"
>;
export type InvoiceLineView = Omit<
  InvoiceLine,
  "demo_note" | InvoiceLineMoney | "reading_product_match"
> &
  Partial<Pick<InvoiceLine, InvoiceLineMoney>> & {
    reading_product_match?: InvoiceProductMatchReadDTO;
  };
type InvoiceMoney =
  "subtotal" | "tax" | "final_total" | "payable_after_open_shorts";
export type InvoiceView = Omit<
  DemoInvoice,
  | "file_data"
  | "original_pages"
  | "reading_record"
  | "live_reading"
  | "other_charges"
  | "legacy_demo_original"
  | "lines"
  | "_confidence_note"
  | "short_lines"
  | "order_comparison"
  | InvoiceMoney
> &
  Partial<Pick<DemoInvoice, InvoiceMoney>> & {
    lines: InvoiceLineView[];
    short_lines?: DemoInvoice["short_lines"];
    order_comparison?: DemoInvoice["order_comparison"];
    original_available: boolean;
    original_page_count: number;
    reading_record?: DemoInvoice["reading_record"];
    live_reading?: LiveInvoiceReadingView;
    other_charges?: DemoInvoice["other_charges"];
    purchase_cost_allowed: boolean;
    margin_allowed: boolean;
    correction_allowed: boolean;
  };

/** Explicit properties only, including when retained data contains unknown fields. */
function select<T extends object, K extends keyof T>(
  record: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys)
    if (Object.hasOwn(record, key)) result[key] = structuredClone(record[key]);
  return result;
}
const lineKeys = [
  "id",
  "company_id",
  "product_code",
  "description",
  "barcode",
  "handwritten_note",
  "expiry_as_printed",
  "pack_size",
  "import_line_index",
  "qty_invoiced",
  "taxable",
  "calculated_selling_price",
  "current_selling_price",
  "qty_received_at_posting",
  "tax_profile",
  "confidence",
  "low_confidence_fields",
  "checked_fields",
  "taxable_inferred",
  "pricing_category",
  "date_tracking",
  "date_type",
  "date_value",
  "date_confirmed",
  "lot_number",
  "qty_later_received",
  "review_confirmed",
  "review_changed_after_confirmation",
  "new_name_en",
  "new_name_suggestion",
  "new_name_swap",
  "new_name_fa",
  "units_per_case",
  "units_per_case_inferred",
  "manual_price_decision",
  "short_dated",
  "supplier_item_id",
  "supplier_item_code",
  "supplier_item_code_inferred",
  "reading_supplier_promotion",
  "quantity_unit",
  "quantity_entered",
  "order_item_id",
  "refused_units",
  "extra_delivery_decision",
  "order_price_decision",
  "sold_by",
  "source_quantity",
  "source_quantity_unit",
  "source_received_quantity",
  "source_cost_unit",
  "weight_conversion_factor",
  "case_weight",
  "case_weight_unit",
  "canonical_lb_quantity",
  "weight_case_quantity",
  "weight_case_received_quantity",
  "order_new_item_match",
] as const satisfies readonly (keyof InvoiceLine)[];
const lineMoneyKeys = [
  "paper_line_total",
  "paper_total_acknowledgement",
  "weight_case_cost_basis",
  "imported_unit_cost_basis",
  "unit_cost_before_tax",
  "case_cost_before_tax",
  "converted_case_cost_before_tax",
  "converted_case_units_per_case",
  "source_cost_before_tax",
  "line_total",
  "line_tax",
  "short_before_tax",
  "short_tax",
] as const satisfies readonly InvoiceLineMoney[];
const invoiceKeys = [
  "id",
  "company_id",
  "branch",
  "branch_id",
  "supplier",
  "supplier_invoice_number",
  "low_confidence_fields",
  "checked_fields",
  "import_warnings",
  "import_handwritten_notes",
  "import_currency",
  "import_currency_inferred",
  "calculated_fields",
  "calculated_from_lines",
  "order_reference",
  "invoice_date_relative_days",
  "payment_terms",
  "created_by_user_id",
  "handler_user_ids",
  "reviewer_user_ids",
  "reviewer_origin_location_id",
  "version",
  "status",
  "file_name",
  "file_type",
  "file_size",
  "original_file_invoice_id",
  "demo_original_snapshot",
  "invoice_date",
  "received_at",
  "imported_received_source",
  "imported_received_alternative",
  "receiving_employee",
  "due_date",
  "posted_at",
  "supplier_confirmed",
  "entry_mode",
  "payment_term_days",
  "payment_terms_inferred",
  "due_date_manual",
  "final_total_manual",
  "supplier_review_required",
  "supplier_review_confirmed",
  "number_is_system_assigned",
  "short_receipt_keys",
  "handling_branch",
  "ship_to",
  "bill_to",
  "supplier_tax_number",
  "order_id",
  "order_missing_decisions",
  "order_review_version",
] as const satisfies readonly (keyof DemoInvoice)[];
const invoiceMoneyKeys = [
  "subtotal",
  "tax",
  "final_total",
  "payable_after_open_shorts",
] as const;

/** No raw correction, approval reason, source handle or margin enters this view. */
function projectReadingProductMatch(
  state: DemoState,
  actor: AuthenticatedActor,
  line: InvoiceLine,
): { reading_product_match?: InvoiceProductMatchReadDTO } {
  const match = line.reading_product_match;
  if (
    !match ||
    match.product_code !== line.product_code ||
    ![
      "supplier_code",
      "supplier_description",
      "barcode",
      "catalog_name",
      "other_supplier_description",
    ].includes(match.basis) ||
    !state.products.some(
      (product) =>
        product.company_id === state.config.company.seed_key &&
        product.code === line.product_code,
    )
  )
    return {};
  const prior = [state.invoice, ...(state.invoices ?? [])].find(
    (invoice) =>
      invoice.company_id === state.config.company.seed_key &&
      invoice.id === match.source_invoice_id,
  );
  return {
    reading_product_match: {
      product_code: match.product_code,
      basis: match.basis,
      requires_check:
        match.requires_check === true &&
        Boolean(
          line.low_confidence_fields?.some(
            (field) => invoiceCheckField(field) === "product_code",
          ),
        ),
      earlier_delivery:
        match.earlier_delivery === true &&
        prior?.status === "posted" &&
        canInvoiceAuthority(state, actor, "invoices.read", prior.id),
    },
  };
}

export function invoiceView(
  state: DemoState,
  actor: AuthenticatedActor,
  invoiceId: string,
  requestedVersion?: string | null,
): InvoiceView {
  const current = requireInvoiceAuthority(
    state,
    actor,
    "invoices.read",
    invoiceId,
  );
  const original =
    invoiceId === state.invoice.id
      ? state.invoice
      : state.invoices!.find((value) => value.id === invoiceId)!;
  if (requestedVersion)
    requireInvoiceAuthority(state, current, "invoices.correct", original.id);
  const invoice = structuredClone(
    requestedVersion
      ? invoiceVersion(state, original, requestedVersion).invoice
      : original.status === "posted"
        ? effectiveInvoiceVersion(state, original)
        : original,
  );
  normalizeInvoiceReceivingReview(invoice);
  const scope = invoiceAuthorityScope(state, original.id);
  const costs = can(state, current, "invoices.cost_read", scope).allowed;
  const margins = can(state, current, "pricing.margin_read", scope).allowed;
  const relatedOrder =
    invoice.order_comparison &&
    state.orders?.find(
      (order) =>
        order.id === invoice.order_comparison!.order_id &&
        order.company_id === original.company_id,
    );
  const orderCosts = Boolean(
    relatedOrder &&
    can(
      state,
      current,
      "invoices.cost_read",
      purchaseLocationScope(relatedOrder.company_id, relatedOrder.branch),
    ).allowed,
  );
  const view = {
    ...select(invoice, invoiceKeys),
    ...(invoice.live_reading
      ? { live_reading: projectLiveInvoiceReading(invoice.live_reading) }
      : {}),
    received_at: effectiveInvoiceReceivedAt(state, invoice),
    ...(costs
      ? {
          ...select(invoice, invoiceMoneyKeys),
          ...select(invoice, ["reading_record", "other_charges"]),
        }
      : {}),
    branch:
      original.status === "posted"
        ? effectiveInvoiceLocation(state, original)
        : original.branch,
    lines: invoice.lines.map((line) => ({
      ...select(line, lineKeys),
      ...projectReadingProductMatch(state, current, line),
      ...(costs ? select(line, lineMoneyKeys) : {}),
      ...(line.order_new_item_match
        ? {
            order_new_item_match: select(line.order_new_item_match, [
              "order_line_id",
              "order_version",
              "invoice_line_index",
              "product_code",
              "supplier_item_code",
              "units_per_case",
              "fingerprint",
            ]),
          }
        : {}),
    })),
    ...(costs
      ? {
          short_lines: invoice.short_lines
            .map((line) =>
              select(line, [
                "product_code",
                "qty_short",
                "deduction_before_tax",
                "deduction_tax",
                "total_deduction",
              ]),
            )
            .map((line, index) => ({
              ...line,
              later_deliveries: invoice.short_lines[index].later_deliveries.map(
                (delivery) =>
                  select(delivery, [
                    "qty_received",
                    "restored_before_tax",
                    "restored_tax",
                    "restored_total",
                  ]),
              ),
            })),
        }
      : {}),
    ...(invoice.lower_price_answers
      ? {
          lower_price_answers: select(invoice.lower_price_answers, [
            "same_expiry",
            "old_expiry",
            "new_expiry",
            "units_left",
            "note",
          ]),
        }
      : {}),
    ...(costs && orderCosts && invoice.order_comparison
      ? {
          order_comparison: {
            order_id: invoice.order_comparison.order_id,
            order_version: invoice.order_comparison.order_version,
            lines: invoice.order_comparison.lines.map((line) =>
              select(line, [
                "invoice_line_index",
                "order_line_id",
                "expected_remaining_units",
                "delivered_units",
                "accepted_units",
                "extra_units",
                "short_units",
                "previous_unit_cost",
                "new_unit_cost",
                "price_changed",
                "old_units_per_case",
                "new_units_per_case",
                "previous_case_cost",
                "new_case_cost",
              ]),
            ),
            residual: invoice.order_comparison.residual.map((line) =>
              select(line, [
                "order_line_id",
                "expected_remaining_units",
                "received_units",
                "missing_units",
                "missing_cases",
                "absent",
              ]),
            ),
          },
        }
      : {}),
    original_available: Boolean(
      costs &&
      ((original.file_data && original.file_name) ||
        original.original_pages?.length),
    ),
    original_page_count: costs
      ? original.original_pages?.length ||
        (original.file_data && original.file_name ? 1 : 0)
      : 0,
    purchase_cost_allowed: costs,
    margin_allowed: margins,
    correction_allowed: can(
      state,
      current,
      "invoices.correct",
      invoiceAuthorityScope(state, original.id, true, true),
    ).allowed,
  };
  return businessAuditRead(
    ["owner", "manager"].includes(current.role)
      ? view
      : redactLiveReadingProvenance(view),
  );
}

export type InvoiceReadDTO = InvoiceView;
/** Explicit null selection; never replace a denied workspace with invented zero data. */
export function projectInvoiceState(
  state: DemoState,
  actor: AuthenticatedActor,
): {
  invoice: InvoiceReadDTO | null;
  invoices: InvoiceReadDTO[];
  invoice_workspace: InvoiceWorkspaceRead | null;
} {
  actor = freshActor(state, actor);
  const views = invoiceRecords(state, state.config.company.seed_key)
    .filter((invoice) => {
      try {
        return can(
          state,
          actor,
          "invoices.read",
          invoiceAuthorityScope(state, invoice.id),
        ).allowed;
      } catch {
        return false;
      }
    })
    .map((invoice) => invoiceView(state, actor, invoice.id));
  return {
    invoice: views.find((invoice) => invoice.id === state.invoice.id) ?? null,
    invoices: views.filter((invoice) => invoice.id !== state.invoice.id),
    invoice_workspace: can(
      state,
      actor,
      "invoices.cost_read",
      invoiceAuthorityScope(state, state.invoice.id),
    ).allowed
      ? invoiceWorkspaceRead(state, actor, state.invoice.id)
      : null,
  };
}

/** Financial fields are required only after actual cost authority and shape validation. */
export type InvoicePurchaseLineView = InvoiceLineView & {
  unit_cost_before_tax: string;
  line_total: string;
};
export type InvoicePurchaseReadDTO = Omit<
  InvoiceReadDTO,
  "lines" | "short_lines" | InvoiceMoney
> &
  Pick<DemoInvoice, InvoiceMoney | "short_lines"> & {
    lines: InvoicePurchaseLineView[];
  };
function purchaseShape(
  invoice: InvoiceReadDTO,
): invoice is InvoicePurchaseReadDTO {
  return (
    invoice.purchase_cost_allowed &&
    typeof invoice.subtotal === "string" &&
    typeof invoice.tax === "string" &&
    typeof invoice.final_total === "string" &&
    typeof invoice.payable_after_open_shorts === "string" &&
    Array.isArray(invoice.short_lines) &&
    invoice.lines.every(
      (line) =>
        typeof line.unit_cost_before_tax === "string" &&
        typeof line.line_total === "string",
    )
  );
}
export function purchaseInvoiceView(
  state: DemoState,
  actor: AuthenticatedActor,
  invoiceId = state.invoice.id,
  version?: string | null,
): InvoicePurchaseReadDTO {
  requireInvoiceAuthority(state, actor, "invoices.cost_read", invoiceId);
  const view = invoiceView(state, actor, invoiceId, version);
  if (!purchaseShape(view))
    throw new Error("Invoice purchase data is unavailable.");
  return businessAuditRead(view);
}
