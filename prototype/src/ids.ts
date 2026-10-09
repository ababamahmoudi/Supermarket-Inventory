let sequence = 0;

/** IDs for fictional local records also work on ordinary HTTP store computers. */
export function createId(prefix = "record"): string {
  if (typeof globalThis.crypto?.randomUUID === "function")
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
    return `${prefix}-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
