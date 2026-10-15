import { configSeed, demoSeed } from "./config";
import { decodeCurrentRole } from "./role-config";
import type {
  ConfiguredDemoPerson,
  ConfiguredDemoDevice,
} from "./authority-initialization";

const personIds = new Set([
  "demo-person-owner",
  "demo-person-manager",
  "demo-person-rh-supervisor",
  "demo-person-ny-floor",
  "demo-person-wh-floor",
  "demo-person-cashier",
]);
/** Validate configured fictional source data; runtime people are owned by authority. */
export function configuredDemoPeople(): ConfiguredDemoPerson[] {
  const locations = new Map(
    configSeed.branches.map((location) => [location.id, location]),
  );
  const records = demoSeed.demo_users.map((row): ConfiguredDemoPerson => {
    const role = decodeCurrentRole(row.role);
    if (
      !role ||
      row.role !== role ||
      !personIds.has(row.id) ||
      row.status !== "active" ||
      row.demo_fixture !== true ||
      !row.username.trim() ||
      !row.name_en.trim() ||
      row.password !== "demo1234" ||
      !row.setup.password_complete ||
      !row.setup.second_step_complete
    )
      throw new Error("Invalid configured demo person");
    const companyRole = role === "owner" || role === "manager";
    const scope = row.location_scope;
    let location_scope: ConfiguredDemoPerson["location_scope"];
    if (companyRole) {
      if (scope.kind !== "company")
        throw new Error("Invalid configured demo location scope");
      location_scope = { kind: "company" };
    } else {
      if (
        scope.kind !== "assigned" ||
        !("location_ids" in scope) ||
        !Array.isArray(scope.location_ids) ||
        scope.location_ids.length === 0 ||
        scope.location_ids.some(
          (id) =>
            !locations.has(id) ||
            (role === "cashier" && locations.get(id)?.type === "warehouse"),
        )
      )
        throw new Error("Invalid configured demo location scope");
      location_scope = {
        kind: "assigned",
        location_ids: [...new Set(scope.location_ids)],
      };
    }
    const privileged = companyRole || role === "branch_supervisor";
    const method =
      "second_step_method" in row.setup
        ? row.setup.second_step_method
        : undefined;
    if (privileged && method !== "passkey" && method !== "authenticator")
      throw new Error("Invalid configured privileged demo setup");
    return {
      id: row.id,
      name_en: row.name_en,
      name_fa: row.name_fa,
      username: row.username,
      aliases: [...row.aliases],
      email: row.email,
      password: row.password,
      role,
      location_scope,
      status: "active",
      setup: {
        password_complete: true,
        second_step_complete: true,
        second_step_method:
          method === "passkey" || method === "authenticator"
            ? method
            : undefined,
        simulated: true,
      },
      demo_fixture: true,
    };
  });
  if (records.length !== 6 || new Set(records.map((row) => row.id)).size !== 6)
    throw new Error("The configured demo needs exactly six distinct people");
  const usernames = records.flatMap((row) => [row.username, ...row.aliases]);
  if (new Set(usernames).size !== usernames.length)
    throw new Error("Configured demo usernames and aliases must be unique");
  return records;
}
export function configuredDemoComputers(): ConfiguredDemoDevice[] {
  const people = configuredDemoPeople();
  return demoSeed.registered_computers.map((row) => {
    const owner = people.find(
      (person) =>
        person.id === row.registered_by_user_id && person.role === "owner",
    );
    const location = configSeed.branches.find(
      (record) => record.id === row.location_id,
    );
    if (
      !row.id.trim() ||
      !row.name.trim() ||
      !owner ||
      !location ||
      row.active !== true ||
      !Number.isSafeInteger(row.version) ||
      row.version < 1
    )
      throw new Error("Invalid configured demo computer");
    return {
      id: row.id,
      name: row.name,
      location_id: row.location_id,
      active: row.active,
      version: row.version,
      registered_by_user_id: row.registered_by_user_id,
    };
  });
}
