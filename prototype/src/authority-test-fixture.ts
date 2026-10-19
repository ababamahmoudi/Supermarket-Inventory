/** Test fixtures only. Never import this module from application code. */
import type {
  AuthoritySnapshot,
  BusinessState,
  LocationSelection,
  PersonRecord,
  RoleId,
  SessionRecord,
} from "./authority-types";
import {
  authoritySnapshot,
  bindAuthoritySnapshot,
  configuredLocations,
  isCompanyRole,
  needsSecondStep,
  resolveActor,
} from "./authority";

let sessionSequence = 0;
const defaultPersonIds: Record<RoleId, string> = {
  owner: "demo-person-owner",
  manager: "demo-person-manager",
  branch_supervisor: "demo-person-rh-supervisor",
  floor_worker: "demo-person-ny-floor",
  cashier: "demo-person-cashier",
};
export interface AuthenticatedFixtureOptions {
  user_id?: string;
  username?: string;
  name_en?: string;
  name_fa?: string;
  locations?: readonly string[];
  selection?: LocationSelection;
  now?: Date;
}
export function authenticatedTestFixture(
  state: BusinessState,
  role: RoleId = "manager",
  options: AuthenticatedFixtureOptions = {},
) {
  const now = options.now ?? new Date();
  const company_id = state.config.company.seed_key;
  let snapshot: AuthoritySnapshot;
  try {
    snapshot = structuredClone(authoritySnapshot(state));
  } catch {
    snapshot = {
      version: 1,
      company_id,
      directory_version: 1,
      people: [],
      sessions: [],
      devices: [],
    };
  }
  const configured = configuredLocations(state).filter(
    (location) => location.active !== false,
  );
  const allowedCandidates = configured.filter(
    (location) => role !== "cashier" || location.type !== "warehouse",
  );
  const location_ids =
    options.locations ??
    [allowedCandidates[0]?.id].filter((id): id is string => Boolean(id));
  const user_id = options.user_id ?? defaultPersonIds[role];
  const previous = snapshot.people.find((item) => item.id === user_id);
  const location_scope: PersonRecord["location_scope"] = isCompanyRole(role)
    ? { kind: "company" }
    : { kind: "assigned", location_ids };
  const changed =
    previous &&
    (previous.role !== role ||
      JSON.stringify(previous.location_scope) !==
        JSON.stringify(location_scope));
  const person: PersonRecord = {
    id: user_id,
    company_id,
    name_en: options.name_en ?? `Test ${role}`,
    name_fa: options.name_fa,
    username: options.username ?? role,
    aliases: [],
    role,
    location_scope,
    status: "active",
    setup: {
      password_complete: true,
      second_step_complete: true,
      simulated: true,
    },
    authority_epoch: (previous?.authority_epoch ?? 1) + (changed ? 1 : 0),
    version: (previous?.version ?? 0) + 1,
    created_at: previous?.created_at ?? now.toISOString(),
    created_by_user_id: user_id,
  };
  const session: SessionRecord = {
    id: `test-session-${++sessionSequence}`,
    company_id,
    user_id,
    authority_epoch: person.authority_epoch,
    state: "active",
    authenticated_at: now.toISOString(),
    second_step_verified_at: needsSecondStep(role)
      ? now.toISOString()
      : undefined,
    selected_location: options.selection ?? {
      kind: "location",
      location_id: location_ids[0],
    },
  };
  const people = snapshot.people.filter((item) => item.id !== user_id);
  const current: AuthoritySnapshot = {
    ...snapshot,
    directory_version: snapshot.directory_version + 1,
    people: [...people, person],
    sessions: [...snapshot.sessions, session],
  };
  bindAuthoritySnapshot(state, current);
  const identity = { company_id, session_id: session.id };
  const actor = resolveActor(state, identity, now);
  return { actor, identity, person, session, snapshot: current };
}
export const authenticatedTestActor = (
  state: BusinessState,
  role: RoleId = "manager",
  options: AuthenticatedFixtureOptions = {},
) => authenticatedTestFixture(state, role, options).actor;
