/** Browser-only evidence storage. Business JSON retains scoped content references,
 * never Blob URLs or base64. Sources are immutable; previews are disposable views. */
import { decodeHistoryStorage, encodeHistoryStorage } from "./history-storage";
export const FILE_DATABASE_NAME = "supermarket-prototype-files-v1";
export const FILE_DATABASE_VERSION = 1;
const FILE_PREFIX = "idb-file:v1:";
const PHOTO_MAX_SIDE = 2000;

export class FileStorageError extends Error {
  constructor(
    public readonly code:
      "unavailable" | "quota" | "integrity" | "image" | "scope" | "missing",
  ) {
    super(code);
    this.name = "FileStorageError";
  }
}
export interface StoredFileRecord {
  reference: string;
  company_id: string;
  name: string;
  type: string;
  source_size: number;
  sha256: string;
  source: Blob;
  preview: Blob;
  preview_width?: number;
  preview_height?: number;
  saved_at: string;
}
export interface FileBackupRecord {
  reference: string;
  company_id: string;
  storage_key: string;
  sha256: string;
  raw: Blob;
  saved_at: string;
}
/** The seam is used for failure/restore tests; browser proof uses real IndexedDB. */
export interface FileRepository {
  getFile(reference: string): Promise<StoredFileRecord | undefined>;
  putFile(record: StoredFileRecord): Promise<void>;
  getBackup(reference: string): Promise<FileBackupRecord | undefined>;
  putBackup(record: FileBackupRecord): Promise<void>;
}
function storageFailure(error: unknown): FileStorageError {
  if (error instanceof FileStorageError) return error;
  return new FileStorageError(
    error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "QuotaExceededError"
      ? "quota"
      : "unavailable",
  );
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new FileStorageError("unavailable"));
      return;
    }
    let stopped = false;
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(FILE_DATABASE_NAME, FILE_DATABASE_VERSION);
    } catch (error) {
      reject(storageFailure(error));
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("files"))
        database.createObjectStore("files", { keyPath: "reference" });
      if (!database.objectStoreNames.contains("backups"))
        database.createObjectStore("backups", { keyPath: "reference" });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (stopped) database.close();
      else resolve(database);
    };
    request.onerror = () => reject(storageFailure(request.error));
    request.onblocked = () => {
      stopped = true;
      reject(new FileStorageError("unavailable"));
    };
  });
}
async function transaction<T>(
  name: "files" | "backups",
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(name, mode);
      let result: T;
      let request: IDBRequest<T>;
      try {
        request = action(transaction.objectStore(name));
      } catch (error) {
        transaction.abort();
        reject(storageFailure(error));
        return;
      }
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () =>
        reject(storageFailure(transaction.error ?? request.error));
      transaction.onerror = () =>
        reject(storageFailure(transaction.error ?? request.error));
    });
  } finally {
    database.close();
  }
}
export const browserFileRepository: FileRepository = {
  getFile: (reference) =>
    transaction("files", "readonly", (store) => store.get(reference)),
  putFile: async (record) => {
    await transaction("files", "readwrite", (store) => store.put(record));
  },
  getBackup: (reference) =>
    transaction("backups", "readonly", (store) => store.get(reference)),
  putBackup: async (record) => {
    await transaction("backups", "readwrite", (store) => store.put(record));
  },
};
export function isStoredFileReference(value?: string): boolean {
  return Boolean(value?.startsWith(FILE_PREFIX));
}
function referenceCompany(reference: string): string | null {
  const match = /^idb-file:v1:([^:]+):[a-f0-9]{64}$/.exec(reference);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
export async function blobDigest(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new FileStorageError("unavailable");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function inlineFileBlob(value: string): Blob {
  const comma = value.indexOf(",");
  if (!value.startsWith("data:") || comma < 0)
    throw new FileStorageError("integrity");
  const metadata = value.slice(5, comma);
  const type = metadata.split(";")[0] || "application/octet-stream";
  const payload = value.slice(comma + 1);
  try {
    const bytes = metadata.includes(";base64")
      ? Uint8Array.from(atob(payload), (character) => character.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(payload));
    return new Blob([bytes], { type });
  } catch {
    throw new FileStorageError("integrity");
  }
}
async function photoPreview(
  source: Blob,
  legacy = false,
): Promise<{
  preview: Blob;
  width?: number;
  height?: number;
}> {
  if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(source.type))
    return { preview: source };
  const url = URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const target = new Image();
      target.onload = () => resolve(target);
      target.onerror = () => reject(new FileStorageError("image"));
      target.src = url;
    });
    const maximum = Math.max(image.naturalWidth, image.naturalHeight);
    if (!maximum) throw new FileStorageError("image");
    const ratio = Math.min(1, PHOTO_MAX_SIDE / maximum);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    if (ratio === 1) return { preview: source, width, height };
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new FileStorageError("image");
    context.drawImage(image, 0, 0, width, height);
    // Retain transparent logos/photos; preserve exact source separately for download.
    const type = source.type === "image/jpeg" ? "image/jpeg" : "image/png";
    const preview = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new FileStorageError("image")),
        type,
        0.88,
      ),
    );
    return { preview, width, height };
  } catch (error) {
    // Older corrupt/unsupported evidence still migrates losslessly and downloads;
    // never delete it merely because its preview cannot be decoded.
    if (legacy) return { preview: source };
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function retainFile(
  source: Blob,
  name: string,
  companyId: string,
  repository: FileRepository,
  legacy = false,
): Promise<StoredFileRecord> {
  if (!companyId) throw new FileStorageError("scope");
  const sha256 = await blobDigest(source);
  const reference = `${FILE_PREFIX}${encodeURIComponent(companyId)}:${sha256}`;
  const previous = await repository.getFile(reference);
  if (previous) {
    if (
      previous.company_id !== companyId ||
      previous.source_size !== source.size ||
      (await blobDigest(previous.source)) !== sha256
    )
      throw new FileStorageError("integrity");
    return previous;
  }
  const { preview, width, height } = await photoPreview(source, legacy);
  const record: StoredFileRecord = {
    reference,
    company_id: companyId,
    name,
    type: source.type,
    source_size: source.size,
    sha256,
    source,
    preview,
    preview_width: width,
    preview_height: height,
    saved_at: new Date().toISOString(),
  };
  await repository.putFile(record);
  // A successful request is insufficient: wait for transaction completion, then
  // read and hash the committed bytes before publishing a reference.
  const verified = await repository.getFile(reference);
  if (
    !verified ||
    verified.company_id !== companyId ||
    verified.source_size !== source.size ||
    (await blobDigest(verified.source)) !== sha256
  )
    throw new FileStorageError("integrity");
  return verified;
}
export async function storeUploadedFile(
  file: Blob & { name?: string },
  companyId: string,
  options: { purpose: "invoice" | "photo" | "logo" },
  repository: FileRepository = browserFileRepository,
): Promise<{ reference: string; name: string; type: string; size: number }> {
  const allowed =
    options.purpose === "invoice"
      ? /^(application\/pdf|image\/(png|jpeg|webp|gif))$/
      : /^image\/(png|jpeg|webp|gif)$/;
  if (!file.size || !allowed.test(file.type))
    throw new FileStorageError("image");
  const name = file.name ?? "file";
  try {
    const record = await retainFile(file, name, companyId, repository);
    return {
      reference: record.reference,
      name,
      type: file.type,
      size: file.size,
    };
  } catch (error) {
    throw storageFailure(error);
  }
}
export async function readStoredFile(
  reference: string,
  companyId: string,
  repository: FileRepository = browserFileRepository,
): Promise<StoredFileRecord> {
  if (referenceCompany(reference) !== companyId)
    throw new FileStorageError("scope");
  const record = await repository.getFile(reference);
  if (!record) throw new FileStorageError("missing");
  if (record.company_id !== companyId || record.reference !== reference)
    throw new FileStorageError("scope");
  if (
    record.source.size !== record.source_size ||
    !reference.endsWith(`:${record.sha256}`) ||
    (await blobDigest(record.source)) !== record.sha256
  )
    throw new FileStorageError("integrity");
  return record;
}

const assetKeys = new Set(["file_data", "photo", "logo_data"]);
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
/** Replace assets and matching History inverse values together. Historical-only
 * removed files are discovered by their reversal path, not just current records. */
export async function migrateInlineFiles<T>(
  input: T,
  companyId: string,
  repository: FileRepository = browserFileRepository,
): Promise<{ state: T; migrated: number }> {
  const files = new Map<
    string,
    { value: string; company: string; name: string }
  >();
  const key = (scope: string, value: string) => `${scope}\u0000${value}`;
  const collect = (node: unknown, scope: string) => {
    if (Array.isArray(node)) {
      node.forEach((entry) => collect(entry, scope));
      return;
    }
    if (!object(node)) return;
    const company =
      typeof node.company_id === "string" ? node.company_id : scope;
    const add = (value: unknown, name = "retained-file") => {
      if (typeof value === "string" && value.startsWith("data:"))
        files.set(key(company, value), { value, company, name });
    };
    for (const [property, value] of Object.entries(node)) {
      if (assetKeys.has(property))
        add(
          value,
          typeof node.file_name === "string" ? node.file_name : property,
        );
      collect(value, company);
    }
    if (
      Array.isArray(node.path) &&
      node.path.some((part) => typeof part === "string" && assetKeys.has(part))
    ) {
      add(node.before);
      add(node.after);
    }
  };
  collect(input, companyId);
  if (!files.size) return { state: input, migrated: 0 };
  const replacements = new Map<string, StoredFileRecord>();
  for (const [assetKey, file] of files) {
    const saved = await retainFile(
      inlineFileBlob(file.value),
      file.name,
      file.company,
      repository,
      true,
    );
    replacements.set(assetKey, saved);
  }
  const replace = (node: unknown, scope: string, asset = false): unknown => {
    if (typeof node === "string")
      return asset
        ? (replacements.get(key(scope, node))?.reference ?? node)
        : node;
    if (Array.isArray(node))
      return node.map((entry) => replace(entry, scope, asset));
    if (!object(node)) return node;
    const company =
      typeof node.company_id === "string" ? node.company_id : scope;
    const assetPath =
      Array.isArray(node.path) &&
      node.path.some((part) => typeof part === "string" && assetKeys.has(part));
    const result = Object.fromEntries(
      Object.entries(node).map(([property, value]) => [
        property,
        replace(
          value,
          company,
          assetKeys.has(property) ||
            (assetPath && (property === "before" || property === "after")),
        ),
      ]),
    );
    if (typeof node.file_data === "string" && "file_name" in node) {
      const record = replacements.get(key(company, node.file_data));
      if (record) result.file_size = record.source_size;
    }
    return result;
  };
  return { state: replace(input, companyId) as T, migrated: files.size };
}
export async function archiveFileStorageSnapshot(
  storageKey: string,
  raw: string,
  companyId: string,
  repository: FileRepository = browserFileRepository,
): Promise<string> {
  const blob = new Blob([raw], { type: "application/json" });
  const sha256 = await blobDigest(blob);
  const reference = `idb-backup:v1:${encodeURIComponent(companyId)}:${encodeURIComponent(storageKey)}:${sha256}`;
  const previous = await repository.getBackup(reference);
  if (!previous)
    await repository.putBackup({
      reference,
      company_id: companyId,
      storage_key: storageKey,
      sha256,
      raw: blob,
      saved_at: new Date().toISOString(),
    });
  const verified = await repository.getBackup(reference);
  if (
    !verified ||
    verified.company_id !== companyId ||
    (await verified.raw.text()) !== raw ||
    (await blobDigest(verified.raw)) !== sha256
  )
    throw new FileStorageError("integrity");
  return reference;
}
export async function readFileStorageBackup(
  reference: string,
  companyId: string,
  repository: FileRepository = browserFileRepository,
): Promise<string> {
  if (!reference.startsWith(`idb-backup:v1:${encodeURIComponent(companyId)}:`))
    throw new FileStorageError("scope");
  const backup = await repository.getBackup(reference);
  if (!backup || backup.company_id !== companyId)
    throw new FileStorageError("missing");
  if ((await blobDigest(backup.raw)) !== backup.sha256)
    throw new FileStorageError("integrity");
  return backup.raw.text();
}
/** Old verified migration backups can themselves fill Safari's text quota.
 * Preserve their exact raw bytes in IndexedDB before rewriting them with refs. */
export async function migrateLegacyFileBackups(
  storage: Pick<Storage, "length" | "key" | "getItem" | "setItem">,
  companyId: string,
  repository: FileRepository = browserFileRepository,
): Promise<number> {
  const keys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  ).filter((value): value is string =>
    Boolean(value?.startsWith("supermarket-prototype-before-")),
  );
  let count = 0;
  for (const storageKey of keys) {
    const raw = storage.getItem(storageKey);
    if (!raw) continue;
    let candidate: unknown;
    try {
      candidate = decodeHistoryStorage(JSON.parse(raw));
    } catch {
      continue;
    }
    const owner =
      object(candidate) &&
      object(candidate.config) &&
      object(candidate.config.company)
        ? candidate.config.company.seed_key
        : null;
    if (owner !== companyId) continue;
    const result = await migrateInlineFiles(candidate, companyId, repository);
    if (!result.migrated) continue;
    await archiveFileStorageSnapshot(storageKey, raw, companyId, repository);
    if (storage.getItem(storageKey) !== raw) continue;
    const rewritten = JSON.stringify(encodeHistoryStorage(result.state));
    storage.setItem(storageKey, rewritten);
    if (storage.getItem(storageKey) !== rewritten)
      throw new FileStorageError("integrity");
    count += result.migrated;
  }
  return count;
}
