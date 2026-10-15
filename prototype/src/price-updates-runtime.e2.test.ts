import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { migrateE1BusinessState } from "./e1-state-migration";
import {
  migratePriceUpdates,
  priceUpdateTasks,
  priceUpdateProgress,
  priceChangeHints,
  preparePriceTaskPrint,
  recordPriceTaskPrint,
  confirmPriceTaskLabel,
  updatePriceTask,
  completePriceTasks,
} from "./price-updates";
import { createE1ShellRuntime } from "./e1-shell-runtime";
import { shellProviderFixture } from "./shell-provider-test-fixture";
import { savePriceChange } from "./sales";
import type { DemoState } from "./types";
const now = new Date("2026-10-12T16:00:00Z");
const cleanState = () => {
  const state = migrateE1BusinessState(initialState());
  state.sales = [];
  state.sale_requests = [];
  state.sale_events = [];
  state.notifications = [];
  state.activity = [];
  return state;
};
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("E2 actual private migration and authenticated shell pipeline", () => {
  it("retains and verifies the exact pre-E2 private business backup before its additive baseline", async () => {
    const factory = new IDBFactory(),
      repository = new BrowserAuthorityRepository(factory),
      state = cleanState();
    await initializeAuthority(repository, {
      state,
      demo_users: configuredDemoPeople(),
      registered_computers: configuredDemoComputers(),
      now,
    });
    const prior = await repository.loadBusiness<DemoState>(
        state.config.company.seed_key,
      ),
      raw = JSON.stringify(prior.state);
    await migratePriceUpdates(repository, state.config.company.seed_key);
    const migrated = await repository.loadBusiness<DemoState>(
      state.config.company.seed_key,
    );
    expect(migrated.state.prototype_e2_schema).toBe(1);
    expect(migrated.state.price_update_tasks).toEqual([]);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(AUTHORITY_DATABASE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const backups = await new Promise<{ raw: string; source_key: string }[]>(
      (resolve, reject) => {
        const request = database
          .transaction("private_backups", "readonly")
          .objectStore("private_backups")
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );
    expect(
      backups.some(
        (backup) =>
          backup.raw === raw &&
          backup.source_key.includes(`revision:${prior.revision}`),
      ),
    ).toBe(true);
    for (const key of [
      "products",
      "invoices",
      "invoice",
      "ledger",
      "stock",
      "returns",
      "activity",
    ] as const)
      expect(migrated.state[key]).toEqual(prior.state[key]);
    const firstRevision = migrated.revision;
    await migratePriceUpdates(repository, state.config.company.seed_key);
    expect(
      (await repository.loadBusiness<DemoState>(state.config.company.seed_key))
        .revision,
    ).toBe(firstRevision);
    database.close();
    repository.dispose();
  });
  it("uses real username/password+MFA, canonical commands, scoped queries and real Demo switches for the full per-store task flow", async () => {
    const fixture = shellProviderFixture(cleanState());
    const runtime = await createE1ShellRuntime({
      ...fixture.options,
      publish: () => {},
      publishPreferences: () => {},
      publishError: (error) => {
        throw error;
      },
    });
    const company = fixture.options.companyId,
      scope = { company_id: company, kind: "company_shared" as const };
    try {
      await runtime.controller.signIn("manager", "demo1234");
      await runtime.controller.completeSecondStep("simulated-passkey");
      await runtime.controller.setLocation({
        kind: "location",
        location_id: "Branch 1",
      });
      await runtime.controller.command(
        "pricing.regular_manage",
        { ...scope, mutation: true },
        (state, actor) =>
          savePriceChange(state, actor, {
            product_code: "0004",
            mode: "regular",
            scope: "all",
            price: "5.99",
            price_unit: "each",
            branches: ["Branch 1", "Branch 2", "Branch 3"],
            starts_on: "2026-10-12",
            last_day: null,
            accept_below_margin: true,
            below_cost_reason: "Fictional test",
            add_labels: false,
          }),
      );
      const progress = await runtime.controller.query(
        "price_updates.read",
        scope,
        (state, actor) => priceUpdateProgress(state, actor),
      );
      expect(progress).toHaveLength(3);
      expect(
        progress.every(
          (row) => row.decided_by_user_id === "demo-person-manager",
        ),
      ).toBe(true);
      await runtime.controller.switchDemoUser("rh-supervisor");
      await runtime.controller.setLocation({
        kind: "location",
        location_id: "Branch 2",
      });
      const [task] = await runtime.controller.query(
        "price_updates.read",
        scope,
        (state, actor) => priceUpdateTasks(state, actor),
      );
      expect(task.branch).toBe("Branch 2");
      const sheet = await runtime.controller.query(
        "price_updates.read",
        scope,
        (state, actor) => preparePriceTaskPrint(state, actor, [task.id]),
      );
      await runtime.controller.command(
        "price_updates.label_confirm",
        {
          company_id: company,
          kind: "location_record",
          location_ids: ["Branch 2"],
          mutation: true,
        },
        (state, actor) => {
          recordPriceTaskPrint(state, actor, sheet);
          confirmPriceTaskLabel(state, actor, task.id, sheet.id);
          updatePriceTask(state, actor, task.id, { register_changed: true });
        },
      );
      await runtime.controller.switchDemoUser("cashier");
      await runtime.controller.setLocation({
        kind: "location",
        location_id: "Branch 2",
      });
      expect(
        await runtime.controller.query("lookup.read", scope, (state, actor) =>
          priceChangeHints(state, actor),
        ),
      ).toHaveLength(1);
      await expect(
        runtime.controller.query("price_updates.read", scope, (state, actor) =>
          priceUpdateTasks(state, actor),
        ),
      ).rejects.toThrow();
      await runtime.controller.switchDemoUser("rh-supervisor");
      await runtime.controller.setLocation({
        kind: "location",
        location_id: "Branch 2",
      });
      await runtime.controller.command(
        "price_updates.complete",
        {
          company_id: company,
          kind: "location_record",
          location_ids: ["Branch 2"],
          mutation: true,
        },
        (state, actor) => completePriceTasks(state, actor, [task.id]),
      );
      await runtime.controller.switchDemoUser("manager");
      const after = await runtime.controller.query(
        "price_updates.read",
        scope,
        (state, actor) => priceUpdateProgress(state, actor),
      );
      expect(after.find((row) => row.id === task.id)).toMatchObject({
        status: "done",
        completed_by_user_id: "demo-person-rh-supervisor",
        completed_at: now.toISOString(),
      });
      expect(after.filter((row) => row.status === "pending")).toHaveLength(2);
    } finally {
      runtime.dispose();
      fixture.dispose();
    }
  });
});
