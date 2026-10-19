import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoUsers } from "./auth";
import { initialState } from "./store";
import { resolveActor, bindAuthoritySnapshot } from "./authority";
import {
  AUTH_PREFERENCES_KEY,
  LANGUAGE_KEY,
  emptyPreferences,
  preferencesFor,
  readPreferences,
  rememberRecentPerson,
  writePreferences,
} from "./auth-preferences.e1";
import {
  authenticationFixture,
  legacyEmployee,
} from "./shell-provider-test-fixture";
const fixtures: Awaited<ReturnType<typeof authenticationFixture>>[] = [];
async function setup(input?: Parameters<typeof authenticationFixture>[0]) {
  const fixture = await authenticationFixture(input);
  fixtures.push(fixture);
  return fixture;
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  fixtures.splice(0).forEach((fixture) => fixture.dispose());
  vi.unstubAllGlobals();
});
describe("fictional username and password accounts", () => {
  it("has six distinct accounts, including two distinct Floor Workers, and retains migrated employee setup", async () => {
    expect(demoUsers.map((user) => user.username)).toEqual([
      "owner",
      "manager",
      "rh-supervisor",
      "ny-floor",
      "wh-floor",
      "cashier",
    ]);
    expect(
      demoUsers.filter((user) => user.role === "floor_worker"),
    ).toHaveLength(2);
    const fixture = await setup({ legacy: legacyEmployee });
    const document = await fixture.readPrivate();
    expect(
      document.people.find((person) => person.username === "newemployee")?.setup
        .password_complete,
    ).toBe(false);
    expect(
      document.people.find((person) => person.username === "newemployee")
        ?.demo_fixture,
    ).toBe(false);
  });
  it("checks the password and records only successful users as recent users", async () => {
    const fixture = await setup();
    await expect(
      fixture.service.signIn({
        company_id: fixture.companyId,
        username: "cashier",
        password_or_setup_code: "wrong",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(readPreferences().recent_user_ids).toEqual([]);
    const signedIn = await fixture.service.signIn({
      company_id: fixture.companyId,
      username: " CASHIER ",
      password_or_setup_code: "demo1234",
    });
    expect(signedIn.person.username).toBe("cashier");
    expect(signedIn.next).toBe("complete");
    writePreferences(
      rememberRecentPerson(readPreferences(), signedIn.person.id),
    );
    const document = await fixture.readPrivate();
    expect(
      document.credentials.find((row) => row.user_id === signedIn.person.id)
        ?.failed_attempts,
    ).toBe(0);
    expect(readPreferences().recent_user_ids).toEqual(["demo-person-cashier"]);
    expect(document.authentication_audit?.map((entry) => entry.action)).toEqual(
      ["Failed sign-in", "Signed in"],
    );
  });
  it("locks after five failures and permits the correct password after fifteen minutes", async () => {
    let now = new Date("2026-10-06T00:00:00Z");
    const fixture = await setup({ now: () => now });
    for (let attempt = 0; attempt < 5; attempt++)
      await expect(
        fixture.service.signIn({
          company_id: fixture.companyId,
          username: "manager",
          password_or_setup_code: "wrong",
        }),
      ).rejects.toMatchObject({ code: attempt === 4 ? "locked" : "invalid" });
    expect(
      (await fixture.readPrivate()).credentials.find(
        (row) => row.user_id === "demo-person-manager",
      )?.locked_until,
    ).toBe("2026-10-06T00:15:00.000Z");
    now = new Date("2026-10-06T00:14:00Z");
    await expect(
      fixture.service.signIn({
        company_id: fixture.companyId,
        username: "manager",
        password_or_setup_code: "demo1234",
      }),
    ).rejects.toMatchObject({ code: "locked" });
    now = new Date("2026-10-06T00:15:00Z");
    const success = await fixture.service.signIn({
      company_id: fixture.companyId,
      username: "manager",
      password_or_setup_code: "demo1234",
    });
    expect(success.next).toBe("second_step_challenge");
    expect(
      (await fixture.readPrivate()).credentials.find(
        (row) => row.user_id === "demo-person-manager",
      )?.failed_attempts,
    ).toBe(0);
  });
  it("blocks short and common passwords and permanently replaces the temporary password", async () => {
    const fixture = await setup({ legacy: legacyEmployee });
    const setupSession = await fixture.service.signIn({
      company_id: fixture.companyId,
      username: "newemployee",
      password_or_setup_code: "temp1234",
    });
    for (const [password, code] of [
      ["short", "too_short"],
      ["password", "common"],
      ["demo1234", "common"],
    ])
      await expect(
        fixture.service.choosePassword(setupSession.identity, password),
      ).rejects.toMatchObject({ code });
    const changed = await fixture.service.choosePassword(
      setupSession.identity,
      "summer orchard",
    );
    expect(changed.next).toBe("complete");
    expect(
      (await fixture.readPrivate()).people.find(
        (person) => person.username === "newemployee",
      )?.setup.password_complete,
    ).toBe(true);
    await expect(
      fixture.service.signIn({
        company_id: fixture.companyId,
        username: "newemployee",
        password_or_setup_code: "temp1234",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    const signedIn = await fixture.service.signIn({
      company_id: fixture.companyId,
      username: "newemployee",
      password_or_setup_code: "summer orchard",
    });
    expect(signedIn.person.username).toBe("newemployee");
    const restored = await fixture.repository.load(fixture.companyId);
    expect(
      restored.people.find((person) => person.username === "newemployee")?.setup
        .password_complete,
    ).toBe(true);
    expect((await fixture.service.resume(signedIn.identity))?.next).toBe(
      "complete",
    );
  });
  it("restores user preferences separately from shared device preferences without replacing malformed originals", () => {
    const preferences = emptyPreferences();
    preferences.device_preferences = {
      theme: "dark",
      comfortableText: true,
      comfortableTextExplicit: true,
    };
    preferences.by_user_id["demo-person-cashier"] = {
      theme: "light",
      comfortableText: false,
      comfortableTextExplicit: false,
    };
    writePreferences(preferences);
    expect(preferencesFor(readPreferences(), "demo-person-cashier")).toEqual({
      theme: "light",
      comfortableText: false,
      comfortableTextExplicit: false,
    });
    expect(preferencesFor(readPreferences(), "demo-person-ny-floor")).toEqual({
      theme: "dark",
      comfortableText: true,
      comfortableTextExplicit: true,
    });
    localStorage.setItem(AUTH_PREFERENCES_KEY, "{broken");
    expect(() => readPreferences()).toThrow();
    expect(localStorage.getItem(AUTH_PREFERENCES_KEY)).toBe("{broken");
  });
});
describe("configured branches and text preference persistence", () => {
  it("restores a Manager newly configured location but rejects unrelated worker locations", async () => {
    const state = initialState();
    state.config.branches.push({
      ...state.config.branches[0],
      code: "B4",
      id: "Branch 4",
      name_en: "Retained configured store",
    });
    const fixture = await setup({ state });
    const manager = await fixture.service.switchDemoUser(
      fixture.companyId,
      "manager",
    );
    await fixture.service.setLocation(manager.identity, {
      kind: "location",
      location_id: "Branch 4",
    });
    const resumed = await fixture.service.resume(manager.identity);
    const fresh = (await fixture.repository.loadBusiness(fixture.companyId))
      .state;
    bindAuthoritySnapshot(
      fresh,
      await fixture.repository.load(fixture.companyId),
    );
    expect(resolveActor(fresh, resumed!.identity).branch).toBe("Branch 4");
    localStorage.setItem(LANGUAGE_KEY, "fa");
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("fa");
    const worker = await fixture.service.switchDemoUser(
      fixture.companyId,
      "ny-floor",
    );
    await expect(
      fixture.service.setLocation(worker.identity, {
        kind: "location",
        location_id: "Branch 4",
      }),
    ).rejects.toThrow();
    bindAuthoritySnapshot(
      fresh,
      await fixture.repository.load(fixture.companyId),
    );
    expect(resolveActor(fresh, worker.identity).branch).toBe("Branch 1");
  });
  it("keeps explicit normal text separate from a company large-text default", () => {
    const preferences = emptyPreferences();
    preferences.by_user_id["demo-person-manager"] = {
      theme: "dark",
      comfortableText: false,
      comfortableTextExplicit: true,
    };
    expect(preferencesFor(preferences, "demo-person-manager")).toMatchObject({
      comfortableText: false,
      comfortableTextExplicit: true,
    });
    expect(
      preferencesFor(preferences, "demo-person-ny-floor")
        .comfortableTextExplicit,
    ).toBeUndefined();
  });
});
