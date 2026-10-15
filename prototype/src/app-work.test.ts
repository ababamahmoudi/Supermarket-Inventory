import { afterEach, expect, it } from "vitest";
import {
  beginAppWork,
  appWorkPending,
  subscribeAppWork,
  trackAppWork,
} from "./app-work";
import { authenticationFixture } from "./shell-provider-test-fixture";
import { createE1StoreController } from "./e1-store-controller";
import { writeIdentity } from "./auth-preferences.e1";
import type { DemoState } from "./types";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  expect(appWorkPending()).toBe(false);
});
it("retains overlapping work until every idempotent release finishes", () => {
  const events: boolean[] = [];
  cleanups.push(subscribeAppWork(() => events.push(appWorkPending())));
  const first = beginAppWork(),
    second = beginAppWork();
  expect(appWorkPending()).toBe(true);
  first();
  first();
  expect(appWorkPending()).toBe(true);
  second();
  expect(appWorkPending()).toBe(false);
  expect(events).toEqual([true, true, true, false]);
});
it("preserves asynchronous return values and rejection identity", async () => {
  const failure = new Error("retained failure");
  const target = trackAppWork(
    {
      async value(input: string) {
        return input;
      },
      async fail() {
        throw failure;
      },
    },
    ["value", "fail"],
  );
  await expect(target.value("original value")).resolves.toBe("original value");
  await expect(target.fail()).rejects.toBe(failure);
  expect(appWorkPending()).toBe(false);
});
it("blocks updates through an actual accepted command and its delayed reconciliation without altering money", async () => {
  const fixture = await authenticationFixture();
  cleanups.push(fixture.dispose);
  let release!: () => void, arrived!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  const controller = createE1StoreController<DemoState, { name: string }>({
    companyId: fixture.companyId,
    repository: fixture.repository,
    authentication: fixture.service,
    projectView: (state) => ({ name: state.products[0].name_en }),
    signedOutView: () => ({ name: "" }),
    persistIdentity: writeIdentity,
    publish: () => undefined,
    reconcileAfterCommit: async () => {
      arrived();
      await barrier;
    },
  });
  cleanups.push(() => controller.dispose());
  const session = await fixture.service.switchDemoUser(
    fixture.companyId,
    "manager",
  );
  await controller.resume(session.identity);
  const before = (
    await fixture.repository.loadBusiness<DemoState>(fixture.companyId)
  ).state;
  const accepted = controller.command(
    "catalog.edit",
    { company_id: fixture.companyId, kind: "company_shared" },
    (draft) => {
      draft.products[0].name_en = "Phone presentation proof";
      return draft.products[0].code;
    },
  );
  expect(appWorkPending()).toBe(true);
  try {
    await entered;
    expect(appWorkPending()).toBe(true);
    const committed = (
      await fixture.repository.loadBusiness<DemoState>(fixture.companyId)
    ).state;
    expect(committed.products[0].name_en).toBe("Phone presentation proof");
    expect(committed.stock).toEqual(before.stock);
    expect(committed.ledger).toEqual(before.ledger);
  } finally {
    release();
  }
  await expect(accepted).resolves.toBe(before.products[0].code);
  expect(appWorkPending()).toBe(false);
});
