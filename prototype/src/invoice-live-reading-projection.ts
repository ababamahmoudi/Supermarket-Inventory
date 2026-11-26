import type {
  LiveInvoiceReading,
  LiveInvoiceReadingView,
} from "./invoice-live-reading-types";
import { businessAuditRead } from "./business-audit-read";

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
export function redactLiveReadingProvenance<T>(input: T): T {
  return redactLiveReadingValue(businessAuditRead(input));
}

function redactLiveReadingValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactLiveReadingValue) as T;
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const path = Array.isArray(record.path)
    ? record.path.map((part) =>
        typeof part === "string"
          ? part
          : part && typeof part === "object" && "key" in part
            ? String(part.key)
            : "",
      )
    : [];
  const wholeLiveRecord =
    path.at(-1) === "reading_record" &&
    [record.before, record.after, record.current, record.guards].some(
      (item) =>
        item &&
        typeof item === "object" &&
        "source" in item &&
        item.source === "live",
    );
  const diagnosticPatch =
    path.includes("reading_record") &&
    (wholeLiveRecord ||
      path.some((part) =>
        ["models", "model_details", "reading_cost_usd", "seconds"].includes(
          String(part),
        ),
      ));
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
      .map(([key, item]) => [key, redactLiveReadingValue(item)]),
  ) as T;
}
