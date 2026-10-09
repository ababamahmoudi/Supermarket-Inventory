import Decimal from "decimal.js";
import { createId } from "./ids";
import { effectivePrice } from "./catalog";
import { manualPrice } from "./manual-prices";
import { configuredBranches } from "./settings";
import {
  companyDate,
  acceptedInvoiceUnits,
  recalculateInvoice,
  shortTotals,
  refusedTotals,
  validInvoiceLineQuantity,
  validInvoiceLineReceived,
} from "./invoice";
import { invoiceLineCalculation, refreshInvoiceWeight } from "./invoice-weight";
import { effectiveInvoiceLocation } from "./received";
import {
  effectiveInvoiceVersion,
  invoiceContentVersions,
} from "./invoice-version";
import { validTrackedDate, trackedDateDaysLeft } from "./date-tracking";
import type { OperationsContext, OperationalLedger } from "./operations";
import type { Approval, DemoInvoice, DemoState, InvoiceLine } from "./types";

/** Posted evidence remains immutable; each correction is a separate version. */
export interface InvoiceContentCorrection {
  id: string;
  request_id: string;
  company_id: string;
  invoice_id: string;
  previous_correction_id?: string;
  branch: string;
  reason: string;
  by: string;
  at: string;
  device: string;
  before: DemoInvoice;
  after: DemoInvoice;
  original_file_invoice_id: string;
  snapshot: string;
  payable_before: string;
  payable_after: string;
  payable_delta: string;
  excess_allocated_credit: string;
  ledger_adjustment_id?: string;
  physical_movement_ids: string[];
  superseded_approval_ids: string[];
  approval_ids: string[];
  removed_date_ids: string[];
  date_ids: string[];
}

export interface InvoiceCorrectionInput {
  lines: InvoiceLine[];
  reason: string;
}

export interface InvoiceCorrectionPreview {
  before: DemoInvoice;
  after: DemoInvoice;
  previous_correction_id?: string;
  branch: string;
  payable_before: string;
  payable_after: string;
  payable_delta: string;
  allocated_amount: string;
  excess_allocated_credit: string;
  receipts: {
    line_index: number;
    before_product: string;
    after_product: string;
    before_quantity: string;
    after_quantity: string;
  }[];
  approval_changes: {
    line_index: number;
    product_code: string;
    before_product_code: string;
    selling_price: string;
    unit_cost: string;
    margin: string | null;
    manual: boolean;
    updates_regular_cost: boolean;
    creates_pending_proposal: boolean;
    superseded_approval_ids: string[];
  }[];
  date_changes: {
    line_index: number;
    product_code: string;
    before?: string;
    after?: string;
    date_type?: "expiry" | "best_before";
  }[];
  blockers: string[];
  snapshot: string;
}

