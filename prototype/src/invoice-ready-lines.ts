import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import { requireInvoiceAuthority } from "./invoice-authority";
import {
  assertInvoiceLineConfirmable,
  confirmInvoiceLineChecks,
  visibleInvoiceCheckFields,
} from "./invoice-checks";
import { actualDate } from "./invoice";
import { invoiceLineCalculation } from "./invoice-weight";
import { createId } from "./ids";

/**
 * PR 29 (Ali, 2026-11-20): a line is ready when nothing is left to check —
 * no highlighted field, a category, and a selling price — and the ordinary
 * Confirm line checks would accept it.
 */
export function invoiceLineReady(state: DemoState, index: number): boolean {
  const line = state.invoice.lines[index];
  if (!line || line.review_confirmed) return false;
  if (visibleInvoiceCheckFields(line).length > 0) return false;
  const product = state.products.find(
    (row) =>
      row.company_id === state.invoice.company_id &&
      row.code === line.product_code,
  );
  const category = line.pricing_category || product?.pricing_category || "";
  if (!state.config.pricing_categories.some((item) => item.key === category))
    return false;
  if (line.date_tracking && !actualDate(line.date_value)) return false;
  try {
    const price =
      line.receiving_price?.price ??
      invoiceLineCalculation(line, category, state.config).selling_price;
    if (!price) return false;
  } catch {
    return false;
  }
  try {
    assertInvoiceLineConfirmable(state, index);
    return true;
  } catch {
    return false;
  }
}

export function readyInvoiceLineIndexes(state: DemoState): number[] {
  return state.invoice.lines.flatMap((_, index) =>
    invoiceLineReady(state, index) ? [index] : [],
  );
}

/** Confirms exactly the ready lines in one reversible, attributed change. */
export function confirmReadyInvoiceLines(
  state: DemoState,
  actor: AuthenticatedActor,
  expected: readonly number[],
): number[] {
  const current = requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  if (!["draft", "review"].includes(state.invoice.status))
    throw new Error("Choose a draft invoice.");
  const before = structuredClone(state.invoice);
  const confirmed: number[] = [];
  for (const index of expected) {
    if (!invoiceLineReady(state, index)) continue;
    confirmInvoiceLineChecks(state, current, index, true);
    confirmed.push(index);
  }
  if (!confirmed.length) return confirmed;
  state.activity.push({
    id: createId("invoice-ready-lines"),
    company_id: state.invoice.company_id,
    branch: state.invoice.branch,
    action: "Confirm ready invoice lines",
    by: current.actor,
    actor_user_id: current.user_id,
    actor_username: current.username,
    actor_role_snapshot: current.role,
    at: new Date().toISOString(),
    reversible: true,
    entity_type: "invoice",
    entity_id: state.invoice.id,
    before,
    after: structuredClone(state.invoice),
  });
  return confirmed;
}
