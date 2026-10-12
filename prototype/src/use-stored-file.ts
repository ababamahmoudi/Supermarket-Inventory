import { useEffect, useMemo, useState } from "react";
import {
  inlineFileBlob,
  isStoredFileReference,
  readStoredFile,
} from "./file-database";

export function useStoredFile(value: string | undefined, companyId: string) {
  const inline = useMemo(() => {
    if (!value?.startsWith("data:")) return {};
    try {
      return { source: inlineFileBlob(value) };
    } catch {
      return { error: true };
    }
  }, [value]);
  const [resolved, setResolved] = useState<{
    value?: string;
    url?: string;
    source?: Blob;
    size?: number;
    error?: boolean;
    companyId?: string;
  }>({});
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    if (!value || !isStoredFileReference(value)) return;
    void readStoredFile(value, companyId)
      .then((record) => {
        if (!active) return;
        url = URL.createObjectURL(record.preview);
        setResolved({
          value,
          url,
          source: record.source,
          size: record.source_size,
          companyId,
        });
      })
      .catch(() => {
        if (active) setResolved({ value, companyId, error: true });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [value, companyId]);
  if (!isStoredFileReference(value)) {
    return {
      url: value,
      source: inline.source,
      size: inline.source?.size,
      loading: false,
      error: Boolean(inline.error),
    };
  }
  const current =
    resolved.value === value && resolved.companyId === companyId
      ? resolved
      : {};
  return {
    url: current.url,
    source: current.source,
    size: current.size,
    loading: !current.url && !current.error,
    error: Boolean(current.error),
  };
}
