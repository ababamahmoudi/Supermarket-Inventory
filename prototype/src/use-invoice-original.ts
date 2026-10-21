import { useEffect, useMemo, useRef, useState } from "react";
import { useDemo } from "./store";
import { loadInvoiceOriginal } from "./invoice-file-access";
import type { InvoiceReadDTO } from "./invoice-projections";

/** Original bytes are loaded outside the authority lock, then revalidated. */
export function useInvoiceOriginal(invoice: InvoiceReadDTO, page = 0) {
  const {
    actor,
    can,
    query,
    authorityGeneration,
    businessRevision,
    authorityDirectoryVersion,
    locationSelection,
    locked,
  } = useDemo();
  const scope = {
    company_id: invoice.company_id,
    kind: "company_shared" as const,
    entity_id: invoice.id,
  };
  const permitted = Boolean(
    actor &&
    !locked &&
    invoice.original_available &&
    can("invoices.cost_read", scope),
  );
  const key = JSON.stringify([
    invoice.id,
    invoice.company_id,
    invoice.version,
    invoice.file_name,
    invoice.file_type,
    invoice.file_size,
    invoice.original_page_count,
    page,
    actor?.user_id,
    actor?.session_id,
    actor?.authority_epoch,
    actor?.person_version,
    authorityGeneration,
    businessRevision,
    authorityDirectoryVersion,
    locationSelection,
    permitted,
  ]);
  // A fresh request token prevents a previous key's bytes reappearing if that
  // same key returns after a denied/intermediate scope, before revalidation.
  const request = useMemo(() => ({ key }), [key]);
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  }, [query]);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    request: typeof request;
    url?: string;
    source?: Blob;
    size?: number;
    name?: string;
    type?: string;
    error?: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    if (!permitted) {
      return () => {
        active = false;
      };
    }
    void loadInvoiceOriginal(latest.current, {
      company_id: invoice.company_id,
      invoice_id: invoice.id,
      page,
    }).then(
      (record) => {
        if (!active) return;
        url = URL.createObjectURL(record.preview);
        setSnapshot({
          key,
          request,
          url,
          source: record.source,
          size: record.source_size,
          name: record.name,
          type: record.type,
        });
      },
      () => {
        if (active) setSnapshot({ key, request, error: true });
      },
    );
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, request, permitted, invoice.company_id, invoice.id, page]);
  const visible =
    snapshot?.key === key && snapshot.request === request && permitted
      ? snapshot
      : null;
  return {
    key,
    url: visible?.url,
    source: visible?.source,
    size: visible?.size,
    name: visible?.name,
    type: visible?.type,
    loading: permitted && !visible,
    error: Boolean(visible?.error),
  };
}
