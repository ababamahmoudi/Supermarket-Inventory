import Decimal from "decimal.js";
import type { DemoState, InvoiceLine, DemoInvoice } from "./types";
import {
  compareInvoiceOrder,
  suggestOpenOrders,
  validateOrderReceipt,
  applyInvoiceToOrder,
  invoiceNewItemFingerprint,
  orderLineInvoiceQuantity,
  type Order,
  type OrderComparison,
  type OrderReceiptInput,
} from "./orders";
import { associatePostedSupplierItem } from "./supplier-items";
import type { AuthenticatedActor } from "./authority-types";
import { cloneWithAuthority, freshActor } from "./authority";
import { can } from "./permissions";
import { purchaseLocationScope } from "./purchase-authority";
import {
  canInvoiceAuthority,
  requireInvoiceAuthority,
} from "./invoice-authority";
import {
  invoicePurchaseEvidence,
  invoiceEvidenceActor,
  closePurchaseEvidence,
  type InternalPurchaseEvidence,
} from "./purchase-evidence.internal";

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
  actor: AuthenticatedActor | null,
): boolean {
  return canInvoiceAuthority(state, actor, "invoices.read", invoice.id);
}
export function compatibleInvoiceOrders(
  state: DemoState,
  actor: AuthenticatedActor,
): Order[] {
  const current = requireInvoiceAuthority(state, actor, "invoices.cost_read");
  return suggestOpenOrders(state, current, state.invoice);
}

export function linkedInvoiceOrder(
  state: DemoState,
  actor: AuthenticatedActor,
  invoice = state.invoice,
): Order | null {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.cost_read",
    invoice.id,
  );
  const canonical =
    invoice.id === state.invoice.id
      ? state.invoice
      : state.invoices?.find((record) => record.id === invoice.id);
  if (!canonical) return null;
  invoice = canonical;
  return (
    (state.orders ?? []).find(
      (order) =>
        order.id === invoice.order_id &&
        order.company_id === invoice.company_id &&
        can(
          state,
          actor,
          "invoices.cost_read",
          purchaseLocationScope(order.company_id, order.branch),
        ).allowed,
    ) ?? null
  );
}

export function currentInvoiceOrderComparison(
  state: DemoState,
  actor: AuthenticatedActor,
): OrderComparison | null {
  requireInvoiceAuthority(state, actor, "invoices.cost_read");
  const order = linkedInvoiceOrder(state, actor);
  if (!order) return null;
  if (state.invoice.status === "posted")
    return state.invoice.order_comparison ?? null;
  try {
    return compareInvoiceOrder(order, state.invoice);
  } catch {
    return null;
  }
}

export function setInvoiceOrder(
  state: DemoState,
  actor: AuthenticatedActor,
  orderId: string,
): void {
  if (
    !canInvoiceAuthority(
      state,
      actor,
      "invoices.edit",
      state.invoice.id,
      true,
    ) ||
    state.invoice.status === "posted"
  )
    throw new Error("Choose an invoice in your allowed receiving location.");
  const order = orderId
    ? compatibleInvoiceOrders(state, actor).find(
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
    const comparison = currentInvoiceOrderComparison(state, actor);
    for (const row of comparison?.lines ?? [])
      state.invoice.lines[row.invoice_line_index].order_item_id =
        row.order_line_id;
  }
}

