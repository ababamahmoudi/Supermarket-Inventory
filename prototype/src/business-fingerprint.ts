import { sha256Bytes } from "./sha256";

/** The exact complete canonical value is compared without exposing its serialization. */
export function businessFingerprint(value: unknown): string {
  return `sha256:${sha256Bytes(new TextEncoder().encode(JSON.stringify(value)))}`;
}
