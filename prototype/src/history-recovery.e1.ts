/** Explicit private quarantine; no damaged raw History enters a public view. */
import type { DemoState, HistoryRecoveryMarker } from "./types";
import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import {
  archiveFileStorageSnapshot,
  browserFileRepository,
  readFileStorageBackup,
  type FileRepository,
} from "./file-database";
import { HistoryStorageError } from "./history-storage";
import { sha256Bytes } from "./sha256";

export const LEGACY_HISTORY_SOURCE_KEY = "supermarket-prototype-v1";
const digest = (raw: string) => sha256Bytes(new TextEncoder().encode(raw));
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
/** Validate source ownership before expanding unreadable History or saving bytes. */
export function parseLegacyCompanySource(raw: string, companyId: string) {
  const encoded: unknown = JSON.parse(raw);
  if (
    !object(encoded) ||
    !Object.hasOwn(encoded, "version") ||
    encoded.version !== 1 ||
    !Object.hasOwn(encoded, "config") ||
    !object(encoded.config) ||
    !Object.hasOwn(encoded.config, "company") ||
    !object(encoded.config.company) ||
    !Object.hasOwn(encoded.config.company, "seed_key") ||
    encoded.config.company.seed_key !== companyId
  )
    throw new Error("invalid_business_storage");
  return encoded;
}
function markerOf(state: DemoState): HistoryRecoveryMarker | undefined {
  const marker = state.prototype_e1_history_recovery;
  if (!marker) return undefined;
  const expectedReference = `idb-backup:v1:${encodeURIComponent(state.config.company.seed_key)}:${encodeURIComponent(LEGACY_HISTORY_SOURCE_KEY)}:${marker.source_sha256}`;
  if (
    marker.version !== 1 ||
    marker.source_key !== LEGACY_HISTORY_SOURCE_KEY ||
    !/^[a-f0-9]{64}$/.test(marker.source_sha256) ||
    marker.backup_reference !== expectedReference ||
    !["quarantined", "reset_committed"].includes(marker.phase)
  )
    throw new HistoryStorageError();
  return structuredClone(marker);
}
export function historyRecoveryStatus(state: DemoState) {
  const marker = markerOf(state);
  return {
    active: Boolean(marker),
    retirementPending: marker?.phase === "reset_committed",
  };
}
async function verifiedOriginal(
  company: string,
  marker: HistoryRecoveryMarker,
  repository: FileRepository,
): Promise<string> {
  const metadata = await repository.getBackup(marker.backup_reference);
  if (
    !metadata ||
    metadata.reference !== marker.backup_reference ||
    metadata.company_id !== company ||
    metadata.storage_key !== marker.source_key ||
    metadata.sha256 !== marker.source_sha256
  )
    throw new HistoryStorageError();
  const raw = await readFileStorageBackup(
    marker.backup_reference,
    company,
    repository,
  );
  if (digest(raw) !== marker.source_sha256) throw new HistoryStorageError();
  parseLegacyCompanySource(raw, company);
  return raw;
}
function unchangedLegacy(
  marker: HistoryRecoveryMarker,
  verifiedRaw: string,
  storage: Pick<Storage, "getItem">,
) {
  const current = storage.getItem(marker.source_key);
  if (current !== null && current !== verifiedRaw)
    throw new HistoryStorageError();
  return current;
}
/** First import only. Verify exact originals before persisting fictional data. */
export async function quarantineHistoryBusiness(
  fictionalState: DemoState,
  raw: string,
  storage: Pick<Storage, "getItem"> = localStorage,
  repository: FileRepository = browserFileRepository,
): Promise<DemoState> {
  const company = fictionalState.config.company.seed_key;
  parseLegacyCompanySource(raw, company);
  const marker: HistoryRecoveryMarker = {
    version: 1,
    source_key: LEGACY_HISTORY_SOURCE_KEY,
    source_sha256: digest(raw),
    backup_reference: await archiveFileStorageSnapshot(
      LEGACY_HISTORY_SOURCE_KEY,
      raw,
      company,
      repository,
    ),
    phase: "quarantined",
  };
  const verified = await verifiedOriginal(company, marker, repository);
  if (verified !== raw || storage.getItem(marker.source_key) !== raw)
    throw new HistoryStorageError();
  fictionalState.prototype_e1_history_recovery = marker;
  return fictionalState;
}
/** A rejected verification changes neither canonical state nor its directory. */
export async function prepareHistoryRecoveryReset(
  before: DemoState,
  replacement: DemoState,
  storage: Pick<Storage, "getItem"> = localStorage,
  repository: FileRepository = browserFileRepository,
): Promise<void> {
  const marker = markerOf(before);
  if (!marker) return;
  const raw = await verifiedOriginal(
    before.config.company.seed_key,
    marker,
    repository,
  );
  unchangedLegacy(marker, raw, storage);
  replacement.prototype_e1_history_recovery = {
    ...marker,
    phase: "reset_committed",
  };
}
interface ProtectedRecoveryAccess {
  query<T>(
    capability: Capability,
    resource: ResourceScope,
    project: (state: DemoState, actor: AuthenticatedActor) => T,
  ): Promise<T>;
  command<T>(
    capability: Capability,
    resource: ResourceScope,
    mutation: (state: DemoState, actor: AuthenticatedActor) => T,
  ): Promise<T>;
}
/**
 * Continue only the retirement authorized by an earlier successful Reset.
 * The current SDK command rechecks actor and marker after asynchronous backup
 * verification. Both the old text and marker remain until their own writes
 * succeed; exact immutable backup bytes survive a cross-store partial failure.
 */
export async function finishHistoryRecoveryReset(
  access: ProtectedRecoveryAccess,
  companyId: string,
  storage: Pick<Storage, "getItem" | "removeItem"> = localStorage,
  repository: FileRepository = browserFileRepository,
): Promise<void> {
  const resource = {
    company_id: companyId,
    kind: "company_shared" as const,
    mutation: true,
  };
  const selected = await access.query("demo.reset", resource, (state) => ({
    marker: markerOf(state),
    company: state.config.company.seed_key,
  }));
  if (!selected.marker || selected.marker.phase !== "reset_committed") return;
  const marker = selected.marker;
  const raw = await verifiedOriginal(selected.company, marker, repository);
  await access.command("demo.reset", resource, (state) => {
    const current = markerOf(state);
    if (
      !current ||
      current.phase !== "reset_committed" ||
      current.source_sha256 !== marker.source_sha256 ||
      current.backup_reference !== marker.backup_reference
    )
      throw new HistoryStorageError();
    const legacy = unchangedLegacy(current, raw, storage);
    if (legacy !== null) storage.removeItem(current.source_key);
    if (storage.getItem(current.source_key) !== null)
      throw new HistoryStorageError();
    delete state.prototype_e1_history_recovery;
  });
}
