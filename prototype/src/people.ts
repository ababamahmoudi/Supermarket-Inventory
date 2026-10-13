import type {
  AuthenticatedActor,
  AuthorityInvalidation,
  BusinessState,
  CommandRequest,
  PersonEditInput,
  PersonInput,
  PersonRecord,
  PersonStatusInput,
} from "./authority-types";
import {
  bindAuthoritySnapshot,
  configuredLocations,
  isCompanyRole,
  needsSecondStep,
  resolveActor,
} from "./authority";
import {
  revokePersonSessions,
  snapshotOf,
  type AuthorityDocument,
  type MutableAuthorityRepository,
} from "./authority-document";
import { requireCapability } from "./permissions";

const roles = new Set([
  "owner",
  "manager",
  "branch_supervisor",
  "floor_worker",
  "cashier",
]);
export type PeopleErrorCode =
  | "name"
  | "username"
  | "contact"
  | "role"
  | "locations"
  | "cashier_warehouse"
  | "duplicate_username"
  | "reason"
  | "self_role"
  | "self_deactivate"
  | "last_owner"
  | "conflict"
  | "person";
export class PeopleError extends Error {
  constructor(readonly code: PeopleErrorCode) {
    super(code);
    this.name = "PeopleError";
  }
}
export interface PreparedSetupCode {
  code: string;
  verifier: string;
  salt: string;
}
export interface PeopleDependencies {
  repository: MutableAuthorityRepository;
  state: () => BusinessState;
  prepareSetupCode: () => Promise<PreparedSetupCode>;
  createId: (prefix: string) => string;
  now?: () => Date;
}
const normalizeUsername = (username: string) => username.trim().toLowerCase();
const hasSameScope = (
  a: PersonRecord["location_scope"],
  b: PersonRecord["location_scope"],
) =>
  a.kind === b.kind &&
  (a.kind === "company" ||
    (b.kind === "assigned" &&
      [...a.location_ids].sort().join("\0") ===
        [...b.location_ids].sort().join("\0")));

function validatePersonInput(
  state: BusinessState,
  document: AuthorityDocument,
  input: PersonInput,
  previous?: PersonRecord,
): PersonInput {
  const next: PersonInput = {
    name_en: input.name_en,
    name_fa: input.name_fa,
    username: input.username,
    phone: input.phone,
    email: input.email,
    role: input.role,
    location_scope: structuredClone(input.location_scope),
  };
  next.name_en = next.name_en.trim();
  next.name_fa = next.name_fa?.trim() || undefined;
  next.username = normalizeUsername(next.username);
  next.phone = next.phone?.trim() || undefined;
  next.email = next.email?.trim() || undefined;
  if (!next.name_en) throw new PeopleError("name");
  if (!next.username) throw new PeopleError("username");
  if (!next.phone && !next.email) throw new PeopleError("contact");
  if (!roles.has(next.role)) throw new PeopleError("role");
  const ownAliases = previous?.aliases ?? [];
  const claimed = new Set(
    [next.username, ...ownAliases].map(normalizeUsername),
  );
  if (
    document.people.some(
      (person) =>
        person.id !== previous?.id &&
        [person.username, ...person.aliases].some((name) =>
          claimed.has(normalizeUsername(name)),
        ),
    )
  )
    throw new PeopleError("duplicate_username");
  if (isCompanyRole(next.role)) {
    if (next.location_scope.kind !== "company")
      throw new PeopleError("locations");
  } else {
    if (
      next.location_scope.kind !== "assigned" ||
      next.location_scope.location_ids.length === 0
    )
      throw new PeopleError("locations");
    const ids = [...new Set(next.location_scope.location_ids)];
    const configured = configuredLocations(state);
    const retained = new Set(
      previous?.location_scope.kind === "assigned"
        ? previous.location_scope.location_ids
        : [],
    );
    for (const id of ids) {
      const location = configured.find((item) => item.id === id);
      if (!location || (location.active === false && !retained.has(id)))
        throw new PeopleError("locations");
      if (next.role === "cashier" && location.type === "warehouse")
        throw new PeopleError("cashier_warehouse");
    }
    next.location_scope = { kind: "assigned", location_ids: ids };
  }
  return next;
}
function assertOwnerRemains(document: AuthorityDocument) {
  if (
    !document.people.some(
      (person) =>
        person.role === "owner" &&
        person.status === "active" &&
        person.setup.password_complete &&
        person.setup.second_step_complete,
    )
  )
    throw new PeopleError("last_owner");
}
function prospectiveDocument(
  document: AuthorityDocument,
  person: PersonRecord,
) {
  const prospective = structuredClone(document);
  const index = prospective.people.findIndex((item) => item.id === person.id);
  if (index < 0) prospective.people.push(person);
  else prospective.people[index] = person;
  assertOwnerRemains(prospective);
  return prospective;
}
function authorized(
  state: BusinessState,
  document: AuthorityDocument,
  identity: CommandRequest<unknown>["identity"],
  now: Date,
) {
  bindAuthoritySnapshot(state, snapshotOf(document));
  const actor = resolveActor(state, identity, now);
  requireCapability(
    state,
    actor,
    "people.manage",
    {
      company_id: document.company_id,
      kind: "company_shared",
      mutation: true,
    },
    now,
  );
  return actor;
}
function target(document: AuthorityDocument, input: PersonStatusInput) {
  const person = document.people.find(
    (item) =>
      item.id === input.person_id && item.company_id === document.company_id,
  );
  if (!person) throw new PeopleError("person");
  if (person.version !== input.expected_version)
    throw new PeopleError("conflict");
  if (!input.reason.trim()) throw new PeopleError("reason");
  return person;
}
function audit(
  document: AuthorityDocument,
  actor: AuthenticatedActor,
  before: PersonRecord | null,
  after: PersonRecord,
  action: string,
  reason: string,
  now: Date,
  createId: PeopleDependencies["createId"],
) {
  document.audit.push({
    id: createId("people-audit"),
    company_id: document.company_id,
    actor_user_id: actor.user_id,
    actor_role_snapshot: actor.role,
    actor_name_snapshot: actor.actor,
    device_id: actor.device_id,
    entity_type: "person",
    entity_id: after.id,
    action,
    reason,
    at: now.toISOString(),
    before: before && structuredClone(before),
    after: structuredClone(after),
  });
}

