import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  BrowserAuthorityRepository,
  AUTHORITY_DATABASE_NAME,
} from "./authority-repository";
import { initializeAuthority } from "./authority-initialization";
import {
  configuredDemoPeople,
  configuredDemoComputers,
} from "./e1-seed-fixtures";
import { initialState } from "./e1-bootstrap";
import {
  migrateTimesheetState,
  initializeTimesheetState,
} from "./timesheet-state";
import { sha256Bytes } from "./sha256";
import type { DemoState } from "./types";

function oldState() {
  const state = initialState();
  delete state.prototype_r2d_timesheet_schema;
  delete state.prototype_r2d_timesheet_demo;
  delete state.config.timesheets;
  Reflect.deleteProperty(state.config.modules, "timesheets");
  delete state.timesheet_staff;
  delete state.timesheet_days;
  delete state.timesheet_rows;
  return state;
}
async function fixture(state = oldState()) {
  const factory = new IDBFactory();
  const repository = new BrowserAuthorityRepository(factory);
  await initializeAuthority(repository, {
    state,
    demo_users: configuredDemoPeople(),
    registered_computers: configuredDemoComputers(),
  });
  return { factory, repository, company: state.config.company.seed_key };
}
async function backups(factory: IDBFactory) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(AUTHORITY_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<
      { raw: string; sha256: string; source_key: string }[]
    >((resolve, reject) => {
      const request = database
        .transaction("private_backups", "readonly")
        .objectStore("private_backups")
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
describe("R2d verified additive stored-state migration", () => {
  it("backs up exact prior bytes/hash, preserves business evidence and initializes no fictional people in existing stores", async () => {
    const { factory, repository, company } = await fixture();
    try {
      const prior = await repository.loadBusiness<DemoState>(company);
      const raw = JSON.stringify(prior.state);
      await migrateTimesheetState(repository, company);
      const after = await repository.loadBusiness<DemoState>(company);
      expect(after.state.prototype_r2d_timesheet_schema).toBe(1);
      expect(after.state.config.modules.timesheets).toBe(true);
      expect(after.state.config.timesheets?.departments).toHaveLength(8);
      expect(after.state.timesheet_staff).toEqual([]);
      expect(after.state.timesheet_days).toEqual([]);
      expect(after.state.timesheet_rows).toEqual([]);
      for (const key of [
        "products",
        "invoices",
        "invoice",
        "ledger",
        "stock",
        "returns",
        "activity",
      ] as const)
        expect(after.state[key]).toEqual(prior.state[key]);
      const saved = (await backups(factory)).find(
        (backup) => backup.raw === raw,
      )!;
      expect(saved).toBeDefined();
      expect(saved.sha256).toBe(sha256Bytes(new TextEncoder().encode(raw)));
      expect(saved.source_key).toContain(`revision:${prior.revision}`);
      const restore = await fixture(JSON.parse(saved.raw));
      try {
        expect(
          (await restore.repository.loadBusiness<DemoState>(company)).state,
        ).toEqual(prior.state);
      } finally {
        restore.repository.dispose();
      }
      await migrateTimesheetState(repository, company);
      expect((await repository.loadBusiness<DemoState>(company)).revision).toBe(
        after.revision,
      );
    } finally {
      repository.dispose();
    }
  });
  it("preserves a false switch, custom departments and preexisting records", async () => {
    const state = oldState();
    state.config.modules.timesheets = false;
    state.config.timesheets = {
      departments: [
        { key: "dispatch", name_en: "Dispatch", name_fa: "ارسال", order: 9 },
      ],
    };
    state.timesheet_staff = [];
    state.timesheet_days = [];
    state.timesheet_rows = [];
    const { repository, company } = await fixture(state);
    try {
      await migrateTimesheetState(repository, company);
      const migrated = (await repository.loadBusiness<DemoState>(company))
        .state;
      expect(migrated.config.modules.timesheets).toBe(false);
      expect(migrated.config.timesheets).toEqual(state.config.timesheets);
      expect(migrated.timesheet_staff).toEqual(state.timesheet_staff);
    } finally {
      repository.dispose();
    }
  });
  it("refuses migration when the exact backup cannot be durably verified", async () => {
    const { repository, company } = await fixture();
    try {
      const prior = await repository.loadBusiness<DemoState>(company);
      const spy = vi
        .spyOn(repository, "archivePrivateBackup")
        .mockRejectedValue(new Error("backup"));
      await expect(migrateTimesheetState(repository, company)).rejects.toThrow(
        "backup",
      );
      expect(await repository.loadBusiness<DemoState>(company)).toEqual(prior);
      spy.mockRestore();
    } finally {
      repository.dispose();
    }
  });
  it("backs up a concurrent newer revision before migrating and retains that write", async () => {
    const { factory, repository, company } = await fixture();
    try {
      const archive = repository.archivePrivateBackup.bind(repository);
      let first = true;
      const spy = vi
        .spyOn(repository, "archivePrivateBackup")
        .mockImplementation(async (...args) => {
          await archive(...args);
          if (first) {
            first = false;
            await repository.runSystemReconciliation<DemoState, void>(
              company,
              "timesheets_migration",
              (state) => {
                state.demo_fixture_anchor_date = "2026-09-14";
              },
            );
          }
        });
      await migrateTimesheetState(repository, company);
      const after = (await repository.loadBusiness<DemoState>(company)).state;
      expect(after.prototype_r2d_timesheet_schema).toBe(1);
      expect(after.demo_fixture_anchor_date).toBe("2026-09-14");
      expect(
        (await backups(factory)).filter((backup) =>
          backup.source_key.startsWith(`business:${company}:revision:`),
        ),
      ).toHaveLength(2);
      spy.mockRestore();
    } finally {
      repository.dispose();
    }
  });
  it("does not reseed records after an explicitly empty migrated store reloads", () => {
    const state = oldState();
    initializeTimesheetState(state);
    state.timesheet_staff = [];
    state.timesheet_days = [];
    state.timesheet_rows = [];
    const snapshot = JSON.stringify(state);
    initializeTimesheetState(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