export function setInvoiceExtraDecision(
  state: DemoState,
  actor: AuthenticatedActor,
  index: number,
  decision: "keep" | "refuse",
): void {
  if (
    !canInvoiceAuthority(
      state,
      actor,
      "invoices.edit",
      state.invoice.id,
      true,
    ) ||
    state.invoice.status === "posted" ||
    !["keep", "refuse"].includes(decision)
  )
    throw new Error(
      "Review the delivered invoice before choosing an extra-item decision.",
    );
  const comparison = currentInvoiceOrderComparison(state, actor);
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

/** Explicit reviewer choice; neither names nor product similarity select a temporary line. */
export function setInvoiceNewItemMatch(
  state: DemoState,
  actor: AuthenticatedActor,
  orderLineId: string,
  invoiceLineIndex: number | null,
): void {
  const invoice = state.invoice;
  const order = linkedInvoiceOrder(state, actor);
  if (
    !canInvoiceAuthority(state, actor, "invoices.edit", invoice.id, true) ||
    invoice.status === "posted" ||
    !order ||
    !compatibleInvoiceOrders(state, actor).some(
      (item) => item.id === order.id,
    ) ||
    invoice.order_review_version !== order.version
  )
    throw new Error("match");
  const temporary = order.lines.find(
    (line) => line.id === orderLineId && line.new_item,
  );
  if (!temporary || temporary.new_item_association) throw new Error("match");
  if (invoiceLineIndex === null) {
    for (const line of invoice.lines)
      if (line.order_new_item_match?.order_line_id === orderLineId)
        clearInvoiceOrderLine(line);
    invoice.order_missing_decisions = undefined;
    return;
  }
  const line = invoice.lines[invoiceLineIndex];
  if (
    !line ||
    line.company_id !== invoice.company_id ||
    (line.order_item_id && line.order_item_id !== orderLineId)
  )
    throw new Error("match");
  if (
    line.product_code === "NEW"
      ? !line.new_name_en?.trim()
      : !state.products.some(
          (product) =>
            product.company_id === invoice.company_id &&
            product.code === line.product_code &&
            product.status !== "archived",
        )
  )
    throw new Error("match");
  orderLineInvoiceQuantity(temporary, line);
  for (const item of invoice.lines)
    if (
      item !== line &&
      item.order_new_item_match?.order_line_id === orderLineId
    )
      clearInvoiceOrderLine(item);
  line.order_new_item_match = {
    order_line_id: orderLineId,
    order_version: order.version,
    invoice_line_index: invoiceLineIndex,
    product_code: line.product_code,
    supplier_item_code: line.supplier_item_code ?? "",
    units_per_case: line.units_per_case ?? 1,
    fingerprint: invoiceNewItemFingerprint(line, invoiceLineIndex),
  };
  line.order_item_id = orderLineId;
  line.review_confirmed = false;
  invoice.order_missing_decisions = undefined;
}

export type InvoiceOrderIssue = "order" | "order_decisions";
export function invoiceOrderIssues(
  state: DemoState,
  actor: AuthenticatedActor,
): InvoiceOrderIssue[] {
  requireInvoiceAuthority(state, actor, "invoices.read");
  const invoice = state.invoice;
  if (!invoice.order_id)
    return invoice.lines.some((line) => (line.refused_units ?? 0) > 0)
      ? ["order_decisions"]
      : [];
  const order = compatibleInvoiceOrders(state, actor).find(
    (record) => record.id === invoice.order_id,
  );
  if (!order || order.version !== invoice.order_review_version)
    return ["order"];
  try {
    const comparison = compareInvoiceOrder(order, invoice);
    const supplier = state.suppliers?.find(
      (item) =>
        item.id === order.supplier_id && item.company_id === invoice.company_id,
    );
    if (supplier && (!supplier.active || supplier.status !== "confirmed"))
      return ["order_decisions"];
    for (const row of comparison.lines) {
      const line = invoice.lines[row.invoice_line_index];
      const temporary = order.lines.find(
        (item) => item.id === row.order_line_id && item.new_item,
      );
      if (!temporary || temporary.new_item_association) continue;
      if (
        line.supplier_item_id &&
        state.supplier_items?.some(
          (item) =>
            item.id === line.supplier_item_id &&
            (item.company_id !== invoice.company_id ||
              item.supplier_id !== order.supplier_id ||
              item.archived ||
              item.product_code !== line.product_code ||
              item.supplier_item_code !== (line.supplier_item_code ?? "")),
        )
      )
        return ["order_decisions"];
    }
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
        accepted_units: new Decimal(
          invoice.lines[row.invoice_line_index].qty_received_at_posting,
        )
          .minus(invoice.lines[row.invoice_line_index].refused_units ?? 0)
          .toNumber(),
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
  actor: AuthenticatedActor,
): OrderComparison | null {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.post",
    state.invoice.id,
    true,
  );
  if (!state.invoice.order_id) return null;
  const issues = invoiceOrderIssues(state, actor);
  if (issues.length) throw new Error(issues.join(", "));
  const comparison = currentInvoiceOrderComparison(state, actor)!;
  const preview = cloneWithAuthority(state);
  const evidence = invoicePurchaseEvidence(
    preview,
    actor,
    preview.invoice.id,
    "invoice_post",
  );
  try {
    preview.invoice.status = "posted";
    preview.invoice.order_comparison = structuredClone(comparison);
    preview.invoices = (preview.invoices ?? []).filter(
      (invoice) =>
        invoice.id !== preview.invoice.id ||
        invoice.company_id !== preview.invoice.company_id,
    );
    preview.invoices.push(structuredClone(preview.invoice));
    for (const row of comparison.lines) {
      const temporary = preview.orders
        ?.find(
          (item) =>
            item.id === preview.invoice.order_id &&
            item.company_id === preview.invoice.company_id,
        )
        ?.lines.find(
          (line) =>
            line.id === row.order_line_id &&
            line.new_item &&
            !line.new_item_association,
        );
      const line = preview.invoice.lines[row.invoice_line_index];
      if (!temporary || row.accepted_units <= 0) continue;
      if (line.product_code === "NEW") {
        const existing = preview.products.find(
          (product) =>
            product.company_id === line.company_id &&
            product.name_en === line.new_name_en,
        );
        if (existing) line.product_code = existing.code;
        else continue;
      }
      associatePostedSupplierItem(
        preview,
        evidence,
        preview.invoice,
        row.invoice_line_index,
      );
    }
    validateOrderReceipt(
      preview,
      actor,
      preview.invoice.order_id!,
      initialReceipt(preview.invoice),
      evidence,
    );
    return comparison;
  } finally {
    closePurchaseEvidence(evidence);
  }
}

export function applyPostedInvoiceOrder(
  state: DemoState,
  actor: AuthenticatedActor,
  evidence: InternalPurchaseEvidence,
): void {
  const current = invoiceEvidenceActor(
    state,
    evidence,
    state.invoice.id,
    "invoice_post",
  );
  actor = freshActor(state, actor);
  if (
    actor.user_id !== current.user_id ||
    actor.session_id !== current.session_id
  )
    throw new Error("Invoice authority changed.");
  if (state.invoice.order_id) {
    const order = state.orders!.find(
      (item) =>
        item.id === state.invoice.order_id &&
        item.company_id === state.invoice.company_id,
    )!;
    const input = initialReceipt(state.invoice);
    validateOrderReceipt(state, actor, order.id, input, evidence);
    const already = order.receipts.some(
      (event) =>
        event.kind === "invoice" && event.invoice_id === state.invoice.id,
    );
    if (!already)
      for (const row of state.invoice.order_comparison?.lines ?? []) {
        const temporary = order.lines.find(
          (item) => item.id === row.order_line_id && item.new_item,
        );
        const line = state.invoice.lines[row.invoice_line_index];
        if (
          !temporary ||
          temporary.new_item_association ||
          row.accepted_units <= 0
        )
          continue;
        const item = associatePostedSupplierItem(
          state,
          evidence,
          state.invoice,
          row.invoice_line_index,
        );
        temporary.new_item_association = {
          invoice_id: state.invoice.id,
          invoice_line_index: row.invoice_line_index,
          product_code: line.product_code,
          supplier_item_id: item.id,
          supplier_item_code: item.supplier_item_code,
          units_per_case: line.units_per_case ?? 1,
          ordered_quantity: orderLineInvoiceQuantity(temporary, line),
          quantity_unit: line.source_quantity_unit ? "lb" : "units",
          ...(line.source_quantity_unit
            ? {
                case_weight: line.case_weight,
                case_weight_unit: line.case_weight_unit,
                weight_conversion_factor: line.weight_conversion_factor,
              }
            : {}),
          fingerprint: line.order_new_item_match!.fingerprint,
        };
      }
    applyInvoiceToOrder(
      state,
      actor,
      state.invoice.order_id,
      initialReceipt(state.invoice),
      evidence,
    );
  }
}

export function invoiceOrderDifferences(
  state: DemoState,
  actor: AuthenticatedActor,
  comparison: OrderComparison,
  evidence?: InternalPurchaseEvidence,
): InvoiceOrderDifference[] {
  if (evidence) {
    const current = invoiceEvidenceActor(
      state,
      evidence,
      state.invoice.id,
      "invoice_post",
    );
    actor = freshActor(state, actor);
    if (
      actor.user_id !== current.user_id ||
      actor.session_id !== current.session_id
    )
      throw new Error("Invoice authority changed.");
  } else requireInvoiceAuthority(state, actor, "invoices.cost_read");
  const invoice = state.invoice;
  const order = state.orders?.find(
    (item) =>
      item.id === invoice.order_id && item.company_id === invoice.company_id,
  );
  if (!order) throw new Error("order");
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
      units: row.missing_units ?? undefined,
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
  context: AuthenticatedActor,
  input: OrderReceiptInput,
  evidence: InternalPurchaseEvidence,
): void {
  validateOrderReceipt(
    state,
    context,
    state.invoice.order_id!,
    input,
    evidence,
  );
}

export function applyShortOrderReceipt(
  state: DemoState,
  context: AuthenticatedActor,
  input: OrderReceiptInput,
  evidence: InternalPurchaseEvidence,
): void {
  applyInvoiceToOrder(state, context, state.invoice.order_id!, input, evidence);
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
  line.order_new_item_match = undefined;
  line.extra_delivery_decision = undefined;
  line.order_price_decision = undefined;
  line.refused_units = 0;
  line.review_confirmed = false;
}