export function createPeopleService(dependencies: PeopleDependencies) {
  const { repository, state, prepareSetupCode, createId } = dependencies;
  const clock = dependencies.now ?? (() => new Date());
  const publish = (
    person: PersonRecord,
    directory_version: number,
    reason: AuthorityInvalidation["reason"],
  ) =>
    repository.publishInvalidation({
      company_id: person.company_id,
      user_id: person.id,
      authority_epoch: person.authority_epoch,
      directory_version,
      reason,
    });
  return {
    async listPeople(request: CommandRequest<Record<string, never>>) {
      const now = clock();
      const result = await repository.transaction(
        request.identity.company_id,
        (document, currentState) => {
          const canonicalState = currentState ?? state();
          bindAuthoritySnapshot(canonicalState, snapshotOf(document));
          const actor = resolveActor(canonicalState, request.identity, now);
          requireCapability(
            canonicalState,
            actor,
            "people.read",
            { company_id: document.company_id, kind: "company_shared" },
            now,
          );
          return document.people
            .filter((person) => person.company_id === document.company_id)
            .map((person) => ({
              id: person.id,
              company_id: person.company_id,
              name_en: person.name_en,
              name_fa: person.name_fa,
              username: person.username,
              phone: person.phone,
              email: person.email,
              role: person.role,
              location_scope: structuredClone(person.location_scope),
              status: person.status,
              version: person.version,
              last_sign_in_at: person.last_sign_in_at,
            }));
        },
      );
      return result.value;
    },
    async addPerson(request: CommandRequest<PersonInput>) {
      const code = await prepareSetupCode();
      const now = clock();
      const result = await repository.transaction(
        request.identity.company_id,
        (document, currentBusiness) => {
          const currentState = currentBusiness ?? state();
          const actor = authorized(
            currentState,
            document,
            request.identity,
            now,
          );
          const input = validatePersonInput(
            currentState,
            document,
            request.input,
          );
          const person: PersonRecord = {
            ...input,
            id: createId("person"),
            company_id: document.company_id,
            aliases: [],
            status: "invited",
            setup: {
              password_complete: false,
              second_step_complete: false,
              simulated: true,
            },
            authority_epoch: 1,
            version: 1,
            created_at: now.toISOString(),
            created_by_user_id: actor.user_id,
          };
          prospectiveDocument(document, person);
          document.people.push(person);
          document.directory_version++;
          document.setup_challenges.push({
            id: createId("setup"),
            company_id: document.company_id,
            user_id: person.id,
            code_verifier: code.verifier,
            code_salt: code.salt,
            progress: "code",
            created_at: now.toISOString(),
            created_by_user_id: actor.user_id,
          });
          audit(document, actor, null, person, "Add person", "", now, createId);
          return structuredClone(person);
        },
      );
      return { person: result.value, one_time_setup_code: code.code };
    },
    async editPerson(request: CommandRequest<PersonEditInput>) {
      const now = clock();
      let invalidation: AuthorityInvalidation["reason"] | undefined;
      const result = await repository.transaction(
        request.identity.company_id,
        (document, currentBusiness) => {
          const currentState = currentBusiness ?? state();
          const actor = authorized(
            currentState,
            document,
            request.identity,
            now,
          );
          const previous = target(document, request.input);
          const input = validatePersonInput(
            currentState,
            document,
            request.input,
            previous,
          );
          if (actor.user_id === previous.id && input.role !== previous.role)
            throw new PeopleError("self_role");
          const next: PersonRecord = {
            ...structuredClone(previous),
            ...input,
            version: previous.version + 1,
          };
          const roleChanged = next.role !== previous.role;
          const scopeChanged = !hasSameScope(
            next.location_scope,
            previous.location_scope,
          );
          if (roleChanged || scopeChanged) {
            next.authority_epoch++;
            invalidation = roleChanged ? "role_changed" : "locations_changed";
          }
          if (
            roleChanged &&
            needsSecondStep(next.role) &&
            !needsSecondStep(previous.role)
          ) {
            next.setup.second_step_complete = false;
            next.setup.second_step_method = undefined;
            if (next.status === "active") next.status = "invited";
          }
          prospectiveDocument(document, next);
          document.people[document.people.indexOf(previous)] = next;
          if (invalidation) revokePersonSessions(document, next.id, now);
          document.directory_version++;
          audit(
            document,
            actor,
            previous,
            next,
            "Edit person",
            request.input.reason.trim(),
            now,
            createId,
          );
          return structuredClone(next);
        },
      );
      if (invalidation)
        publish(result.value, result.snapshot.directory_version, invalidation);
      return result.value;
    },
    async deactivatePerson(request: CommandRequest<PersonStatusInput>) {
      const now = clock();
      const result = await repository.transaction(
        request.identity.company_id,
        (document, currentBusiness) => {
          const actor = authorized(
            currentBusiness ?? state(),
            document,
            request.identity,
            now,
          );
          const previous = target(document, request.input);
          if (actor.user_id === previous.id)
            throw new PeopleError("self_deactivate");
          const next: PersonRecord = {
            ...structuredClone(previous),
            status: "deactivated",
            version: previous.version + 1,
            authority_epoch: previous.authority_epoch + 1,
          };
          prospectiveDocument(document, next);
          document.people[document.people.indexOf(previous)] = next;
          revokePersonSessions(document, next.id, now);
          document.directory_version++;
          audit(
            document,
            actor,
            previous,
            next,
            "Deactivate person",
            request.input.reason.trim(),
            now,
            createId,
          );
          return structuredClone(next);
        },
      );
      publish(result.value, result.snapshot.directory_version, "deactivated");
      return result.value;
    },
    async reactivatePerson(request: CommandRequest<PersonStatusInput>) {
      const now = clock();
      const result = await repository.transaction(
        request.identity.company_id,
        (document, currentBusiness) => {
          const actor = authorized(
            currentBusiness ?? state(),
            document,
            request.identity,
            now,
          );
          const previous = target(document, request.input);
          if (previous.status !== "deactivated")
            throw new PeopleError("person");
          const complete =
            previous.setup.password_complete &&
            (!needsSecondStep(previous.role) ||
              previous.setup.second_step_complete);
          const next: PersonRecord = {
            ...structuredClone(previous),
            status: complete ? "active" : "invited",
            version: previous.version + 1,
            authority_epoch: previous.authority_epoch + 1,
          };
          prospectiveDocument(document, next);
          document.people[document.people.indexOf(previous)] = next;
          revokePersonSessions(document, next.id, now);
          document.directory_version++;
          audit(
            document,
            actor,
            previous,
            next,
            "Reactivate person",
            request.input.reason.trim(),
            now,
            createId,
          );
          return structuredClone(next);
        },
      );
      return result.value;
    },
    async resetSetup(request: CommandRequest<PersonStatusInput>) {
      const code = await prepareSetupCode();
      const now = clock();
      const result = await repository.transaction(
        request.identity.company_id,
        (document, currentBusiness) => {
          const actor = authorized(
            currentBusiness ?? state(),
            document,
            request.identity,
            now,
          );
          const previous = target(document, request.input);
          if (previous.status === "deactivated")
            throw new PeopleError("person");
          const next: PersonRecord = {
            ...structuredClone(previous),
            status: "invited",
            setup: {
              password_complete: false,
              second_step_complete: false,
              simulated: true,
            },
            version: previous.version + 1,
            authority_epoch: previous.authority_epoch + 1,
          };
          prospectiveDocument(document, next);
          document.people[document.people.indexOf(previous)] = next;
          revokePersonSessions(document, next.id, now);
          document.credentials = document.credentials.filter(
            (item) => item.user_id !== next.id,
          );
          document.setup_challenges.push({
            id: createId("setup"),
            company_id: document.company_id,
            user_id: next.id,
            code_verifier: code.verifier,
            code_salt: code.salt,
            progress: "code",
            created_at: now.toISOString(),
            created_by_user_id: actor.user_id,
          });
          document.directory_version++;
          audit(
            document,
            actor,
            previous,
            next,
            "Reset password",
            request.input.reason.trim(),
            now,
            createId,
          );
          return structuredClone(next);
        },
      );
      publish(
        result.value,
        result.snapshot.directory_version,
        "password_reset",
      );
      return { person: result.value, one_time_setup_code: code.code };
    },
  };
}
