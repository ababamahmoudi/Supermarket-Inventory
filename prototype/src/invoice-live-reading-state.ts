import { freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import {
  canInvoiceAuthority,
  requireInvoiceAuthority,
} from "./invoice-authority";
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
  mode: "processing" | "settle" = "processing",
) {
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
      : live.phase !== "processing") ||
    invoice.status !== "reading" ||
    guard.user_id !== current.actor.user_id ||
    guard.session_id !== current.actor.session_id ||
    guard.authority_epoch !== current.actor.authority_epoch ||
    guard.person_version !== current.actor.person_version ||
    guard.branch !== invoice.branch ||
    guard.original_signature !== liveOriginalSignature(invoice) ||
    guard.invoice_version !== (invoice.version ?? 1) ||
    guard.content_signature !== liveContentSignature(invoice)
  )
    throw new Error("The reading attempt changed. Read the invoice again.");
  return current;
}

export function requireLiveManualInvoice(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
) {
  const current = requireLiveManualOrigin(state, actor, id);
  if (
    current.invoice.live_reading?.phase !== "manual" ||
    current.invoice.entry_mode !== "manual"
  )
    throw new Error("This is not a saved live manual-entry fallback.");
  return current.actor;
}

function requireLiveManualOrigin(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
) {
  const current = requireLiveInvoice(state, actor, id);
  const live = current.invoice.live_reading;
  const guard = live?.authority;
  const ordinaryManual = canInvoiceAuthority(
    state,
    current.actor,
    "invoices.enter_manual",
    id,
    true,
  );
  if (
    !live?.attempt_id ||
    !guard ||
    guard.origin !== "local-reader-v1" ||
    guard.branch !== current.invoice.branch ||
    guard.original_signature !== liveOriginalSignature(current.invoice) ||
    (!ordinaryManual && guard.user_id !== current.actor.user_id)
  )
    throw new Error("The saved live manual-entry origin changed.");
  return current;
}

export function requireLiveManualTransition(
  state: DemoState,
  actor: AuthenticatedActor,
  input: { invoice_id: string; attempt_id: string },
) {
  const current = requireLiveManualOrigin(state, actor, input.invoice_id);
  const live = current.invoice.live_reading!;
  const guard = live.authority!;
  if (
    live.attempt_id !== input.attempt_id ||
    !["ready", "processing", "failed", "cancelled"].includes(live.phase) ||
    current.invoice.status !== "reading" ||
    guard.invoice_version !== (current.invoice.version ?? 1) ||
    guard.content_signature !== liveContentSignature(current.invoice)
  )
    throw new Error("The saved reading draft changed before manual entry.");
  return current;
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
