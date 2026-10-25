import type { DemoInvoice } from "./types";

export type InvoiceListTab =
  | "drafts"
  | "processing"
  | "needs_review"
  | "ready_to_post"
  | "posted"
  | "cancelled";

/** Combine canonical records or already-authorized DTOs; this grants no access. */
export function invoiceRecords<
  Invoice extends { id: string; company_id: string },
>(
  state: { invoice: Invoice | null; invoices?: readonly Invoice[] },
  companyId: string,
): Invoice[] {
  const records = new Map<string, Invoice>();
  for (const invoice of [...(state.invoices ?? []), state.invoice])
    if (invoice?.company_id === companyId) records.set(invoice.id, invoice);
  return [...records.values()];
}

/** Counts and rows classify the same authorized invoice using the same checks. */
export function invoiceListStage(
  invoice: Pick<DemoInvoice, "id" | "status"> & {
    original_available?: boolean;
  },
  blockersById: Readonly<Record<string, readonly unknown[] | undefined>>,
): InvoiceListTab | null {
  if (invoice.status === "posted") return "posted";
  if (invoice.status === "reading") return "processing";
  if (
    invoice.status === "draft" ||
    (invoice.status === "empty" && invoice.original_available)
  )
    return "drafts";
  if (invoice.status !== "review") return null;
  return blockersById[invoice.id]?.length === 0
    ? "ready_to_post"
    : "needs_review";
}
