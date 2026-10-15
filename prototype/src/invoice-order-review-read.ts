import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import type { OrderComparison } from "./orders";
import {
  invoiceView,
  type InvoiceReadDTO,
  type InvoiceLineView,
} from "./invoice-projections";
import {
  canInvoiceAuthority,
  requireInvoiceAuthority,
} from "./invoice-authority";
import {
  compatibleInvoiceOrders,
  currentInvoiceOrderComparison,
  linkedInvoiceOrder,
} from "./invoice-orders";
import { lowerPriceLineIndexes } from "./invoice";

export interface InvoiceOrderReviewRead {
  invoice: Omit<InvoiceReadDTO, "lines"> & {
    lines: (InvoiceLineView & { unit_cost_before_tax: string })[];
  };
  choices: { id: string; reference: string; date: string }[];
  order: {
    id: string;
    reference: string;
    supplier: string;
    version: number;
    lines: {
      id: string;
      name_en: string;
      name_fa: string;
      new_item?: boolean;
      new_item_association: boolean;
    }[];
  } | null;
  comparison: OrderComparison | null;
  lower_price_line_indices: number[];
  can_edit: boolean;
  fingerprint: string;
}

/** Only a currently permitted invoice-cost query can construct this read model. */
export function invoiceOrderReviewRead(
  state: DemoState,
  actor: AuthenticatedActor,
  invoiceId: string,
): InvoiceOrderReviewRead {
  requireInvoiceAuthority(state, actor, "invoices.cost_read", invoiceId);
  if (state.invoice.id !== invoiceId)
    throw new Error("Review an invoice in your allowed receiving location.");
  const view = invoiceView(state, actor, invoiceId);
  const invoice = {
    ...view,
    lines: view.lines.map((line, index) => ({
      ...line,
      unit_cost_before_tax: state.invoice.lines[index].unit_cost_before_tax,
    })),
  };
  const linked = linkedInvoiceOrder(state, actor);
  const order = linked
    ? {
        id: linked.id,
        reference: linked.reference,
        supplier: linked.supplier,
        version: linked.version,
        lines: linked.lines.map((line) => ({
          id: line.id,
          name_en: line.name_en,
          name_fa: line.name_fa,
          new_item: line.new_item,
          new_item_association: Boolean(line.new_item_association),
        })),
      }
    : null;
  const sourceComparison = currentInvoiceOrderComparison(state, actor);
  // Retained source records can contain unknown imported fields. Pick known evidence.
  const comparison = sourceComparison
    ? {
        order_id: sourceComparison.order_id,
        order_version: sourceComparison.order_version,
        lines: sourceComparison.lines.map((line) => ({
          invoice_line_index: line.invoice_line_index,
          order_line_id: line.order_line_id,
          expected_remaining_units: line.expected_remaining_units,
          delivered_units: line.delivered_units,
          accepted_units: line.accepted_units,
          extra_units: line.extra_units,
          short_units: line.short_units,
          previous_unit_cost: line.previous_unit_cost,
          new_unit_cost: line.new_unit_cost,
          price_changed: line.price_changed,
          old_units_per_case: line.old_units_per_case,
          new_units_per_case: line.new_units_per_case,
          previous_case_cost: line.previous_case_cost,
          new_case_cost: line.new_case_cost,
        })),
        residual: sourceComparison.residual.map((line) => ({
          order_line_id: line.order_line_id,
          expected_remaining_units: line.expected_remaining_units,
          received_units: line.received_units,
          missing_units: line.missing_units,
          missing_cases: line.missing_cases,
          absent: line.absent,
        })),
      }
    : null;
  const choices =
    state.invoice.status === "posted"
      ? []
      : compatibleInvoiceOrders(state, actor).map((candidate) => ({
          id: candidate.id,
          reference: candidate.reference,
          date: candidate.date,
        }));
  return {
    invoice,
    choices,
    order,
    comparison,
    lower_price_line_indices: lowerPriceLineIndexes(state, actor, true),
    can_edit:
      state.invoice.status !== "posted" &&
      canInvoiceAuthority(state, actor, "invoices.edit", invoiceId, true),
    fingerprint: JSON.stringify({ invoice, order, comparison }),
  };
}
