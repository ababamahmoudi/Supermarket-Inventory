import { freshActor, AuthorityError } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { requireInvoiceAuthority } from "./invoice-authority";
import {
  liveContentSignature,
  liveOriginalSignature,
  liveReadingInvoice,
} from "./invoice-live-reading-state";
import { normalizeLiveReadingFailure } from "./live-reading-failure";
import type { DemoState } from "./types";

/** Diagnostics never enter ordinary invoice DTOs or general History exports. */
export function readLiveInvoiceFailure(
  state: DemoState,
  actor: AuthenticatedActor,
  invoiceId: string,
  expectedAttempt: string,
) {
  actor = freshActor(state, actor);
  if (actor.role !== "owner" && actor.role !== "manager")
    throw new AuthorityError("capability");
  requireInvoiceAuthority(state, actor, "invoices.read", invoiceId);
  requireInvoiceAuthority(state, actor, "invoices.cost_read", invoiceId);
  const invoice = liveReadingInvoice(state, invoiceId);
  const live = invoice.live_reading;
  if (
    invoice.company_id !== actor.company_id ||
    invoice.status !== "reading" ||
    live?.phase !== "failed" ||
    !expectedAttempt ||
    live.attempt_id !== expectedAttempt ||
    !live.authority ||
    live.authority.branch !== invoice.branch ||
    live.authority.invoice_version !== (invoice.version ?? 1) ||
    live.authority.original_signature !== liveOriginalSignature(invoice) ||
    live.authority.content_signature !== liveContentSignature(invoice)
  )
    throw new Error("The reading failure changed.");
  return live.failure_diagnostic
    ? normalizeLiveReadingFailure(live.failure_diagnostic)
    : null;
}
