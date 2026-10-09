import type {
  DemoState,
  InvoiceLine,
  Role,
  Branch,
  DemoInvoice,
} from "./types";
import {
  compareInvoiceOrder,
  suggestOpenOrders,
  validateOrderReceipt,
  applyInvoiceToOrder,
  type Order,
  type OrderComparison,
  type OrderReceiptInput,
} from "./orders";
import { effectiveInvoiceLocation } from "./received";
import type { OperationsContext } from "./operations";

/** A retained explanation of a received invoice's differences from its order. */
export interface InvoiceOrderDifference {
  kind: "short" | "not_delivered" | "extra" | "price_change" | "short_dated";
  invoice_line_index?: number;
  order_line_id?: string;
  product_code: string;
  name_en?: string;
  name_fa?: string;
  units?: number;
  previous_unit_cost?: string;
  new_unit_cost?: string;
  previous_case_cost?: string;
  new_case_cost?: string;
  expiry_date?: string;
  decision: string;
}

export function invoiceReviewerAllowed(
  state: DemoState,
  invoice: DemoInvoice,
  role: Role,
  branch: Branch,
): boolean {
  return (
    invoice.company_id === state.config.company.seed_key &&
    role !== "cashier" &&
    (role === "supervisor" ||
      (invoice.status === "posted"
        ? effectiveInvoiceLocation(state, invoice)
        : (invoice.handling_branch ?? invoice.branch)) === branch)
  );
}

export function compatibleInvoiceOrders(
  state: DemoState,
  role: Role,
  branch: Branch,
): Order[] {
  return invoiceReviewerAllowed(state, state.invoice, role, branch)
    ? suggestOpenOrders(state, state.invoice)
    : [];
}

export function linkedInvoiceOrder(
  state: DemoState,
  invoice = state.invoice,
): Order | null {
  return (
    (state.orders ?? []).find(
      (order) =>
        order.id === invoice.order_id &&
        order.company_id === invoice.company_id,
    ) ?? null
  );
}

export function currentInvoiceOrderComparison(
  state: DemoState,
): OrderComparison | null {
  if (state.invoice.status === "posted")
    return state.invoice.order_comparison ?? null;
  const order = linkedInvoiceOrder(state);
  return order ? compareInvoiceOrder(order, state.invoice) : null;
}

export function setInvoiceOrder(
  state: DemoState,
  role: Role,
  branch: Branch,
  orderId: string,
): void {
  if (
    !invoiceReviewerAllowed(state, state.invoice, role, branch) ||
    state.invoice.status === "posted"
  )
    throw new Error("Choose an invoice in your allowed receiving location.");
  const order = orderId
    ? compatibleInvoiceOrders(state, role, branch).find(
        (candidate) => candidate.id === orderId,
      )
    : null;
  if (orderId && !order)
    throw new Error(
      "Choose an open order for this supplier and receiving location.",
    );
  clearInvoiceOrder(state.invoice);
  if (order) {
    state.invoice.order_id = order.id;
    state.invoice.order_review_version = order.version;
    const comparison = compareInvoiceOrder(order, state.invoice);
    for (const row of comparison.lines)
      state.invoice.lines[row.invoice_line_index].order_item_id =
        row.order_line_id;
  }
}

export function setInvoiceExtraDecision(
  state: DemoState,
  role: Role,
  branch: Branch,
  index: number,
  decision: "keep" | "refuse",
): void {
  if (
    !invoiceReviewerAllowed(state, state.invoice, role, branch) ||
    state.invoice.status === "posted" ||
    !["keep", "refuse"].includes(decision)
  )
    throw new Error(
      "Review the delivered invoice before choosing an extra-item decision.",
    );
  const comparison = currentInvoiceOrderComparison(state);
  const row = comparison?.lines.find(
    (entry) => entry.invoice_line_index === index,
  );
  if (!row || row.extra_units <= 0)
    throw new Error("Choose an extra delivered invoice line.");
  const line = state.invoice.lines[index];
  line.extra_delivery_decision = decision;
  line.refused_units = decision === "refuse" ? row.extra_units : 0;
  line.review_confirmed = false;
  state.invoice.order_missing_decisions = undefined;
}

