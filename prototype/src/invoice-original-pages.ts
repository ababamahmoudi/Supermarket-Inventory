import type { DemoInvoice } from "./types";

export type InvoiceOriginalPage = NonNullable<
  DemoInvoice["original_pages"]
>[number];

/** An explicitly empty active list must never fall back to a removed original. */
export function activeInvoiceOriginalPages(
  invoice: DemoInvoice,
): InvoiceOriginalPage[] {
  if (Array.isArray(invoice.original_pages)) return invoice.original_pages;
  return invoice.file_data && invoice.file_name
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
}

/** Removed logical sources remain part of the saved invoice's original evidence. */
export function retainedInvoiceOriginalPages(
  invoice: DemoInvoice,
): InvoiceOriginalPage[] {
  return [
    ...activeInvoiceOriginalPages(invoice),
    ...(invoice.retained_original_pages ?? []),
  ];
}
