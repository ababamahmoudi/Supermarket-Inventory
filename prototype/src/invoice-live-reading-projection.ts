import type {
  LiveInvoiceReading,
  LiveInvoiceReadingView,
} from "./invoice-live-reading-types";

export function projectLiveInvoiceReading(
  value: LiveInvoiceReading | undefined,
): LiveInvoiceReadingView | undefined {
  if (!value) return undefined;
  return {
    phase: value.phase,
    ...(value.attempt_id ? { attempt_id: value.attempt_id } : {}),
    ...(value.started_at ? { started_at: value.started_at } : {}),
    ...(value.completed_at ? { completed_at: value.completed_at } : {}),
  };
}

/** Also protects retained History snapshots and diagnostic-field patches. */
export function redactLiveReadingProvenance<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactLiveReadingProvenance) as T;
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const path = record.path;
  const diagnosticPatch =
    Array.isArray(path) &&
    path.includes("reading_record") &&
    path.some((part) =>
      ["models", "reading_cost_usd", "seconds"].includes(String(part)),
    );
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key, item]) => {
        if (
          diagnosticPatch &&
          ["before", "after", "current", "guards"].includes(key)
        )
          return false;
        return !(
          key === "reading_record" &&
          item &&
          typeof item === "object" &&
          "source" in item &&
          item.source === "live"
        );
      })
      .map(([key, item]) => [key, redactLiveReadingProvenance(item)]),
  ) as T;
}
