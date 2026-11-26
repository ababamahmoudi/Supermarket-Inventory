/** Retained invoices predate line identities; their original index remains a valid link. */
export function invoiceLineId(line: { id?: string }, index: number): string {
  return line.id ?? String(index);
}

export function invoiceLineHref(invoiceId: string, lineId: string): string {
  return `#invoices?id=${encodeURIComponent(invoiceId)}&line=${encodeURIComponent(lineId)}`;
}
