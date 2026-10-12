import { Blob as NodeBlob } from "node:buffer";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeHistoryStorage, encodeHistoryStorage } from "./history-storage";
import {
  archiveFileStorageSnapshot,
  blobDigest,
  inlineFileBlob,
  INCLUDED_COST_INVOICE_SHA256,
  migrateInlineFiles,
  migrateLegacyFileBackups,
  readFileStorageBackup,
  readStoredFile,
  storeUploadedFile,
  type FileBackupRecord,
  type FileRepository,
  type StoredFileRecord,
} from "./file-database";

class MemoryFiles implements FileRepository {
  files = new Map<string, StoredFileRecord>();
  backups = new Map<string, FileBackupRecord>();
  writes = 0;
  failFiles = false;
  failBackups = false;
  corruptFiles = false;
  async getFile(reference: string) {
    return this.files.get(reference);
  }
  async putFile(record: StoredFileRecord) {
    if (this.failFiles) throw new DOMException("Full", "QuotaExceededError");
    this.writes++;
    this.files.set(
      record.reference,
      this.corruptFiles
        ? { ...record, source: new Blob(["corrupt"], { type: record.type }) }
        : record,
    );
  }
  async getBackup(reference: string) {
    return this.backups.get(reference);
  }
  async putBackup(record: FileBackupRecord) {
    if (this.failBackups) throw new DOMException("Full", "QuotaExceededError");
    this.backups.set(record.reference, record);
  }
}
class TextStorage {
  data = new Map<string, string>();
  limit = Number.POSITIVE_INFINITY;
  get length() {
    return this.data.size;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    const next = new Map(this.data).set(key, value);
    const bytes = Array.from(next).reduce(
      (sum, [name, content]) => sum + (name.length + content.length) * 2,
      0,
    );
    if (bytes > this.limit)
      throw new DOMException("Full", "QuotaExceededError");
    this.data = next;
  }
}
const company = "company:one";
const pdf =
  "data:application/pdf;base64,JVBERi0xLjcKJUZpY3Rpb25hbCBkZW1vIGV2aWRlbmNl";
const svg =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctext%3E%D8%AF%D9%85%D9%88%3C%2Ftext%3E%3C%2Fsvg%3E";
const namedPdf = () =>
  Object.assign(
    new Blob(["%PDF-1.7\nExact original evidence\n"], {
      type: "application/pdf",
    }),
    { name: "original.pdf" },
  );
