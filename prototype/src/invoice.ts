import type { InvoiceEditableLine } from "./invoice-edit-types";
import { invoiceView, type InvoiceLineView } from "./invoice-projections";
import Decimal from "decimal.js";
import {
  fillCalculatedInvoiceTotals,
  invoiceCheckCount,
} from "./invoice-checks";
import type { AuthenticatedActor } from "./authority-types";
import { cloneWithAuthority } from "./authority";
import { can, directoryRecipients, requireCapability } from "./permissions";
import {
  requireInvoiceAuthority,
  canInvoiceAuthority,
} from "./invoice-authority";
import { requirePurchase, purchaseLocationScope } from "./purchase-authority";
import {
  invoicePurchaseEvidence,
  invoicePriorRegularCost,
  closePurchaseEvidence,
  type InternalPurchaseEvidence,
} from "./purchase-evidence.internal";
import { configSeed, demoSeed as demo } from "./config";
import { regularPrice, conflictingBarcodeProduct } from "./catalog";
import { createId } from "./ids";
import { configuredBranches } from "./settings";
import {
  supplierRecords,
  supplierMatches,
  confirmSupplier,
} from "./supplier-editor";
import { companyCalendarDate } from "./company-time";
import {
  invoiceComputedTotal,
  paymentTermsDays,
  isMonthlyPaymentTerms,
} from "./invoice-entry";
import { recordInvoiceReceiptLots } from "./receipt-lots";
import { nextProductCode } from "./manual-product";
import { manualPrice } from "./manual-prices";
import { recordSaleReceiptCost, type SaleReceiptCostInput } from "./sales";
import { effectiveInvoiceLocation } from "./received";
import { effectiveInvoiceVersion } from "./invoice-version";
import { requireLiveManualInvoice } from "./invoice-live-reading-state";
import { trackingChoiceForProduct } from "./date-tracking";
import {
  initializeInvoiceWeight,
  invoiceLineCalculation,
  invoiceLineAmount,
  refreshInvoiceWeight,
  invoicePaperTotalMismatch,
  invoiceSourceWeightQuantity,
} from "./invoice-weight";
import {
  validateWeightQuantity,
  weightCostPerLb,
  weightQuantityPerLb,
} from "./weighed";
import {
  costPerCase,
  costPerUnit,
  packUnits,
  resolveSupplierItem,
  supplierItemFactsForInvoice,
} from "./supplier-items";
import {
  invoiceOrderIssues,
  prepareInvoiceOrder,
  applyPostedInvoiceOrder,
  invoiceOrderDifferences,
  shortOrderReceipt,
  validateShortOrderReceipt,
  applyShortOrderReceipt,
  reindexInvoiceOrderLines,
} from "./invoice-orders";
import type {
  Approval,
  Branch,
  CompanyConfig,
  DemoInvoice,
  DemoState,
  InvoiceLine,
} from "./types";

const cents = (value: Decimal.Value) =>
  new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
const key = (branch: Branch, code: string) => `${branch}:${code}`;

export interface InvoiceStockMovement {
  id: string;
  company_id: string;
  branch: Branch;
  product_code: string;
  qty: number;
  type: string;
  reference: string;
  by: string;
  at: string;
  invoice_id?: string;
  line_index?: number;
}

/** Physical receipts append history; retrying the same event never changes stock twice. */
function recordReceiptStock(
  state: DemoState,
  movement: InvoiceStockMovement,
): void {
  const physical = state as DemoState & {
    stock_movements?: InvoiceStockMovement[];
  };
  physical.stock_movements ??= [];
  if (
    movement.qty === 0 ||
    physical.stock_movements.some((entry) => entry.id === movement.id)
  )
    return;
  physical.stock_movements.push(movement);
  const stockKey = key(movement.branch, movement.product_code);
  state.stock[stockKey] = new Decimal(state.stock[stockKey] ?? 0)
    .plus(movement.qty)
    .toNumber();
}

