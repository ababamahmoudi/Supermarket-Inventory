import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Bytes } from "./sha256";

const nativeDigest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

describe("portable FIPS 180-4 SHA-256 bytes", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
  ])("matches the published vector for %j", (text, expected) => {
    expect(sha256Bytes(new TextEncoder().encode(text))).toBe(expected);
  });

  it.each([1, 7, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 255, 4096])(
    "matches independent Node crypto at the %i-byte padding boundary",
    (length) => {
      const bytes = Uint8Array.from(
        { length },
        (_, index) => (index * 97) % 256,
      );
      expect(sha256Bytes(bytes)).toBe(nativeDigest(bytes));
    },
  );

  it("hashes real file-sized varied bytes and leaves the source unchanged", () => {
    const bytes = new Uint8Array(3 * 1024 * 1024);
    let seed = 731;
    for (let index = 0; index < bytes.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      bytes[index] = seed >>> 24;
    }
    const expected = nativeDigest(bytes);
    expect(sha256Bytes(bytes)).toBe(expected);
    expect(nativeDigest(bytes)).toBe(expected);
  });

  it("matches Node crypto for random inputs and offset byte views", () => {
    for (const length of [0, 33, 56, 64, 1000, 10007]) {
      const padded = randomBytes(length + 23);
      const view = new Uint8Array(
        padded.buffer,
        padded.byteOffset + 11,
        length,
      );
      const original = Buffer.from(padded);
      expect(sha256Bytes(view)).toBe(nativeDigest(view));
      expect(padded).toEqual(original);
    }
  });
});
