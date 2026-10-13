import type { CommandIdentity } from "./authority-types";
import type { AuthorityMigrationPreferences } from "./authority-initialization";

export const AUTH_PREFERENCES_KEY = "supermarket-prototype-preferences-v3";
export const AUTH_IDENTITY_KEY = "supermarket-prototype-session-v3";
export const COMPUTER_ID_KEY = "supermarket-prototype-computer-v1";
export const LANGUAGE_KEY = "supermarket-prototype-language-v3";
const LEGACY_SESSION_KEY = "supermarket-prototype-session-v2";
export type Theme = "light" | "dark";
export interface Preferences {
  theme: Theme;
  comfortableText: boolean;
  comfortableTextExplicit?: boolean;
}
export interface AuthPreferences {
  version: 3;
  by_user_id: Record<string, Preferences>;
  recent_user_ids: string[];
  device_preferences: Preferences;
}
export class PreferenceStorageError extends Error {
  readonly code = "preferences_storage";
  constructor() {
    super("preferences_storage");
  }
}
const validPreference = (value: unknown): value is Preferences => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Preferences>;
  return (
    Object.keys(item).every((key) =>
      ["theme", "comfortableText", "comfortableTextExplicit"].includes(key),
    ) &&
    (item.theme === "light" || item.theme === "dark") &&
    typeof item.comfortableText === "boolean" &&
    (item.comfortableTextExplicit === undefined ||
      typeof item.comfortableTextExplicit === "boolean")
  );
};
export function emptyPreferences(): AuthPreferences {
  return {
    version: 3,
    by_user_id: {},
    recent_user_ids: [],
    device_preferences: { theme: "light", comfortableText: false },
  };
}
export function readPreferences(
  storage: Storage = localStorage,
): AuthPreferences {
  const raw = storage.getItem(AUTH_PREFERENCES_KEY);
  if (!raw) return emptyPreferences();
  const saved: unknown = JSON.parse(raw);
  if (
    !saved ||
    typeof saved !== "object" ||
    (saved as { version?: number }).version !== 3
  )
    throw new PreferenceStorageError();
  const candidate = saved as Partial<AuthPreferences>;
  if (
    !candidate.by_user_id ||
    typeof candidate.by_user_id !== "object" ||
    Array.isArray(candidate.by_user_id) ||
    !validPreference(candidate.device_preferences) ||
    !Array.isArray(candidate.recent_user_ids) ||
    candidate.recent_user_ids.some((id) => typeof id !== "string")
  )
    throw new PreferenceStorageError();
  const preferences = emptyPreferences();
  for (const [id, value] of Object.entries(candidate.by_user_id)) {
    if (!validPreference(value)) throw new PreferenceStorageError();
    preferences.by_user_id[id] = { ...value };
  }
  if (validPreference(candidate.device_preferences))
    preferences.device_preferences = { ...candidate.device_preferences };
  preferences.recent_user_ids = Array.isArray(candidate.recent_user_ids)
    ? candidate.recent_user_ids
        .filter((id): id is string => typeof id === "string")
        .slice(0, 4)
    : [];
  return preferences;
}
/** Only the old presentation language is read; its role/location/SID is ignored. */
export function readLanguage(
  local: Storage = localStorage,
  session: Storage = sessionStorage,
): "en" | "fa" {
  const current = local.getItem(LANGUAGE_KEY);
  if (current === "en" || current === "fa") return current;
  const raw = session.getItem(LEGACY_SESSION_KEY);
  if (!raw) return "en";
  const legacy: unknown = JSON.parse(raw);
  return legacy &&
    typeof legacy === "object" &&
    "lang" in legacy &&
    legacy.lang === "fa"
    ? "fa"
    : "en";
}
/** Verify exact persistence before legacy credential cleanup is permitted. */
export function writePreferences(
  value: AuthPreferences,
  storage: Storage = localStorage,
) {
  const raw = JSON.stringify(value);
  storage.setItem(AUTH_PREFERENCES_KEY, raw);
  if (storage.getItem(AUTH_PREFERENCES_KEY) !== raw)
    throw new PreferenceStorageError();
}
export function adoptMigratedPreferences(
  migration: AuthorityMigrationPreferences,
  storage: Storage = localStorage,
) {
  const current = readPreferences(storage);
  for (const [id, preference] of Object.entries(migration.by_user_id))
    if (validPreference(preference) && !current.by_user_id[id])
      current.by_user_id[id] = { ...preference };
  if (
    !storage.getItem(AUTH_PREFERENCES_KEY) &&
    validPreference(migration.device_preferences)
  )
    current.device_preferences = { ...migration.device_preferences };
  current.recent_user_ids = [
    ...new Set([...current.recent_user_ids, ...migration.recent_user_ids]),
  ].slice(0, 4);
  writePreferences(current, storage);
  return current;
}
export function preferencesFor(
  state: AuthPreferences,
  personId: string | null,
): Preferences {
  return personId && state.by_user_id[personId]
    ? { ...state.by_user_id[personId] }
    : { ...state.device_preferences };
}
export function rememberRecentPerson(
  state: AuthPreferences,
  personId: string,
): AuthPreferences {
  return {
    ...state,
    recent_user_ids: [
      personId,
      ...state.recent_user_ids.filter((id) => id !== personId),
    ].slice(0, 4),
  };
}
export function readIdentity(
  storage: Storage = sessionStorage,
): CommandIdentity | null {
  const raw = storage.getItem(AUTH_IDENTITY_KEY);
  if (!raw) return null;
  const item: unknown = JSON.parse(raw);
  if (!item || typeof item !== "object") return null;
  const identity = item as Partial<CommandIdentity>;
  return typeof identity.company_id === "string" &&
    typeof identity.session_id === "string"
    ? { company_id: identity.company_id, session_id: identity.session_id }
    : null;
}
export function writeIdentity(
  identity: CommandIdentity | null,
  storage: Storage = sessionStorage,
) {
  if (identity) storage.setItem(AUTH_IDENTITY_KEY, JSON.stringify(identity));
  else storage.removeItem(AUTH_IDENTITY_KEY);
}
export function readComputerId(
  companyId: string,
  configuredDefault: string | null,
  storage: Storage = localStorage,
): string | null {
  const key = `${COMPUTER_ID_KEY}:${companyId}`;
  const stored = storage.getItem(key);
  if (stored) return stored;
  if (configuredDefault) storage.setItem(key, configuredDefault);
  return configuredDefault;
}
export function writeComputerId(
  companyId: string,
  deviceId: string | null,
  storage: Storage = localStorage,
) {
  const key = `${COMPUTER_ID_KEY}:${companyId}`;
  if (deviceId === null) storage.removeItem(key);
  else storage.setItem(key, deviceId);
}
