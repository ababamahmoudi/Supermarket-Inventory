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
    invoice.file_name,
    invoice.file_type,
    invoice.file_size,
    invoice.original_page_count,
    invoice.reading_record?.page_sha256s[page],
    page,
    actor?.user_id,
    actor?.session_id,
    actor?.authority_epoch,
    actor?.person_version,
    authorityGeneration,
    authorityDirectoryVersion,
    locationSelection,
    permitted,
  ]);
  const accessKey = JSON.stringify([
    invoice.id,
    invoice.company_id,
    page,
    actor?.user_id,
    actor?.session_id,
    actor?.authority_epoch,
    actor?.person_version,
    authorityGeneration,
    authorityDirectoryVersion,
    locationSelection,
    permitted,
  ]);
  // A fresh request token prevents a previous key's bytes reappearing if that
  // same key returns after a denied/intermediate scope, before revalidation.
  const request = useMemo(() => ({ key: accessKey }), [accessKey]);
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  }, [query]);
  const [snapshot, setSnapshot] = useState<{
    hash: string;
    request: typeof request;
    url?: string;
    source?: Blob;
    size?: number;
    name?: string;
    type?: string;
    error?: boolean;
  } | null>(null);
  const retained = useRef(snapshot);
  useEffect(() => {
    let active = true;
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
        const previous = retained.current;
        // Keep decoded image/PDF objects while the immutable bytes agree.
        if (previous?.request === request && previous.hash === record.sha256) {
          if (
            previous.name !== record.name ||
            previous.size !== record.source_size ||
            previous.type !== record.type
          ) {
            const refreshed = {
              ...previous,
              name: record.name,
              size: record.source_size,
              type: record.type,
            };
            retained.current = refreshed;
            setSnapshot(refreshed);
          }
          return;
        }
        const next = {
          hash: record.sha256,
          request,
          url: URL.createObjectURL(record.preview),
          source: record.source,
          size: record.source_size,
          name: record.name,
          type: record.type,
        };
        retained.current = next;
        setSnapshot(next);
      },
      () => {
        if (active) {
          const failure = { hash: "", request, error: true };
          retained.current = failure;
          setSnapshot(failure);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [
    key,
    request,
    permitted,
    invoice.company_id,
    invoice.id,
    page,
    businessRevision,
  ]);
  // Each URL survives a revalidation. Retire it only after its replacement has
  // committed, or on unmount; denied authority is masked synchronously below.
  useEffect(() => {
    const url = snapshot?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [snapshot?.url, request]);
  const visible = snapshot?.request === request && permitted ? snapshot : null;
  return {
    key: JSON.stringify([request.key, visible?.hash]),
    url: visible?.url,
    source: visible?.source,
    size: visible?.size,
    name: visible?.name,
    type: visible?.type,
    loading: permitted && !visible,
    error: Boolean(visible?.error),
  };
}
