import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import { decisionAttribution, freshActor } from "./authority";
import { can, requireCapability, allowedLocationIds } from "./permissions";
import type { DemoState } from "./types";

export function domainScope(
  state: { config: { company: { seed_key: string } } },
  record?: {
    company_id: string;
    branch?: string;
    id?: string;
    status?: string;
  },
  mutation = false,
): ResourceScope {
  return {
    company_id: record?.company_id ?? state.config.company.seed_key,
    kind:
      record?.branch && record.branch !== "all"
        ? "location_record"
        : "company_shared",
    location_ids:
      record?.branch && record.branch !== "all" ? [record.branch] : [],
    entity_id: record?.id,
    status: record?.status,
    mutation,
    location_policy: mutation ? "active_only" : "retained_read",
  };
}

export function guardDomain(
  state: DemoState,
  actor: AuthenticatedActor,
  capability: Capability,
  record?: {
    company_id: string;
    branch?: string;
    id?: string;
    status?: string;
  },
  mutation = false,
) {
  requireCapability(
    state,
    actor,
    capability,
    domainScope(state, record, mutation),
  );
  return freshActor(state, actor);
}

export function actorAudit(
  state: DemoState,
  actor: AuthenticatedActor,
  now = new Date(),
) {
  const source = decisionAttribution(state, actor, now);
  return {
    actor_user_id: source.user_id,
    actor_role_snapshot: source.role_snapshot,
    actor_username: source.username,
    device_id: source.device_id,
  };
}

export function actorOwns(
  state: DemoState,
  actor: AuthenticatedActor,
  record: {
    actor_user_id?: string;
    user_id?: string;
    owner_user_id?: string;
  },
) {
  const current = freshActor(state, actor);
  return (
    (record.actor_user_id ?? record.user_id ?? record.owner_user_id) ===
    current.user_id
  );
}

export function selectedLocations(
  state: DemoState,
  actor: AuthenticatedActor,
  includeInactive = false,
) {
  const current = freshActor(state, actor);
  const allowed = allowedLocationIds(state, current, { includeInactive });
  return current.branch === "all"
    ? [...allowed]
    : allowed.filter((id) => id === current.branch);
}

export function canDomain(
  state: DemoState,
  actor: AuthenticatedActor | null,
  capability: Capability,
  record?: {
    company_id: string;
    branch?: string;
    id?: string;
    status?: string;
  },
  mutation = false,
) {
  return can(state, actor, capability, domainScope(state, record, mutation))
    .allowed;
}
