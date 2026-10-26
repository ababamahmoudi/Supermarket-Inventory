import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { BrowserAuthorityRepository } from "./authority-repository";
import { initializeAuthority } from "./authority-initialization";
import {
  configuredDemoPeople,
  configuredDemoComputers,
} from "./e1-seed-fixtures";
import { createAuthenticationService } from "./authentication-service";
import { initialState } from "./e1-bootstrap";
import {
  addTimesheetStaff,
  addTimesheetRow,
  patchTimesheetRow,
  readTimesheetDay,
  exportTimesheetCsv,
  timesheetScope,
} from "./timesheets";
import type { DemoState } from "./types";

async function fixture() {
  const state = initialState();
  const repository = new BrowserAuthorityRepository(new IDBFactory());
  await initializeAuthority(repository, {
    state,
    demo_users: configuredDemoPeople(),
    registered_computers: configuredDemoComputers(),
  });
  const authentication = createAuthenticationService({ repository });
  return { repository, authentication, company: state.config.company.seed_key };
}
describe("R2d real canonical repository authorization", () => {
  it("a real cashier saves independent time fields durably, with current actor audit and branch denial", async () => {
    const { repository, authentication, company } = await fixture();
    try {
      const signed = await authentication.switchDemoUser(company, "cashier");
      const identity = signed.identity;
      const scope = timesheetScope(company, "Branch 1", true);
      const created = await repository.runBusinessCommand<DemoState, string>(
        identity,
        (draft, actor) => {
          const staff = addTimesheetStaff(draft, actor, {
            branch: "Branch 1",
            name_en: "Fern October",
            usual_department_key: "cash",
          });
          return addTimesheetRow(draft, actor, {
            branch: "Branch 1",
            date: "2026-10-26",
            department_key: "cash",
            staff_id: staff.id,
          }).id;
        },
        { capability: "timesheets.edit", resource: scope },
      );
      for (const patch of [{ in_time: "730" }, { out_time: "1915" }])
        await repository.runBusinessCommand<DemoState, void>(
          identity,
          (draft, actor) => {
            patchTimesheetRow(draft, actor, created.value, patch);
          },
          { capability: "timesheets.edit", resource: scope },
        );
      const read = await repository.queryBusiness<
        DemoState,
        ReturnType<typeof readTimesheetDay>
      >(
        identity,
        (draft, actor) =>
          readTimesheetDay(draft, actor, "Branch 1", "2026-10-26"),
        {
          capability: "timesheets.read",
          resource: timesheetScope(company, "Branch 1"),
        },
      );
      expect(
        read.value.departments.find((department) => department.key === "cash")
          ?.rows[0],
      ).toMatchObject({ in_time: "07:30", out_time: "19:15", minutes: 705 });
      const persisted = (await repository.loadBusiness<DemoState>(company))
        .state;
      expect(persisted.activity.at(-1)).toMatchObject({
        actor_user_id: signed.person.id,
        action: "Edit timesheet row",
        after: { out_time: "19:15" },
      });
      let called = false;
      await expect(
        repository.queryBusiness(
          identity,
          () => {
            called = true;
          },
          {
            capability: "timesheets.read",
            resource: timesheetScope(company, "Branch 3"),
          },
        ),
      ).rejects.toThrow();
      expect(called).toBe(false);
    } finally {
      repository.dispose();
    }
  });
  it("rejects Floor Worker read/edit/export before the callback sees private records", async () => {
    const { repository, authentication, company } = await fixture();
    try {
      const signed = await authentication.switchDemoUser(company, "ny-floor");
      const before = await repository.loadBusiness<DemoState>(company);
      let called = false;
      await expect(
        repository.queryBusiness<DemoState, unknown>(
          signed.identity,
          (draft, actor) => {
            called = true;
            return readTimesheetDay(draft, actor, "Branch 1", "2026-10-26");
          },
          {
            capability: "timesheets.read",
            resource: timesheetScope(company, "Branch 1"),
          },
        ),
      ).rejects.toThrow();
      await expect(
        repository.queryBusiness<DemoState, unknown>(
          signed.identity,
          (draft, actor) => {
            called = true;
            return exportTimesheetCsv(draft, actor, {
              branch: "Branch 1",
              date: "2026-10-26",
              view: "day",
            });
          },
          {
            capability: "timesheets.read",
            resource: timesheetScope(company, "Branch 1"),
          },
        ),
      ).rejects.toThrow();
      await expect(
        repository.runBusinessCommand(
          signed.identity,
          () => {
            called = true;
          },
          {
            capability: "timesheets.edit",
            resource: timesheetScope(company, "Branch 1", true),
          },
        ),
      ).rejects.toThrow();
      expect(called).toBe(false);
      expect(await repository.loadBusiness<DemoState>(company)).toEqual(before);
    } finally {
      repository.dispose();
    }
  });
});
