import { beforeEach, describe, expect, it } from "vitest";
import { configSeed } from "./config";
import {
  AUTH_STORAGE_KEY,
  SESSION_KEY,
  readAuthSession,
  authenticate,
  demoUsers,
  initialAuth,
  passwordError,
  preferencesFor,
  readAuth,
  replacePassword,
} from "./auth";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
const settings = configSeed.session;
describe("fictional username and password accounts", () => {
  it("has four distinct accounts, including two distinct Floor Workers", () => {
    expect(demoUsers.map((user) => user.username)).toEqual([
      "supervisor",
      "floorworker",
      "cashier",
      "newemployee",
    ]);
    expect(
      demoUsers.filter((user) => user.role === "floor_worker"),
    ).toHaveLength(2);
    expect(initialAuth().accounts.newemployee.mustChangePassword).toBe(true);
  });
  it("checks the password and records only successful users as recent users", () => {
    const failed = authenticate(initialAuth(), "cashier", "wrong", settings);
    expect(failed.error).toBe("invalid");
    expect(failed.state.recentUsers).toEqual([]);
    const signedIn = authenticate(
      failed.state,
      " CASHIER ",
      "demo1234",
      settings,
    );
    expect(signedIn.user?.username).toBe("cashier");
    expect(signedIn.state.accounts.cashier.failedAttempts).toBe(0);
    expect(signedIn.state.recentUsers).toEqual(["cashier"]);
    expect(signedIn.state.audit.map((entry) => entry.action)).toEqual([
      "Failed sign-in",
      "Signed in",
    ]);
  });
  it("locks after five failures and permits the correct password after fifteen minutes", () => {
    let auth = initialAuth();
    const now = Date.UTC(2026, 9, 6);
    for (let attempt = 0; attempt < 5; attempt++)
      auth = authenticate(auth, "supervisor", "wrong", settings, now).state;
    expect(auth.accounts.supervisor.lockedUntil).toBe(now + 15 * 60_000);
    expect(
      authenticate(auth, "supervisor", "demo1234", settings, now + 14 * 60_000)
        .error,
    ).toBe("locked");
    const success = authenticate(
      auth,
      "supervisor",
      "demo1234",
      settings,
      now + 15 * 60_000,
    );
    expect(success.error).toBeUndefined();
    expect(success.state.accounts.supervisor.failedAttempts).toBe(0);
  });
  it("blocks short and common passwords and permanently replaces the temporary password", () => {
    expect(passwordError("short", settings)).toBe("too_short");
    expect(passwordError("password", settings)).toBe("common");
    expect(passwordError("demo1234", settings)).toBe("common");
    const changed = replacePassword(
      initialAuth(),
      "newemployee",
      "summer orchard",
      settings,
    );
    expect(changed.error).toBeUndefined();
    expect(changed.state.accounts.newemployee.mustChangePassword).toBe(false);
    expect(
      authenticate(changed.state, "newemployee", "temp1234", settings).error,
    ).toBe("invalid");
    expect(
      authenticate(changed.state, "newemployee", "summer orchard", settings)
        .user?.username,
    ).toBe("newemployee");
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(changed.state));
    expect(
      authenticate(readAuth(), "newemployee", "summer orchard", settings).user
        ?.username,
    ).toBe("newemployee");
  });
  it("restores user preferences separately from shared device preferences", () => {
    const auth = initialAuth();
    auth.devicePreferences = { theme: "dark", comfortableText: true };
    auth.preferences.cashier = { theme: "light", comfortableText: false };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    expect(preferencesFor(readAuth(), "cashier")).toEqual({
      theme: "light",
      comfortableText: false,
      comfortableTextExplicit: false,
    });
    expect(preferencesFor(readAuth(), "floorworker")).toEqual({
      theme: "dark",
      comfortableText: true,
      comfortableTextExplicit: true,
    });
    localStorage.setItem(AUTH_STORAGE_KEY, "{broken");
    expect(preferencesFor(readAuth(), null)).toEqual({
      theme: "light",
      comfortableText: false,
      comfortableTextExplicit: false,
    });
  });
});

describe("configured branches and text preference persistence", () => {
  it("restores a Supervisor's newly configured branch but rejects unrelated branches", () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: "supervisor",
        branch: "Branch 4",
        lang: "fa",
        locked: false,
        authenticatedAt: 42,
      }),
    );
    expect(readAuthSession(["Branch 1", "Branch 4"])).toMatchObject({
      branch: "Branch 4",
      lang: "fa",
    });
    expect(readAuthSession(["Branch 1"])).toMatchObject({ branch: "Branch 1" });
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: "floorworker",
        branch: "Branch 4",
        lang: "en",
      }),
    );
    expect(readAuthSession(["Branch 1", "Branch 4"])).toMatchObject({
      branch: "Branch 1",
    });
  });
  it("keeps explicit normal text separate from a company large-text default", () => {
    const state = initialAuth();
    state.preferences.supervisor = {
      theme: "dark",
      comfortableText: false,
      comfortableTextExplicit: true,
    };
    expect(preferencesFor(state, "supervisor")).toMatchObject({
      comfortableText: false,
      comfortableTextExplicit: true,
    });
    expect(preferencesFor(state, "floorworker")).toMatchObject({
      comfortableTextExplicit: false,
    });
  });
});
