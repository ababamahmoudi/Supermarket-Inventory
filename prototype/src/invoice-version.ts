import type { DemoInvoice, DemoState } from "./types";

export interface InvoiceVersion {
  version_id: string;
  invoice: DemoInvoice;
  reason?: string;
  by?: string;
  at?: string;
}

/** No transaction imports: receipt/date read models can resolve versions safely. */
export function invoiceContentVersions(
  state: DemoState,
  original: DemoInvoice,
): InvoiceVersion[] {
  const versions: InvoiceVersion[] = [
    { version_id: "original", invoice: original },
  ];
  let previous: string | undefined;
  for (const correction of state.invoice_content_corrections ?? []) {
    if (
      correction.company_id !== original.company_id ||
      correction.invoice_id !== original.id ||
      correction.previous_correction_id !== previous ||
      correction.after.id !== original.id ||
      correction.after.company_id !== original.company_id
    )
      continue;
    versions.push({
      version_id: correction.id,
      invoice: {
        ...correction.after,
        file_name: original.file_name,
        file_type: original.file_type,
        file_data: original.file_data,
      },
      reason: correction.reason,
      by: correction.by,
      at: correction.at,
    });
    previous = correction.id;
  }
  return versions;
}

function currentOperationalVersion(
  original: DemoInvoice,
  version: InvoiceVersion,
): InvoiceVersion {
  if (version.version_id === "original") return version;
  return {
    ...version,
    invoice: {
      ...version.invoice,
      short_receipt_keys: [...(original.short_receipt_keys ?? [])],
      lines: version.invoice.lines.map((line, index) => ({
        ...line,
        qty_later_received:
          original.lines[index]?.qty_later_received ?? line.qty_later_received,
      })),
    },
  };
}

export function effectiveInvoiceVersion(
  state: DemoState,
  original: DemoInvoice,
): DemoInvoice {
  return currentOperationalVersion(
    original,
    invoiceContentVersions(state, original).at(-1)!,
  ).invoice;
}

export function invoiceVersion(
  state: DemoState,
  original: DemoInvoice,
  versionId?: string | null,
): InvoiceVersion {
  const versions = invoiceContentVersions(state, original);
  const selected =
    versions.find((version) => version.version_id === versionId) ??
    versions.at(-1)!;
  return selected.version_id === versions.at(-1)!.version_id
    ? currentOperationalVersion(original, selected)
    : selected;
}
