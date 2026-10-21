import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authenticationFixture } from "./shell-provider-test-fixture";
import { writeIdentity } from "./auth-preferences.e1";
import {
  createE1StoreController,
  type ShellSnapshot,
} from "./e1-store-controller";
import type { DemoState } from "./types";

const dispose: (() => void)[] = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  dispose
    .splice(0)
    .reverse()
    .forEach((close) => close());
  vi.unstubAllGlobals();
});

async function setup() {
  const fixture = await authenticationFixture();
  dispose.push(fixture.dispose);
  const snapshots: ShellSnapshot<{ protectedName: string }>[] = [];
  let pauseResume: Promise<void> | null = null;
  const controller = createE1StoreController<
    DemoState,
    { protectedName: string }
  >({
    companyId: fixture.companyId,
    repository: fixture.repository,
    authentication: {
      ...fixture.service,
      async resume(identity) {
        const result = await fixture.service.resume(identity);
        if (pauseResume) await pauseResume;
        return result;
      },
    },
    projectView: (state, actor) => ({
      protectedName: actor?.role === "manager" ? state.products[0].name_en : "",
    }),
    signedOutView: () => ({ protectedName: "" }),
    persistIdentity: writeIdentity,
    publish: (snapshot) => snapshots.push(snapshot),
  });
  dispose.push(() => controller.dispose());
  const manager = await fixture.service.switchDemoUser(
    fixture.companyId,
    "manager",
  );
  await controller.resume(manager.identity);
  expect(snapshots.at(-1)?.view.protectedName).not.toBe("");
  return {
    fixture,
    controller,
    manager,
    snapshots,
    pause(promise: Promise<void>) {
      pauseResume = promise;
    },
  };
}

it("switches real people without an auth layout stage and immediately withholds prior private records", async () => {
  const { controller, manager, fixture, snapshots } = await setup();
  const switched = controller.switchDemoUser("cashier");
  expect(snapshots.at(-1)).toMatchObject({
    stage: "refreshing",
    actor: null,
    person: null,
    view: { protectedName: "" },
  });
  expect(controller.permission("catalog.edit").allowed).toBe(false);
  await expect(
    controller.query(
      "catalog.read",
      { company_id: fixture.companyId, kind: "company_shared" },
      (state) => state.products[0],
    ),
  ).rejects.toMatchObject({ code: "session_changed" });
  await switched;
  expect(snapshots.at(-1)).toMatchObject({
    stage: "complete",
    actor: { role: "cashier" },
    view: { protectedName: "" },
  });
  expect(await fixture.service.resume(manager.identity)).toBeNull();
  expect(snapshots.filter((snapshot) => snapshot.stage === "loading")).toEqual(
    [],
  );
});

it("keeps invalidation pending until the actual resumed session and fresh projection return", async () => {
  const { controller, snapshots, pause } = await setup();
  let release!: () => void;
  pause(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const invalidated = controller.invalidate();
  try {
    expect(snapshots.at(-1)).toMatchObject({
      stage: "refreshing",
      actor: null,
      person: null,
      view: { protectedName: "" },
    });
    expect(controller.permission("catalog.edit").allowed).toBe(false);
  } finally {
    release();
  }
  await invalidated;
  expect(snapshots.at(-1)?.stage).toBe("complete");
  expect(snapshots.at(-1)?.actor?.role).toBe("manager");
  expect(snapshots.at(-1)?.view.protectedName).not.toBe("");
});

it("still publishes final locked and signed-out stages with no protected records", async () => {
  const { controller, snapshots } = await setup();
  await controller.lock();
  expect(snapshots.at(-1)).toMatchObject({
    stage: "locked",
    actor: null,
    view: { protectedName: "" },
  });
  await controller.signOut();
  expect(snapshots.at(-1)).toMatchObject({
    stage: "signed_out",
    actor: null,
    person: null,
    view: { protectedName: "" },
  });
});
