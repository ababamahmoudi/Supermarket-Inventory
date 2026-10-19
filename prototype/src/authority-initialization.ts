import type {
  AuthoritySnapshot,
  BusinessState,
  PersonRecord,
  RegisteredDevice,
} from "./authority-types";
import type { AuthorityDocument, CredentialRecord } from "./authority-document";
import {
  BrowserAuthorityRepository,
  AuthorityStorageError,
} from "./authority-repository";
import { assertDirectoryLocationSafety } from "./authority-location-invariants";
import { credentialVerifier, randomToken } from "./credentials";
import { sha256Bytes } from "./sha256";

export const LEGACY_AUTH_STORAGE_KEY = "supermarket-prototype-auth-v2";
export interface ConfiguredDemoPerson {
  id: string;
  name_en: string;
  name_fa?: string;
  username: string;
  aliases: string[];
  phone?: string;
  email?: string;
  password: string;
  role: PersonRecord["role"];
  location_scope: PersonRecord["location_scope"];
  status: "active";
  setup: PersonRecord["setup"];
  demo_fixture: true;
}
export interface ConfiguredDemoDevice {
  id: string;
  name: string;
  location_id: string;
  active: boolean;
  version: number;
  registered_by_user_id: string;
}
export type LegacyPersonMetadata = Omit<PersonRecord, "company_id">;
interface LegacyAccount {
  password: string;
  mustChangePassword: boolean;
  failedAttempts: number;
  lockedUntil: number;
}
interface LegacyAuth {
  version: 2;
  accounts: Record<string, LegacyAccount>;
  preferences?: Record<string, unknown>;
  recentUsers?: string[];
  devicePreferences?: unknown;
  audit?: unknown[];
}
export interface AuthorityMigrationPreferences {
  by_user_id: Record<string, unknown>;
  recent_user_ids: string[];
  device_preferences?: unknown;
}
export interface AuthorityInitializationOptions {
  state: BusinessState;
  demo_users: readonly ConfiguredDemoPerson[];
  registered_computers: readonly ConfiguredDemoDevice[];
  legacy_auth_raw?: string | null;
  /** Actual retained metadata only. Unknown credential names cannot create role-bearing people. */
  legacy_people?: readonly LegacyPersonMetadata[];
  now?: Date;
}
const demoIds = new Set([
  "demo-person-owner",
  "demo-person-manager",
  "demo-person-rh-supervisor",
  "demo-person-ny-floor",
  "demo-person-wh-floor",
  "demo-person-cashier",
]);
const hashRaw = (raw: string) => sha256Bytes(new TextEncoder().encode(raw));
function parseLegacy(raw?: string | null): LegacyAuth | null {
  if (raw == null) return null;
  const parsed = JSON.parse(raw) as LegacyAuth;
  if (
    !parsed ||
    parsed.version !== 2 ||
    !parsed.accounts ||
    typeof parsed.accounts !== "object"
  )
    throw new Error(
      "Legacy account data is invalid; the original remains retained.",
    );
  for (const account of Object.values(parsed.accounts)) {
    if (
      !account ||
      typeof account.password !== "string" ||
      typeof account.mustChangePassword !== "boolean" ||
      !Number.isFinite(account.failedAttempts) ||
      !Number.isFinite(account.lockedUntil)
    )
      throw new Error(
        "Legacy account data is invalid; the original remains retained.",
      );
  }
  return parsed;
}
function credential(
  company_id: string,
  user_id: string,
  password: string,
  account?: LegacyAccount,
): CredentialRecord {
  const salt = randomToken();
  return {
    company_id,
    user_id,
    password_salt: salt,
    password_verifier: credentialVerifier(password, salt),
    failed_attempts: Math.max(0, Math.trunc(account?.failedAttempts ?? 0)),
    locked_until: account?.lockedUntil
      ? new Date(account.lockedUntil).toISOString()
      : undefined,
    version: 1,
  };
}
/** Pure prepared document: reset omits legacy options, normal initialization preserves known saved people/password intent. */
export function prepareAuthorityDocument(
  options: AuthorityInitializationOptions,
): {
  document: AuthorityDocument;
  preferences: AuthorityMigrationPreferences;
  mappedLegacyUsernames: readonly string[];
} {
  const { state } = options;
  const company_id = state.config.company.seed_key;
  const now = options.now ?? new Date(),
    at = now.toISOString();
  if (
    options.demo_users.length !== 6 ||
    options.demo_users.some((user) => !demoIds.has(user.id)) ||
    new Set(options.demo_users.map((user) => user.id)).size !== 6
  )
    throw new Error(
      "The configured demo must contain exactly the six stable people.",
    );
  const legacy = parseLegacy(options.legacy_auth_raw);
  const people: PersonRecord[] = [],
    credentials: CredentialRecord[] = [];
  const usernameToId = new Map<string, string>(),
    mappedLegacyUsernames: string[] = [];
  for (const fixture of options.demo_users) {
    const candidateNames = [fixture.username, ...fixture.aliases];
    const savedName = candidateNames.find((name) => legacy?.accounts[name]);
    const account = savedName ? legacy!.accounts[savedName] : undefined;
    const setup = structuredClone(fixture.setup);
    if (account?.mustChangePassword) {
      setup.password_complete = false;
      setup.second_step_complete = false;
      setup.second_step_method = undefined;
    }
    const person: PersonRecord = {
      id: fixture.id,
      company_id,
      name_en: fixture.name_en,
      name_fa: fixture.name_fa,
      username: fixture.username,
      aliases: [...fixture.aliases],
      phone: fixture.phone,
      email: fixture.email,
      role: fixture.role,
      location_scope: structuredClone(fixture.location_scope),
      status: setup.password_complete ? "active" : "invited",
      setup,
      authority_epoch: 1,
      version: 1,
      created_at: at,
      created_by_user_id: "demo-person-owner",
      demo_fixture: true,
    };
    people.push(person);
    credentials.push(
      credential(
        company_id,
        person.id,
        account?.password ?? fixture.password,
        account,
      ),
    );
    for (const name of candidateNames)
      usernameToId.set(name.toLowerCase(), person.id);
    if (savedName) mappedLegacyUsernames.push(savedName);
  }
  const retainedMetadata = [...(options.legacy_people ?? [])];
  // The one actual pre-E1 non-fixture seed is a known worker, never inferred from an arbitrary saved name.
  if (
    legacy?.accounts.newemployee &&
    !retainedMetadata.some((person) => person.username === "newemployee")
  )
    retainedMetadata.push({
      id: "legacy-person-newemployee",
      name_en: "Demo New Employee",
      username: "newemployee",
      aliases: [],
      role: "floor_worker",
      location_scope: { kind: "assigned", location_ids: ["Branch 1"] },
      status: "invited",
      setup: {
        password_complete: false,
        second_step_complete: false,
        simulated: true,
      },
      authority_epoch: 1,
      version: 1,
      created_at: at,
      created_by_user_id: "demo-person-owner",
      demo_fixture: false,
    });
  for (const retained of retainedMetadata) {
    if (
      people.some(
        (person) =>
          person.id === retained.id ||
          [person.username, ...person.aliases].includes(retained.username),
      )
    )
      continue;
    if (
      ![
        "owner",
        "manager",
        "branch_supervisor",
        "floor_worker",
        "cashier",
      ].includes(retained.role) ||
      !retained.id ||
      !retained.username
    )
      throw new Error("Retained person metadata is invalid.");
    const savedName = [retained.username, ...retained.aliases].find(
      (name) => legacy?.accounts[name],
    );
    const account = savedName ? legacy!.accounts[savedName] : undefined;
    const person = {
      ...structuredClone(retained),
      company_id,
      demo_fixture: false,
    };
    if (account) {
      person.setup.password_complete = !account.mustChangePassword;
      if (account.mustChangePassword) {
        person.setup.second_step_complete = false;
        person.setup.second_step_method = undefined;
      }
      if (person.status !== "deactivated")
        person.status =
          person.setup.password_complete &&
          (["floor_worker", "cashier"].includes(person.role) ||
            person.setup.second_step_complete)
            ? "active"
            : "invited";
      credentials.push(
        credential(company_id, person.id, account.password, account),
      );
      mappedLegacyUsernames.push(savedName!);
    }
    people.push(person);
    for (const name of [person.username, ...person.aliases])
      usernameToId.set(name.toLowerCase(), person.id);
  }
  const devices: RegisteredDevice[] = options.registered_computers.map(
    (device) => ({
      id: device.id,
      company_id,
      name: device.name,
      location_id: device.location_id,
      active: device.active,
      version: device.version,
      registered_at: at,
      registered_by_user_id: device.registered_by_user_id,
    }),
  );
  const document: AuthorityDocument = {
    version: 1,
    company_id,
    directory_version: 1,
    people,
    sessions: [],
    credentials,
    setup_challenges: [],
    devices,
    audit: [],
  };
  assertDirectoryLocationSafety(state, document);
  const names = new Set<string>();
  for (const person of people)
    for (const username of [person.username, ...person.aliases]) {
      const normalized = username.toLowerCase();
      if (names.has(normalized)) throw new Error("Retained usernames overlap.");
      names.add(normalized);
    }
  if (
    !people.some(
      (person) =>
        person.role === "owner" &&
        person.status === "active" &&
        person.setup.password_complete &&
        person.setup.second_step_complete,
    )
  )
    throw new Error("The initialized directory needs a usable Owner.");
  const by_user_id: Record<string, unknown> = {};
  for (const [username, preference] of Object.entries(
    legacy?.preferences ?? {},
  )) {
    const id = usernameToId.get(username.toLowerCase());
    if (id) by_user_id[id] = structuredClone(preference);
  }
  const recent_user_ids = [
    ...new Set(
      (legacy?.recentUsers ?? [])
        .map((username) => usernameToId.get(username.toLowerCase()))
        .filter((id): id is string => Boolean(id)),
    ),
  ].slice(0, 4);
  return {
    document,
    mappedLegacyUsernames,
    preferences: {
      by_user_id,
      recent_user_ids,
      device_preferences: structuredClone(legacy?.devicePreferences),
    },
  };
}

