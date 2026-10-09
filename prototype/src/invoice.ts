import Decimal from "decimal.js";
import { demoSeed as demo } from "./config";
import { calculatePrice } from "./pricing";
import { effectivePrice } from "./catalog";
import { createId } from "./ids";
import { configuredBranches } from "./settings";
import { supplierRecords, supplierMatches } from "./supplier-editor";
import { nextProductCode } from "./manual-product";
import { manualPrice } from "./manual-prices";
import { effectiveInvoiceLocation } from "./received";
import type {
  Branch,
  CompanyConfig,
  DemoInvoice,
  DemoState,
  InvoiceLine,
  Role,
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
  state.stock[stockKey] = (state.stock[stockKey] ?? 0) + movement.qty;
}

/** A local business date follows the company setting, including Toronto daylight saving. */
export function companyDate(config: CompanyConfig, now = new Date()): string {
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

export function createInvoice(
  state: DemoState,
  branch: Branch,
  manual = false,
): DemoInvoice {
  const company = state.config.company.seed_key;
  const today = companyDate(state.config);
  const seed = structuredClone(demo.demo_invoice);
  return {
    ...seed,
    id: createId("invoice"),
    company_id: company,
    branch,
    handling_branch: branch,
    status: "draft",
    entry_mode: manual ? "manual" : "upload",
    supplier_confirmed: true,
    invoice_date: today,
    received_at: new Date().toISOString(),
    receiving_employee: "Demo Floor Worker",
    due_date: dateAfter(today, 14),
    short_receipt_keys: [],
    lines: manual
      ? []
      : seed.lines.map((line) => ({
          ...line,
          company_id: company,
          // Let the receiver explicitly mark the four chips missing, rather than inventing a shortage.
          qty_received_at_posting: line.qty_invoiced,
          qty_later_received: 0,
          pricing_category:
            state.products.find((product) => product.code === line.product_code)
              ?.pricing_category ?? "grocery",
          review_confirmed: false,
          date_tracking: false,
          date_confirmed: false,
          new_name_en:
            line.product_code === "NEW" ? line.description : undefined,
          new_name_fa:
            line.product_code === "NEW" ? "زرشک خشک ۱۰۰ گرمی" : undefined,
          line_tax: line.taxable
            ? cents(new Decimal(line.line_total).times(state.config.tax.rate))
            : "0.00",
        })),
    ...(manual
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

export function addManualLine(state: DemoState, code: string): void {
  const product = state.products.find(
    (item) =>
      item.code === code && item.company_id === state.invoice.company_id,
  );
  if (!product || state.invoice.status === "posted") return;
  state.invoice.lines.push({
    company_id: state.invoice.company_id,
    product_code: code,
    description: product.name_en,
    qty_invoiced: 1,
    qty_received_at_posting: 1,
    qty_later_received: 0,
    unit_cost_before_tax: product.last_cost_before_tax,
    line_total: product.last_cost_before_tax,
    taxable: product.taxable,
    tax_profile: product.tax_profile,
    calculated_selling_price: product.selling_price,
    current_selling_price: product.selling_price,
    pricing_category: product.pricing_category,
    demo_note: "",
    review_confirmed: false,
    date_tracking: false,
    date_confirmed: false,
  });
  recalculateInvoice(state.invoice, state.config);
}

export function recalculateInvoice(
  invoice: DemoInvoice,
  config: CompanyConfig,
): void {
  let subtotal = new Decimal(0);
  let tax = new Decimal(0);
  for (const line of invoice.lines) {
    if (
      !validCost(line.unit_cost_before_tax) ||
      !validQuantity(line.qty_invoiced)
    )
      continue;
    line.line_total = cents(
      new Decimal(line.unit_cost_before_tax).times(line.qty_invoiced),
    );
    const profile = config.tax.profiles.find(
      (item) => item.key === line.tax_profile,
    );
    line.line_tax = cents(
      new Decimal(line.line_total).times(profile?.rate ?? "0"),
    );
    subtotal = subtotal.plus(line.line_total);
    tax = tax.plus(line.line_tax);
    line.review_confirmed = false;
  }
  invoice.subtotal = cents(subtotal);
  invoice.tax = cents(tax);
  invoice.final_total = cents(subtotal.plus(tax));
  invoice.payable_after_open_shorts = cents(
    new Decimal(invoice.final_total).minus(shortTotals(invoice).total),
  );
}

function validQuantity(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validCost(value: string): boolean {
  return /^\d+(?:\.\d{1,4})?$/.test(value);
}

function validMoney(value: string): boolean {
  return /^\d+(?:\.\d{1,2})?$/.test(value);
}

export function lineShort(line: InvoiceLine): {
  quantity: number;
  beforeTax: string;
  tax: string;
  total: string;
} {
  const quantity = Math.max(
    0,
    line.qty_invoiced - line.qty_received_at_posting,
  );
  if (
    !quantity ||
    !validQuantity(line.qty_invoiced) ||
    !validCost(line.unit_cost_before_tax)
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

export function shortTotals(invoice: DemoInvoice): {
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
      .minus(cumulativeAllocation(short.beforeTax, restored, short.quantity));
    tax = tax
      .plus(short.tax)
      .minus(cumulativeAllocation(short.tax, restored, short.quantity));
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
): string {
  if (delivered === 0 || originallyMissing === 0) return "0.00";
  if (
    !Number.isSafeInteger(delivered) ||
    delivered < 0 ||
    delivered > originallyMissing
  ) {
    throw new Error("Receive no more than the remaining missing quantity.");
  }
  return cents(new Decimal(amount).times(delivered).div(originallyMissing));
}

export function previousReceiptCost(
  state: DemoState,
  code: string,
): { cost: string; reference: string } | null {
  const invoice = state.invoice;
  const previous = [...(state.invoices ?? [])]
    .reverse()
    .find(
      (receipt) =>
        receipt.id !== invoice.id &&
        receipt.company_id === invoice.company_id &&
        effectiveInvoiceLocation(state, receipt) === invoice.branch &&
        receipt.supplier === invoice.supplier &&
        receipt.status === "posted" &&
        receipt.lines.some(
          (line) =>
            line.product_code === code &&
            line.qty_received_at_posting + (line.qty_later_received ?? 0) > 0,
        ),
    );
  if (previous)
    return {
      cost: previous.lines.find((line) => line.product_code === code)!
        .unit_cost_before_tax,
      reference: previous.supplier_invoice_number,
    };
  // Only the original demo catalog supplies historical Branch 1 receipt costs.
  const product = demo.products.find(
    (item) => item.code === code && item.main_supplier === invoice.supplier,
  );
  return invoice.branch === demo.same_supplier_lower_price_alert.branch &&
    product
    ? {
        cost: product.last_cost_before_tax,
        reference: "Fictional prior receipt",
      }
    : null;
}

export function lowerPriceLines(state: DemoState): InvoiceLine[] {
  return state.invoice.lines.filter((line) => {
    const previous = previousReceiptCost(state, line.product_code);
    return (
      previous &&
      validCost(line.unit_cost_before_tax) &&
      new Decimal(line.unit_cost_before_tax).lessThan(previous.cost)
    );
  });
}

export type InvoiceBlocker =
  | "permission"
  | "branch"
  | "company"
  | "supplier"
  | "supplier_pending"
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
  | "manual_price";

export function invoiceBlockers(
  state: DemoState,
  role: Role,
  branch: Branch,
): InvoiceBlocker[] {
  const invoice = state.invoice;
  const blockers: InvoiceBlocker[] = [];
  if (role === "cashier") blockers.push("permission");
  if (
    !configuredBranches(state.config).includes(invoice.branch) ||
    (role !== "supervisor" &&
      branch !== (invoice.handling_branch ?? invoice.branch))
  )
    blockers.push("branch");
  if (invoice.company_id !== state.config.company.seed_key)
    blockers.push("company");
  if (!invoice.supplier.trim()) blockers.push("supplier");
  const supplier = supplierRecords(state).find(
    (record) =>
      record.company_id === invoice.company_id &&
      supplierMatches(record, invoice.supplier),
  );
  if (
    !supplier ||
    supplier.status !== "confirmed" ||
    !invoice.supplier_confirmed
  )
    blockers.push("supplier_pending");
  if (
    !invoice.invoice_date ||
    !invoice.received_at ||
    !invoice.receiving_employee?.trim()
  )
    blockers.push("header");
  if (![invoice.subtotal, invoice.tax, invoice.final_total].every(validMoney))
    blockers.push("money");
  if (!invoice.file_name || !invoice.file_data) blockers.push("file");
  if (!invoice.lines.length) blockers.push("lines");
  for (const line of invoice.lines) {
    const product = state.products.find(
      (item) =>
        item.code === line.product_code &&
        item.company_id === invoice.company_id,
    );
    if (line.company_id !== invoice.company_id) blockers.push("company");
    if (
      !product &&
      !(
        line.product_code === "NEW" &&
        line.new_name_en?.trim() &&
        line.new_name_fa?.trim()
      )
    )
      blockers.push("matching");
    if (
      !validQuantity(line.qty_invoiced) ||
      !Number.isSafeInteger(line.qty_received_at_posting) ||
      line.qty_received_at_posting < 0 ||
      line.qty_received_at_posting > line.qty_invoiced
    )
      blockers.push("quantity");
    if (!validCost(line.unit_cost_before_tax)) blockers.push("cost");
    if (!line.review_confirmed) blockers.push("review");
    const category = state.config.pricing_categories.find(
      (item) =>
        item.key === (line.pricing_category ?? product?.pricing_category),
    );
    try {
      calculatePrice(
        line.unit_cost_before_tax,
        category?.key ?? "",
        state.config,
      );
    } catch {
      blockers.push("cost");
    }
    if (!line.date_confirmed || (line.date_tracking && !line.date_value))
      blockers.push("date");
    if (
      product &&
      !line.short_dated &&
      manualPrice(state, product, invoice.branch) &&
      !line.manual_price_decision
    )
      blockers.push("manual_price");
  }
  if (lowerPriceLines(state).length) {
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
  return [...new Set(blockers)];
}

/** Mutates the store draft once; the browser is the only persistence layer in this demo. */
export function postInvoice(
  state: DemoState,
  role: Role,
  branch: Branch,
  actor?: string,
): boolean {
  const invoice = state.invoice;
  if (invoice.status === "posted") return false;
  const blockers = invoiceBlockers(state, role, branch);
  if (blockers.length) throw new Error(blockers.join(", "));
  if (state.ledger.some((entry) => entry.id === `${invoice.id}:posted`))
    return false;
  const now = new Date().toISOString();
  if (!invoice.supplier_invoice_number.trim()) {
    invoice.supplier_invoice_number = String(
      1 +
        state.ledger.filter(
          (entry) =>
            entry.company_id === invoice.company_id &&
            entry.supplier === invoice.supplier &&
            entry.type === "invoice",
        ).length,
    );
    invoice.number_is_system_assigned = true;
  }
  for (const [lineIndex, line] of invoice.lines.entries()) {
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
        name_fa: line.new_name_fa!,
        pricing_category: line.pricing_category ?? "grocery",
        unit_size: "100 g",
        last_cost_before_tax: line.unit_cost_before_tax,
        selling_price: "",
        offer: null,
        taxable: line.taxable,
        date_tracking: true,
        main_supplier: invoice.supplier,
        ai_category: "Dried fruits & spices",
        barcode: "",
        status: "pending_approval",
        tax_profile: line.tax_profile,
      };
      state.products.push(product);
    }
    if (!product) throw new Error("Resolve every product before posting.");
    const calculation = calculatePrice(
      line.unit_cost_before_tax,
      line.pricing_category ?? product.pricing_category,
      state.config,
    );
    const rulePrice = calculation.selling_price;
    const prior = effectivePrice(state, product, invoice.branch);
    const manual = manualPrice(state, product, invoice.branch);
    const keepsManual = !!manual && line.manual_price_decision === "keep";
    const usesRule = !!manual && line.manual_price_decision === "rule";
    const price = keepsManual ? prior! : rulePrice;
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
    product.price_provenance ??= {};
    const previousProvenance = product.price_provenance[invoice.branch];
    product.price_provenance[invoice.branch] = {
      ...(previousProvenance ?? {}),
      invoice_number: invoice.supplier_invoice_number,
      calculated_price: rulePrice,
      invoice_date: invoice.invoice_date ?? companyDate(state.config),
    };
    if (
      !line.short_dated &&
      (usesRule || prior !== price || margin.below_minimum)
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
        existing.triggered_by = actor ?? invoice.receiving_employee;
        existing.posted_at = now;
        existing.source_invoice_id = invoice.id;
        existing.clear_manual_price = usesRule;
      } else if (
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
          triggered_by: actor ?? invoice.receiving_employee,
          posted_at: now,
          source_invoice_id: invoice.id,
          clear_manual_price: usesRule,
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
      qty: line.qty_received_at_posting,
      type: "received",
      reference: `${invoice.supplier_invoice_number}:line:${lineIndex + 1}`,
      by: invoice.receiving_employee!,
      at: now,
      invoice_id: invoice.id,
      line_index: lineIndex,
    });
    if (!line.short_dated && line.qty_received_at_posting > 0)
      product.last_cost_before_tax = line.unit_cost_before_tax;
    const short = lineShort(line);
    line.short_before_tax = short.beforeTax;
    line.short_tax = short.tax;
    if (line.date_tracking && line.date_value) {
      state.expiry.push({
        id: `${invoice.id}:date:${product.code}`,
        company_id: invoice.company_id,
        branch: invoice.branch,
        product_code: product.code,
        invoice_id: invoice.id,
        invoice_number: invoice.supplier_invoice_number,
        received_date: (
          invoice.received_at ??
          invoice.invoice_date ??
          now
        ).slice(0, 10),
        date: line.date_value,
        status: "active",
        expires_in_days: Math.round(
          (new Date(`${line.date_value}T12:00:00Z`).getTime() -
            new Date(`${companyDate(state.config)}T12:00:00Z`).getTime()) /
            86_400_000,
        ),
      });
    }
  }
  for (const line of lowerPriceLines(state)) {
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
      previous_cost: previousReceiptCost(state, product.code)!.cost,
      new_cost: line.unit_cost_before_tax,
      same_expiry: answer.same_expiry,
      old_expiry: answer.old_expiry,
      new_expiry: answer.new_expiry,
      units_left:
        answer.same_expiry === "no_previous_stock" ? 0 : answer.units_left,
      note: [
        answer.note,
        `Previous receipt: ${previousReceiptCost(state, product.code)?.reference}; invoice: ${invoice.supplier_invoice_number}`,
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
      .minus(Decimal.sum(...invoice.lines.map((line) => line.line_tax ?? "0")))
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
  invoice.payable_after_open_shorts = cents(
    new Decimal(invoice.final_total).minus(totals.total),
  );
  invoice.status = "posted";
  invoice.posted_at = now;
  state.activity.push({
    id: `${invoice.id}:activity`,
    company_id: invoice.company_id,
    branch: invoice.branch,
    action: "Posted invoice",
    by: invoice.receiving_employee!,
    at: now,
  });
  state.invoices ??= [];
  const savedIndex = state.invoices.findIndex(
    (saved) =>
      saved.company_id === invoice.company_id && saved.id === invoice.id,
  );
  if (savedIndex >= 0) state.invoices[savedIndex] = structuredClone(invoice);
  else state.invoices.push(structuredClone(invoice));
  return true;
}

/** The delta of cumulative allocations assigns the final cent once, rather than rounding each receipt independently. */
export function receiveShort(
  state: DemoState,
  code: string,
  quantity: number,
  receipt: string,
  role: Role,
  branch: Branch,
): string {
  const invoice = state.invoice;
  const effectiveBranch = effectiveInvoiceLocation(state, invoice);
  if (
    role === "cashier" ||
    branch !== effectiveBranch ||
    invoice.company_id !== state.config.company.seed_key
  )
    throw new Error("Select your permitted invoice branch.");
  if (invoice.status !== "posted")
    throw new Error("Post the invoice before receiving a later delivery.");
  const receiptReference = receipt.trim();
  if (!receiptReference) throw new Error("Add a delivery document reference.");
  invoice.short_receipt_keys ??= [];
  if (invoice.short_receipt_keys.includes(receiptReference)) return "0.00";
  const line = invoice.lines.find(
    (item) =>
      item.product_code === code && item.company_id === invoice.company_id,
  );
  if (!line) throw new Error("Choose an invoice line.");
  const short = lineShort(line);
  const previous = line.qty_later_received ?? 0;
  if (!validQuantity(quantity) || previous + quantity > short.quantity)
    throw new Error("Receive no more than the remaining missing quantity.");
  const baseDelta = new Decimal(
    cumulativeAllocation(short.beforeTax, previous + quantity, short.quantity),
  ).minus(cumulativeAllocation(short.beforeTax, previous, short.quantity));
  const taxDelta = new Decimal(
    cumulativeAllocation(short.tax, previous + quantity, short.quantity),
  ).minus(cumulativeAllocation(short.tax, previous, short.quantity));
  const restored = cents(baseDelta.plus(taxDelta));
  line.qty_later_received = previous + quantity;
  invoice.short_receipt_keys.push(receiptReference);
  recordReceiptStock(state, {
    id: `${invoice.id}:delivery:${receiptReference}:stock`,
    company_id: invoice.company_id,
    branch,
    product_code: code,
    qty: quantity,
    type: "short_resolved_received",
    reference: receiptReference,
    by: invoice.receiving_employee!,
    at: new Date().toISOString(),
    invoice_id: invoice.id,
    line_index: invoice.lines.indexOf(line),
  });
  state.ledger.push({
    id: `${invoice.id}:delivery:${receiptReference}`,
    company_id: invoice.company_id,
    branch,
    supplier: invoice.supplier,
    type: "short_restoration",
    amount: restored,
    date: companyDate(state.config),
    reference: receiptReference,
    invoice_id: invoice.id,
    currency: state.config.company.currency,
    note: `${quantity} units; before tax ${cents(baseDelta)}, tax ${cents(taxDelta)}`,
  });
  invoice.payable_after_open_shorts = cents(
    new Decimal(invoice.final_total).minus(shortTotals(invoice).total),
  );
  const history = state.invoices?.find((item) => item.id === invoice.id);
  if (history) Object.assign(history, structuredClone(invoice));
  state.activity.push({
    id: `${invoice.id}:delivery:${receiptReference}:activity`,
    company_id: invoice.company_id,
    branch,
    action: "Received short delivery",
    by: invoice.receiving_employee!,
    at: new Date().toISOString(),
    product_code: code,
  });
  return restored;
}
