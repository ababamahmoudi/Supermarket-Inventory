import type {
  BusinessState,
  CommandIdentity,
  LocationSelection,
  PersonRecord,
  SessionRecord,
  SignInInput,
  SignInResult,
} from "./authority-types";
import {
  bindAuthoritySnapshot,
  configuredLocations,
  isCompanyRole,
  needsSecondStep,
  resolveActor,
} from "./authority";
import {
  snapshotOf,
  type AuthorityDocument,
  type CredentialRecord,
  type MutableAuthorityRepository,
  type SetupChallenge,
} from "./authority-document";
import {
  credentialVerifier,
  newAuthorityId,
  randomToken,
  validatePassword,
} from "./credentials";
import { resolveLocationSelection } from "./permissions";

export type AuthenticationErrorCode =
  | "invalid"
  | "locked"
  | "too_short"
  | "common"
  | "same_password"
  | "location"
  | "setup_session"
  | "second_step";
export class AuthenticationError extends Error {
  constructor(readonly code: AuthenticationErrorCode) {
    super(code);
    this.name = "AuthenticationError";
  }
}
interface AuthenticationPolicy {
  password_min_length: number;
  block_common_passwords: boolean;
  lockout_after_failed_attempts: number;
  lockout_minutes: number;
  simulated_authenticator_code?: string;
}
export interface AuthenticationDependencies {
  repository: MutableAuthorityRepository;
  now?: () => Date;
  createId?: (prefix: string) => string;
  currentDeviceId?: () => string | undefined;
}
const policyOf = (state: BusinessState): AuthenticationPolicy => ({
  password_min_length: 8,
  block_common_passwords: true,
  lockout_after_failed_attempts: 5,
  lockout_minutes: 15,
  ...(state.config.session as Partial<AuthenticationPolicy> | undefined),
});
function audit(
  document: AuthorityDocument,
  user_id: string | undefined,
  action: string,
  now: Date,
  id: (prefix: string) => string,
  device_id?: string,
) {
  document.authentication_audit ??= [];
  document.authentication_audit.push({
    id: id("authentication-audit"),
    company_id: document.company_id,
    user_id,
    action,
    at: now.toISOString(),
    device_id,
  });
}
function personAndSession(
  document: AuthorityDocument,
  identity: CommandIdentity,
) {
  if (document.company_id !== identity.company_id)
    throw new AuthenticationError("invalid");
  const session = document.sessions.find(
    (item) =>
      item.id === identity.session_id &&
      item.company_id === identity.company_id,
  );
  const person =
    session &&
    document.people.find(
      (item) =>
        item.id === session.user_id && item.company_id === identity.company_id,
    );
  if (
    !person ||
    !session ||
    person.status === "deactivated" ||
    session.state === "revoked" ||
    session.authority_epoch !== person.authority_epoch
  )
    throw new AuthenticationError("invalid");
  return { person, session };
}
function defaultSelection(
  state: BusinessState,
  document: AuthorityDocument,
  person: PersonRecord,
  device_id?: string,
): LocationSelection | null {
  const assigned =
    person.location_scope.kind === "assigned"
      ? new Set(person.location_scope.location_ids)
      : null;
  const locations = configuredLocations(state).filter(
    (location) =>
      location.active !== false &&
      (!assigned || assigned.has(location.id)) &&
      (person.role !== "cashier" || location.type !== "warehouse"),
  );
  const registered = document.devices.find(
    (device) =>
      device.id === device_id &&
      device.company_id === person.company_id &&
      device.active,
  );
  if (
    registered &&
    locations.some((location) => location.id === registered.location_id)
  )
    return { kind: "location", location_id: registered.location_id };
  if (locations.length === 1)
    return { kind: "location", location_id: locations[0].id };
  if (locations.length > 1)
    return {
      kind: isCompanyRole(person.role) ? "all_locations" : "all_my_locations",
    };
  return isCompanyRole(person.role) ? { kind: "all_locations" } : null;
}
function step(
  person: PersonRecord,
  session: SessionRecord,
): SignInResult["next"] {
  if (session.state === "locked") return "locked";
  if (!person.setup.password_complete) return "password";
  if (
    needsSecondStep(person.role) &&
    !person.setup.second_step_complete &&
    !person.setup.second_step_method
  )
    return "second_step_setup";
  if (needsSecondStep(person.role) && !session.second_step_verified_at)
    return "second_step_challenge";
  if (!session.selected_location) return "location";
  return "complete";
}
const resultOf = (
  person: PersonRecord,
  session: SessionRecord,
): SignInResult => ({
  identity: { company_id: person.company_id, session_id: session.id },
  person: structuredClone(person),
  next: step(person, session),
});
function finishIfReady(
  state: BusinessState,
  document: AuthorityDocument,
  person: PersonRecord,
  session: SessionRecord,
  now: Date,
) {
  if (
    !person.setup.password_complete ||
    (needsSecondStep(person.role) && !person.setup.second_step_complete)
  ) {
    session.state = "setup";
    return;
  }
  if (needsSecondStep(person.role) && !session.second_step_verified_at) {
    session.state = "second_step_challenge";
    return;
  }
  person.status = "active";
  session.selected_location ??= defaultSelection(
    state,
    document,
    person,
    session.device_id,
  );
  session.state = session.selected_location ? "active" : "location_required";
  if (session.state === "active") person.last_sign_in_at = now.toISOString();
}
function validateNotLocked(record: { locked_until?: string }, now: Date) {
  if (record.locked_until && Date.parse(record.locked_until) > now.getTime())
    throw new AuthenticationError("locked");
}
function failedAttempt(
  record: CredentialRecord | SetupChallenge,
  policy: AuthenticationPolicy,
  now: Date,
) {
  const expired =
    record.locked_until && Date.parse(record.locked_until) <= now.getTime();
  record.failed_attempts = expired ? 1 : (record.failed_attempts ?? 0) + 1;
  if (record.failed_attempts >= policy.lockout_after_failed_attempts) {
    record.locked_until = new Date(
      now.getTime() + policy.lockout_minutes * 60_000,
    ).toISOString();
    return "locked" as const;
  }
  return "invalid" as const;
}

