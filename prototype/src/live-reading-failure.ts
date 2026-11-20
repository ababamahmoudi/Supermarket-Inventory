/** Closed diagnostic vocabulary. No reader text or payload is retained here. */
const failureFields = {
  address: undefined,
  images: undefined,
  network_or_cors: undefined,
  http: undefined,
  timeout: undefined,
  invalid_json: "response",
  invalid_envelope: "response",
  invalid_reading: "reading",
  invalid_items: "reading.lines",
  invalid_statuses: "statuses",
  invalid_checks_passed: "checksPassed",
  invalid_models: "models",
  invalid_model_id: "models[].id",
  invalid_seconds: "seconds",
  invalid_cost_usd: "costUSD",
  invalid_export: "reading",
  pdf_pages: undefined,
  pdf_selection: undefined,
  pdf_decode: undefined,
  image_decode: undefined,
  unsupported_file: undefined,
  empty: undefined,
  canvas: undefined,
  invoice_number: undefined,
  page_sha256: undefined,
  import: undefined,
  unknown: undefined,
} as const;

export type LiveReadingFailureReason = keyof typeof failureFields;
export interface LiveReadingFailure {
  reason: LiveReadingFailureReason;
  field?: Exclude<(typeof failureFields)[LiveReadingFailureReason], undefined>;
  status?: number;
}

/** Canonical commands and private reads copy only this explicit safe shape. */
export function normalizeLiveReadingFailure(
  value: unknown,
): LiveReadingFailure {
  if (
    !value ||
    typeof value !== "object" ||
    !("reason" in value) ||
    typeof value.reason !== "string" ||
    !Object.hasOwn(failureFields, value.reason)
  )
    throw new Error("The reading failure detail is invalid.");
  const reason = value.reason as LiveReadingFailureReason;
  const field = failureFields[reason];
  const status = "status" in value ? value.status : undefined;
  return {
    reason,
    ...(field ? { field } : {}),
    ...(reason === "http" &&
    typeof status === "number" &&
    Number.isSafeInteger(status) &&
    status >= 100 &&
    status <= 599
      ? { status }
      : {}),
  };
}

export function liveReadingFailure(
  reason: LiveReadingFailureReason,
  status?: number,
): LiveReadingFailure {
  return normalizeLiveReadingFailure({ reason, status });
}
