import { Blob as NodeBlob } from "node:buffer";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { IDBFactory, IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveFileStorageSnapshot,
  browserFileRepository,
  FILE_DATABASE_NAME,
  FILE_DATABASE_VERSION,
  readFileStorageBackup,
  readStoredFile,
  storeUploadedFile,
  type FileBackupRecord,
  type StoredFileRecord,
} from "./file-database";

const company = "company:alpha";
const savedAt = "2026-10-19T12:34:56.789Z";
const sourceBytes = new Uint8Array([
  0, 255, 1, 128, 37, 80, 68, 70, 10, 0, 242,
]);
const previewBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 177]);
const unsupportedSharedBuffer: unknown = runInNewContext(
  "new SharedArrayBuffer(3)",
);
const rawBackup =
  '{\r\n  "note": "یادداشت 👋 e\u0301", "escaped": "\\u0000"\r\n}\r\n';
const storageKey = "business:before/receiving";
const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

function fileRecord(): StoredFileRecord {
  const sha256 = digest(sourceBytes);
  return {
    reference: `idb-file:v1:${encodeURIComponent(company)}:${sha256}`,
    company_id: company,
    name: "اصل-فاکتور.pdf",
    type: "application/pdf",
    source_size: sourceBytes.byteLength,
    sha256,
    source: new Blob([sourceBytes], { type: "application/pdf" }),
    preview: new Blob([previewBytes], { type: "image/png" }),
    preview_width: 320,
    preview_height: 180,
    saved_at: savedAt,
  };
}

function backupRecord(): FileBackupRecord {
  const sha256 = digest(rawBackup);
  return {
    reference: `idb-backup:v1:${encodeURIComponent(company)}:${encodeURIComponent(storageKey)}:${sha256}`,
    company_id: company,
    storage_key: storageKey,
    sha256,
    raw: new Blob([rawBackup], { type: "application/json" }),
    saved_at: savedAt,
  };
}

function containsBlob(value: unknown, seen = new Set<object>()): boolean {
  if (value instanceof Blob) return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (value instanceof Map)
    return [...value].some(([key, item]) =>
      [key, item].some((entry) => containsBlob(entry, seen)),
    );
  if (value instanceof Set)
    return [...value].some((entry) => containsBlob(entry, seen));
  return Object.values(value).some((entry) => containsBlob(entry, seen));
}

/** Model the observed WebKit rejection without changing the public adapter. */
function rejectBlobPuts() {
  const originalPut = FakeObjectStore.prototype.put;
  return vi
    .spyOn(FakeObjectStore.prototype, "put")
    .mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (containsBlob(value))
        throw new DOMException(
          "Error preparing Blob/File data to be stored in object store",
          "UnknownError",
        );
      return originalPut.call(this, value, key);
    });
}

async function rawRequest<T>(
  storeName: "files" | "backups",
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(FILE_DATABASE_NAME, FILE_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      for (const name of ["files", "backups"])
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: "reference" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      let result: T;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? request.error);
    });
  } finally {
    database.close();
  }
}

const rawGet = (store: "files" | "backups", reference: string) =>
  rawRequest<Record<string, unknown>>(store, "readonly", (table) =>
    table.get(reference),
  );
const rawPut = (store: "files" | "backups", value: unknown) =>
  rawRequest(store, "readwrite", (table) => table.put(value));

async function expectExactFile(record: StoredFileRecord) {
  expect(record).toMatchObject({
    reference: fileRecord().reference,
    company_id: company,
    name: "اصل-فاکتور.pdf",
    type: "application/pdf",
    source_size: sourceBytes.byteLength,
    sha256: digest(sourceBytes),
    preview_width: 320,
    preview_height: 180,
    saved_at: savedAt,
  });
  expect(record.source).toBeInstanceOf(Blob);
  expect(record.preview).toBeInstanceOf(Blob);
  expect(record.source.type).toBe("application/pdf");
  expect(record.preview.type).toBe("image/png");
  expect(new Uint8Array(await record.source.arrayBuffer())).toEqual(
    sourceBytes,
  );
  expect(new Uint8Array(await record.preview.arrayBuffer())).toEqual(
    previewBytes,
  );
  expect(record.preview).not.toBe(record.source);
  expect(record).not.toHaveProperty("binary_encoding");
  expect(record).not.toHaveProperty("source_mime_type");
  expect(record).not.toHaveProperty("preview_mime_type");
}