export function createAuthenticationService(
  dependencies: AuthenticationDependencies,
) {
  const { repository } = dependencies;
  const clock = dependencies.now ?? (() => new Date());
  const id = dependencies.createId ?? newAuthorityId;
  const publish = (
    person: PersonRecord,
    document_version: number,
    reason: "session_locked" | "session_signed_out",
    session_id: string,
  ) =>
    repository.publishInvalidation({
      company_id: person.company_id,
      user_id: person.id,
      authority_epoch: person.authority_epoch,
      directory_version: document_version,
      reason,
      session_id,
    });
  return {
    async reauthenticate(
      identity: CommandIdentity,
      password: string,
    ): Promise<SignInResult> {
      const now = clock();
      const response = await repository.transaction(
        identity.company_id,
        (document, state) => {
          const { person, session } = personAndSession(document, identity);
          if (
            session.state !== "active" ||
            person.status !== "active" ||
            !person.setup.password_complete ||
            (needsSecondStep(person.role) &&
              (!person.setup.second_step_complete ||
                !session.second_step_verified_at))
          )
            throw new AuthenticationError("invalid");
          const credential = document.credentials.find(
            (item) =>
              item.user_id === person.id &&
              item.company_id === person.company_id,
          );
          if (!credential) throw new AuthenticationError("invalid");
          validateNotLocked(credential, now);
          if (
            credential.password_verifier !==
            credentialVerifier(password, credential.password_salt)
          ) {
            audit(
              document,
              person.id,
              "Failed sign-in",
              now,
              id,
              session.device_id,
            );
            return { error: failedAttempt(credential, policyOf(state), now) };
          }
          credential.failed_attempts = 0;
          credential.locked_until = undefined;
          session.authenticated_at = now.toISOString();
          audit(
            document,
            person.id,
            "Confirmed password",
            now,
            id,
            session.device_id,
          );
          return { result: resultOf(person, session) };
        },
      );
      if ("error" in response.value && response.value.error)
        throw new AuthenticationError(response.value.error);
      return response.value.result!;
    },
    async signIn(input: SignInInput): Promise<SignInResult> {
      const now = clock();
      const response = await repository.transaction(
        input.company_id,
        (document, state) => {
          const username = input.username.trim().toLowerCase();
          const person = document.people.find(
            (item) =>
              item.company_id === input.company_id &&
              [item.username, ...item.aliases].some(
                (name) => name.toLowerCase() === username,
              ),
          );
          if (!person || person.status === "deactivated")
            return { error: "invalid" as const };
          const policy = policyOf(state);
          const credential = document.credentials.find(
            (item) =>
              item.user_id === person.id &&
              item.company_id === person.company_id,
          );
          const challenge = document.setup_challenges
            .filter(
              (item) =>
                item.user_id === person.id &&
                item.company_id === person.company_id &&
                !item.revoked_at,
            )
            .at(-1);
          const guard = credential ?? challenge;
          if (guard) validateNotLocked(guard, now);
          const passwordValid =
            credential &&
            credential.password_verifier ===
              credentialVerifier(
                input.password_or_setup_code,
                credential.password_salt,
              );
          const codeValid =
            !credential &&
            challenge &&
            !challenge.consumed_at &&
            challenge.progress === "code" &&
            challenge.code_verifier ===
              credentialVerifier(
                input.password_or_setup_code,
                challenge.code_salt,
              );
          if (!passwordValid && !codeValid) {
            audit(
              document,
              person.id,
              "Failed sign-in",
              now,
              id,
              input.device_id,
            );
            return {
              error: guard
                ? failedAttempt(guard, policy, now)
                : ("invalid" as const),
            };
          }
          if (guard) {
            guard.failed_attempts = 0;
            guard.locked_until = undefined;
          }
          const session: SessionRecord = {
            id: id("session"),
            company_id: person.company_id,
            user_id: person.id,
            authority_epoch: person.authority_epoch,
            state: "setup",
            authenticated_at: now.toISOString(),
            selected_location: defaultSelection(
              state,
              document,
              person,
              input.device_id,
            ),
            device_id: input.device_id,
          };
          if (codeValid && challenge) {
            challenge.consumed_at = now.toISOString();
            challenge.progress = "password";
            challenge.setup_session_id = session.id;
          }
          document.sessions.push(session);
          finishIfReady(state, document, person, session, now);
          audit(document, person.id, "Signed in", now, id, input.device_id);
          return { result: resultOf(person, session) };
        },
      );
      if ("error" in response.value && response.value.error)
        throw new AuthenticationError(response.value.error);
      return response.value.result!;
    },
    async resume(identity: CommandIdentity): Promise<SignInResult | null> {
      const response = await repository.transaction(
        identity.company_id,
        (document) => {
          try {
            const { person, session } = personAndSession(document, identity);
            return resultOf(person, session);
          } catch {
            return null;
          }
        },
      );
      return response.value;
    },
    async choosePassword(
      identity: CommandIdentity,
      password: string,
    ): Promise<SignInResult> {
      const now = clock(),
        salt = randomToken();
      const verifier = credentialVerifier(password, salt);
      const response = await repository.transaction(
        identity.company_id,
        (document, state) => {
          const { person, session } = personAndSession(document, identity);
          if (session.state !== "setup" || person.setup.password_complete)
            throw new AuthenticationError("setup_session");
          const error = validatePassword(password, policyOf(state));
          if (error) throw new AuthenticationError(error);
          const previous = document.credentials.find(
            (item) => item.user_id === person.id,
          );
          if (
            previous &&
            previous.password_verifier ===
              credentialVerifier(password, previous.password_salt)
          )
            throw new AuthenticationError("same_password");
          const credential: CredentialRecord = {
            company_id: person.company_id,
            user_id: person.id,
            password_verifier: verifier,
            password_salt: salt,
            failed_attempts: 0,
            version: (previous?.version ?? 0) + 1,
          };
          document.credentials = document.credentials.filter(
            (item) => item.user_id !== person.id,
          );
          document.credentials.push(credential);
          person.setup.password_complete = true;
          person.version++;
          for (const challenge of document.setup_challenges.filter(
            (item) => item.setup_session_id === session.id && !item.revoked_at,
          ))
            challenge.progress = needsSecondStep(person.role)
              ? "second_step"
              : "complete";
          if (!needsSecondStep(person.role))
            person.setup.second_step_complete = true;
          finishIfReady(state, document, person, session, now);
          session.authenticated_at = now.toISOString();
          audit(
            document,
            person.id,
            "Changed password",
            now,
            id,
            session.device_id,
          );
          return resultOf(person, session);
        },
      );
      return response.value;
    },
    async setupSecondStep(
      identity: CommandIdentity,
      method: "passkey" | "authenticator",
    ): Promise<SignInResult> {
      const now = clock();
      const response = await repository.transaction(
        identity.company_id,
        (document) => {
          const { person, session } = personAndSession(document, identity);
          if (
            session.state !== "setup" ||
            !person.setup.password_complete ||
            person.setup.second_step_complete ||
            !needsSecondStep(person.role) ||
            !["passkey", "authenticator"].includes(method)
          )
            throw new AuthenticationError("setup_session");
          person.setup.second_step_method = method;
          person.version++;
          audit(
            document,
            person.id,
            "Set up second sign-in step",
            now,
            id,
            session.device_id,
          );
          return resultOf(person, session);
        },
      );
      return response.value;
    },
    async completeSecondStep(
      identity: CommandIdentity,
      simulated_response: string,
    ): Promise<SignInResult> {
      const now = clock();
      const response = await repository.transaction(
        identity.company_id,
        (document, state) => {
          const { person, session } = personAndSession(document, identity);
          if (
            !person.setup.password_complete ||
            !needsSecondStep(person.role) ||
            !["setup", "second_step_challenge"].includes(session.state)
          )
            throw new AuthenticationError("setup_session");
          const method = person.setup.second_step_method;
          const expected =
            method === "passkey"
              ? "simulated-passkey"
              : (policyOf(state).simulated_authenticator_code ?? "123456");
          if (!method || simulated_response !== expected)
            throw new AuthenticationError("second_step");
          person.setup.second_step_complete = true;
          person.setup.simulated = true;
          person.version++;
          session.second_step_verified_at = now.toISOString();
          for (const challenge of document.setup_challenges.filter(
            (item) => item.setup_session_id === session.id && !item.revoked_at,
          ))
            challenge.progress = "complete";
          finishIfReady(state, document, person, session, now);
          audit(
            document,
            person.id,
            "Completed second sign-in step",
            now,
            id,
            session.device_id,
          );
          return resultOf(person, session);
        },
      );
      return response.value;
    },
    async unlock(
      identity: CommandIdentity,
      password: string,
    ): Promise<SignInResult> {
      const now = clock();
      const response = await repository.transaction(
        identity.company_id,
        (document, state) => {
          const { person, session } = personAndSession(document, identity);
          if (session.state !== "locked")
            throw new AuthenticationError("invalid");
          const credential = document.credentials.find(
            (item) => item.user_id === person.id,
          );
          if (!credential) throw new AuthenticationError("invalid");
          validateNotLocked(credential, now);
          if (
            credential.password_verifier !==
            credentialVerifier(password, credential.password_salt)
          ) {
            audit(
              document,
              person.id,
              "Failed sign-in",
              now,
              id,
              session.device_id,
            );
            return { error: failedAttempt(credential, policyOf(state), now) };
          }
          credential.failed_attempts = 0;
          credential.locked_until = undefined;
          session.authenticated_at = now.toISOString();
          finishIfReady(state, document, person, session, now);
          audit(
            document,
            person.id,
            "Unlocked screen",
            now,
            id,
            session.device_id,
          );
          return { result: resultOf(person, session) };
        },
      );
      if ("error" in response.value && response.value.error)
        throw new AuthenticationError(response.value.error);
      return response.value.result!;
    },
    async lock(identity: CommandIdentity): Promise<void> {
      const now = clock();
      const response = await repository.transaction(
        identity.company_id,
        (document) => {
          const { person, session } = personAndSession(document, identity);
          if (session.state !== "active")
            throw new AuthenticationError("invalid");
          session.state = "locked";
          audit(
            document,
            person.id,
            "Locked screen",
            now,
            id,
            session.device_id,
          );
          return structuredClone(person);
        },
      );
      publish(
        response.value,
        response.snapshot.directory_version,
        "session_locked",
        identity.session_id,
      );
    },
    async signOut(identity: CommandIdentity): Promise<void> {
      const now = clock();
      const response = await repository.transaction(
        identity.company_id,
        (document) => {
          const { person, session } = personAndSession(document, identity);
          session.state = "revoked";
          session.revoked_at = now.toISOString();
          audit(document, person.id, "Signed out", now, id, session.device_id);
          return structuredClone(person);
        },
      );
      publish(
        response.value,
        response.snapshot.directory_version,
        "session_signed_out",
        identity.session_id,
      );
    },
    async switchDemoUser(
      company_id: string,
      username: string,
    ): Promise<SignInResult> {
      const now = clock();
      const response = await repository.transaction(
        company_id,
        (document, state) => {
          const normalized = username.trim().toLowerCase();
          const person = document.people.find((item) =>
            [item.username, ...item.aliases].includes(normalized),
          );
          if (
            !person?.demo_fixture ||
            person.status !== "active" ||
            !person.setup.password_complete ||
            (needsSecondStep(person.role) && !person.setup.second_step_complete)
          )
            throw new AuthenticationError("invalid");
          const device_id = dependencies.currentDeviceId?.();
          const session: SessionRecord = {
            id: id("session"),
            company_id,
            user_id: person.id,
            authority_epoch: person.authority_epoch,
            state: "active",
            authenticated_at: now.toISOString(),
            second_step_verified_at: needsSecondStep(person.role)
              ? now.toISOString()
              : undefined,
            selected_location: defaultSelection(
              state,
              document,
              person,
              device_id,
            ),
            device_id,
          };
          document.sessions.push(session);
          finishIfReady(state, document, person, session, now);
          audit(
            document,
            person.id,
            "Switched demo user",
            now,
            id,
            session.device_id,
          );
          return resultOf(person, session);
        },
      );
      return response.value;
    },
    async setLocation(identity: CommandIdentity, selection: LocationSelection) {
      const now = clock();
      const response = await repository.transaction(
        identity.company_id,
        (document, state) => {
          const { person, session } = personAndSession(document, identity);
          if (
            !person.setup.password_complete ||
            (needsSecondStep(person.role) &&
              (!person.setup.second_step_complete ||
                !session.second_step_verified_at)) ||
            !["active", "location_required"].includes(session.state)
          )
            throw new AuthenticationError("invalid");
          const proposed = {
            ...structuredClone(session),
            state: "active" as const,
            selected_location: selection,
          };
          const prospective = structuredClone(document);
          prospective.sessions[
            prospective.sessions.findIndex((item) => item.id === session.id)
          ] = proposed;
          bindAuthoritySnapshot(state, snapshotOf(prospective));
          const actor = resolveActor(state, identity, now);
          resolveLocationSelection(state, actor, selection);
          session.selected_location = structuredClone(selection);
          session.state = "active";
          return snapshotOf(document);
        },
      );
      return response.value;
    },
  };
}
