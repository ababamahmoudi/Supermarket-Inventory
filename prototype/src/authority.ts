import type {
  AuthenticatedActor,
  AuthoritySnapshot,
  BusinessState,
  CommandIdentity,
  DecisionAttribution,
  LocationSelection,
  PersonRecord,
  SessionRecord,
} from "./authority-types";

const snapshots = new WeakMap<object, AuthoritySnapshot>();
const resolvedActors = new WeakSet<object>();
// Only actorAtLocation may pin a genuine actor to an explicit runtime view.
// A public selection field or a copied actor cannot create this override.
const runtimeLocationOverrides = new WeakMap<object, string>();
const knownRoles = new Set([
  "owner",
  "manager",
  "branch_supervisor",
  "floor_worker",
  "cashier",
]);

export type AuthorityErrorCode =
  | "authentication"
  | "setup"
  | "revoked"
  | "company"
  | "location"
  | "inactive_location"
  | "capability"
  | "ownership"
  | "state"
  | "freshness";
export class AuthorityError extends Error {
  constructor(readonly code: AuthorityErrorCode) {
    super(code);
    this.name = "AuthorityError";
  }
}

export function bindAuthoritySnapshot<T extends BusinessState>(
  state: T,
  snapshot: AuthoritySnapshot,
): T {
  if (snapshot.company_id !== state.config.company.seed_key)
    throw new AuthorityError("company");
  if (
    snapshot.version !== 1 ||
    !Number.isSafeInteger(snapshot.directory_version) ||
    snapshot.directory_version < 1
  )
    throw new AuthorityError("authentication");
  snapshots.set(state, structuredClone(snapshot));
  return state;
}
export function authoritySnapshot(state: BusinessState): AuthoritySnapshot {
  const snapshot = snapshots.get(state);
  if (!snapshot) throw new AuthorityError("authentication");
  return snapshot;
}
export function inheritAuthoritySnapshot<T extends BusinessState>(
  source: BusinessState,
  target: T,
): T {
  return bindAuthoritySnapshot(target, authoritySnapshot(source));
}
export function cloneWithAuthority<T extends BusinessState>(state: T): T {
  return inheritAuthoritySnapshot(state, structuredClone(state));
}

export const isCompanyRole = (role: PersonRecord["role"]) =>
  role === "owner" || role === "manager";
export const needsSecondStep = (role: PersonRecord["role"]) =>
  isCompanyRole(role) || role === "branch_supervisor";

export function configuredLocations(state: BusinessState) {
  return state.config.branches.map((location, index) => ({
    ...location,
    id: location.id ?? location.name_en ?? `Branch ${index + 1}`,
  }));
}

function currentIdentity(
  state: BusinessState,
  identity: CommandIdentity,
): { person: PersonRecord; session: SessionRecord } {
  const snapshot = authoritySnapshot(state);
  if (
    identity.company_id !== state.config.company.seed_key ||
    identity.company_id !== snapshot.company_id
  )
    throw new AuthorityError("company");
  const session = snapshot.sessions.find(
    (record) =>
      record.id === identity.session_id &&
      record.company_id === identity.company_id,
  );
  if (!session) throw new AuthorityError("authentication");
  const person = snapshot.people.find(
    (record) =>
      record.id === session.user_id &&
      record.company_id === identity.company_id,
  );
  if (
    !person ||
    person.status === "deactivated" ||
    session.state === "revoked" ||
    session.authority_epoch !== person.authority_epoch
  )
    throw new AuthorityError("revoked");
  if (
    !knownRoles.has(person.role) ||
    !Number.isSafeInteger(person.authority_epoch) ||
    person.authority_epoch < 1 ||
    !Number.isSafeInteger(person.version) ||
    person.version < 1 ||
    !Number.isSafeInteger(session.authority_epoch) ||
    session.authority_epoch < 1 ||
    !Number.isFinite(Date.parse(session.authenticated_at))
  )
    throw new AuthorityError("authentication");
  if (
    person.status !== "active" ||
    !person.setup.password_complete ||
    (needsSecondStep(person.role) && !person.setup.second_step_complete) ||
    session.state === "setup" ||
    session.state === "second_step_challenge"
  )
    throw new AuthorityError("setup");
  if (session.state !== "active") throw new AuthorityError("authentication");
  if (!session.selected_location) throw new AuthorityError("location");
  if (needsSecondStep(person.role) && !session.second_step_verified_at)
    throw new AuthorityError("setup");
  if (
    (isCompanyRole(person.role) && person.location_scope.kind !== "company") ||
    (!isCompanyRole(person.role) &&
      (person.location_scope.kind !== "assigned" ||
        person.location_scope.location_ids.length === 0))
  )
    throw new AuthorityError("location");
  return { person, session };
}