/** Retry presentation migration from the actual current directory, never seeded roles. */
function preferencesFromCurrentDirectory(
  document: AuthorityDocument,
  legacy: LegacyAuth | null,
): {
  preferences: AuthorityMigrationPreferences;
  credentialsVerified: boolean;
} {
  const names = new Map<string, Set<string>>();
  for (const person of document.people) {
    if (person.company_id !== document.company_id) continue;
    for (const name of [person.username, ...person.aliases]) {
      const normalized = name.trim().toLowerCase();
      const ids = names.get(normalized) ?? new Set<string>();
      ids.add(person.id);
      names.set(normalized, ids);
    }
  }
  const currentId = (username: string) => {
    const ids = names.get(username.trim().toLowerCase());
    return ids?.size === 1 ? [...ids][0] : undefined;
  };
  const preferences: AuthorityMigrationPreferences = {
    by_user_id: Object.fromEntries(
      Object.entries(legacy?.preferences ?? {}).flatMap(([username, value]) => {
        const id = currentId(username);
        return id ? [[id, structuredClone(value)]] : [];
      }),
    ),
    recent_user_ids: [
      ...new Set(
        (legacy?.recentUsers ?? [])
          .map(currentId)
          .filter((id): id is string => Boolean(id)),
      ),
    ].slice(0, 4),
    device_preferences: structuredClone(legacy?.devicePreferences),
  };
  const credentialsVerified = Object.entries(legacy?.accounts ?? {}).every(
    ([username, account]) => {
      const claimed = names.get(username.trim().toLowerCase());
      if (!claimed) return true; // Unknown originals remain in the verified archive.
      const id = currentId(username);
      if (!id) return false; // An ambiguous name never permits cleanup.
      const credentials = document.credentials.filter(
        (record) =>
          record.company_id === document.company_id && record.user_id === id,
      );
      return (
        credentials.length === 1 &&
        credentials[0].password_verifier ===
          credentialVerifier(account.password, credentials[0].password_salt)
      );
    },
  );
  return { preferences, credentialsVerified };
}