export type InvoiceOrderIssue = "order" | "order_decisions";
export function invoiceOrderIssues(
  state: DemoState,
  role: Role,
  branch: Branch,
): InvoiceOrderIssue[] {
  const invoice = state.invoice;
  if (!invoice.order_id)
    return invoice.lines.some((line) => (line.refused_units ?? 0) > 0)
      ? ["order_decisions"]
      : [];
  const order = compatibleInvoiceOrders(state, role, branch).find(
    (record) => record.id === invoice.order_id,
  );
  if (!order || order.version !== invoice.order_review_version)
    return ["order"];
  try {
    const comparison = compareInvoiceOrder(order, invoice);
    const unresolved =
      comparison.lines.some((row) => {
        const line = invoice.lines[row.invoice_line_index];
        const refused = line.refused_units ?? 0;
        return (
          (row.extra_units > 0 &&
            !["keep", "refuse"].includes(line.extra_delivery_decision ?? "")) ||
          (line.extra_delivery_decision === "refuse"
            ? refused !== row.extra_units
            : refused !== 0) ||
          (row.price_changed &&
            row.accepted_units > 0 &&
            !(
              line.order_price_decision === "accept" ||
              (line.order_price_decision === "short_dated" && line.short_dated)
            ))
        );
      }) ||
      comparison.residual.some(
        (row) =>
          !["short", "back_ordered", "cancelled"].includes(
            invoice.order_missing_decisions?.[row.order_line_id] ?? "",
          ),
      );
    return unresolved ? ["order_decisions"] : [];
  } catch {
    return ["order_decisions"];
  }
}

function initialReceipt(invoice: DemoInvoice): OrderReceiptInput {
  return {
    invoice_id: invoice.id,
    event_key: `${invoice.id}:order:posted`,
    kind: "invoice",
    lines: (invoice.order_comparison?.lines ?? [])
      .filter((row) => row.order_line_id)
      .map((row) => ({
        order_line_id: row.order_line_id!,
        invoice_line_index: row.invoice_line_index,
        accepted_units:
          invoice.lines[row.invoice_line_index].qty_received_at_posting -
          (invoice.lines[row.invoice_line_index].refused_units ?? 0),
      })),
    residual: (invoice.order_comparison?.residual ?? []).map((row) => ({
      order_line_id: row.order_line_id,
      decision: invoice.order_missing_decisions![row.order_line_id],
    })),
  };
}

/** Validate a prospective posted snapshot before any receipt or money is written. */
export function prepareInvoiceOrder(
  state: DemoState,
  role: Role,
  branch: Branch,
  actor: string,
): OrderComparison | null {
  if (!state.invoice.order_id) return null;
  const issues = invoiceOrderIssues(state, role, branch);
  if (issues.length) throw new Error(issues.join(", "));
  const comparison = currentInvoiceOrderComparison(state)!;
  const preview = structuredClone(state);
  preview.invoice.status = "posted";
  preview.invoice.order_comparison = structuredClone(comparison);
  preview.invoices = (preview.invoices ?? []).filter(
    (invoice) =>
      invoice.id !== preview.invoice.id ||
      invoice.company_id !== preview.invoice.company_id,
  );
  preview.invoices.push(structuredClone(preview.invoice));
  validateOrderReceipt(
    preview,
    { company_id: preview.invoice.company_id, role, branch, actor },
    preview.invoice.order_id!,
    initialReceipt(preview.invoice),
  );
  return comparison;
}

export function applyPostedInvoiceOrder(
  state: DemoState,
  role: Role,
  branch: Branch,
  actor: string,
): void {
  if (state.invoice.order_id)
    applyInvoiceToOrder(
      state,
      { company_id: state.invoice.company_id, role, branch, actor },
      state.invoice.order_id,
      initialReceipt(state.invoice),
    );
}

