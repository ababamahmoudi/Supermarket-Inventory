/** Test-only fixtures resolve actors through the real authority directory. */
import {
  authenticatedTestActor,
  type AuthenticatedFixtureOptions,
} from "./authority-test-fixture";
import { configuredDemoPeople } from "./e1-seed-fixtures";
import type { RoleId } from "./authority-types";
import type { Branch, DemoState } from "./types";

export function catalogTestActor(
  state: DemoState,
  role: RoleId,
  branch: Branch = "Branch 1",
  options: AuthenticatedFixtureOptions = {},
) {
  const person = configuredDemoPeople().find((item) => item.role === role);
  if (!person) throw new Error("Configured test person is missing");
  return authenticatedTestActor(state, role, {
    user_id: person.id,
    username: person.username,
    name_en: person.name_en,
    name_fa: person.name_fa,
    locations:
      person.location_scope.kind === "assigned"
        ? person.location_scope.location_ids
        : undefined,
    selection:
      branch === "all"
        ? {
            kind:
              role === "owner" || role === "manager"
                ? "all_locations"
                : "all_my_locations",
          }
        : { kind: "location", location_id: branch },
    ...options,
  });
}

/** A genuinely resolved actor of a separate company, rather than actor spreading. */
export function foreignCatalogManager(state: DemoState) {
  const foreign = structuredClone(state);
  foreign.config.company.seed_key = "another-company";
  return catalogTestActor(foreign, "manager");
}
