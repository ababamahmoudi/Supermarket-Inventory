import type { AuthenticatedActor } from "./authority-types";
import { actorAudit } from "./domain-authority";
import {
  invoiceAuthorityScope,
  requireInvoiceAuthority,
} from "./invoice-authority";
import { requireCapability } from "./permissions";
import { createId } from "./ids";
import { liveContentSignature } from "./invoice-live-reading-state";
import type { DemoInvoice, DemoState } from "./types";

function invoiceById(state: DemoState, id: string): DemoInvoice {
  const invoice =
    state.invoice.id === id
      ? state.invoice
      : state.invoices?.find((item) => item.id === id);
  if (!invoice) throw new Error("The invoice changed. Open it again.");
  return invoice;
}

/** Default date/location fields alone are not entered invoice content. */
export function isEmptyInvoiceDraft(invoice: DemoInvoice): boolean {
  return (
    !invoice.lines.length &&
    !invoice.file_data &&
    !invoice.original_pages?.length &&
    !invoice.supplier.trim() &&
    !invoice.supplier_invoice_number.trim() &&
    !invoice.payment_terms?.trim() &&
    !invoice.supplier_tax_number?.trim() &&
    !invoice.due_date_manual &&
    !invoice.final_total_manual &&
    !invoice.other_charges?.length &&
    !invoice.order_id &&
    !invoice.order_reference &&
    !invoice.bill_to &&
    !invoice.ship_to &&
    !invoice.import_handwritten_notes?.length &&
    [invoice.subtotal, invoice.tax, invoice.final_total].every(
      (value) => !value?.trim() || /^0+(?:\.0+)?$/.test(value),
    )
  );
}

export function invoiceDiscardRead(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
) {
  requireInvoiceAuthority(state, actor, "invoices.edit", id, true);
  const invoice = invoiceById(state, id);
  if (invoice.status === "posted")
    throw new Error("Posted invoices cannot be discarded.");
  return { version: invoice.version ?? 1, empty: isEmptyInvoiceDraft(invoice) };
}

/** Retire a transport without changing its original uploader identity or source bytes. */
function retireReading(invoice: DemoInvoice, now: Date) {
  if (!invoice.live_reading || invoice.live_reading.phase === "complete")
    return;
  const manual = invoice.live_reading.phase === "manual";
  invoice.live_reading = {
    ...invoice.live_reading,
    phase: manual ? "manual" : "cancelled",
    attempt_id: createId("retired-reading"),
    completed_at: manual
      ? invoice.live_reading.completed_at
      : now.toISOString(),
  };
  const guard = invoice.live_reading.authority;
  if (guard) {
    guard.invoice_version = invoice.version ?? 1;
    // Discard/Undo never changes originals. Preserve their existing witness,
    // including an invalid witness that must not suddenly authorize a read.
    guard.content_signature = liveContentSignature(invoice);
  }
}

function publishRetained(state: DemoState, invoice: DemoInvoice) {
  const index =
    state.invoices?.findIndex(
      (item) =>
        item.id === invoice.id && item.company_id === invoice.company_id,
    ) ?? -1;
  if (index >= 0) state.invoices![index] = structuredClone(invoice);
  else (state.invoices ??= []).push(structuredClone(invoice));
  if (
    state.invoice.id === invoice.id &&
    state.invoice.company_id === invoice.company_id
  )
    state.invoice = invoice;
}

export function discardInvoice(
  state: DemoState,
  actor: AuthenticatedActor,
  input: { invoice_id: string; expected_version: number; reason: string },
  now = new Date(),
) {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    input.invoice_id,
    true,
  );
  const invoice = invoiceById(state, input.invoice_id);
  if (invoice.status === "posted")
    throw new Error("Posted invoices cannot be discarded.");
  if ((invoice.version ?? 1) !== input.expected_version)
    throw new Error("The invoice changed. Open Discard invoice again.");
  const empty = isEmptyInvoiceDraft(invoice);
  const reason = input.reason.trim() || (empty ? "Empty draft" : "");
  if (!reason) throw new Error("Add a reason for discarding this invoice.");
  const at = now.toISOString();
  const before = structuredClone(invoice);
  const attemptId = invoice.live_reading?.attempt_id;
  invoice.status = "cancelled";
  invoice.cancellation = {
    by_user_id: actor.user_id,
    by: actor.actor,
    at,
    reason,
  };
  invoice.version = (invoice.version ?? 1) + 1;
  retireReading(invoice, now);
  publishRetained(state, invoice);
  state.activity.push({
    id: createId("invoice-discard"),
    company_id: invoice.company_id,
    branch: invoice.branch,
    action: "Cancel invoice",
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at,
    device: "Browser",
    entity_type: "invoice",
    entity_id: invoice.id,
    before,
    after: structuredClone(invoice),
    reversible: true,
  });
  return { invoice_id: invoice.id, attempt_id: attemptId };
}

/** General conflict/authority-checked Undo invokes only this exact lifecycle hook. */
export function recoverDiscardedInvoice(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  priorVersion: number,
  now: Date,
) {
  // The exact history inverse restores the retained target first. Its active
  // workspace may still carry Cancelled, or may now be an unrelated invoice.
  const restored = state.invoices?.find(
    (item) => item.id === id && item.company_id === actor.company_id,
  );
  if (
    !restored ||
    restored.status === "posted" ||
    restored.status === "cancelled"
  )
    throw new Error("The discarded invoice could not be restored.");
  const scope = invoiceAuthorityScope(state, id, true);
  scope.status = restored.status;
  requireCapability(state, actor, "invoices.edit", scope);
  if (
    restored &&
    state.invoice.id === id &&
    state.invoice.company_id === actor.company_id
  )
    state.invoice = structuredClone(restored);
  const invoice = invoiceById(state, id);
  if (invoice.status === "posted" || invoice.status === "cancelled")
    throw new Error("The discarded invoice could not be restored.");
  invoice.version = priorVersion + 1;
  retireReading(invoice, now);
  publishRetained(state, invoice);
  return structuredClone(invoice);
}
