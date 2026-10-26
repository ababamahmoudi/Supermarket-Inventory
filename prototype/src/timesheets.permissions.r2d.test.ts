import { describe, expect, it } from "vitest";
import { initialState } from "./notes-dates-fixture.e1";
import { authenticatedTestActor } from "./authority-test-fixture";
import { can } from "./permissions";
import { configuredBranches } from "./settings";
import type { AuthenticatedActor, RoleId } from "./authority-types";
import { configSeed } from "./config";

const roles: RoleId[] = [
  "owner",
  "manager",
  "branch_supervisor",
  "cashier",
  "floor_worker",
];
describe("R2d timesheet canonical capabilities", () => {
  it.each(roles)("grants exactly the four approved roles: %s", (role) => {
    const state = initialState();
    const branch = configuredBranches(state.config)[0];
    const actor = authenticatedTestActor(state, role, { locations: [branch] });
    for (const capability of ["timesheets.read", "timesheets.edit"] as const) {
      expect(
        can(state, actor, capability, {
          company_id: actor.company_id,
          kind: "location_record",
          location_ids: [branch],
          mutation: capability === "timesheets.edit",
        }).allowed,
      ).toBe(role !== "floor_worker");
    }
  });
  it.each(roles)("module off denies even privileged roles: %s", (role) => {
    const state = initialState();
    const config = state.config as typeof state.config & {
      modules: { timesheets?: boolean };
    };
    config.modules.timesheets = false;
    const actor = authenticatedTestActor(state, role);
    expect(can(state, actor, "timesheets.read").allowed).toBe(false);
    expect(can(state, actor, "timesheets.edit").allowed).toBe(false);
  });
  it("rejects foreign company/branch, aggregate mutation and fabricated actor claims", () => {
    const state = initialState();
    const branches = configuredBranches(state.config);
    const actor = authenticatedTestActor(state, "cashier", {
      locations: [branches[0]],
    });
    const resource = {
      company_id: actor.company_id,
      kind: "location_record" as const,
      location_ids: [branches[1]],
    };
    expect(can(state, actor, "timesheets.read", resource).allowed).toBe(false);
    expect(
      can(state, actor, "timesheets.edit", { ...resource, mutation: true })
        .allowed,
    ).toBe(false);
    expect(
      can(state, actor, "timesheets.read", {
        ...resource,
        company_id: "foreign",
        location_ids: [branches[0]],
      }).allowed,
    ).toBe(false);
    expect(
      can(state, actor, "timesheets.edit", {
        ...resource,
        location_ids: [],
        mutation: true,
      }).allowed,
    ).toBe(false);
    expect(
      can(
        state,
        { ...actor, role: "owner" } as AuthenticatedActor,
        "timesheets.read",
        resource,
      ).allowed,
    ).toBe(false);
  });
  it("retains configured role descriptions without granting Floor Worker overrides", () => {
    for (const role of configSeed.roles) {
      expect(role.capabilities?.includes("timesheets.read") ?? false).toBe(
        role.key !== "floor_worker",
      );
    }
    const state = initialState();
    state.config.roles.find(
      (role) => role.key === "floor_worker",
    )!.capabilities = ["timesheets.read", "timesheets.edit"];
    const actor = authenticatedTestActor(state, "floor_worker");
    expect(can(state, actor, "timesheets.read").allowed).toBe(false);
  });
});
