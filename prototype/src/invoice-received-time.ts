import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import { requireInvoiceAuthority } from "./invoice-authority";
import { invoiceRecords } from "./invoice-records";
import { importedReadingReceived } from "./invoice-reading-dates";
import { effectiveInvoiceLocation } from "./received";
import { createId } from "./ids";

import {
  effectiveInvoiceReceivedAt,
  type InvoiceReceivedCorrection,
} from "./invoice-received-version";

export function correctHandwrittenReceivedDate(
  state: DemoState,
  actor: AuthenticatedActor,
  invoiceId: string,
  expectedReceivedAt: string | undefined,
  now = new Date(),
): void {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.correct",
    invoiceId,
    true,
  );
  const invoice = invoiceRecords(state, actor.company_id).find(
    (record) => record.id === invoiceId && record.status === "posted",
  );
  if (!invoice) throw new Error("The posted invoice was not found.");
  const before = effectiveInvoiceReceivedAt(state, invoice);
  const candidate = importedReadingReceived(state.config, {
    invoice_date: invoice.invoice_date,
    handwritten_notes: invoice.import_handwritten_notes,
  });
  if (candidate.source !== "handwriting" || !candidate.received_at)
    throw new Error("A clear handwritten received date is required.");
  if (candidate.received_at === before) return;
  if (before !== expectedReceivedAt)
    throw new Error("The received date changed. Open the invoice again.");
  const id = createId("invoice-received-correction");
  const correction: InvoiceReceivedCorrection = {
    id,
    company_id: invoice.company_id,
    invoice_id: invoice.id,
    from_received_at: before ?? "",
    to_received_at: candidate.received_at,
    source: "handwriting",
    reason: "Use the received date handwritten on the original invoice.",
    by: actor.actor,
    actor_user_id: actor.user_id,
    at: now.toISOString(),
  };
  (state.invoice_received_corrections ??= []).push(correction);
  state.activity.push({
    id: `${id}:history`,
    company_id: invoice.company_id,
    branch: effectiveInvoiceLocation(state, invoice),
    action: "Correct invoice received date",
    by: actor.actor,
    actor_user_id: actor.user_id,
    actor_username: actor.username,
    actor_role_snapshot: actor.role,
    at: correction.at,
    device: "Prototype browser",
    reversible: false,
    entity_type: "invoice_received_correction",
    entity_id: invoice.id,
    before: { received_at: before },
    after: {
      received_at: candidate.received_at,
      source: correction.source,
      reason: correction.reason,
    },
  });
}