beforeEach(() => {
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(savedAt));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("real IndexedDB file adapter when WebKit rejects Blob/File puts", () => {
  it("retains exact nontext originals, distinct previews and UTF-8 backups in both stores", async () => {
    const guard = rejectBlobPuts();
    const original = fileRecord();
    await browserFileRepository.putFile(original);
    await expectExactFile(await readStoredFile(original.reference, company));
    const backupReference = await archiveFileStorageSnapshot(
      storageKey,
      rawBackup,
      company,
    );
    expect(backupReference).toBe(backupRecord().reference);
    expect(await readFileStorageBackup(backupReference, company)).toBe(
      rawBackup,
    );
    const backup = await browserFileRepository.getBackup(backupReference);
    expect(backup).toMatchObject({
      reference: backupRecord().reference,
      company_id: company,
      storage_key: storageKey,
      sha256: digest(rawBackup),
      saved_at: savedAt,
    });
    expect(backup!.raw).toBeInstanceOf(Blob);
    expect(backup!.raw.type).toBe("application/json");
    expect(Array.from(new Uint8Array(await backup!.raw.arrayBuffer()))).toEqual(
      Array.from(new TextEncoder().encode(rawBackup)),
    );
    expect(backup).not.toHaveProperty("binary_encoding");
    expect(backup).not.toHaveProperty("raw_mime_type");
    const storedFile = await rawGet("files", original.reference);
    const storedBackup = await rawGet("backups", backupReference);
    for (const record of [storedFile, storedBackup]) {
      expect(record.binary_encoding).toBe("array-buffer-v1");
      expect(containsBlob(record)).toBe(false);
    }
    expect(new Uint8Array(storedFile.source as ArrayBuffer)).toEqual(
      sourceBytes,
    );
    expect(new Uint8Array(storedFile.preview as ArrayBuffer)).toEqual(
      previewBytes,
    );
    expect(Array.from(new Uint8Array(storedBackup.raw as ArrayBuffer))).toEqual(
      Array.from(new TextEncoder().encode(rawBackup)),
    );
    expect(guard).toHaveBeenCalledTimes(2);

    const duplicate = await storeUploadedFile(
      Object.assign(new Blob([sourceBytes], { type: "application/pdf" }), {
        name: "renamed.pdf",
      }),
      company,
      { purpose: "invoice" },
    );
    expect(duplicate.reference).toBe(original.reference);
    expect(
      await archiveFileStorageSnapshot(storageKey, rawBackup, company),
    ).toBe(backupReference);
    expect(guard).toHaveBeenCalledTimes(2);
    expect(await rawGet("files", original.reference)).toEqual(storedFile);
    expect(await rawGet("backups", backupReference)).toEqual(storedBackup);
  });

  it("reads legacy Blob originals, previews and backups without rewriting either store", async () => {
    const original = fileRecord();
    const backup = backupRecord();
    await rawPut("files", original);
    await rawPut("backups", backup);
    const guard = rejectBlobPuts();
    await expectExactFile(await readStoredFile(original.reference, company));
    expect(await readFileStorageBackup(backup.reference, company)).toBe(
      rawBackup,
    );
    expect(
      await browserFileRepository.getBackup(backup.reference),
    ).toMatchObject({
      company_id: company,
      storage_key: storageKey,
      sha256: digest(rawBackup),
      saved_at: savedAt,
    });
    const retainedFile = await rawGet("files", original.reference);
    const retainedBackup = await rawGet("backups", backup.reference);
    expect(retainedFile).not.toHaveProperty("binary_encoding");
    expect(retainedBackup).not.toHaveProperty("binary_encoding");
    expect(retainedFile.source).toBeInstanceOf(Blob);
    expect(retainedFile.preview).toBeInstanceOf(Blob);
    expect(retainedBackup.raw).toBeInstanceOf(Blob);
    expect(guard).not.toHaveBeenCalled();
  });

  it("keeps the public shared source/preview Blob identity and content idempotency", async () => {
    const guard = rejectBlobPuts();
    const file = Object.assign(
      new Blob([sourceBytes], { type: "application/pdf" }),
      {
        name: "evidence.pdf",
      },
    );
    const first = await storeUploadedFile(file, company, {
      purpose: "invoice",
    });
    const saved = await readStoredFile(first.reference, company);
    expect(saved.preview).toBe(saved.source);
    expect(new Uint8Array(await saved.source.arrayBuffer())).toEqual(
      sourceBytes,
    );
    const wire = await rawGet("files", first.reference);
    expect(wire.source).toBe(wire.preview);
    expect(
      await storeUploadedFile(file, company, { purpose: "invoice" }),
    ).toEqual(first);
    expect(guard).toHaveBeenCalledOnce();
  });

  it("denies cross-company original and backup reads before accessing their records", async () => {
    rejectBlobPuts();
    const file = fileRecord();
    await browserFileRepository.putFile(file);
    const reference = await archiveFileStorageSnapshot(
      storageKey,
      rawBackup,
      company,
    );
    const readFile = vi.spyOn(browserFileRepository, "getFile");
    const readBackup = vi.spyOn(browserFileRepository, "getBackup");
    await expect(
      readStoredFile(file.reference, "company:other"),
    ).rejects.toMatchObject({
      code: "scope",
    });
    await expect(
      readFileStorageBackup(reference, "company:other"),
    ).rejects.toMatchObject({
      code: "scope",
    });
    expect(readFile).not.toHaveBeenCalled();
    expect(readBackup).not.toHaveBeenCalled();
  });

  it.each(["files", "backups"] as const)(
    "rejects altered encoded bytes in %s instead of publishing corrupted evidence",
    async (store) => {
      rejectBlobPuts();
      const file = fileRecord();
      const reference =
        store === "files"
          ? (await browserFileRepository.putFile(file), file.reference)
          : await archiveFileStorageSnapshot(storageKey, rawBackup, company);
      const wire = await rawGet(store, reference);
      const key = store === "files" ? "source" : "raw";
      const damaged = new Uint8Array(wire[key] as ArrayBuffer).slice();
      damaged[0] ^= 255;
      await rawPut(store, { ...wire, [key]: damaged.buffer });
      await expect(
        store === "files"
          ? readStoredFile(reference, company)
          : readFileStorageBackup(reference, company),
      ).rejects.toMatchObject({ code: "integrity" });
    },
  );

  it.each([
    ["files", "binary_encoding", "array-buffer-v999"],
    ["files", "binary_encoding", undefined],
    ["files", "source", new Uint8Array([1, 2])],
    ["files", "source", { byteLength: sourceBytes.byteLength }],
    ["files", "source", unsupportedSharedBuffer],
    ["files", "preview", undefined],
    ["files", "source_mime_type", 42],
    ["files", "preview_mime_type", "IMAGE/PNG"],
    ["backups", "binary_encoding", "array-buffer-v999"],
    ["backups", "binary_encoding", undefined],
    ["backups", "raw", "not binary bytes"],
    ["backups", "raw_mime_type", undefined],
  ] as const)(
    "fails closed for malformed %s field %s (%s)",
    async (store, key, invalid) => {
      rejectBlobPuts();
      const file = fileRecord();
      const reference =
        store === "files"
          ? (await browserFileRepository.putFile(file), file.reference)
          : await archiveFileStorageSnapshot(storageKey, rawBackup, company);
      const wire = await rawGet(store, reference);
      const malformed = { ...wire, [key]: invalid };
      // Missing the marker must not make encoded bytes pass as legacy Blobs.
      if (key === "binary_encoding" && invalid === undefined)
        delete malformed.binary_encoding;
      await rawPut(store, malformed);
      await expect(
        store === "files"
          ? browserFileRepository.getFile(reference)
          : browserFileRepository.getBackup(reference),
      ).rejects.toMatchObject({ code: "integrity" });
    },
  );
});
