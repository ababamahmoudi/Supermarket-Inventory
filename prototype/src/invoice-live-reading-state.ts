import { freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { requireInvoiceAuthority } from "./invoice-authority";
import type { DemoInvoice, DemoState } from "./types";

export function liveReadingInvoice(state: DemoState, id: string): DemoInvoice {
  const invoice =
    state.invoice.id === id
      ? state.invoice
      : state.invoices?.find((record) => record.id === id);
  if (!invoice) throw new Error("Invoice was not found.");
  return invoice;
}

export function liveOriginalPages(invoice: DemoInvoice) {
  const pages = invoice.original_pages?.length
    ? invoice.original_pages
    : invoice.file_data && invoice.file_name
      ? [
          {
            file_name: invoice.file_name,
            file_type: invoice.file_type ?? "",
            file_data: invoice.file_data,
            file_size: invoice.file_size ?? 0,
            original_sha256: invoice.file_data.split(":").at(-1) ?? "",
          },
        ]
      : [];
  if (
    !pages.length ||
    pages.some(
      (page) =>
        !page.file_data.startsWith("idb-file:v1:") ||
        !/^[a-f\d]{64}$/i.test(page.original_sha256),
    )
  )
    throw new Error("The saved original is required.");
  return pages;
}

export function liveOriginalSignature(invoice: DemoInvoice): string {
  return JSON.stringify(liveOriginalPages(invoice));
}

export function liveContentSignature(invoice: DemoInvoice): string {
  const { live_reading: _live, ...content } = invoice;
  void _live;
  return JSON.stringify(content);
}

export function requireLiveInvoice(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
) {
  actor = freshActor(state, actor);
  actor = requireInvoiceAuthority(state, actor, "invoices.edit", id, true);
  requireInvoiceAuthority(state, actor, "invoices.cost_read", id);
  const invoice = liveReadingInvoice(state, id);
  if (
    invoice.company_id !== actor.company_id ||
    invoice.status === "posted" ||
    invoice.status === "empty"
  )
    throw new Error("The invoice is no longer an editable draft.");
  return { invoice, actor };
}

export function requireLiveReadingTarget(
  state: DemoState,
  actor: AuthenticatedActor,
  input: { invoice_id: string; attempt_id: string },
  mode: boolean | "settle" = false,
) {
  const manual = mode === true;
  const current = requireLiveInvoice(state, actor, input.invoice_id);
  const { invoice } = current;
  const live = invoice.live_reading;
  const guard = live?.authority;
  if (
    !live ||
    !guard ||
    guard.origin !== "local-reader-v1" ||
    live.attempt_id !== input.attempt_id ||
    (mode === "settle"
      ? !["ready", "processing", "failed", "cancelled"].includes(live.phase)
      : live.phase !== (manual ? "manual" : "processing")) ||
    (!manual && invoice.status !== "reading") ||
    (manual && invoice.entry_mode !== "manual") ||
    guard.user_id !== current.actor.user_id ||
    guard.session_id !== current.actor.session_id ||
    guard.authority_epoch !== current.actor.authority_epoch ||
    guard.person_version !== current.actor.person_version ||
    guard.branch !== invoice.branch ||
    guard.original_signature !== liveOriginalSignature(invoice) ||
    (!manual &&
      (guard.invoice_version !== (invoice.version ?? 1) ||
        guard.content_signature !== liveContentSignature(invoice)))
  )
    throw new Error("The reading attempt changed. Read the invoice again.");
  return current;
}

export function requireLiveManualInvoice(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
) {
  const invoice = liveReadingInvoice(state, id);
  return requireLiveReadingTarget(
    state,
    actor,
    { invoice_id: id, attempt_id: invoice.live_reading?.attempt_id ?? "" },
    true,
  ).actor;
}

export function canUseLiveManualInvoice(
  state: DemoState,
  actor: AuthenticatedActor | null,
  id: string,
): boolean {
  if (!actor) return false;
  try {
    requireLiveManualInvoice(state, actor, id);
    return true;
  } catch {
    return false;
  }
}
