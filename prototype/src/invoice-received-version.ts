import type { DemoInvoice, DemoState } from "./types";
import { invoiceRecords } from "./invoice-records";

export interface InvoiceReceivedCorrection {
  id: string;
  company_id: string;
  invoice_id: string;
  from_received_at: string;
  to_received_at: string;
  source: "handwriting";
  reason: string;
  by: string;
  actor_user_id: string;
  at: string;
}

/** A metadata correction never rewrites the original document or physical event. */
export function effectiveInvoiceReceivedAt(
  state: Pick<DemoState, "invoice_received_corrections">,
  invoice: Pick<DemoInvoice, "id" | "company_id" | "received_at">,
): string | undefined {
  let received = invoice.received_at;
  for (const correction of state.invoice_received_corrections ?? [])
    if (
      correction.company_id === invoice.company_id &&
      correction.invoice_id === invoice.id &&
      correction.from_received_at === (received ?? "")
    )
      received = correction.to_received_at;
  return received;
}

export function effectiveMovementReceivedAt(
  state: Pick<
    DemoState,
    "invoice" | "invoices" | "invoice_received_corrections"
  >,
  movement: Pick<
    NonNullable<DemoState["stock_movements"]>[number],
    "company_id" | "invoice_id" | "type" | "at"
  >,
): string {
  if (movement.type !== "received" || !movement.invoice_id) return movement.at;
  const invoice = invoiceRecords(state, movement.company_id).find(
    (record) => record.id === movement.invoice_id,
  );
  if (!invoice) return movement.at;
  const received = effectiveInvoiceReceivedAt(state, invoice);
  return received !== invoice.received_at
    ? (received ?? movement.at)
    : movement.at;
}
