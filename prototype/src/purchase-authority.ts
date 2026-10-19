import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import { freshActor } from "./authority";
import { can, requireCapability } from "./permissions";
import type { DemoState } from "./types";

/** Callers pass canonical records; role/scope claims never construct an actor. */
export function purchaseLocationScope(
  companyId: string,
  locationId: string,
  mutation = false,
  locationPolicy: ResourceScope["location_policy"] = mutation
    ? "active_only"
    : "retained_read",
): ResourceScope {
  return {
    company_id: companyId,
    kind: "location_record",
    location_ids: [locationId],
    mutation,
    location_policy: locationPolicy,
  };
}
export function requirePurchase(
  state: DemoState,
  actor: AuthenticatedActor,
  capability: Capability,
  scope: ResourceScope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
  },
): AuthenticatedActor {
  requireCapability(state, actor, capability, scope);
  return freshActor(state, actor);
}
export function purchaseLocationAllowed(
  state: DemoState,
  actor: AuthenticatedActor,
  capability: Capability,
  companyId: string,
  locationId: string,
  mutation = false,
  locationPolicy?: ResourceScope["location_policy"],
): boolean {
  const current = freshActor(state, actor);
  return (
    (current.selection.kind !== "location" ||
      current.selection.location_id === locationId) &&
    can(
      state,
      current,
      capability,
      purchaseLocationScope(companyId, locationId, mutation, locationPolicy),
    ).allowed
  );
}