export function invoiceOrderDifferences(
  state: DemoState,
  comparison: OrderComparison,
): InvoiceOrderDifference[] {
  const invoice = state.invoice;
  const order = linkedInvoiceOrder(state)!;
  const result: InvoiceOrderDifference[] = [];
  for (const row of comparison.lines) {
    const line = invoice.lines[row.invoice_line_index];
    const product = state.products.find(
      (item) =>
        item.company_id === invoice.company_id &&
        item.code === line.product_code,
    );
    const base = {
      invoice_line_index: row.invoice_line_index,
      order_line_id: row.order_line_id,
      product_code: line.product_code,
      name_en: product?.name_en ?? line.new_name_en ?? line.description,
      name_fa: product?.name_fa ?? line.new_name_fa,
    };
    if (row.short_units)
      result.push({
        ...base,
        kind: "short",
        units: row.short_units,
        decision:
          invoice.order_missing_decisions?.[row.order_line_id ?? ""] ?? "short",
      });
    if (row.extra_units)
      result.push({
        ...base,
        kind: "extra",
        units: row.extra_units,
        decision: line.extra_delivery_decision!,
      });
    if (row.price_changed)
      result.push({
        ...base,
        kind: line.short_dated ? "short_dated" : "price_change",
        previous_unit_cost: row.previous_unit_cost ?? undefined,
        new_unit_cost: row.new_unit_cost,
        previous_case_cost: row.previous_case_cost ?? undefined,
        new_case_cost: row.new_case_cost,
        expiry_date: line.short_dated ? line.date_value : undefined,
        decision:
          row.accepted_units > 0
            ? (line.order_price_decision ?? "accept")
            : "refuse",
      });
    else if (line.short_dated)
      result.push({
        ...base,
        kind: "short_dated",
        new_unit_cost: line.unit_cost_before_tax,
        expiry_date: line.date_value,
        decision: "short_dated",
      });
  }
  for (const row of comparison.residual) {
    const line = order.lines.find((item) => item.id === row.order_line_id)!;
    result.push({
      kind: "not_delivered",
      order_line_id: row.order_line_id,
      product_code: line.product_code,
      name_en: line.name_en,
      name_fa: line.name_fa,
      units: row.missing_units,
      decision: invoice.order_missing_decisions![row.order_line_id],
    });
  }
  return result;
}

export function shortOrderReceipt(
  state: DemoState,
  index: number,
  quantity: number,
  receipt: string,
): OrderReceiptInput | null {
  const orderLine = state.invoice.order_comparison?.lines.find(
    (row) => row.invoice_line_index === index,
  )?.order_line_id;
  if (!state.invoice.order_id || !orderLine) return null;
  return {
    invoice_id: state.invoice.id,
    event_key: `${state.invoice.id}:order:short:${index}:${receipt}`,
    kind: "short_delivery",
    lines: [
      {
        order_line_id: orderLine,
        invoice_line_index: index,
        accepted_units: quantity,
      },
    ],
    residual: [],
  };
}

export function validateShortOrderReceipt(
  state: DemoState,
  context: OperationsContext,
  input: OrderReceiptInput,
): void {
  validateOrderReceipt(state, context, state.invoice.order_id!, input);
}

export function applyShortOrderReceipt(
  state: DemoState,
  context: OperationsContext,
  input: OrderReceiptInput,
): void {
  applyInvoiceToOrder(state, context, state.invoice.order_id!, input);
}

/** Changing a receiving location or supplier invalidates the old order link. */
export function clearInvoiceOrder(invoice: DemoInvoice): void {
  invoice.order_id = undefined;
  invoice.order_review_version = undefined;
  invoice.order_comparison = undefined;
  invoice.order_missing_decisions = undefined;
  for (const line of invoice.lines) clearInvoiceOrderLine(line);
}

export function clearInvoiceOrderLine(line: InvoiceLine): void {
  line.order_item_id = undefined;
  line.extra_delivery_decision = undefined;
  line.order_price_decision = undefined;
  line.refused_units = 0;
  line.review_confirmed = false;
}