beforeEach(() => {
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => vi.unstubAllGlobals());

describe("scoped immutable browser evidence", () => {
  it.each([true, false])(
    "stores only the exact included invoice SVG and roundtrips its original/preview bytes (native hashing %s)",
    async (native) => {
      if (!native) vi.stubGlobal("crypto", {});
      const bytes = new Uint8Array(
        readFileSync("public/demo-originals/fictional-hw-5012.svg"),
      );
      expect(bytes.byteLength).toBe(3179);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        INCLUDED_COST_INVOICE_SHA256,
      );
      const repository = new MemoryFiles();
      // A rename does not change whether the exact approved bytes are recognised.
      const source = Object.assign(
        new Blob([bytes], { type: "image/svg+xml" }),
        {
          name: "renamed-original.svg",
        },
      );
      const saved = await storeUploadedFile(
        source,
        company,
        { purpose: "invoice" },
        repository,
      );
      expect(saved).toEqual({
        reference: `idb-file:v1:company%3Aone:${INCLUDED_COST_INVOICE_SHA256}`,
        name: "renamed-original.svg",
        type: "image/svg+xml",
        size: 3179,
      });
      const reloaded = await readStoredFile(
        saved.reference,
        company,
        repository,
      );
      expect(new Uint8Array(await reloaded.source.arrayBuffer())).toEqual(
        bytes,
      );
      expect(new Uint8Array(await reloaded.preview.arrayBuffer())).toEqual(
        bytes,
      );
      expect(reloaded.preview).toBe(reloaded.source);
      expect(reloaded.sha256).toBe(INCLUDED_COST_INVOICE_SHA256);
      expect(await blobDigest(reloaded.source)).toBe(
        INCLUDED_COST_INVOICE_SHA256,
      );
      expect(repository.writes).toBe(1);
      await expect(
        readStoredFile(saved.reference, "other-company", repository),
      ).rejects.toMatchObject({ code: "scope" });
    },
  );
  it("rejects unknown SVG with the included filename, a one-byte alteration, and the exact invoice SVG used as a photo or logo", async () => {
    const bytes = new Uint8Array(
      readFileSync("public/demo-originals/fictional-hw-5012.svg"),
    );
    const altered = bytes.slice();
    altered[altered.length - 1] ^= 1;
    const repository = new MemoryFiles();
    for (const source of [
      new Blob(
        [
          '<svg xmlns="http://www.w3.org/2000/svg"><text>Other original</text></svg>',
        ],
        { type: "image/svg+xml" },
      ),
      new Blob([altered], { type: "image/svg+xml" }),
    ])
      await expect(
        storeUploadedFile(
          Object.assign(source, { name: "fictional-hw-5012.svg" }),
          company,
          { purpose: "invoice" },
          repository,
        ),
      ).rejects.toMatchObject({ code: "image" });
    for (const purpose of ["photo", "logo"] as const)
      await expect(
        storeUploadedFile(
          Object.assign(new Blob([bytes], { type: "image/svg+xml" }), {
            name: "fictional-hw-5012.svg",
          }),
          company,
          { purpose },
          repository,
        ),
      ).rejects.toMatchObject({ code: "image" });
    expect(repository.writes).toBe(0);
    expect(repository.files.size).toBe(0);
  });
  it("keeps native SubtleCrypto hashing when available and propagates its failures", async () => {
    const source = namedPdf();
    const digest = vi.fn((algorithm: string, bytes: ArrayBuffer) =>
      webcrypto.subtle.digest(algorithm, bytes),
    );
    vi.stubGlobal("crypto", { subtle: { digest } });
    const expected = createHash("sha256")
      .update(new Uint8Array(await source.arrayBuffer()))
      .digest("hex");
    expect(await blobDigest(source)).toBe(expected);
    expect(digest).toHaveBeenCalledOnce();
    expect(digest.mock.calls[0][0]).toBe("SHA-256");
    expect(new Uint8Array(digest.mock.calls[0][1])).toEqual(
      new Uint8Array(await source.arrayBuffer()),
    );
    const failure = new DOMException("Native digest failed", "OperationError");
    digest.mockRejectedValueOnce(failure);
    await expect(blobDigest(source)).rejects.toBe(failure);
  });
  it("retains exact scoped files and verified backups without SubtleCrypto on HTTP LAN origins", async () => {
    vi.stubGlobal("crypto", {});
    const repository = new MemoryFiles();
    const source = namedPdf();
    const expected = createHash("sha256")
      .update(new Uint8Array(await source.arrayBuffer()))
      .digest("hex");
    const saved = await storeUploadedFile(
      source,
      company,
      { purpose: "invoice" },
      repository,
    );
    expect(saved.reference).toBe(`idb-file:v1:company%3Aone:${expected}`);
    expect(
      await (
        await readStoredFile(saved.reference, company, repository)
      ).source.text(),
    ).toBe(await source.text());
    const raw = JSON.stringify({ invoice: { file_data: saved.reference } });
    const backup = await archiveFileStorageSnapshot(
      "business",
      raw,
      company,
      repository,
    );
    expect(await readFileStorageBackup(backup, company, repository)).toBe(raw);
    expect(repository.backups.get(backup)?.sha256).toBe(
      createHash("sha256").update(raw).digest("hex"),
    );
    const record = repository.files.get(saved.reference)!;
    repository.files.set(saved.reference, {
      ...record,
      source: new Blob(["damaged original"], { type: record.type }),
    });
    await expect(
      readStoredFile(saved.reference, company, repository),
    ).rejects.toMatchObject({ code: "integrity" });
    await expect(
      readFileStorageBackup(backup, "other-company", repository),
    ).rejects.toMatchObject({ code: "scope" });
  });
  it("stores exact PDF source bytes, verifies them, deduplicates content and keeps refs small", async () => {
    const repository = new MemoryFiles();
    const source = namedPdf();
    const first = await storeUploadedFile(
      source,
      company,
      { purpose: "invoice" },
      repository,
    );
    const second = await storeUploadedFile(
      Object.assign(namedPdf(), { name: "copy.pdf" }),
      company,
      { purpose: "invoice" },
      repository,
    );
    expect(first.reference).toMatch(/^idb-file:v1:company%3Aone:[a-f0-9]{64}$/);
    expect(first.reference.length).toBeLessThan(128);
    expect(second.reference).toBe(first.reference);
    expect(second.name).toBe("copy.pdf");
    expect(repository.writes).toBe(1);
    const saved = await readStoredFile(first.reference, company, repository);
    expect(await saved.source.text()).toBe(await source.text());
    expect(await blobDigest(saved.source)).toBe(await blobDigest(source));
    expect(saved.preview).toBe(saved.source);
  });
  it("isolates identical content in two companies and denies foreign file/backup references", async () => {
    const repository = new MemoryFiles();
    const first = await storeUploadedFile(
      namedPdf(),
      company,
      { purpose: "invoice" },
      repository,
    );
    const second = await storeUploadedFile(
      namedPdf(),
      "another-company",
      { purpose: "invoice" },
      repository,
    );
    expect(first.reference).not.toBe(second.reference);
    await expect(
      readStoredFile(first.reference, "another-company", repository),
    ).rejects.toMatchObject({ code: "scope" });
    const backup = await archiveFileStorageSnapshot(
      "business",
      "exact old state",
      company,
      repository,
    );
    await expect(
      readFileStorageBackup(backup, "another-company", repository),
    ).rejects.toMatchObject({ code: "scope" });
  });
  it("never publishes a reference to a corrupt read-back or failed file write", async () => {
    const repository = new MemoryFiles();
    repository.corruptFiles = true;
    await expect(
      storeUploadedFile(
        namedPdf(),
        company,
        { purpose: "invoice" },
        repository,
      ),
    ).rejects.toMatchObject({ code: "integrity" });
    repository.corruptFiles = false;
    repository.failFiles = true;
    repository.files.clear();
    await expect(
      storeUploadedFile(
        namedPdf(),
        company,
        { purpose: "invoice" },
        repository,
      ),
    ).rejects.toMatchObject({ code: "quota" });
  });
  it("rejects missing, malformed and zero-byte uploads rather than storing dangling references", async () => {
    const repository = new MemoryFiles();
    await expect(
      readStoredFile("idb-file:v1:invalid", company, repository),
    ).rejects.toMatchObject({ code: "scope" });
    await expect(
      storeUploadedFile(
        new Blob([], { type: "application/pdf" }),
        company,
        { purpose: "invoice" },
        repository,
      ),
    ).rejects.toMatchObject({ code: "image" });
    await expect(
      storeUploadedFile(
        new Blob(["text"], { type: "text/plain" }),
        company,
        { purpose: "invoice" },
        repository,
      ),
    ).rejects.toMatchObject({ code: "image" });
  });
  it("detects damaged stored bytes after reload instead of presenting them as the retained original", async () => {
    const repository = new MemoryFiles();
    const saved = await storeUploadedFile(
      namedPdf(),
      company,
      { purpose: "invoice" },
      repository,
    );
    const record = repository.files.get(saved.reference)!;
    repository.files.set(saved.reference, {
      ...record,
      source: new Blob(["damaged original"], { type: "application/pdf" }),
    });
    await expect(
      readStoredFile(saved.reference, company, repository),
    ).rejects.toMatchObject({ code: "integrity" });
  });
});
describe("lossless legacy inline migration", () => {
  it("migrates invoice, logo and historical-only inverse/guard bytes together and is idempotent", async () => {
    const repository = new MemoryFiles();
    const original = {
      config: { company: { seed_key: company, logo_data: svg } },
      invoice: { company_id: company, file_name: "source.pdf", file_data: pdf },
      activity: [
        {
          company_id: company,
          reversal: [
            {
              path: ["config", "company", "logo_data"],
              before: svg,
              after: undefined,
              guards: [{ path: ["invoice", "file_data"], after: pdf }],
            },
          ],
        },
      ],
    };
    const migrated = await migrateInlineFiles(original, company, repository);
    expect(migrated.migrated).toBe(2);
    expect(original.invoice.file_data).toBe(pdf);
    expect(migrated.state.invoice.file_data).toMatch(/^idb-file:/);
    expect(migrated.state.activity[0].reversal[0].before).toBe(
      migrated.state.config.company.logo_data,
    );
    expect(migrated.state.activity[0].reversal[0].guards[0].after).toBe(
      migrated.state.invoice.file_data,
    );
    const source = await readStoredFile(
      migrated.state.invoice.file_data,
      company,
      repository,
    );
    expect(await source.source.text()).toBe(await inlineFileBlob(pdf).text());
    const second = await migrateInlineFiles(
      migrated.state,
      company,
      repository,
    );
    expect(second.migrated).toBe(0);
    expect(second.state).toBe(migrated.state);
    expect(repository.writes).toBe(2);
  });
  it("recovers a removed file that exists only in a History inverse", async () => {
    const repository = new MemoryFiles();
    const input = {
      activity: [
        {
          company_id: company,
          reversal: [{ path: ["invoice", "file_data"], before: pdf }],
        },
      ],
    };
    const result = await migrateInlineFiles(input, company, repository);
    expect(result.migrated).toBe(1);
    expect(result.state.activity[0].reversal[0].before).toMatch(/^idb-file:/);
    expect(input.activity[0].reversal[0].before).toBe(pdf);
  });
  it("preserves ordinary text and uses each record's real company scope", async () => {
    const repository = new MemoryFiles();
    const input = {
      note: svg,
      records: [
        { company_id: company, photo: svg },
        { company_id: "foreign", photo: svg },
      ],
    };
    const result = await migrateInlineFiles(input, company, repository);
    expect(result.state.records[0].photo).not.toBe(
      result.state.records[1].photo,
    );
    expect(result.state.note).toBe(svg);
    // Matching legacy inverse values are representation-migrated too; unrelated
    // data-looking prose is untouched when no asset field refers to it.
    expect(
      (await migrateInlineFiles({ note: pdf }, company, repository)).state.note,
    ).toBe(pdf);
    await expect(
      readStoredFile(result.state.records[1].photo, company, repository),
    ).rejects.toMatchObject({ code: "scope" });
  });
  it("archives an exact UTF-8 old state and restores its raw value byte for byte", async () => {
    const repository = new MemoryFiles();
    const raw = JSON.stringify({
      note: "نام شرکت · 🍞",
      invoice: { file_data: pdf },
    });
    const reference = await archiveFileStorageSnapshot(
      "supermarket-prototype-v1",
      raw,
      company,
      repository,
    );
    const restored = await readFileStorageBackup(
      reference,
      company,
      repository,
    );
    expect(restored).toBe(raw);
    expect(new TextEncoder().encode(restored)).toEqual(
      new TextEncoder().encode(raw),
    );
    expect(repository.backups.size).toBe(1);
    expect(
      await archiveFileStorageSnapshot(
        "supermarket-prototype-v1",
        raw,
        company,
        repository,
      ),
    ).toBe(reference);
  });
  it("does not rewrite an old inline backup if durable backup verification fails", async () => {
    const repository = new MemoryFiles();
    repository.failBackups = true;
    const storage = new TextStorage();
    const key = "supermarket-prototype-before-c4";
    const raw = JSON.stringify({
      config: { company: { seed_key: company } },
      invoice: { file_data: pdf },
    });
    storage.setItem(key, raw);
    await expect(
      migrateLegacyFileBackups(storage, company, repository),
    ).rejects.toThrow();
    expect(storage.getItem(key)).toBe(raw);
    expect(storage.getItem(key)).toContain("data:application/pdf");
  });
  it("shrinks the existing same-key backup under a full quota without duplicating it in text storage", async () => {
    const repository = new MemoryFiles();
    const storage = new TextStorage();
    const key = "supermarket-prototype-before-c4";
    const large = `data:application/pdf;base64,${btoa("Fictional source evidence ".repeat(10000))}`;
    const raw = JSON.stringify({
      config: { company: { seed_key: company } },
      invoice: { file_data: large },
    });
    storage.setItem(key, raw);
    storage.limit = (key.length + raw.length) * 2 + 2;
    expect(await migrateLegacyFileBackups(storage, company, repository)).toBe(
      1,
    );
    expect(storage.getItem(key)!.length).toBeLessThan(256);
    expect(storage.getItem(key)).not.toContain("data:");
    expect(
      await readFileStorageBackup(
        Array.from(repository.backups.keys())[0],
        company,
        repository,
      ),
    ).toBe(raw);
    expect(await migrateLegacyFileBackups(storage, company, repository)).toBe(
      0,
    );
  });
  it("expands encoded historical backup values before moving their retained inline files", async () => {
    const repository = new MemoryFiles();
    const storage = new TextStorage();
    const large = `data:application/pdf;base64,${btoa("Fictional retained evidence ".repeat(3000))}`;
    const state = {
      config: { company: { seed_key: company } },
      activity: [
        { company_id: company, after: { file_data: large } },
        { company_id: company, before: { file_data: large } },
      ],
    };
    const raw = JSON.stringify(encodeHistoryStorage(state));
    expect(raw).toContain("prototype_history_dictionary");
    expect(decodeHistoryStorage(JSON.parse(raw))).toEqual(state);
    storage.setItem("supermarket-prototype-before-c4", raw);
    expect(await migrateLegacyFileBackups(storage, company, repository)).toBe(
      1,
    );
    const decoded = decodeHistoryStorage(
      JSON.parse(storage.getItem("supermarket-prototype-before-c4")!),
    ) as typeof state;
    expect(decoded.activity[0].after!.file_data).toMatch(/^idb-file:v1:/);
    expect(decoded.activity[1].before!.file_data).toBe(
      decoded.activity[0].after!.file_data,
    );
    expect(
      await readFileStorageBackup(
        Array.from(repository.backups.keys())[0],
        company,
        repository,
      ),
    ).toBe(raw);
  });
});