/** Archive/readback first. Existing authority only retries non-authoritative preferences. */
export async function initializeAuthority(
  repository: BrowserAuthorityRepository,
  options: AuthorityInitializationOptions,
): Promise<{
  snapshot: AuthoritySnapshot;
  preferences: AuthorityMigrationPreferences;
  migrated: boolean;
  may_remove_legacy_credentials: boolean;
}> {
  await repository.initializeBusiness(options.state);
  let existing: AuthoritySnapshot | null = null;
  try {
    existing = await repository.load(options.state.config.company.seed_key);
  } catch (error) {
    if (!(error instanceof AuthorityStorageError) || error.code !== "missing")
      throw error;
  }
  if (existing && options.legacy_auth_raw == null) {
    return {
      snapshot: existing,
      preferences: { by_user_id: {}, recent_user_ids: [] },
      migrated: false,
      may_remove_legacy_credentials: false,
    };
  }
  if (options.legacy_auth_raw != null) {
    const raw = options.legacy_auth_raw;
    await repository.archivePrivateBackup(
      {
        id: `legacy-auth:${options.state.config.company.seed_key}:${hashRaw(raw)}`,
        company_id: options.state.config.company.seed_key,
        source_key: LEGACY_AUTH_STORAGE_KEY,
        raw,
        sha256: hashRaw(raw),
        created_at: (options.now ?? new Date()).toISOString(),
      },
      hashRaw,
    );
  }
  if (!existing) {
    const prepared = prepareAuthorityDocument(options);
    await repository.initialize(prepared.document);
  }
  // Retry/concurrent initialization reads real current names and credentials.
  // It never recreates people, resets passwords, revives sessions or applies seed roles.
  const legacy = parseLegacy(options.legacy_auth_raw);
  const verification = await repository.transaction(
    options.state.config.company.seed_key,
    (document) => preferencesFromCurrentDirectory(document, legacy),
  );
  return {
    snapshot: verification.snapshot,
    preferences: verification.value.preferences,
    migrated: !existing,
    may_remove_legacy_credentials:
      options.legacy_auth_raw != null && verification.value.credentialsVerified,
  };
}
