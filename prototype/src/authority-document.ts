import type {
  AuthorityInvalidation,
  AuthoritySnapshot,
  BusinessState,
  CommandIdentity,
  PersonRecord,
  RegisteredDevice,
  SessionRecord,
} from "./authority-types";

export interface CredentialRecord {
  company_id: string;
  user_id: string;
  password_verifier: string;
  password_salt: string;
  failed_attempts: number;
  locked_until?: string;
  version: number;
}
export interface SetupChallenge {
  id: string;
  company_id: string;
  user_id: string;
  code_verifier: string;
  code_salt: string;
  progress: "code" | "password" | "second_step" | "complete";
  created_at: string;
  created_by_user_id: string;
  consumed_at?: string;
  revoked_at?: string;
  setup_session_id?: string;
  failed_attempts?: number;
  locked_until?: string;
}
export interface DirectoryAuditEvent {
  id: string;
  company_id: string;
  actor_user_id: string;
  actor_role_snapshot: PersonRecord["role"];
  actor_name_snapshot: string;
  device_id?: string;
  entity_type: "person" | "device";
  entity_id: string;
  action: string;
  reason: string;
  at: string;
  before: PersonRecord | RegisteredDevice | null;
  after: PersonRecord | RegisteredDevice;
}
export interface AuthorityDocument {
  version: 1;
  company_id: string;
  directory_version: number;
  people: PersonRecord[];
  sessions: SessionRecord[];
  credentials: CredentialRecord[];
  setup_challenges: SetupChallenge[];
  devices: RegisteredDevice[];
  audit: DirectoryAuditEvent[];
  authentication_audit?: {
    id: string;
    company_id: string;
    user_id?: string;
    action: string;
    at: string;
    device_id?: string;
  }[];
}
export function snapshotOf(document: AuthorityDocument): AuthoritySnapshot {
  return structuredClone({
    version: document.version,
    company_id: document.company_id,
    directory_version: document.directory_version,
    people: document.people,
    sessions: document.sessions,
    devices: document.devices,
  });
}
export interface TransactionResult<T> {
  value: T;
  snapshot: AuthoritySnapshot;
}
export interface MutableAuthorityRepository {
  load(company_id: string): Promise<AuthoritySnapshot>;
  /** Private service primitive. Callback stays synchronous inside IDB lock. */
  transaction<T>(
    company_id: string,
    operation: (
      document: AuthorityDocument,
      currentBusiness: BusinessState,
    ) => T,
  ): Promise<TransactionResult<T>>;
  publishInvalidation(event: AuthorityInvalidation): void;
  subscribeInvalidation(
    listener: (event: AuthorityInvalidation) => void,
  ): () => void;
}
export function revokePersonSessions(
  document: AuthorityDocument,
  user_id: string,
  now: Date,
) {
  for (const session of document.sessions.filter(
    (s) => s.user_id === user_id,
  )) {
    session.state = "revoked";
    session.revoked_at ??= now.toISOString();
  }
  for (const challenge of document.setup_challenges.filter(
    (item) => item.user_id === user_id && item.progress !== "complete",
  ))
    challenge.revoked_at ??= now.toISOString();
}
export const identityForSession = (
  session: SessionRecord,
): CommandIdentity => ({
  company_id: session.company_id,
  session_id: session.id,
});
