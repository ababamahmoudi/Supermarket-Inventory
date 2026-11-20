/** A request key identifies one form submission; it never grants business authority. */
export function validPickupRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

/** Numbered retained papers keep their legacy identity; blank papers need a real request. */
export function pickupEvidenceKey(
  reference: string | undefined,
  requestId?: string,
): string | null {
  const paper = reference?.trim();
  if (paper) return `paper:${paper}`;
  return validPickupRequestId(requestId) ? `request:${requestId}` : null;
}