/** A local business date follows the company setting, including Toronto daylight saving. */
export function companyDate(
  config: { company: Pick<CompanyConfig["company"], "timezone"> },
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (name: string) =>
    parts.find((part) => part.type === name)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Supplier profiles are optional receiving follow-up; they never require approval. */
export function markInvoiceSupplierReview(
  invoice: DemoInvoice,
  supplier: ReturnType<typeof supplierRecords>[number],
  _previousSupplier = invoice.supplier,
): void {
  void _previousSupplier; // Legacy callers can still pass their previous selection.
  invoice.supplier_confirmed = supplier.active;
  invoice.supplier_review_required = false;
  invoice.supplier_review_confirmed = true;
}

export function confirmInvoiceSupplierReview(
  state: DemoState,
  context: AuthenticatedActor,
  now = new Date(),
): void {
  const invoice = state.invoice;
  context = requireInvoiceAuthority(state, context, "invoices.read");
  requireCapability(state, context, "suppliers.confirm", {
    company_id: invoice.company_id,
    kind: "company_shared",
  });
  if (invoice.status === "posted")
    throw new Error(
      "Only an Owner or Manager can confirm this supplier review.",
    );
  const supplier = supplierRecords(state).find(
    (item) =>
      item.company_id === invoice.company_id &&
      supplierMatches(item, invoice.supplier),
  );
  if (!supplier || !supplier.active)
    throw new Error("Choose an active supplier.");
  if (supplier.status !== "confirmed")
    confirmSupplier(state, context, supplier.id, now);
  if (invoice.supplier_review_confirmed) return;
  const before = structuredClone(invoice);
  invoice.supplier_confirmed = true;
  invoice.supplier_review_confirmed = true;
  state.activity.push({
    id: createId("supplier-review"),
    company_id: invoice.company_id,
    branch: invoice.branch,
    action: "Confirm supplier",
    by: context.actor,
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role_snapshot: context.role,
    at: now.toISOString(),
    reversible: false,
    entity_type: "invoice",
    entity_id: invoice.id,
    before,
    after: structuredClone(invoice),
  });
}

export function removeInvoiceLine(
  state: DemoState,
  context: AuthenticatedActor,
  index: number,
  now = new Date(),
): void {
  context = requireInvoiceAuthority(
    state,
    context,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  const invoice = state.invoice;
  if (
    !["draft", "review"].includes(invoice.status) ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= invoice.lines.length
  )
    throw new Error("Choose a draft invoice line in your allowed location.");
  const before = structuredClone(invoice);
  invoice.lines.splice(index, 1);
  invoice.order_comparison = undefined;
  invoice.order_missing_decisions = undefined;
  invoice.lower_price_answers = undefined;
  reindexInvoiceOrderLines(invoice);
  recalculateInvoice(invoice, state.config);
  state.activity.push({
    id: createId("invoice-line-remove"),
    company_id: invoice.company_id,
    branch: invoice.branch,
    action: "Remove line",
    by: context.actor,
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role_snapshot: context.role,
    at: now.toISOString(),
    reversible: true,
    entity_type: "invoice",
    entity_id: invoice.id,
    before,
    after: structuredClone(invoice),
  });
}

/** Remember entry metadata without replacing facts read from the original invoice. */
export function rememberInvoiceSupplierItem(
  state: DemoState,
  actor: AuthenticatedActor,
  invoice: Pick<DemoInvoice, "company_id" | "supplier" | "branch">,
  line: InvoiceLine,
): InvoiceLine {
  if (
    invoice.company_id !== state.config.company.seed_key ||
    line.company_id !== invoice.company_id
  )
    return line;
  const supplier = supplierRecords(state).find(
    (record) =>
      record.company_id === invoice.company_id &&
      supplierMatches(record, invoice.supplier),
  );
  const candidates =
    state.supplier_items
      ?.filter(
        (record) =>
          record.company_id === invoice.company_id &&
          record.supplier_id === supplier?.id &&
          !record.archived,
      )
      .filter((record) =>
        line.supplier_item_id
          ? record.id === line.supplier_item_id
          : record.product_code === line.product_code &&
            (!line.supplier_item_code?.trim() ||
              record.supplier_item_code === line.supplier_item_code),
      ) ?? [];
  const item = candidates.length === 1 ? candidates[0] : undefined;
  requirePurchase(
    state,
    actor,
    "invoices.enter",
    purchaseLocationScope(invoice.company_id, invoice.branch, true),
  );
  if (
    !item ||
    item.product_code !== line.product_code ||
    !Number.isSafeInteger(item.units_per_case) ||
    item.units_per_case <= 0
  )
    return line;
  return {
    ...line,
    supplier_item_id: line.supplier_item_id ?? item.id,
    supplier_item_code: line.supplier_item_code ?? item.supplier_item_code,
    ...(!line.supplier_item_code && item.supplier_item_code_inferred
      ? { supplier_item_code_inferred: true }
      : {}),
    units_per_case: line.units_per_case ?? item.units_per_case,
  };
}

export function createInvoice(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: Branch,
  manual = false,
  options?: { empty?: boolean },
): DemoInvoice {
  const company = state.config.company.seed_key;
  actor = requirePurchase(
    state,
    actor,
    manual ? "invoices.enter_manual" : "invoices.enter",
    purchaseLocationScope(company, branch, true),
  );
  const today = companyDate(state.config);
  const seed = structuredClone(demo.demo_invoice);
  return {
    ...seed,
    id: createId("invoice"),
    company_id: company,
    branch,
    handling_branch: branch,
    reviewer_origin_location_id: branch,
    created_by_user_id: actor.user_id,
    handler_user_ids: [actor.user_id],
    reviewer_user_ids: [actor.user_id],
    version: 1,
    status: "draft",
    entry_mode: manual ? "manual" : "upload",
    supplier_confirmed: true,
    invoice_date: today,
    received_at: new Date().toISOString(),
    receiving_employee: actor.actor,
    due_date: dateAfter(today, 14),
    short_receipt_keys: [],
    ...(options?.empty ? { short_lines: [] } : {}),
    lines:
      manual || options?.empty
        ? []
        : seed.lines.map((line) =>
            initializeInvoiceWeight(
              rememberInvoiceSupplierItem(
                state,
                actor,
                {
                  company_id: company,
                  supplier: seed.supplier,
                  branch,
                },
                {
                  ...line,
                  id: createId("invoice-line"),
                  company_id: company,
                  // Let the receiver explicitly mark the four chips missing, rather than inventing a shortage.
                  qty_received_at_posting: line.qty_invoiced,
                  qty_later_received: 0,
                  pricing_category:
                    state.products.find(
                      (product) => product.code === line.product_code,
                    )?.pricing_category ?? "grocery",
                  review_confirmed: false,
                  sold_by:
                    line.sold_by === "weight"
                      ? "weight"
                      : (state.products.find(
                          (product) => product.code === line.product_code,
                        )?.sold_by ?? "each"),
                  quantity_unit:
                    line.quantity_unit === "cases" ? "cases" : "units",
                  date_tracking:
                    trackingChoiceForProduct(
                      state.products.find(
                        (product) => product.code === line.product_code,
                      ),
                    ) === "yes",
                  date_confirmed: true,
                  new_name_en:
                    line.product_code === "NEW" ? line.description : undefined,
                  new_name_fa:
                    line.product_code === "NEW"
                      ? "زرشک خشک ۱۰۰ گرمی"
                      : undefined,
                  line_tax: line.taxable
                    ? cents(
                        new Decimal(line.line_total).times(
                          state.config.tax.rate,
                        ),
                      )
                    : "0.00",
                },
              ),
              state.config,
            ),
          ),
    ...(manual || options?.empty
      ? {
          supplier: "",
          supplier_confirmed: false,
          supplier_invoice_number: "",
          payment_terms: "",
          subtotal: "0.00",
          tax: "0.00",
          final_total: "0.00",
          payable_after_open_shorts: "0.00",
        }
      : {}),
  };
}

export function dateAfter(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function addManualLine(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  supplierItemId?: string,
): void {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  if (
    !canInvoiceAuthority(
      state,
      actor,
      "invoices.enter_manual",
      state.invoice.id,
      true,
    ) &&
    state.invoice.live_reading?.phase === "manual"
  )
    actor = requireLiveManualInvoice(state, actor, state.invoice.id);
  else
    requireInvoiceAuthority(
      state,
      actor,
      "invoices.enter_manual",
      state.invoice.id,
      true,
    );
  const product = state.products.find(
    (item) =>
      item.code === code && item.company_id === state.invoice.company_id,
  );
  if (!product || state.invoice.status === "posted") return;
  const item = resolveSupplierItem(
    state,
    actor,
    state.invoice.supplier,
    state.invoice.branch,
    supplierItemId ? { id: supplierItemId } : { product_code: code },
  );
  const cost =
    item?.last_bought_unit_cost ??
    item?.quoted_unit_cost_before_tax ??
    (can(state, actor, "catalog.cost_read", {
      company_id: product.company_id,
      kind: "company_shared",
    }).allowed
      ? product.last_cost_before_tax
      : "");
  state.invoice.lines.push({
    id: createId("invoice-line"),
    company_id: state.invoice.company_id,
    product_code: code,
    description: product.name_en,
    qty_invoiced: 1,
    qty_received_at_posting: 1,
    qty_later_received: 0,
    unit_cost_before_tax: cost,
    line_total: cost,
    taxable: product.taxable,
    tax_profile: product.tax_profile,
    calculated_selling_price: product.selling_price,
    current_selling_price: product.selling_price,
    pricing_category: product.pricing_category,
    demo_note: "",
    low_confidence_fields: [],
    review_confirmed: false,
    sold_by: product.sold_by ?? "each",
    date_tracking: trackingChoiceForProduct(product) === "yes",
    date_confirmed: true,
    supplier_item_id: item?.id,
    supplier_item_code: item?.supplier_item_code,
    ...(item?.supplier_item_code_inferred
      ? { supplier_item_code_inferred: true }
      : {}),
    units_per_case: item?.units_per_case ?? 1,
    quantity_unit: "units",
    quantity_entered: "1",
  });
  initializeInvoiceWeight(state.invoice.lines.at(-1)!, state.config);
  recalculateInvoice(state.invoice, state.config);
}

/** Retain entry facts while the engine and receipts use individual units. */
export function setInvoiceLineQuantity(
  line: InvoiceEditableLine,
  quantity: string | number,
  unit: "cases" | "units",
  pack = line.units_per_case ?? 1,
): void {
  const wasFullyDelivered = line.qty_received_at_posting === line.qty_invoiced;
  line.quantity_unit = unit;
  line.quantity_entered = quantity;
  line.units_per_case = pack;
  try {
    line.qty_invoiced = packUnits(quantity, unit, unit === "units" ? 1 : pack);
  } catch {
    line.qty_invoiced = 0;
  }
  line.qty_received_at_posting = wasFullyDelivered
    ? line.qty_invoiced
    : Math.min(line.qty_received_at_posting, line.qty_invoiced);
  if (
    unit === "cases" &&
    line.case_cost_before_tax === undefined &&
    validCost(line.unit_cost_before_tax)
  )
    line.case_cost_before_tax = costPerCase(line.unit_cost_before_tax, pack);
  if (
    unit === "cases" &&
    line.case_cost_before_tax !== undefined &&
    validCost(line.case_cost_before_tax) &&
    Number.isSafeInteger(pack) &&
    pack > 0
  )
    line.unit_cost_before_tax = costPerUnit(line.case_cost_before_tax, pack);
  if (unit === "units") line.case_cost_before_tax = undefined;
  line.refused_units = 0;
  line.extra_delivery_decision = undefined;
  line.order_price_decision = undefined;
  line.review_changed_after_confirmation ||= Boolean(line.review_confirmed);
  line.review_confirmed = false;
  delete line.known_delivery;
}

export type InvoiceCalculationInput = Pick<
  DemoInvoice,
  | "reading_record"
  | "other_charges"
  | "subtotal"
  | "tax"
  | "final_total"
  | "final_total_manual"
  | "low_confidence_fields"
  | "payable_after_open_shorts"
> & { lines: InvoiceEditableLine[] };

export function recalculateInvoice(
  invoice: InvoiceCalculationInput,
  config: Pick<CompanyConfig, "tax" | "weighed_items">,
): void {
  let subtotal = new Decimal(0);
  let tax = new Decimal(0);
  for (const line of invoice.lines) {
    if (line.sold_by === "weight") {
      try {
        refreshInvoiceWeight(line, config);
      } catch {
        continue;
      }
    }
    // An unread imported quantity is an empty review field, not a printed zero.
    // Unrelated edits must not replace that missing source value with the
    // canonical zero used internally until someone enters a real quantity.
    if (
      line.quantity_unit === "units" &&
      (!invoice.reading_record ||
        String(line.quantity_entered ?? "").trim() !== "")
    )
      line.quantity_entered = String(line.qty_invoiced);
    if (
      !validCost(line.unit_cost_before_tax) ||
      !validInvoiceLineQuantity(line)
    )
      continue;
    if (line.sold_by !== "weight") line.line_total = invoiceLineAmount(line);
    const profile = config.tax.profiles.find(
      (item) => item.key === line.tax_profile,
    );
    line.line_tax = cents(
      new Decimal(line.line_total).times(profile?.rate ?? "0"),
    );
    subtotal = subtotal.plus(line.line_total);
    tax = tax.plus(line.line_tax);
  }
  for (const charge of invoice.other_charges ?? []) {
    try {
      const amount = new Decimal(charge.amount);
      if (!amount.isFinite()) continue;
      subtotal = subtotal.plus(amount);
      if (charge.taxable) tax = tax.plus(amount.times(config.tax.rate));
    } catch {
      /* Invalid imported amounts stay visible for review. */
    }
  }
  // Imported headers retain the supplier's printed amounts for reconciliation.
  if (!invoice.reading_record) {
    invoice.subtotal = cents(subtotal);
    invoice.tax = cents(tax);
    if (!invoice.final_total_manual)
      invoice.final_total = invoiceComputedTotal(invoice)!;
  }
  fillCalculatedInvoiceTotals(invoice);
  invoice.payable_after_open_shorts = cents(
    new Decimal(validMoney(invoice.final_total) ? invoice.final_total : "0")
      .minus(shortTotals(invoice).total)
      .minus(refusedTotals(invoice).total),
  );
}

/** An arrived extra that went back with the driver is not an accepted receipt. */
export function acceptedInvoiceUnits(line: InvoiceEditableLine): number {
  return new Decimal(line.qty_received_at_posting)
    .minus(line.refused_units ?? 0)
    .toNumber();
}

/** Allocate the original tax once across Shorts and refused extras together. */
export function lineRefused(line: InvoiceEditableLine): {
  quantity: number;
  beforeTax: string;
  tax: string;
  total: string;
} {
  const quantity = line.refused_units ?? 0;
  if (
    !quantity ||
    !validInvoiceLineQuantity(line) ||
    !validMoney(line.line_total) ||
    !validMoney(line.line_tax || "0.00")
  )
    return { quantity, beforeTax: "0.00", tax: "0.00", total: "0.00" };
  const short = lineShort(line);
  const excluded = new Decimal(short.quantity).plus(quantity);
  const beforeTax = cents(
    new Decimal(line.line_total)
      .times(excluded)
      .div(line.qty_invoiced)
      .minus(short.beforeTax),
  );
  const tax = cents(
    new Decimal(line.line_tax ?? "0.00")
      .times(excluded)
      .div(line.qty_invoiced)
      .minus(short.tax),
  );
  return {
    quantity,
    beforeTax,
    tax,
    total: cents(new Decimal(beforeTax).plus(tax)),
  };
}

export function refusedTotals(invoice: {
  lines: readonly InvoiceEditableLine[];
}): {
  beforeTax: string;
  tax: string;
  total: string;
} {
  const amounts = invoice.lines.map(lineRefused);
  const beforeTax = Decimal.sum(0, ...amounts.map((line) => line.beforeTax));
  const tax = Decimal.sum(0, ...amounts.map((line) => line.tax));
  return {
    beforeTax: cents(beforeTax),
    tax: cents(tax),
    total: cents(beforeTax.plus(tax)),
  };
}

function validQuantity(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function validInvoiceLineQuantity(line: InvoiceEditableLine): boolean {
  if (line.sold_by !== "weight") return validQuantity(line.qty_invoiced);
  try {
    const source =
      line.quantity_unit === "cases"
        ? new Decimal(validateWeightQuantity(line.quantity_entered ?? ""))
            .times(validateWeightQuantity(line.case_weight ?? ""))
            .toString()
        : invoiceSourceWeightQuantity(line);
    if (!new Decimal(source).eq(line.source_quantity ?? "0")) return false;
    const canonical = weightQuantityPerLb(
      source,
      line.source_quantity_unit ?? "lb",
      line.weight_conversion_factor ?? "2.20462",
    );
    if (!new Decimal(canonical).eq(line.qty_invoiced)) return false;
    if (line.quantity_unit === "cases") {
      const cases = validateWeightQuantity(line.quantity_entered ?? "");
      const caseWeight = validateWeightQuantity(line.case_weight ?? "");
      if (
        !new Decimal(cases).times(caseWeight).eq(source) ||
        line.case_weight_unit !== line.source_quantity_unit
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validInvoiceLineReceived(line: InvoiceEditableLine): boolean {
  if (line.sold_by !== "weight")
    return (
      Number.isSafeInteger(line.qty_received_at_posting) &&
      line.qty_received_at_posting >= 0 &&
      line.qty_received_at_posting <= line.qty_invoiced
    );
  try {
    const source =
      line.quantity_unit === "cases" &&
      new Decimal(line.source_received_quantity ?? "0").eq(
        line.source_quantity ?? "0",
      )
        ? line.source_received_quantity!
        : invoiceSourceWeightQuantity(line, true);
    return (
      new Decimal(
        weightQuantityPerLb(
          source,
          line.source_quantity_unit ?? "lb",
          line.weight_conversion_factor ?? "2.20462",
        ),
      ).eq(line.qty_received_at_posting) &&
      new Decimal(line.qty_received_at_posting).lte(line.qty_invoiced)
    );
  } catch {
    return false;
  }
}

export function validCost(value: string): boolean {
  return /^\d+(?:\.\d{1,4})?$/.test(value);
}

export function validMoney(value: string): boolean {
  return /^\d+(?:\.\d{1,2})?$/.test(value);
}

export function actualDate(value: string | undefined): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function lineShort(line: InvoiceEditableLine): {
  quantity: number;
  beforeTax: string;
  tax: string;
  total: string;
} {
  const quantity = Decimal.max(
    0,
    new Decimal(line.qty_invoiced).minus(line.qty_received_at_posting),
  ).toNumber();
  if (
    !quantity ||
    !validInvoiceLineQuantity(line) ||
    !validCost(line.unit_cost_before_tax) ||
    !validMoney(line.line_total) ||
    !validMoney(line.line_tax || "0.00")
  ) {
    return { quantity, beforeTax: "0.00", tax: "0.00", total: "0.00" };
  }
  const beforeTax =
    line.short_before_tax ??
    cents(new Decimal(line.line_total).times(quantity).div(line.qty_invoiced));
  const tax =
    line.short_tax ??
    cents(
      new Decimal(line.line_tax ?? "0.00")
        .times(quantity)
        .div(line.qty_invoiced),
    );
  return {
    quantity,
    beforeTax,
    tax,
    total: cents(new Decimal(beforeTax).plus(tax)),
  };
}

export function shortTotals(invoice: {
  lines: readonly InvoiceEditableLine[];
}): {
  beforeTax: string;
  tax: string;
  total: string;
} {
  let beforeTax = new Decimal(0);
  let tax = new Decimal(0);
  for (const line of invoice.lines) {
    const short = lineShort(line);
    const restored = line.qty_later_received ?? 0;
    beforeTax = beforeTax
      .plus(short.beforeTax)
      .minus(
        cumulativeAllocation(
          short.beforeTax,
          restored,
          short.quantity,
          line.sold_by === "weight",
        ),
      );
    tax = tax
      .plus(short.tax)
      .minus(
        cumulativeAllocation(
          short.tax,
          restored,
          short.quantity,
          line.sold_by === "weight",
        ),
      );
  }
  return {
    beforeTax: cents(beforeTax),
    tax: cents(tax),
    total: cents(beforeTax.plus(tax)),
  };
}

export function cumulativeAllocation(
  amount: string,
  delivered: number,
  originallyMissing: number,
  allowFractional = false,
): string {
  if (delivered === 0 || originallyMissing === 0) return "0.00";
  if (
    !(allowFractional
      ? Number.isFinite(delivered)
      : Number.isSafeInteger(delivered)) ||
    delivered < 0 ||
    delivered > originallyMissing
  ) {
    throw new Error("Receive no more than the remaining missing quantity.");
  }
  return cents(new Decimal(amount).times(delivered).div(originallyMissing));
}

function calculationPreviousReceiptCost(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  currentLine?: InvoiceLine,
  includeRetainedCalculationBasis = true,
): { cost: string; reference: string } | null {
  actor = requireInvoiceAuthority(state, actor, "invoices.cost_read");
  const invoice = state.invoice;
  if (
    invoice.company_id !== state.config.company.seed_key ||
    !configuredBranches(state.config, true).includes(invoice.branch)
  )
    return null;
  const current =
    currentLine ??
    (() => {
      const candidates = invoice.lines.filter(
        (line) =>
          line.company_id === invoice.company_id && line.product_code === code,
      );
      return candidates.length === 1 ? candidates[0] : undefined;
    })();
  if (
    !current ||
    !invoice.lines.includes(current) ||
    current.company_id !== invoice.company_id ||
    current.product_code !== code
  )
    return null;
  const facts = supplierItemFactsForInvoice(
    state,
    actor,
    invoice.supplier,
    invoice.id,
  );
  const matches = current.supplier_item_id
    ? facts.filter((item) => item.id === current.supplier_item_id)
    : facts.filter(
        (item) =>
          item.product_code === code &&
          item.supplier_item_code ===
            (current.supplier_item_code?.trim() ?? ""),
      );
  const previous =
    matches.length === 1
      ? matches[0].history.find(
          (purchase) =>
            purchase.invoice_id !== invoice.id &&
            purchase.product_code === code &&
            purchase.received_units > 0,
        )
      : undefined;
  if (previous)
    return {
      cost: previous.unit_cost_before_tax,
      reference: previous.invoice_number,
    };
  // Public evidence must identify a real scoped posted receipt. The retained
  // demo calculation basis remains private to unchanged lower-price decisions.
  if (!includeRetainedCalculationBasis) return null;
  // The original no-SKU demo catalog supplies historical Branch 1 receipts only.
  // A newly introduced SKU or ambiguous prior purchase never borrows this basis.
  if (
    current.supplier_item_code?.trim() ||
    facts.some(
      (item) =>
        item.product_code === code &&
        item.history.some((purchase) => purchase.invoice_id !== invoice.id),
    )
  )
    return null;
  const supplier = supplierRecords(state).find(
    (item) =>
      item.company_id === invoice.company_id &&
      supplierMatches(item, invoice.supplier),
  );
  const product = demo.products.find(
    (item) =>
      item.code === code &&
      (supplier
        ? supplierMatches(supplier, item.main_supplier)
        : item.main_supplier === invoice.supplier),
  );
  return invoice.company_id === configSeed.company.seed_key &&
    invoice.branch === demo.same_supplier_lower_price_alert.branch &&
    product
    ? {
        cost: product.last_cost_before_tax,
        reference: "Fictional prior receipt",
      }
    : null;
}

/** Public invoice hint: never substitutes company Catalog cost for receipt evidence. */
export function previousReceiptCost(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  currentLine?: InvoiceLine,
): { cost: string; reference: string } | null {
  return calculationPreviousReceiptCost(state, actor, code, currentLine, false);
}

function canonicalLowerPriceLines(
  state: DemoState,
  actor: AuthenticatedActor,
  includeShortDated = false,
): InvoiceLine[] {
  requireInvoiceAuthority(state, actor, "invoices.cost_read");
  return state.invoice.lines.filter((line) => {
    const previous = calculationPreviousReceiptCost(
      state,
      actor,
      line.product_code,
      line,
    );
    return (
      (includeShortDated || !line.short_dated) &&
      acceptedInvoiceUnits(line) > 0 &&
      previous &&
      validCost(line.unit_cost_before_tax) &&
      new Decimal(line.unit_cost_before_tax).lessThan(previous.cost)
    );
  });
}

/** Narrow comparison hint; retained calculation values never enter the result. */
export function lowerPriceLineIndexes(
  state: DemoState,
  actor: AuthenticatedActor,
  includeShortDated = false,
): number[] {
  requireInvoiceAuthority(state, actor, "invoices.cost_read");
  return canonicalLowerPriceLines(state, actor, includeShortDated).map((line) =>
    state.invoice.lines.indexOf(line),
  );
}

/** Receiver-facing flags retain the calculation, without private notes or unknown fields. */
export function lowerPriceLines(
  state: DemoState,
  actor: AuthenticatedActor,
): InvoiceLineView[] {
  const indices = new Set(lowerPriceLineIndexes(state, actor));
  return invoiceView(state, actor, state.invoice.id).lines.filter((_, index) =>
    indices.has(index),
  );
}

export type InvoiceBlocker =
  | "permission"
  | "branch"
  | "company"
  | "supplier"
  | "supplier_pending"
  | "supplier_details"
  | "supplier_review"
  | "payment_terms"
  | "header"
  | "money"
  | "file"
  | "lines"
  | "matching"
  | "quantity"
  | "cost"
  | "review"
  | "date"
  | "lower_price"
  | "manual_price"
  | "order"
  | "order_decisions"
  | "checks"
  | "barcode";

export function invoiceBlockers(
  state: DemoState,
  actor: AuthenticatedActor,
  lineIndexes?: Partial<Record<InvoiceBlocker, number[]>>,
): InvoiceBlocker[] {
  const invoice = state.invoice;
  const blockers: InvoiceBlocker[] = [];
  if (!canInvoiceAuthority(state, actor, "invoices.post", invoice.id, true))
    return ["permission"];
  actor = requireInvoiceAuthority(state, actor, "invoices.read");
  if (!configuredBranches(state.config).includes(invoice.branch))
    blockers.push("branch");
  if (invoice.company_id !== state.config.company.seed_key)
    blockers.push("company");
  if (
    !invoice.supplier.trim() ||
    !supplierRecords(state).some(
      (record) =>
        record.company_id === invoice.company_id &&
        record.active &&
        supplierMatches(record, invoice.supplier),
    )
  )
    blockers.push("supplier");
  if (
    invoice.payment_terms &&
    ((/^net/i.test(invoice.payment_terms) &&
      paymentTermsDays(invoice.payment_terms) === undefined) ||
      (!invoice.due_date_manual &&
        (paymentTermsDays(invoice.payment_terms) !== undefined ||
          isMonthlyPaymentTerms(invoice.payment_terms)) &&
        !actualDate(invoice.due_date)))
  )
    blockers.push("payment_terms");
  if (
    !invoice.supplier_invoice_number.trim() ||
    !actualDate(invoice.invoice_date) ||
    !invoice.received_at ||
    Number.isNaN(Date.parse(invoice.received_at)) ||
    !invoice.receiving_employee?.trim()
  )
    blockers.push("header");
  if (![invoice.subtotal, invoice.tax, invoice.final_total].every(validMoney))
    blockers.push("money");
  if (!invoice.file_name || !invoice.file_data) blockers.push("file");
  if (!invoice.lines.length) blockers.push("lines");
  if (invoiceCheckCount(invoice)) blockers.push("checks");
  if (
    (invoice.other_charges ?? []).some((charge) => {
      try {
        return !new Decimal(charge.amount).isFinite();
      } catch {
        return true;
      }
    })
  )
    blockers.push("money");
  for (const [lineIndex, line] of invoice.lines.entries()) {
    const firstLineBlocker = blockers.length;
    const product = state.products.find(
      (item) =>
        item.code === line.product_code &&
        item.company_id === invoice.company_id,
    );
    if (line.company_id !== invoice.company_id) blockers.push("company");
    if (product?.sold_by === "weight" && line.sold_by !== "weight")
      blockers.push("quantity");
    if (
      line.product_code === "NEW" &&
      line.barcode &&
      conflictingBarcodeProduct(
        state.products,
        invoice.company_id,
        line.barcode,
      )
    )
      blockers.push("barcode");
    if (
      !product &&
      !(line.refused_units && acceptedInvoiceUnits(line) === 0) &&
      !(line.product_code === "NEW" && line.new_name_en?.trim())
    )
      blockers.push("matching");
    if (!validInvoiceLineQuantity(line) || !validInvoiceLineReceived(line))
      blockers.push("quantity");
    if (
      !(line.sold_by === "weight"
        ? Number.isFinite(line.refused_units ?? 0)
        : Number.isSafeInteger(line.refused_units ?? 0)) ||
      (line.refused_units ?? 0) < 0 ||
      (line.refused_units ?? 0) > line.qty_received_at_posting
    )
      blockers.push("quantity");
    if (line.sold_by !== "weight" && line.quantity_unit !== undefined) {
      try {
        if (
          packUnits(
            line.quantity_entered ?? line.qty_invoiced,
            line.quantity_unit as "cases" | "units",
            line.units_per_case ?? 1,
          ) !== line.qty_invoiced
        )
          blockers.push("quantity");
        if (
          line.quantity_unit === "cases" &&
          (!validCost(line.case_cost_before_tax ?? "") ||
            costPerUnit(
              line.case_cost_before_tax!,
              line.units_per_case ?? 1,
            ) !== new Decimal(line.unit_cost_before_tax).toFixed(4))
        )
          blockers.push("cost");
      } catch {
        blockers.push("quantity");
      }
    }
    if (!validCost(line.unit_cost_before_tax)) blockers.push("cost");
    if (line.sold_by === "weight") {
      try {
        if (
          weightCostPerLb(
            line.source_cost_before_tax ?? "",
            line.source_cost_unit ?? "lb",
            line.weight_conversion_factor ?? state.config,
          ) !== line.unit_cost_before_tax
        )
          blockers.push("cost");
      } catch {
        blockers.push("cost");
      }
    }
    if (invoicePaperTotalMismatch(line)) blockers.push("cost");
    if (!line.review_confirmed) blockers.push("review");
    const category = state.config.pricing_categories.find(
      (item) =>
        item.key === (line.pricing_category ?? product?.pricing_category),
    );
    try {
      invoiceLineCalculation(line, category?.key ?? "", state.config);
    } catch {
      blockers.push("cost");
    }
    if (line.date_tracking && (!line.date_confirmed || !line.date_value))
      blockers.push("date");
    if (
      line.short_dated &&
      (!product ||
        !previousReceiptCost(state, actor, line.product_code, line) ||
        !new Decimal(line.unit_cost_before_tax).lt(
          previousReceiptCost(state, actor, line.product_code, line)!.cost,
        ) ||
        !line.date_tracking ||
        !line.date_confirmed ||
        (line.date_type !== undefined && line.date_type !== "expiry") ||
        !actualDate(line.date_value))
    )
      blockers.push("date");
    if (
      product &&
      acceptedInvoiceUnits(line) > 0 &&
      !line.short_dated &&
      manualDecisionForLine(state, actor, line, invoice.branch) &&
      !line.manual_price_decision
    )
      blockers.push("manual_price");
    if (lineIndexes)
      for (const blocker of new Set(blockers.slice(firstLineBlocker)))
        (lineIndexes[blocker] ??= []).push(lineIndex);
  }
  if (canonicalLowerPriceLines(state, actor).length) {
    const answer = invoice.lower_price_answers;
    const valid =
      answer &&
      ((answer.same_expiry === "yes" &&
        Number.isSafeInteger(answer.units_left) &&
        (answer.units_left ?? -1) >= 0) ||
        (answer.same_expiry === "no" &&
          answer.old_expiry &&
          answer.new_expiry) ||
        answer.same_expiry === "no_previous_stock" ||
        answer.same_expiry === "dates_not_tracked" ||
        (answer.same_expiry === "unknown" && answer.note?.trim()));
    if (!valid) blockers.push("lower_price");
  }
  blockers.push(...invoiceOrderIssues(state, actor));
  return [...new Set(blockers)];
}

/** Mutates the store draft once; the browser is the only persistence layer in this demo. */
export function postInvoice(
  state: DemoState,
  actor: AuthenticatedActor,
): boolean {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.post",
    state.invoice.id,
    true,
  );
  const invoice = state.invoice;
  if (invoice.status === "posted") return false;
  const blockers = invoiceBlockers(state, actor);
  if (blockers.length) throw new Error(blockers.join(", "));
  if (state.ledger.some((entry) => entry.id === `${invoice.id}:posted`))
    return false;
  const orderComparison = prepareInvoiceOrder(state, actor);
  const evidence = invoicePurchaseEvidence(
    state,
    actor,
    invoice.id,
    "invoice_post",
  );
  try {
    if (orderComparison)
      for (const row of orderComparison.lines)
        invoice.lines[row.invoice_line_index].order_item_id = row.order_line_id;
    const now = new Date().toISOString();
    const saleCostInputs = new Map<string, SaleReceiptCostInput>();
    const priorCosts = new Map(
      state.products
        .filter((product) => product.company_id === invoice.company_id)
        .map((product) => [
          product.code,
          invoicePriorRegularCost(state, evidence, product.code) ??
            product.last_cost_before_tax,
        ]),
    );
    for (const [lineIndex, line] of invoice.lines.entries()) {
      if (line.refused_units && acceptedInvoiceUnits(line) === 0) {
        const short = lineShort(line);
        line.short_before_tax = short.beforeTax;
        line.short_tax = short.tax;
        continue;
      }
      let product = state.products.find(
        (item) =>
          item.company_id === invoice.company_id &&
          item.code === line.product_code,
      );
      if (line.product_code === "NEW") {
        product = state.products.find(
          (item) =>
            item.company_id === invoice.company_id &&
            item.name_en === line.new_name_en,
        );
        if (product) line.product_code = product.code;
      }
      if (line.product_code === "NEW") {
        line.product_code = nextProductCode(state);
        state.product_code_high_water = Number(line.product_code);
        product = {
          company_id: invoice.company_id,
          code: line.product_code,
          name_en: line.new_name_en!,
          name_fa: line.new_name_fa?.trim() ?? "",
          first_added_branch: invoice.branch,
          pricing_category: line.pricing_category ?? "grocery",
          unit_size:
            line.sold_by === "weight"
              ? ""
              : (line.pack_size ?? (invoice.reading_record ? "" : "100 g")),
          sold_by: line.sold_by ?? "each",
          last_cost_before_tax: line.unit_cost_before_tax,
          selling_price: "",
          offer: null,
          taxable: line.taxable,
          date_tracking: line.date_tracking ?? true,
          main_supplier: invoice.supplier,
          ai_category: invoice.reading_record ? "" : "Dried fruits & spices",
          barcode: line.barcode ?? "",
          status: "pending_approval",
          tax_profile: line.tax_profile,
        };
        state.products.push(product);
      }
      if (!product) throw new Error("Resolve every product before posting.");
      const calculation = invoiceLineCalculation(
        line,
        line.pricing_category ?? product.pricing_category,
        state.config,
      );
      const rulePrice = calculation.selling_price;
      const prior = regularPrice(state, product, invoice.branch);
      const manual = manualPrice(state, product, invoice.branch);
      const costChanged = !new Decimal(
        priorCosts.get(product.code) ?? product.last_cost_before_tax,
      ).eq(line.unit_cost_before_tax);
      const manualReview = !!manual && costChanged;
      const keepsManual = !!manual && !costChanged;
      const usesRule = manualReview;
      // The receiver's choice is a retained recommendation; only the Owner or Manager decides.
      const price = manualReview ? rulePrice : keepsManual ? prior! : rulePrice;
      const manualPriceReview: Approval["manual_price_review"] = manualReview
        ? {
            kept_price: prior!,
            calculated_price: rulePrice,
            prior_cost: new Decimal(priorCosts.get(product.code)!).toFixed(4),
            received_cost: new Decimal(line.unit_cost_before_tax).toFixed(4),
            receiver_recommendation: line.manual_price_decision ?? "rule",
          }
        : undefined;
      const category = state.config.pricing_categories.find(
        (item) =>
          item.key === (line.pricing_category ?? product.pricing_category),
      )!;
      const actualMargin =
        keepsManual && new Decimal(price).gt(0)
          ? new Decimal(price)
              .minus(line.unit_cost_before_tax)
              .div(price)
              .toFixed(8)
          : calculation.margin;
      const margin = {
        margin: actualMargin,
        below_minimum: keepsManual
          ? category.minimum_margin !== null &&
            category.minimum_margin !== "" &&
            actualMargin !== null &&
            new Decimal(actualMargin).lt(category.minimum_margin)
          : calculation.below_minimum_margin,
      };
      line.calculated_selling_price = rulePrice;
      line.current_selling_price = prior;
      if (
        !product.package_of_product_id &&
        !line.short_dated &&
        acceptedInvoiceUnits(line) > 0
      ) {
        product.price_provenance ??= {};
        const previousProvenance = product.price_provenance[invoice.branch];
        product.price_provenance[invoice.branch] = {
          ...(previousProvenance ?? {}),
          invoice_number: invoice.supplier_invoice_number,
          calculated_price: rulePrice,
          invoice_date: invoice.invoice_date ?? companyDate(state.config),
        };
      }
      if (
        !product.package_of_product_id &&
        !line.short_dated &&
        acceptedInvoiceUnits(line) > 0 &&
        (!manual || costChanged) &&
        (manualReview || usesRule || prior !== price || margin.below_minimum)
      ) {
        const context = `${invoice.company_id}:${invoice.branch}:${product.code}:${prior ?? "new"}:${line.unit_cost_before_tax}:${line.manual_price_decision ?? "standard"}:${JSON.stringify(
          {
            categories: state.config.pricing_categories,
            bands: state.config.rounding_bands,
            corrections: state.config.special_corrections,
          },
        )}`;
        const existing = state.approvals.find(
          (item) =>
            item.company_id === invoice.company_id &&
            item.branch === invoice.branch &&
            item.product_code === product.code &&
            item.proposed_price === price &&
            (prior === price && !usesRule
              ? item.type === "margin_review" && item.config_version === context
              : item.type !== "margin_review" && item.status === "pending"),
        );
        if (existing) {
          existing.invoice_ids = [
            ...new Set([...(existing.invoice_ids ?? []), invoice.id]),
          ];
          existing.unit_cost = line.unit_cost_before_tax;
          existing.margin = margin.margin;
          existing.threshold = category.minimum_margin;
          existing.invoice_number = invoice.supplier_invoice_number;
          existing.triggered_by = actor.actor;
          existing.triggered_by_user_id = actor.user_id;
          existing.posted_at = now;
          existing.source_invoice_id = invoice.id;
          existing.clear_manual_price = usesRule;
          existing.manual_price_review = manualPriceReview;
        } else if (
          manualReview ||
          !state.approvals.some((item) => item.config_version === context)
        ) {
          state.approvals.push({
            id: `${invoice.id}:proposal:${product.code}`,
            company_id: invoice.company_id,
            branch: invoice.branch,
            product_code: product.code,
            status: "pending",
            proposed_price: price,
            current_price: prior,
            type:
              prior === null
                ? "new_product"
                : prior === price && !usesRule
                  ? "margin_review"
                  : "price_change",
            unit_cost: line.unit_cost_before_tax,
            margin: margin.margin,
            threshold: category.minimum_margin,
            reason: margin.below_minimum ? "Below minimum margin" : undefined,
            config_version: context,
            invoice_ids: [invoice.id],
            created_at: now,
            invoice_number: invoice.supplier_invoice_number,
            triggered_by: actor.actor,
            triggered_by_user_id: actor.user_id,
            posted_at: now,
            source_invoice_id: invoice.id,
            clear_manual_price: usesRule,
            manual_price_review: manualPriceReview,
          });
        }
        if (prior !== price) {
          product.pending_price = price;
          product.pending_branch = invoice.branch;
        }
      }
      recordReceiptStock(state, {
        id: `${invoice.id}:received:${lineIndex}`,
        company_id: invoice.company_id,
        branch: invoice.branch,
        product_code: product.code,
        qty: acceptedInvoiceUnits(line),
        type: "received",
        reference: `${invoice.supplier_invoice_number}:line:${lineIndex + 1}`,
        by: invoice.receiving_employee!,
        at: invoice.received_at ?? now,
        invoice_id: invoice.id,
        line_index: lineIndex,
      });
      if (
        !product.package_of_product_id &&
        !line.short_dated &&
        acceptedInvoiceUnits(line) > 0
      ) {
        saleCostInputs.set(product.code, {
          invoice_id: invoice.id,
          product_code: product.code,
          line_index: lineIndex,
          previous_cost:
            priorCosts.get(product.code) ?? product.last_cost_before_tax,
          new_cost: line.unit_cost_before_tax,
          regular_price_before: prior ?? "0",
          proposed_regular_price: price,
        });
        product.last_cost_before_tax = line.unit_cost_before_tax;
      }
      const short = lineShort(line);
      line.short_before_tax = short.beforeTax;
      line.short_tax = short.tax;
      if (
        line.date_tracking &&
        line.date_value &&
        acceptedInvoiceUnits(line) > 0
      ) {
        product.date_tracking = true;
        state.expiry.push({
          id: `${invoice.id}:date:${lineIndex}:${product.code}`,
          company_id: invoice.company_id,
          branch: invoice.branch,
          product_code: product.code,
          invoice_id: invoice.id,
          invoice_number: invoice.supplier_invoice_number,
          received_date: companyCalendarDate(
            state.config,
            invoice.received_at ?? invoice.invoice_date ?? now,
          ),
          date: line.date_value,
          status: "active",
          source: "invoice",
          date_type: line.date_type ?? "expiry",
          invoice_line_index: lineIndex,
          quantity:
            line.sold_by === "weight"
              ? line.source_received_quantity
              : String(acceptedInvoiceUnits(line)),
          lot_number: line.lot_number,
          created_by: actor.actor,
          created_at: now,
          expires_in_days: Math.round(
            (new Date(`${line.date_value}T12:00:00Z`).getTime() -
              new Date(`${companyDate(state.config)}T12:00:00Z`).getTime()) /
              86_400_000,
          ),
        });
      }
    }
    for (const line of invoice.order_id
      ? []
      : canonicalLowerPriceLines(state, actor)) {
      const product = state.products.find(
        (item) =>
          item.company_id === invoice.company_id &&
          item.code === line.product_code,
      )!;
      const answer = invoice.lower_price_answers!;
      state.alerts.push({
        id: `${invoice.id}:lower:${product.code}`,
        company_id: invoice.company_id,
        branch: invoice.branch,
        type: "lower_price",
        status: "pending",
        product_code: product.code,
        supplier: invoice.supplier,
        previous_cost: previousReceiptCost(state, actor, product.code, line)!
          .cost,
        new_cost: line.unit_cost_before_tax,
        same_expiry: answer.same_expiry,
        old_expiry: answer.old_expiry,
        new_expiry: answer.new_expiry,
        units_left:
          answer.same_expiry === "no_previous_stock" ? 0 : answer.units_left,
        note: [
          answer.note,
          `Previous receipt: ${previousReceiptCost(state, actor, product.code, line)?.reference}; invoice: ${invoice.supplier_invoice_number}`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
    const taxMismatch =
      !new Decimal(invoice.subtotal)
        .plus(invoice.tax)
        .equals(invoice.final_total) ||
      new Decimal(invoice.tax)
        .minus(
          Decimal.sum(
            ...invoice.lines.map((line) => line.line_tax ?? "0"),
            ...(invoice.other_charges ?? []).map((charge) =>
              charge.taxable
                ? new Decimal(charge.amount).times(state.config.tax.rate)
                : "0",
            ),
          ),
        )
        .abs()
        .greaterThan("0.01");
    if (taxMismatch)
      state.alerts.push({
        id: `${invoice.id}:tax`,
        company_id: invoice.company_id,
        branch: invoice.branch,
        type: "tax_discrepancy",
        product_code: "",
        status: "pending",
        supplier: invoice.supplier,
        note: `Invoice ${invoice.supplier_invoice_number}: review totals and tax.`,
      });
    const totals = shortTotals(invoice);
    const refused = refusedTotals(invoice);
    state.ledger.push({
      id: `${invoice.id}:posted`,
      company_id: invoice.company_id,
      branch: invoice.branch,
      supplier: invoice.supplier,
      type: "invoice",
      amount: invoice.final_total,
      date: invoice.invoice_date!,
      reference: invoice.supplier_invoice_number,
      invoice_id: invoice.id,
      currency: state.config.company.currency,
    });
    if (new Decimal(totals.total).greaterThan(0))
      state.ledger.push({
        id: `${invoice.id}:short`,
        company_id: invoice.company_id,
        branch: invoice.branch,
        supplier: invoice.supplier,
        type: "short_deduction",
        amount: new Decimal(totals.total).negated().toFixed(2),
        date: invoice.invoice_date!,
        reference: invoice.supplier_invoice_number,
        invoice_id: invoice.id,
        currency: state.config.company.currency,
      });
    if (new Decimal(refused.total).greaterThan(0))
      state.ledger.push({
        id: `${invoice.id}:refused`,
        company_id: invoice.company_id,
        branch: invoice.branch,
        supplier: invoice.supplier,
        type: "refused_deduction",
        amount: new Decimal(refused.total).negated().toFixed(2),
        date: invoice.invoice_date!,
        reference: invoice.supplier_invoice_number,
        invoice_id: invoice.id,
        currency: state.config.company.currency,
      });
    invoice.payable_after_open_shorts = cents(
      new Decimal(invoice.final_total).minus(totals.total).minus(refused.total),
    );
    invoice.status = "posted";
    recordInvoiceReceiptLots(state, invoice);
    invoice.posted_at = now;
    if (orderComparison) {
      invoice.order_comparison = structuredClone(orderComparison);
      const differences = invoiceOrderDifferences(
        state,
        actor,
        orderComparison,
        evidence,
      );
      if (
        differences.length &&
        !state.alerts.some(
          (alert) => alert.id === `${invoice.id}:order-differences`,
        )
      ) {
        const answer = invoice.lower_price_answers;
        state.alerts.push({
          id: `${invoice.id}:order-differences`,
          company_id: invoice.company_id,
          branch: invoice.branch,
          type: "order_differences",
          status: "pending",
          product_code: "",
          supplier: invoice.supplier,
          invoice_id: invoice.id,
          order_id: invoice.order_id,
          order_differences: differences,
          same_expiry: answer?.same_expiry,
          old_expiry: answer?.old_expiry,
          new_expiry: answer?.new_expiry,
          units_left:
            answer?.same_expiry === "no_previous_stock"
              ? 0
              : answer?.units_left,
          note: answer?.note,
        });
      }
    }
    state.activity.push({
      id: `${invoice.id}:activity`,
      company_id: invoice.company_id,
      branch: invoice.branch,
      action: "Posted invoice",
      entity_type: "invoice",
      entity_id: invoice.id,
      after: {
        supplier_invoice_number: invoice.supplier_invoice_number,
        supplier: invoice.supplier,
        line_count: invoice.lines.length,
      },
      by: actor.actor,
      actor_user_id: actor.user_id,
      actor_username: actor.username,
      actor_role_snapshot: actor.role,
      at: now,
    });
    state.invoices ??= [];
    const savedIndex = state.invoices.findIndex(
      (saved) =>
        saved.company_id === invoice.company_id && saved.id === invoice.id,
    );
    if (savedIndex >= 0) state.invoices[savedIndex] = structuredClone(invoice);
    else state.invoices.push(structuredClone(invoice));
    for (const input of saleCostInputs.values())
      recordSaleReceiptCost(
        state,
        actor,
        input,
        "invoice_post",
        evidence,
        new Date(now),
        [...directoryRecipients(state)],
      );
    applyPostedInvoiceOrder(state, actor, evidence);
    return true;
  } finally {
    closePurchaseEvidence(evidence);
  }
}

/** The delta of cumulative allocations assigns the final cent once, rather than rounding each receipt independently. */
export function receiveShort(
  state: DemoState,
  code: string,
  quantity: number,
  receipt: string,
  actor: AuthenticatedActor,
  invoiceLineIndex?: number,
): string {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.short_resolve",
    state.invoice.id,
    true,
  );
  const original = state.invoice;
  const invoice = effectiveInvoiceVersion(state, original);
  const effectiveBranch = effectiveInvoiceLocation(state, invoice);
  const branch = effectiveBranch;
  if (invoice.status !== "posted")
    throw new Error("Post the invoice before receiving a later delivery.");
  const evidence = invoicePurchaseEvidence(
    state,
    actor,
    original.id,
    "invoice_short_resolve",
  );
  try {
    const receiptReference = receipt.trim();
    if (!receiptReference)
      throw new Error("Add a delivery document reference.");
    invoice.short_receipt_keys ??= [];
    const matching = invoice.lines.filter(
      (item) =>
        item.product_code === code && item.company_id === invoice.company_id,
    );
    const line =
      invoiceLineIndex === undefined
        ? matching.length === 1
          ? matching[0]
          : undefined
        : Number.isSafeInteger(invoiceLineIndex)
          ? invoice.lines[invoiceLineIndex]
          : undefined;
    if (line?.product_code !== code || line.company_id !== invoice.company_id)
      throw new Error("Choose the specific invoice line for this delivery.");
    if (!line) throw new Error("Choose an invoice line.");
    const lineIndex = invoice.lines.indexOf(line);
    const lineReceiptKey = `line:${lineIndex}:${receiptReference}`;
    if (
      invoice.short_receipt_keys.includes(receiptReference) ||
      invoice.short_receipt_keys.includes(lineReceiptKey)
    )
      return "0.00";
    const receiptEvent =
      invoiceLineIndex === undefined ? receiptReference : lineReceiptKey;
    const short = lineShort(line);
    const previous = line.qty_later_received ?? 0;
    if (
      !(line.sold_by === "weight"
        ? Number.isFinite(quantity) && quantity > 0
        : validQuantity(quantity)) ||
      new Decimal(previous).plus(quantity).gt(short.quantity)
    )
      throw new Error("Receive no more than the remaining missing quantity.");
    const baseDelta = new Decimal(
      cumulativeAllocation(
        short.beforeTax,
        new Decimal(previous).plus(quantity).toNumber(),
        short.quantity,
        line.sold_by === "weight",
      ),
    ).minus(
      cumulativeAllocation(
        short.beforeTax,
        previous,
        short.quantity,
        line.sold_by === "weight",
      ),
    );
    const taxDelta = new Decimal(
      cumulativeAllocation(
        short.tax,
        new Decimal(previous).plus(quantity).toNumber(),
        short.quantity,
        line.sold_by === "weight",
      ),
    ).minus(
      cumulativeAllocation(
        short.tax,
        previous,
        short.quantity,
        line.sold_by === "weight",
      ),
    );
    const restored = cents(baseDelta.plus(taxDelta));
    const orderReceipt = shortOrderReceipt(
      state,
      lineIndex,
      quantity,
      receiptReference,
    );
    const orderContext = actor;
    if (orderReceipt) {
      const preview = cloneWithAuthority(state);
      const previewEvidence = invoicePurchaseEvidence(
        preview,
        actor,
        preview.invoice.id,
        "invoice_short_resolve",
      );
      try {
        preview.invoice.lines[lineIndex].qty_later_received = new Decimal(
          previous,
        )
          .plus(quantity)
          .toNumber();
        const saved = preview.invoices?.find(
          (item) =>
            item.id === invoice.id && item.company_id === invoice.company_id,
        );
        if (saved) Object.assign(saved, structuredClone(preview.invoice));
        validateShortOrderReceipt(
          preview,
          orderContext,
          orderReceipt,
          previewEvidence,
        );
      } finally {
        closePurchaseEvidence(previewEvidence);
      }
    }
    const receiptProduct = state.products.find(
      (product) =>
        product.company_id === invoice.company_id && product.code === code,
    );
    const receiptPriorCost = receiptProduct
      ? invoicePriorRegularCost(state, evidence, receiptProduct.code)
      : null;
    line.qty_later_received = new Decimal(previous).plus(quantity).toNumber();
    invoice.short_receipt_keys.push(receiptEvent);
    if (invoice !== original) {
      original.lines[lineIndex].qty_later_received = line.qty_later_received;
      original.short_receipt_keys ??= [];
      original.short_receipt_keys.push(receiptEvent);
    }
    recordReceiptStock(state, {
      id: `${invoice.id}:delivery:${receiptEvent}:stock`,
      company_id: invoice.company_id,
      branch,
      product_code: code,
      qty: quantity,
      type: "short_resolved_received",
      reference: receiptReference,
      by: orderContext.actor,
      at: new Date().toISOString(),
      invoice_id: invoice.id,
      line_index: invoice.lines.indexOf(line),
    });
    state.ledger.push({
      id: `${invoice.id}:delivery:${receiptEvent}`,
      company_id: invoice.company_id,
      branch,
      supplier: invoice.supplier,
      type: "short_restoration",
      amount: restored,
      date: companyDate(state.config),
      reference: receiptReference,
      invoice_id: invoice.id,
      invoice_line_index: lineIndex,
      currency: state.config.company.currency,
      note: `${quantity} units; before tax ${cents(baseDelta)}, tax ${cents(taxDelta)}`,
    });
    invoice.payable_after_open_shorts = cents(
      new Decimal(invoice.final_total)
        .minus(shortTotals(invoice).total)
        .minus(refusedTotals(invoice).total),
    );
    const history = state.invoices?.find((item) => item.id === invoice.id);
    if (history) Object.assign(history, structuredClone(original));
    if (orderReceipt)
      applyShortOrderReceipt(state, orderContext, orderReceipt, evidence);
    if (receiptProduct && receiptPriorCost !== null && !line.short_dated)
      recordLaterRegularReceipt(
        state,
        invoice,
        branch,
        lineIndex,
        receiptPriorCost,
        `${invoice.id}:delivery:${receiptEvent}:stock`,
        actor,
        evidence,
      );
    state.activity.push({
      id: `${invoice.id}:delivery:${receiptEvent}:activity`,
      company_id: invoice.company_id,
      branch,
      action: "Received short delivery",
      by: orderContext.actor,
      actor_user_id: actor.user_id,
      actor_username: actor.username,
      actor_role_snapshot: actor.role,
      at: new Date().toISOString(),
      product_code: code,
    });
    return restored;
  } finally {
    closePurchaseEvidence(evidence);
  }
}

/** Exact configured fictional cost-up invoice. Upload UI attaches and retains the approved original bytes. */
export function demoSaleCostInvoice(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: Branch,
): DemoInvoice {
  requirePurchase(
    state,
    actor,
    "invoices.enter",
    purchaseLocationScope(state.config.company.seed_key, branch, true),
  );
  const fixture = demo.sales_demo.cost_increase_invoice;
  const product = state.products.find(
    (entry) =>
      entry.company_id === state.config.company.seed_key &&
      entry.code === fixture.product_code,
  );
  if (!product || !configuredBranches(state.config).includes(branch))
    throw new Error("Choose a permitted invoice location.");
  const now = new Date();
  const invoice = createInvoice(state, actor, branch, false);
  const supplier = supplierRecords(state).find(
    (record) =>
      record.company_id === state.config.company.seed_key &&
      supplierMatches(record, fixture.supplier),
  );
  const category = state.config.pricing_categories.find(
    (entry) => entry.key === product.pricing_category,
  )!;
  return {
    ...invoice,
    id: fixture.id,
    supplier: fixture.supplier,
    supplier_confirmed: supplier?.status === "confirmed",
    supplier_invoice_number: fixture.supplier_invoice_number,
    branch,
    handling_branch: branch,
    subtotal: fixture.subtotal,
    tax: fixture.tax,
    final_total: fixture.final_total,
    invoice_date: "2026-10-12",
    received_at: now.toISOString(),
    receiving_employee: "",
    payment_terms: "Net 30",
    payment_term_days: 30,
    due_date: dateAfter("2026-10-12", 30),
    entry_mode: "upload",
    status: "review",
    payable_after_open_shorts: fixture.final_total,
    short_lines: [],
    lines: [
      {
        ...structuredClone(demo.demo_invoice.lines[0]),
        company_id: state.config.company.seed_key,
        product_code: product.code,
        description: product.name_en,
        pricing_category: product.pricing_category,
        qty_invoiced: fixture.qty_ordered,
        qty_received_at_posting: fixture.qty_received,
        qty_later_received: 0,
        units_per_case: fixture.units_per_case,
        quantity_unit: "cases",
        quantity_entered: 1,
        unit_cost_before_tax: fixture.unit_cost_before_tax,
        case_cost_before_tax: new Decimal(fixture.unit_cost_before_tax)
          .times(fixture.units_per_case)
          .toFixed(4),
        line_total: fixture.subtotal,
        line_tax: fixture.tax,
        taxable: true,
        tax_profile: category.default_tax_profile,
        date_tracking: false,
        date_confirmed: true,
        review_confirmed: false,
        low_confidence_fields: [],
        confidence: 1,
        sold_by: "each",
        manual_price_decision: manualPrice(state, product, branch)
          ? "rule"
          : undefined,
        calculated_selling_price: invoiceLineCalculation(
          {
            unit_cost_before_tax: fixture.unit_cost_before_tax,
            sold_by: "each",
          } as InvoiceLine,
          product.pricing_category,
          state.config,
        ).selling_price,
      },
    ],
  };
}

/** Only a genuinely different accepted regular receipt asks how to replace a manual regular price. */
export function manualDecisionForLine(
  state: DemoState,
  actor: AuthenticatedActor,
  line: InvoiceLine,
  branch: Branch,
) {
  requireInvoiceAuthority(state, actor, "invoices.cost_read");
  if (branch !== state.invoice.branch || !state.invoice.lines.includes(line))
    throw new Error("Choose the invoice's own price location.");
  if (
    line.company_id !== state.config.company.seed_key ||
    line.short_dated ||
    acceptedInvoiceUnits(line) <= 0
  )
    return null;
  const product = state.products.find(
    (item) =>
      item.company_id === line.company_id && item.code === line.product_code,
  );
  if (!product) return null;
  const marker = manualPrice(state, product, branch);
  if (!marker) return null;
  try {
    const evidence = invoicePurchaseEvidence(
      state,
      actor,
      state.invoice.id,
      "invoice_read",
    );
    let prior: string | null;
    try {
      prior = invoicePriorRegularCost(state, evidence, product.code);
    } finally {
      closePurchaseEvidence(evidence);
    }
    return prior !== null && !new Decimal(prior).eq(line.unit_cost_before_tax)
      ? marker
      : null;
  } catch {
    return null;
  }
}
/** Preserve an explicit Keep choice; initialize the changed-cost default before presenting/posting a draft. */
export function initializeInvoiceManualPriceDecisions(
  state: DemoState,
  actor: AuthenticatedActor,
  invoice: DemoInvoice = state.invoice,
) {
  requireInvoiceAuthority(state, actor, "invoices.edit", invoice.id, true);
  if (invoice !== state.invoice)
    throw new Error("Choose the current invoice workspace.");
  if (
    invoice.company_id !== state.config.company.seed_key ||
    invoice.status === "posted"
  )
    return;
  for (const line of invoice.lines)
    if (manualDecisionForLine(state, actor, line, invoice.branch))
      line.manual_price_decision ??= "rule";
}

function recordLaterRegularReceipt(
  state: DemoState,
  invoice: DemoInvoice,
  branch: Branch,
  lineIndex: number,
  previousCost: string,
  receiptId: string,
  actor: AuthenticatedActor,
  evidence: InternalPurchaseEvidence,
) {
  const line = invoice.lines[lineIndex];
  const product = state.products.find(
    (item) =>
      item.company_id === invoice.company_id && item.code === line.product_code,
  );
  const receipt = state.stock_movements?.find(
    (item) =>
      item.id === receiptId &&
      item.company_id === invoice.company_id &&
      item.invoice_id === invoice.id &&
      item.line_index === lineIndex &&
      item.type === "short_resolved_received" &&
      item.qty > 0,
  );
  if (!product || !receipt || line.short_dated || product.package_of_product_id)
    return;
  const now = new Date(receipt.at);
  const calculation = invoiceLineCalculation(
    line,
    line.pricing_category ?? product.pricing_category,
    state.config,
  );
  const prior = regularPrice(state, product, branch);
  const marker = manualPrice(state, product, branch);
  const changed = !new Decimal(previousCost).eq(line.unit_cost_before_tax);
  const manualReview = Boolean(marker && changed);
  const keep = Boolean(marker && !changed);
  const price = manualReview
    ? calculation.selling_price
    : keep
      ? prior!
      : calculation.selling_price;
  const category = state.config.pricing_categories.find(
    (item) => item.key === product.pricing_category,
  )!;
  const margin = new Decimal(price).gt(0)
    ? new Decimal(price).minus(line.unit_cost_before_tax).div(price).toFixed(8)
    : null;
  const below =
    margin !== null &&
    category.minimum_margin !== null &&
    category.minimum_margin !== "" &&
    new Decimal(margin).lt(category.minimum_margin);
  if ((!marker || changed) && (manualReview || prior !== price || below)) {
    const existing = state.approvals.find(
      (item) =>
        item.company_id === invoice.company_id &&
        item.product_code === product.code &&
        item.branch === branch &&
        item.status === "pending" &&
        item.proposed_price === price &&
        item.source_invoice_id === invoice.id,
    );
    if (!existing)
      state.approvals.push({
        id: `${receiptId}:proposal`,
        company_id: invoice.company_id,
        branch,
        branch_id: branch,
        type:
          prior === null
            ? "new_product"
            : prior === price && !manualReview
              ? "margin_review"
              : "price_change",
        product_code: product.code,
        status: "pending",
        proposed_price: price,
        current_price: prior,
        unit_cost: line.unit_cost_before_tax,
        margin,
        threshold: category.minimum_margin,
        source_invoice_id: invoice.id,
        invoice_ids: [invoice.id],
        invoice_number: invoice.supplier_invoice_number,
        posted_at: receipt.at,
        created_at: receipt.at,
        triggered_by: actor.actor,
        triggered_by_user_id: actor.user_id,
        clear_manual_price: manualReview,
        manual_price_review: manualReview
          ? {
              kept_price: prior!,
              calculated_price: calculation.selling_price,
              prior_cost: new Decimal(previousCost).toFixed(4),
              received_cost: new Decimal(line.unit_cost_before_tax).toFixed(4),
              receiver_recommendation: line.manual_price_decision ?? "rule",
            }
          : undefined,
      });
    if (prior !== price) {
      product.pending_price = price;
      product.pending_branch = branch;
    }
  }
  product.last_cost_before_tax = line.unit_cost_before_tax;
  product.price_provenance ??= {};
  product.price_provenance[branch] = {
    ...(product.price_provenance[branch] ?? {}),
    invoice_number: invoice.supplier_invoice_number,
    invoice_date: invoice.invoice_date,
    calculated_price: calculation.selling_price,
  };
  recordSaleReceiptCost(
    state,
    actor,
    {
      invoice_id: invoice.id,
      product_code: product.code,
      line_index: lineIndex,
      previous_cost: previousCost,
      new_cost: line.unit_cost_before_tax,
      regular_price_before: prior ?? "0",
      proposed_regular_price: price,
      source_event_id: receiptId,
    },
    "invoice_short_receipt",
    evidence,
    now,
    [...directoryRecipients(state)],
  );
}
