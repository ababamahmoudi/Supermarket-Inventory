import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticationFixture } from "./shell-provider-test-fixture";
import {
  createE1StoreController,
  type ShellSnapshot,
} from "./e1-store-controller";
import { AuthorityStorageError } from "./authority-repository";
import { writeIdentity } from "./auth-preferences.e1";
import { createPeopleService } from "./people";
import { newAuthorityId, prepareSetupCode } from "./credentials";
import type { DemoState } from "./types";
const fixtures: Awaited<ReturnType<typeof authenticationFixture>>[] = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  fixtures.splice(0).forEach((fixture) => fixture.dispose());
  vi.unstubAllGlobals();
});
async function setup(
  extra: {
    reconcileAfterCommit?: () => Promise<void>;
    reportReconciliationError?: (error: unknown) => void;
  } = {},
) {
  const fixture = await authenticationFixture();
  fixtures.push(fixture);
  const snapshots: ShellSnapshot<{ name: string }>[] = [];
  const controller = createE1StoreController<DemoState, { name: string }>({
    companyId: fixture.companyId,
    repository: fixture.repository,
    authentication: fixture.service,
    projectView: (state) => ({ name: state.products[0].name_en }),
    signedOutView: () => ({ name: "" }),
    persistIdentity: writeIdentity,
    publish: (snapshot) => snapshots.push(snapshot),
    ...extra,
  });
  return { fixture, controller, snapshots };
}
describe("actual E1 interactive authentication and accepted-commit boundary", () => {
  it("keeps interactive failed sign-in on the same signed-out stage without publishing password or private data", async () => {
    const { controller, snapshots } = await setup();
    await controller.resume(null);
    const attempt = controller.signIn("cashier", "wrong");
    expect(snapshots.at(-1)?.stage).toBe("signed_out");
    expect(snapshots.at(-1)?.actor).toBeNull();
    expect(snapshots.at(-1)?.view).toEqual({ name: "" });
    expect(JSON.stringify(snapshots.at(-1))).not.toContain("wrong");
    await expect(attempt).rejects.toMatchObject({ code: "invalid" });
    expect(snapshots.at(-1)?.stage).toBe("signed_out");
    controller.dispose();
  });
  it("retains the accepted saved result and canonical change when a separate reminder job fails", async () => {
    const failure = new AuthorityStorageError("unavailable");
    const reported: unknown[] = [];
    const { fixture, controller, snapshots } = await setup({
      reconcileAfterCommit: async () => {
        throw failure;
      },
      reportReconciliationError: (error) => reported.push(error),
    });
    const session = await fixture.service.switchDemoUser(
      fixture.companyId,
      "manager",
    );
    await controller.resume(session.identity);
    const before = (
      await fixture.repository.loadBusiness<DemoState>(fixture.companyId)
    ).state;
    await expect(
      controller.command(
        "catalog.edit",
        { company_id: fixture.companyId, kind: "company_shared" },
        (draft) => {
          draft.products[0].name_en = "Changed only in browser";
          return "saved";
        },
      ),
    ).resolves.toBe("saved");
    const saved = (
      await fixture.repository.loadBusiness<DemoState>(fixture.companyId)
    ).state;
    expect(saved.products[0].name_en).toBe("Changed only in browser");
    expect(saved.stock).toEqual(before.stock);
    expect(saved.ledger).toEqual(before.ledger);
    expect(reported).toEqual([failure]);
    expect(snapshots.at(-1)?.view.name).toBe("Changed only in browser");
    controller.dispose();
  });
  it("reads genuine protected authority history without republishing the public snapshot", async () => {
    const { fixture, controller, snapshots } = await setup();
    const session = await fixture.service.switchDemoUser(
      fixture.companyId,
      "manager",
    );
    await controller.resume(session.identity);
    const cashier = await fixture.service.switchDemoUser(
      fixture.companyId,
      "cashier",
    );
    const people = createPeopleService({
      repository: fixture.repository,
      state: () => {
        throw new Error(
          "The initialized real repository must supply canonical business.",
        );
      },
      prepareSetupCode,
      createId: newAuthorityId,
    });
    await controller.authorityAction((identity) =>
      people.deactivatePerson({
        identity,
        request_id: newAuthorityId("request"),
        input: {
          person_id: cashier.person.id,
          expected_version: cashier.person.version,
          reason: "Create real authority history before testing its read",
        },
      }),
    );
    const before = snapshots.at(-1);
    const published = snapshots.length;
    const rows = await controller.authorityRead(
      "history.read_all",
      { company_id: fixture.companyId, kind: "company_shared" },
      (identity) => fixture.repository.authorityHistory(identity),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(snapshots).toHaveLength(published);
    expect(snapshots.at(-1)).toBe(before);
    expect(snapshots.at(-1)?.actor?.user_id).toBe(session.person.id);
    controller.dispose();
  });
  it("withholds a delayed genuine read after persisted Manager revocation without relying on an invalidation hint", async () => {
    const { fixture, controller, snapshots } = await setup();
    const manager = await fixture.service.switchDemoUser(
      fixture.companyId,
      "manager",
    );
    await controller.resume(manager.identity);
    let arrived!: () => void, release!: () => void;
    const readCompleted = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    const continueRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    let returnedPrivateRows = false;
    const pending = controller
      .authorityRead(
        "history.read_all",
        { company_id: fixture.companyId, kind: "company_shared" },
        async (identity) => {
          const rows = await fixture.repository.authorityHistory(identity);
          arrived();
          await continueRead;
          return rows;
        },
      )
      .then((rows) => {
        returnedPrivateRows = true;
        return rows;
      });
    const rejected = expect(pending).rejects.toMatchObject({ code: "revoked" });
    await readCompleted;
    const owner = await fixture.service.switchDemoUser(
      fixture.companyId,
      "owner",
    );
    const people = createPeopleService({
      repository: fixture.repository,
      state: () => {
        throw new Error(
          "The initialized real repository must supply canonical business.",
        );
      },
      prepareSetupCode,
      createId: newAuthorityId,
    });
    await people.deactivatePerson({
      identity: owner.identity,
      request_id: newAuthorityId("request"),
      input: {
        person_id: manager.person.id,
        expected_version: manager.person.version,
        reason: "Delayed private read revocation regression",
      },
    });
    // No runtime subscriber invalidates this controller; only its actual
    // post-await persisted-authority check can reject the retained result.
    release();
    await rejected;
    expect(returnedPrivateRows).toBe(false);
    expect(snapshots.at(-1)?.stage).toBe("signed_out");
    expect(snapshots.at(-1)?.actor).toBeNull();
    expect(snapshots.at(-1)?.view).toEqual({ name: "" });
    controller.dispose();
  });
});