function personLocations(state: BusinessState, person: PersonRecord) {
  const assigned =
    person.location_scope.kind === "assigned"
      ? new Set(person.location_scope.location_ids)
      : null;
  return configuredLocations(state).filter(
    (location) =>
      (!assigned || assigned.has(location.id)) &&
      (person.role !== "cashier" || location.type !== "warehouse"),
  );
}

function selectedLocations(
  state: BusinessState,
  person: PersonRecord,
  selection: LocationSelection,
) {
  if (
    !["location", "all_my_locations", "all_locations"].includes(selection.kind)
  )
    throw new AuthorityError("location");
  // Existing assigned inactive locations remain valid historical read scopes.
  // Active picker choices and mutations are checked separately by permissions.
  const locations = personLocations(state, person);
  if (selection.kind === "all_locations" && !isCompanyRole(person.role))
    throw new AuthorityError("location");
  if (selection.kind === "all_my_locations" && locations.length < 2)
    throw new AuthorityError("location");
  if (selection.kind !== "location") return locations;
  const selected = locations.find(
    (location) => location.id === selection.location_id,
  );
  if (!selected) throw new AuthorityError("location");
  return [selected];
}

function makeActor(
  state: BusinessState,
  person: PersonRecord,
  session: SessionRecord,
  selection: LocationSelection,
): AuthenticatedActor {
  selectedLocations(state, person, selection);
  const actor = Object.freeze({
    company_id: person.company_id,
    user_id: person.id,
    session_id: session.id,
    device_id: session.device_id,
    username: person.username,
    role: person.role,
    actor: person.name_en,
    name_en: person.name_en,
    name_fa: person.name_fa,
    authority_epoch: person.authority_epoch,
    person_version: person.version,
    authenticated_at: session.authenticated_at,
    second_step_verified_at: session.second_step_verified_at,
    location_scope: structuredClone(person.location_scope),
    selection: structuredClone(selection),
    branch: selection.kind === "location" ? selection.location_id : "all",
    allowed_branches: Object.freeze(
      personLocations(state, person).map((location) => location.id),
    ),
  }) as unknown as AuthenticatedActor;
  resolvedActors.add(actor);
  return actor;
}

export function resolveActor(
  state: BusinessState,
  identity: CommandIdentity,
  _now = new Date(),
): AuthenticatedActor {
  void _now;
  const { person, session } = currentIdentity(state, identity);
  if (!session.selected_location) throw new AuthorityError("location");
  return makeActor(state, person, session, session.selected_location);
}

/** Resolve the actor's actual session; arbitrary role objects fail closed. */
export function freshActor(
  state: BusinessState,
  actor: AuthenticatedActor,
): AuthenticatedActor {
  if (!resolvedActors.has(actor)) throw new AuthorityError("authentication");
  const { person, session } = currentIdentity(state, {
    company_id: actor.company_id,
    session_id: actor.session_id,
  });
  if (
    person.id !== actor.user_id ||
    actor.authority_epoch !== person.authority_epoch
  )
    throw new AuthorityError("revoked");
  const override = runtimeLocationOverrides.get(actor);
  const selection = override
    ? { kind: "location" as const, location_id: override }
    : session.selected_location;
  if (!selection) throw new AuthorityError("location");
  const current = makeActor(state, person, session, selection);
  if (override) runtimeLocationOverrides.set(current, override);
  return current;
}

export function actorAtLocation(
  state: BusinessState,
  actor: AuthenticatedActor,
  location_id: string,
): AuthenticatedActor {
  const current = freshActor(state, actor);
  const { person, session } = currentIdentity(state, {
    company_id: current.company_id,
    session_id: current.session_id,
  });
  const scoped = makeActor(state, person, session, {
    kind: "location",
    location_id,
  });
  runtimeLocationOverrides.set(scoped, location_id);
  return scoped;
}

export function decisionAttribution(
  state: BusinessState,
  actor: AuthenticatedActor,
  now = new Date(),
): DecisionAttribution {
  const current = freshActor(state, actor);
  return Object.freeze({
    user_id: current.user_id,
    company_id: current.company_id,
    username: current.username,
    name_snapshot: current.actor,
    role_snapshot: current.role,
    device_id: current.device_id,
    at: now.toISOString(),
  });
}
