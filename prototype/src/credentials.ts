import { sha256Bytes } from "./sha256";
import type { PreparedSetupCode } from "./people";

/** Browser-demo verifier only. Future server uses its password hashing provider. */
export const credentialVerifier = (value: string, salt: string) =>
  sha256Bytes(
    new TextEncoder().encode(`prototype-credential-v1\0${salt}\0${value}`),
  );
export function randomToken(bytes = 16): string {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error("Secure random values are unavailable.");
  return Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function prepareSetupCode(): Promise<PreparedSetupCode> {
  const code = randomToken(12)
    .toUpperCase()
    .match(/.{1,4}/g)!
    .join("-");
  const salt = randomToken();
  return { code, salt, verifier: credentialVerifier(code, salt) };
}
export const newAuthorityId = (prefix: string) => `${prefix}-${randomToken()}`;
export interface PasswordPolicy {
  password_min_length: number;
  block_common_passwords: boolean;
}
const commonPasswords = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "qwertyuiop",
  "abcdefgh",
  "11111111",
  "00000000",
  "87654321",
  "iloveyou",
  "letmein123",
  "welcome1",
  "welcome123",
  "admin123",
  "admin1234",
  "demo1234",
  "temp1234",
  "supermarket",
  "changeme",
  "changeme123",
]);
export function validatePassword(
  password: string,
  policy: PasswordPolicy,
): "too_short" | "common" | undefined {
  if (password.length < policy.password_min_length) return "too_short";
  if (
    policy.block_common_passwords &&
    commonPasswords.has(password.toLowerCase())
  )
    return "common";
}