export class InvoiceCorrectionError extends Error {
  constructor(
    public readonly code:
      | "scope"
      | "reason"
      | "lines"
      | "product"
      | "quantity"
      | "cost"
      | "date"
      | "stale"
      | "downstream"
      | "unchanged",
    message: string,
  ) {
    super(message);
    this.name = "InvoiceCorrectionError";
  }
}
const money = (value: Decimal.Value) =>
  new Decimal(value).toFixed(2, Decimal.ROUND_HALF_UP);
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const withoutFile = (invoice: DemoInvoice) => {
  const result = structuredClone(invoice);
  delete result.file_data;
  delete result.legacy_demo_original;
  return result;
};
function fileFingerprint(value = "") {
  let a = 2166136261,
    b = 5381;
  for (let index = 0; index < value.length; index++) {
    a = Math.imul(a ^ value.charCodeAt(index), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(index);
  }
  return `${value.length}:${a >>> 0}:${b >>> 0}`;
}
function originalInvoice(
  state: DemoState,
  context: OperationsContext,
  id: string,
): DemoInvoice {
  const original = [...(state.invoices ?? []), state.invoice].find(
    (invoice) =>
      invoice.company_id === context.company_id &&
      invoice.id === id &&
      invoice.status === "posted",
  );
  if (
    context.role !== "supervisor" ||
    context.company_id !== state.config.company.seed_key ||
    !original
  )
    throw new InvoiceCorrectionError(
      "scope",
      "Only the Supervisor can correct a posted invoice in this company.",
    );
  const location = effectiveInvoiceLocation(state, original);
  if (
    !configuredBranches(state.config, true).includes(location) ||
    (context.branch !== "all" && context.branch !== location)
  )
    throw new InvoiceCorrectionError(
      "scope",
      "Choose the invoice's current receiving location.",
    );
  if (
    !state.ledger.some(
      (entry) =>
        entry.company_id === context.company_id &&
        entry.invoice_id === id &&
        entry.type === "invoice",
    )
  )
    throw new InvoiceCorrectionError(
      "scope",
      "The original invoice ledger is missing. Review the retained invoice before correcting it.",
    );
  return original;
}

/** Preview and save must make the same decision without dropping cost changes. */
function correctionProposalDecision(
  state: DemoState,
  companyId: string,
  branch: string,
  change: Pick<
    InvoiceCorrectionPreview["approval_changes"][number],
    "product_code" | "selling_price" | "margin"
  >,
) {
  const product = state.products.find(
    (product) =>
      product.company_id === companyId && product.code === change.product_code,
  )!;
  const current = effectivePrice(state, product, branch);
  const category = state.config.pricing_categories.find(
    (category) => category.key === product.pricing_category,
  )!;
  const below =
    change.margin !== null &&
    category.minimum_margin !== null &&
    category.minimum_margin !== "" &&
    new Decimal(change.margin).lt(category.minimum_margin);
  const type: Approval["type"] | null =
    current !== change.selling_price || below
      ? current === null
        ? "new_product"
        : current === change.selling_price
          ? "margin_review"
          : "price_change"
      : null;
  return { current, type, threshold: category.minimum_margin };
}

function correctionPendingApprovals(
  state: DemoState,
  companyId: string,
  invoiceId: string,
  change: Pick<
    InvoiceCorrectionPreview["approval_changes"][number],
    "product_code" | "before_product_code"
  >,
) {
  return state.approvals.filter(
    (approval) =>
      approval.company_id === companyId &&
      approval.status === "pending" &&
      [change.product_code, change.before_product_code].includes(
        approval.product_code,
      ) &&
      approval.source_invoice_id === invoiceId,
  );
}

export function invoiceContentCorrectionPreview(
  state: DemoState,
  context: OperationsContext,
  id: string,
  input: InvoiceCorrectionInput,
): InvoiceCorrectionPreview {
  const original = originalInvoice(state, context, id);
  const before = effectiveInvoiceVersion(state, original);
  const branch = effectiveInvoiceLocation(state, original);
  if (!input.lines.length || input.lines.length !== before.lines.length)
    throw new InvoiceCorrectionError(
      "lines",
      "Keep each original invoice line in the correction.",
    );
  const after = structuredClone(before);
  const changed = new Set<number>();
  const physicalChanged = new Set<number>();
  const pricingChanged = new Set<number>();
  const dateChanged = new Set<number>();
  after.lines = input.lines.map((incoming, index) => {
    const old = before.lines[index];
    const line = { ...old };
    const fields = [
      "product_code",
      "qty_invoiced",
      "qty_received_at_posting",
      "unit_cost_before_tax",
      "units_per_case",
      "quantity_unit",
      "quantity_entered",
      "case_cost_before_tax",
      "date_tracking",
      "date_type",
      "date_value",
      "lot_number",
      "sold_by",
      "source_quantity",
      "source_quantity_unit",
      "source_received_quantity",
      "source_cost_before_tax",
      "source_cost_unit",
      "weight_conversion_factor",
      "case_weight",
      "case_weight_unit",
      "canonical_lb_quantity",
    ] as const;
    for (const field of fields) {
      // Only editor fields can change; company/supplier/order/receipt evidence stays retained.
      (line as unknown as Record<string, unknown>)[field] = incoming[field];
    }
    line.company_id = before.company_id;
    const product = state.products.find(
      (product) =>
        product.company_id === context.company_id &&
        product.code === line.product_code,
    );
    if (
      !product ||
      (product.status === "archived" && product.code !== old.product_code)
    )
      throw new InvoiceCorrectionError(
        "product",
        `Choose a product for line ${index + 1}.`,
      );
    if (line.product_code !== old.product_code) {
      line.description = product.name_en;
      line.pricing_category = product.pricing_category;
      line.tax_profile = product.tax_profile;
      line.taxable = product.taxable;
      line.sold_by = product.sold_by ?? "each";
      line.supplier_item_id = undefined;
      line.supplier_item_code = undefined;
      line.order_new_item_match = undefined;
    }
    if (
      !/^\d+(?:\.\d{1,4})?$/.test(
        line.sold_by === "weight"
          ? (line.source_cost_before_tax ?? line.unit_cost_before_tax)
          : line.unit_cost_before_tax,
      )
    )
      throw new InvoiceCorrectionError(
        "cost",
        `Enter a cost with up to four decimal places on line ${index + 1}.`,
      );
    if (line.sold_by !== "weight") {
      if (line.quantity_unit === "cases") {
        try {
          const entered = new Decimal(
            line.quantity_entered ??
              new Decimal(line.qty_invoiced).div(line.units_per_case ?? 1),
          );
          if (
            !Number.isSafeInteger(line.units_per_case) ||
            (line.units_per_case ?? 0) <= 0 ||
            !entered.times(line.units_per_case!).eq(line.qty_invoiced)
          )
            throw new Error("pack");
          if (
            line.unit_cost_before_tax !== old.unit_cost_before_tax ||
            line.units_per_case !== old.units_per_case
          )
            line.case_cost_before_tax = new Decimal(line.unit_cost_before_tax)
              .times(line.units_per_case!)
              .toFixed(4, Decimal.ROUND_HALF_UP);
        } catch {
          throw new InvoiceCorrectionError(
            "quantity",
            `Review the case quantity and pack on line ${index + 1}.`,
          );
        }
      } else line.quantity_entered = String(line.qty_invoiced);
    }
    if (
      old.sold_by === "weight" &&
      line.sold_by === "weight" &&
      old.weight_conversion_factor &&
      line.weight_conversion_factor !== old.weight_conversion_factor
    )
      throw new InvoiceCorrectionError(
        "quantity",
        `Retain the original weight conversion on line ${index + 1}.`,
      );
    try {
      if (line.sold_by === "weight") refreshInvoiceWeight(line, state.config);
    } catch {
      throw new InvoiceCorrectionError(
        "quantity",
        `Review the weight and cost on line ${index + 1}.`,
      );
    }
    if (
      !validInvoiceLineQuantity(line) ||
      !validInvoiceLineReceived(line) ||
      (line.refused_units ?? 0) > line.qty_received_at_posting
    )
      throw new InvoiceCorrectionError(
        "quantity",
        `Enter valid invoice and delivered quantities on line ${index + 1}.`,
      );
    if (!/^\d+(?:\.\d{1,4})?$/.test(line.unit_cost_before_tax))
      throw new InvoiceCorrectionError(
        "cost",
        `Enter a cost with up to four decimal places on line ${index + 1}.`,
      );
    if (
      line.date_tracking &&
      (line.date_tracking !== old.date_tracking ||
        line.date_value !== old.date_value ||
        line.product_code !== old.product_code) &&
      !validTrackedDate(line.date_value ?? "")
    )
      throw new InvoiceCorrectionError(
        "date",
        `Enter the tracked date on line ${index + 1}.`,
      );
    if (!equal(line, old)) changed.add(index);
    const physicalKeys = [
      "product_code",
      "qty_invoiced",
      "qty_received_at_posting",
      "units_per_case",
      "sold_by",
      "source_quantity_unit",
      "case_weight",
      "case_weight_unit",
      "quantity_unit",
      "quantity_entered",
      "source_quantity",
      "source_received_quantity",
      "weight_conversion_factor",
    ] as const;
    if (physicalKeys.some((key) => !equal(line[key], old[key])))
      physicalChanged.add(index);
    if (
      physicalChanged.has(index) ||
      line.unit_cost_before_tax !== old.unit_cost_before_tax ||
      line.source_cost_before_tax !== old.source_cost_before_tax ||
      line.source_cost_unit !== old.source_cost_unit
    )
      pricingChanged.add(index);
    if (
      line.product_code !== old.product_code ||
      line.date_tracking !== old.date_tracking ||
      line.date_type !== old.date_type ||
      line.date_value !== old.date_value ||
      line.lot_number !== old.lot_number ||
      physicalChanged.has(index)
    )
      dateChanged.add(index);
    if (pricingChanged.has(index)) {
      // Remove old allocations of short cents only on the changed line.
      line.short_before_tax = undefined;
      line.short_tax = undefined;
      const scratch = { ...after, lines: [structuredClone(line)] };
      recalculateInvoice(scratch, state.config);
      line.line_total = scratch.lines[0].line_total;
      line.line_tax = scratch.lines[0].line_tax;
      line.calculated_selling_price = invoiceLineCalculation(
        line,
        line.pricing_category ?? product.pricing_category,
        state.config,
      ).selling_price;
    }
    return line;
  });
  if (!changed.size)
    throw new InvoiceCorrectionError(
      "unchanged",
      "Change an invoice line before previewing the correction.",
    );
  const blockers: string[] = [];
  for (const index of pricingChanged) {
    const old = before.lines[index];
    if ((old.qty_later_received ?? 0) > 0)
      blockers.push(
        `Line ${index + 1} has a later short delivery. Keep its quantity, product, pack and cost; correct its date separately.`,
      );
  }
  for (const index of physicalChanged) {
    const old = before.lines[index];
    if (
      old.order_item_id ||
      old.order_new_item_match ||
      before.order_comparison?.lines.some(
        (row) => row.invoice_line_index === index && row.order_line_id,
      )
    )
      blockers.push(
        `Line ${index + 1} has a retained order receipt. Keep its quantity, product and pack; a cost or date correction is available.`,
      );
    const pickedUp = Decimal.sum(
      0,
      ...state.returns
        .filter(
          (record) =>
            record.company_id === context.company_id &&
            record.linked_invoice === id,
        )
        .flatMap((record) =>
          record.lines
            .filter((line) => line.product_code === old.product_code)
            .map((line) => line.picked_up ?? 0),
        ),
    );
    const acceptedCoverage = Decimal.sum(
      0,
      ...after.lines
        .filter((line) => line.product_code === old.product_code)
        .map((line) => acceptedInvoiceUnits(line)),
    );
    if (
      pickedUp.gt(0) &&
      (after.lines[index].product_code !== old.product_code ||
        acceptedCoverage.lt(pickedUp))
    )
      blockers.push(
        `Line ${index + 1} has picked-up supplier return evidence. Keep the product and accepted quantity sufficient to cover the retained return.`,
      );
    if (
      after.lines[index].product_code !== old.product_code &&
      state.approvals.some(
        (approval) =>
          approval.company_id === context.company_id &&
          approval.product_code === old.product_code &&
          approval.status === "pending" &&
          approval.source_invoice_id === id &&
          (approval.invoice_ids ?? []).some((invoiceId) => invoiceId !== id),
      )
    )
      blockers.push(
        `Line ${index + 1} has a merged pending approval with other invoices. Keep the product until that approval is resolved; cost and date corrections are available.`,
      );
  }
  const subtotalDelta = Decimal.sum(
    0,
    ...after.lines.map((line, index) =>
      new Decimal(line.line_total).minus(before.lines[index].line_total),
    ),
  );
  const taxDelta = Decimal.sum(
    0,
    ...after.lines.map((line, index) => {
      if (!pricingChanged.has(index)) return new Decimal(0);
      const originalLine = before.lines[index];
      let baseline = originalLine.line_tax;
      if (baseline === undefined) {
        const scratch = { ...before, lines: [structuredClone(originalLine)] };
        recalculateInvoice(scratch, state.config);
        baseline = scratch.lines[0].line_tax ?? "0";
      }
      return new Decimal(line.line_tax ?? "0").minus(baseline);
    }),
  );
  after.subtotal = money(new Decimal(before.subtotal).plus(subtotalDelta));
  after.tax = money(new Decimal(before.tax).plus(taxDelta));
  after.final_total = money(
    new Decimal(before.final_total).plus(subtotalDelta).plus(taxDelta),
  );
  if (
    new Decimal(after.final_total).lt(0) ||
    new Decimal(after.subtotal).lt(0) ||
    new Decimal(after.tax).lt(0)
  )
    throw new InvoiceCorrectionError(
      "cost",
      "The correction would make the invoice total negative. Review the original amounts and changed lines.",
    );
  const payableBefore = money(
    new Decimal(before.final_total)
      .minus(shortTotals(before).total)
      .minus(refusedTotals(before).total),
  );
  const payableAfter = money(
    new Decimal(after.final_total)
      .minus(shortTotals(after).total)
      .minus(refusedTotals(after).total),
  );
  after.payable_after_open_shorts = payableAfter;
  const rows = (state.ledger as OperationalLedger[]).filter(
    (entry) =>
      entry.company_id === context.company_id &&
      (entry.invoice_id === id ||
        entry.allocations?.some((allocation) => allocation.invoice_id === id)),
  );
  const allocated = Decimal.sum(
    0,
    ...rows.flatMap(
      (row) =>
        row.allocations
          ?.filter((allocation) => allocation.invoice_id === id)
          .map((allocation) => allocation.amount) ?? [],
    ),
  );
  const proposals = state.approvals.filter(
    (approval) =>
      approval.company_id === context.company_id &&
      (approval.source_invoice_id === id || approval.invoice_ids?.includes(id)),
  );
  const dates = state.expiry.filter(
    (entry) =>
      entry.company_id === context.company_id && entry.invoice_id === id,
  );
  const receipts = [...physicalChanged].map((index) => ({
    line_index: index,
    before_product: before.lines[index].product_code,
    after_product: after.lines[index].product_code,
    before_quantity: String(acceptedInvoiceUnits(before.lines[index])),
    after_quantity: String(acceptedInvoiceUnits(after.lines[index])),
  }));
  const approvalChanges = [...pricingChanged].flatMap((index) => {
    const line = after.lines[index];
    if (line.short_dated || acceptedInvoiceUnits(line) <= 0) return [];
    const product = state.products.find(
      (product) =>
        product.company_id === context.company_id &&
        product.code === line.product_code,
    )!;
    const anchor =
      original.posted_at ?? original.received_at ?? original.invoice_date ?? "";
    const newerAccepted = (state.invoices ?? []).filter(
      (invoice) =>
        invoice.company_id === context.company_id &&
        invoice.status === "posted" &&
        invoice.id !== id &&
        (invoice.posted_at ??
          invoice.received_at ??
          invoice.invoice_date ??
          "") > anchor &&
        effectiveInvoiceVersion(state, invoice).lines.some(
          (item) =>
            item.product_code === line.product_code &&
            !item.short_dated &&
            acceptedInvoiceUnits(item) > 0,
        ),
    );
    if (
      newerAccepted.some(
        (invoice) => effectiveInvoiceLocation(state, invoice) === branch,
      )
    )
      return [];
    const calculation = invoiceLineCalculation(
      line,
      line.pricing_category ?? product.pricing_category,
      state.config,
    );
    const manual = manualPrice(state, product, branch);
    const change = {
      line_index: index,
      product_code: product.code,
      before_product_code: before.lines[index].product_code,
      selling_price: manual?.price ?? calculation.selling_price,
      unit_cost: line.unit_cost_before_tax,
      margin:
        manual && new Decimal(manual.price).gt(0)
          ? new Decimal(manual.price)
              .minus(line.unit_cost_before_tax)
              .div(manual.price)
              .toFixed(8)
          : calculation.margin,
      manual: !!manual,
      updates_regular_cost: newerAccepted.length === 0,
    };
    return [
      {
        ...change,
        creates_pending_proposal:
          correctionProposalDecision(state, context.company_id, branch, change)
            .type !== null,
        superseded_approval_ids: correctionPendingApprovals(
          state,
          context.company_id,
          id,
          change,
        ).map((approval) => approval.id),
      },
    ];
  });
  const dateChanges = [...dateChanged].map((index) => ({
    line_index: index,
    product_code: after.lines[index].product_code,
    before: before.lines[index].date_tracking
      ? before.lines[index].date_value
      : undefined,
    after:
      after.lines[index].date_tracking &&
      acceptedInvoiceUnits(after.lines[index]) > 0
        ? after.lines[index].date_value
        : undefined,
    date_type: after.lines[index].date_type,
  }));
  const previous = invoiceContentVersions(state, original).at(-1)!.version_id;
  return {
    before,
    after,
    previous_correction_id: previous === "original" ? undefined : previous,
    branch,
    payable_before: payableBefore,
    payable_after: payableAfter,
    payable_delta: money(new Decimal(payableAfter).minus(payableBefore)),
    allocated_amount: money(allocated),
    excess_allocated_credit: money(
      Decimal.max(0, allocated.minus(payableAfter)),
    ),
    receipts,
    approval_changes: approvalChanges,
    date_changes: dateChanges,
    blockers,
    snapshot: JSON.stringify({
      original: withoutFile(original),
      original_file: fileFingerprint(original.file_data),
      before: withoutFile(before),
      after: withoutFile(after),
      reason: input.reason.trim(),
      branch,
      rows,
      proposals,
      dates,
      location: state.invoice_location_corrections?.filter(
        (entry) =>
          entry.company_id === context.company_id && entry.invoice_id === id,
      ),
      orders: state.orders?.filter((order) =>
        order.linked_invoice_ids.includes(id),
      ),
      returns: state.returns.filter(
        (record) =>
          record.company_id === context.company_id &&
          record.linked_invoice === id,
      ),
      products: state.products.filter(
        (product) =>
          product.company_id === context.company_id &&
          after.lines.some((line) => line.product_code === product.code),
      ),
      config: state.config,
    }),
  };
}

export function correctPostedInvoice(
  state: DemoState,
  context: OperationsContext,
  id: string,
  input: InvoiceCorrectionInput,
  snapshot: string,
  requestId: string,
): InvoiceContentCorrection {
  originalInvoice(state, context, id);
  if (!requestId.trim())
    throw new InvoiceCorrectionError(
      "stale",
      "Use a unique correction request.",
    );
  if (!input.reason.trim())
    throw new InvoiceCorrectionError(
      "reason",
      "Give a reason for the correction.",
    );
  const priorRequest = state.invoice_content_corrections?.find(
    (correction) =>
      correction.company_id === context.company_id &&
      correction.invoice_id === id &&
      correction.request_id === requestId,
  );
  if (priorRequest) {
    if (priorRequest.snapshot !== snapshot)
      throw new InvoiceCorrectionError(
        "stale",
        "This correction request already has different recorded details.",
      );
    return priorRequest;
  }
  const preview = invoiceContentCorrectionPreview(state, context, id, input);
  if (preview.snapshot !== snapshot)
    throw new InvoiceCorrectionError(
      "stale",
      "The invoice or allocations changed. Review the correction again.",
    );
  if (preview.blockers.length)
    throw new InvoiceCorrectionError("downstream", preview.blockers.join(" "));
  const correctionId = createId("invoice-content");
  const at = new Date().toISOString();
  const correction: InvoiceContentCorrection = {
    id: correctionId,
    request_id: requestId,
    company_id: context.company_id,
    invoice_id: id,
    previous_correction_id: preview.previous_correction_id,
    branch: preview.branch,
    reason: input.reason.trim(),
    by: context.actor,
    at,
    device: "Prototype browser",
    before: withoutFile(preview.before),
    after: withoutFile(preview.after),
    original_file_invoice_id: id,
    snapshot,
    payable_before: preview.payable_before,
    payable_after: preview.payable_after,
    payable_delta: preview.payable_delta,
    excess_allocated_credit: preview.excess_allocated_credit,
    physical_movement_ids: [],
    superseded_approval_ids: [],
    approval_ids: [],
    removed_date_ids: [],
    date_ids: [],
  };
  if (!new Decimal(preview.payable_delta).isZero()) {
    correction.ledger_adjustment_id = `${correctionId}:payable`;
    state.ledger.push({
      id: correction.ledger_adjustment_id,
      company_id: context.company_id,
      branch: preview.branch,
      supplier: preview.before.supplier,
      type: "adjustment",
      amount: preview.payable_delta,
      date: companyDate(state.config),
      reference: preview.before.supplier_invoice_number,
      invoice_id: id,
      currency:
        state.ledger.find(
          (entry) =>
            entry.company_id === context.company_id &&
            entry.invoice_id === id &&
            entry.type === "invoice",
        )?.currency ?? state.config.company.currency,
      note: input.reason.trim(),
    });
  }
  state.stock_movements ??= [];
  for (const receipt of preview.receipts) {
    const movements =
      receipt.before_product === receipt.after_product
        ? [
            {
              product: receipt.after_product,
              qty: new Decimal(receipt.after_quantity).minus(
                receipt.before_quantity,
              ),
            },
          ]
        : [
            {
              product: receipt.before_product,
              qty: new Decimal(receipt.before_quantity).negated(),
            },
            {
              product: receipt.after_product,
              qty: new Decimal(receipt.after_quantity),
            },
          ];
    for (const [index, movement] of movements.entries()) {
      if (movement.qty.isZero()) continue;
      const movementId = `${correctionId}:receipt:${receipt.line_index}:${index}`;
      state.stock_movements.push({
        id: movementId,
        company_id: context.company_id,
        branch: preview.branch,
        product_code: movement.product,
        qty: movement.qty.toNumber(),
        type: "invoice_content_correction",
        reference: id,
        invoice_id: id,
        line_index: receipt.line_index,
        by: context.actor,
        at,
      });
      correction.physical_movement_ids.push(movementId);
    }
  }
  for (const change of preview.approval_changes) {
    const product = state.products.find(
      (product) =>
        product.company_id === context.company_id &&
        product.code === change.product_code,
    )!;
    const contributorIds = new Set<string>([id]);
    for (const approval of correctionPendingApprovals(
      state,
      context.company_id,
      id,
      change,
    )) {
      if (approval.product_code === change.product_code)
        for (const contributor of approval.invoice_ids ?? [])
          contributorIds.add(contributor);
      approval.status = "superseded";
      approval.correction_id = correctionId;
      correction.superseded_approval_ids.push(approval.id);
    }
    if (
      product.pending_branch === preview.branch &&
      correction.superseded_approval_ids.length &&
      !state.approvals.some(
        (approval) =>
          approval.company_id === context.company_id &&
          approval.product_code === product.code &&
          approval.branch === preview.branch &&
          approval.status === "pending",
      )
    ) {
      product.pending_price = null;
      product.pending_branch = undefined;
    }
    const { current, type, threshold } = correctionProposalDecision(
      state,
      context.company_id,
      preview.branch,
      change,
    );
    if (type !== null) {
      const approval: Approval = {
        id: `${correctionId}:proposal:${change.line_index}`,
        company_id: context.company_id,
        branch: preview.branch,
        product_code: change.product_code,
        status: "pending",
        type,
        proposed_price: change.selling_price,
        current_price: current,
        unit_cost: change.unit_cost,
        margin: change.margin,
        threshold,
        source_invoice_id: id,
        invoice_ids: [...contributorIds],
        invoice_number: preview.before.supplier_invoice_number,
        posted_at: at,
        created_at: at,
        triggered_by: context.actor,
        correction_id: correctionId,
      };
      state.approvals.push(approval);
      correction.approval_ids.push(approval.id);
      if (current !== change.selling_price) {
        product.pending_price = change.selling_price;
        product.pending_branch = preview.branch;
      }
    }
    if (change.updates_regular_cost)
      product.last_cost_before_tax = change.unit_cost;
    product.price_provenance ??= {};
    product.price_provenance[preview.branch] = {
      ...(product.price_provenance[preview.branch] ?? {}),
      invoice_number: preview.before.supplier_invoice_number,
      invoice_date: preview.before.invoice_date,
      calculated_price: change.selling_price,
    };
  }
  for (const change of preview.date_changes) {
    const old = state.expiry.filter(
      (entry) =>
        entry.company_id === context.company_id &&
        entry.invoice_id === id &&
        entry.status === "active" &&
        (entry.invoice_line_index === change.line_index ||
          (entry.invoice_line_index === undefined &&
            entry.id.includes(`:date:${change.line_index}:`))),
    );
    for (const entry of old) {
      entry.status = "removed";
      entry.removed_reason = "entered_by_mistake";
      entry.removed_at = at;
      entry.removed_by = context.actor;
      entry.removal_action = "correction";
      entry.correction_id = correctionId;
      correction.removed_date_ids.push(entry.id);
    }
    if (change.after) {
      const line = preview.after.lines[change.line_index];
      const dateId = `${correctionId}:date:${change.line_index}`;
      state.expiry.push({
        id: dateId,
        company_id: context.company_id,
        branch: preview.branch,
        product_code: change.product_code,
        invoice_id: id,
        invoice_number: preview.before.supplier_invoice_number,
        invoice_line_index: change.line_index,
        source: "correction",
        status: "active",
        date: change.after,
        date_type: change.date_type ?? "expiry",
        quantity:
          line.sold_by === "weight"
            ? line.source_received_quantity
            : String(acceptedInvoiceUnits(line)),
        lot_number: line.lot_number,
        created_by: context.actor,
        created_at: at,
        correction_id: correctionId,
        previous_entry_id: old[0]?.id,
        expires_in_days: trackedDateDaysLeft(
          change.after,
          companyDate(state.config),
        ),
      });
      correction.date_ids.push(dateId);
    }
  }
  state.invoice_content_corrections ??= [];
  state.invoice_content_corrections.push(correction);
  state.activity.push({
    id: `${correctionId}:history`,
    company_id: context.company_id,
    branch: preview.branch,
    action: "Correct invoice",
    by: context.actor,
    at,
    device: "Prototype browser",
    reversible: false,
    entity_type: "invoice_content_correction",
    entity_id: id,
    before: {
      version_id: preview.previous_correction_id ?? "original",
      invoice: correction.before,
      payable: preview.payable_before,
    },
    after: {
      version_id: correctionId,
      invoice: correction.after,
      payable: preview.payable_after,
      reason: input.reason.trim(),
    },
  });
  return correction;
}

/** Attach evidence to a manual posted invoice without editing money or line facts. */
export function attachPostedInvoiceOriginal(
  state: DemoState,
  context: OperationsContext,
  id: string,
  file: Pick<DemoInvoice, "file_name" | "file_type" | "file_data">,
): void {
  const original = originalInvoice(state, context, id);
  if (
    original.file_data ||
    !file.file_data ||
    !file.file_name ||
    !file.file_type ||
    (!/^image\/(png|jpeg|webp|gif)$/.test(file.file_type) &&
      file.file_type !== "application/pdf")
  )
    throw new InvoiceCorrectionError(
      "scope",
      "Retain the existing original; attach a PDF or photo only when no original exists.",
    );
  for (const invoice of [...(state.invoices ?? []), state.invoice]) {
    if (invoice.company_id === context.company_id && invoice.id === id)
      Object.assign(invoice, file);
  }
  state.activity.push({
    id: createId("invoice-original"),
    company_id: context.company_id,
    branch: effectiveInvoiceLocation(state, original),
    action: "Attach original",
    by: context.actor,
    at: new Date().toISOString(),
    device: "Prototype browser",
    entity_type: "invoice",
    entity_id: id,
    reversible: false,
    before: { file_name: null },
    after: { file_name: file.file_name, file_type: file.file_type },
  });
}
