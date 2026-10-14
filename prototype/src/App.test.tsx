import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setImmediate as nativeSetImmediate } from "node:timers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { pages } from "./App";
import { DemoProvider, initialState } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { LEGACY_AUTH_STORAGE_KEY } from "./authority-initialization";
import { LANGUAGE_KEY } from "./auth-preferences.e1";
import {
  shellProviderFixture,
  legacyEmployee,
  retainedCashierLocationFixture,
} from "./shell-provider-test-fixture";
import type { ProviderOptions } from "./store";
import type { DemoState } from "./types";
import i18n from "./i18n";
const fixtures: { dispose(): void }[] = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
  void i18n.changeLanguage("en");
});
afterEach(() => {
  fixtures.splice(0).forEach((fixture) => fixture.dispose());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function show(state?: DemoState, options?: ProviderOptions) {
  const fixture = options ? null : shellProviderFixture(state);
  if (fixture) fixtures.push(fixture);
  const actual = options ?? fixture!.options;
  const view = render(
    <DemoProvider options={actual}>
      <App />
    </DemoProvider>,
  );
  await screen.findByRole("heading", { name: "Sign in" }, { timeout: 10000 });
  return { ...view, options: actual };
}
async function signedInFixture(
  role: Parameters<typeof authenticatedProviderFixture>[0]["role"],
  now?: Date,
) {
  const fixture = await authenticatedProviderFixture({
    state: initialState(),
    role,
    actorOptions: { now },
  });
  fixtures.push(fixture);
  return fixture;
}
async function showAuthenticated(options: ProviderOptions) {
  const view = render(
    <DemoProvider options={options}>
      <App />
    </DemoProvider>,
  );
  await actualReady(() =>
    screen.queryByRole("navigation", { name: /Pages|صفحه‌ها/ }),
  );
  return view;
}
/** UI timers are controlled, while genuine IDB/crypto still finish in native tasks. */
async function actualReady(read: () => HTMLElement | null) {
  const deadline = performance.now() + 10000;
  while (!read()) {
    if (performance.now() >= deadline)
      throw new Error("Actual Provider did not become ready within 10 seconds");
    await act(async () => {
      await new Promise<void>((resolve) => nativeSetImmediate(resolve));
    });
  }
}
async function signIn(username: string, password = "demo1234") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), username);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  if (
    ["manager", "supervisor", "owner", "rh-supervisor"].includes(username) &&
    password === "demo1234"
  ) {
    await user.click(
      await screen.findByRole(
        "button",
        { name: "Use simulated passkey" },
        { timeout: 10000 },
      ),
    );
  }
  return user;
}
async function openUserMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "User menu" }));
}
describe("E1 authentication and role-aware shell", () => {
  it("assigns a distinct icon to every sidebar destination", () => {
    expect(new Set(pages.map((page) => page.icon)).size).toBe(pages.length);
    expect(pages.find((page) => page.key === "invoices")?.icon).not.toBe(
      pages.find((page) => page.key === "received")?.icon,
    );
    expect(pages.find((page) => page.key === "orders")?.icon).not.toBe(
      pages.find((page) => page.key === "approvals")?.icon,
    );
  });
  it("hides lookup and navigation for a retained Cashier session whose store has become a warehouse", async () => {
    const fixture = await retainedCashierLocationFixture();
    fixtures.push(fixture);
    window.location.hash = "lookup";
    await show(undefined, fixture.options);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Pages" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Cashier lookup" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Location" }),
    ).not.toBeInTheDocument();
    expect((await fixture.readCanonical()).config.branches[0].type).toBe(
      "warehouse",
    );
  });
  it("uses username and password, explains a failed attempt, and has a show/hide control", async () => {
    await show();
    expect(screen.queryByLabelText("Demo PIN")).not.toBeInTheDocument();
    const user = await signIn("cashier", "wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The username or password is incorrect. Try again.",
    );
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const nav = within(
      await screen.findByRole(
        "navigation",
        { name: "Pages" },
        { timeout: 10000 },
      ),
    );
    expect(nav.getAllByRole("link")).toHaveLength(1);
    expect(nav.getByRole("link", { name: "Lookup" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("combobox", { name: "Branch" }),
    ).not.toBeInTheDocument();
  });
  it("prevents Floor Workers from reaching Payables and Settings by hash", async () => {
    await show();
    await signIn("floorworker");
    await screen.findByRole(
      "navigation",
      { name: "Pages" },
      { timeout: 10000 },
    );
    window.location.hash = "payables";
    fireEvent(window, new HashChangeEvent("hashchange"));
    const nav = within(screen.getByRole("navigation", { name: "Pages" }));
    expect(
      nav.queryByRole("link", { name: "Payables" }),
    ).not.toBeInTheDocument();
    expect(
      nav.queryByRole("link", { name: "Settings" }),
    ).not.toBeInTheDocument();
    expect(
      nav.queryByRole("link", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Payables" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("You do not have permission for this action."),
    ).toBeVisible();
    window.location.hash = "";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Invoices" },
        { timeout: 10000 },
      ),
    ).toBeVisible();
    window.location.hash = "settings";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      screen.getByText("Only an Owner or Manager can change Settings."),
    ).toBeVisible();
  });
  it("retires a denied route on explicit sign-out so a new sign-in opens its permitted home", async () => {
    await show();
    const user = await signIn("floorworker");
    await screen.findByRole(
      "navigation",
      { name: "Pages" },
      { timeout: 10000 },
    );
    window.location.hash = "payables?name=previous-session";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      screen.getByText("You do not have permission for this action."),
    ).toBeVisible();
    await openUserMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await screen.findByRole("heading", { name: "Sign in" });
    await waitFor(() => expect(window.location.hash).toBe(""));
    await signIn("floorworker");
    expect(
      await screen.findByRole(
        "heading",
        { name: "Invoices" },
        { timeout: 10000 },
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("You do not have permission for this action."),
    ).not.toBeInTheDocument();
    // A direct private route in the new authenticated session is still denied.
    window.location.hash = "payables";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      screen.getByText("You do not have permission for this action."),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Payables" }),
    ).not.toBeInTheDocument();
  });
  it("uses a custom location selector and supports Persian RTL", async () => {
    await show();
    const user = await signIn("supervisor");
    await user.click(
      await screen.findByRole(
        "combobox",
        { name: "Location" },
        { timeout: 10000 },
      ),
    );
    await user.click(screen.getByRole("option", { name: "Richmond Hill" }));
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Location" }),
      ).toHaveTextContent("Richmond Hill"),
    );
    expect(document.querySelector("select")).toBeNull();
    const toPersian = screen.getByRole("button", { name: "Switch to Persian" });
    expect(toPersian).toHaveTextContent("فا");
    expect(
      screen.queryByRole("button", { name: "English" }),
    ).not.toBeInTheDocument();
    await user.click(toPersian);
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("navigation", { name: "صفحه‌ها" })).toBeVisible();
    const toEnglish = screen.getByRole("button", { name: "تغییر به انگلیسی" });
    expect(toEnglish).toHaveTextContent("EN");
    expect(
      screen.queryByRole("button", { name: "Switch to Persian" }),
    ).not.toBeInTheDocument();
    await user.click(toEnglish);
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });
  it("only offers a language switch when that target language is configured", async () => {
    const state = initialState();
    state.config.company.ui_languages = ["en"];
    await show(state);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Switch to Persian" }),
    ).not.toBeInTheDocument();
  });
  it("blocks every hash until the new employee saves a valid new password and persists it", async () => {
    localStorage.setItem(LEGACY_AUTH_STORAGE_KEY, legacyEmployee);
    const view = await show();
    const user = await signIn("newemployee", "temp1234");
    expect(
      await screen.findByRole(
        "heading",
        { name: "Choose a new password" },
        { timeout: 10000 },
      ),
    ).toBeVisible();
    for (const page of [
      "invoices",
      "lookup",
      "dashboard",
      "products",
      "payables",
    ]) {
      window.location.hash = page;
      fireEvent(window, new HashChangeEvent("hashchange"));
      expect(
        screen.queryByRole("navigation", { name: "Pages" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Choose a new password" }),
      ).toBeVisible();
    }
    await user.type(screen.getByLabelText("New password"), "password");
    await user.type(screen.getByLabelText("Confirm password"), "password");
    await user.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This password is too common.",
    );
    await user.clear(screen.getByLabelText("New password"));
    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(screen.getByLabelText("New password"), "summer orchard");
    await user.type(
      screen.getByLabelText("Confirm password"),
      "summer orchard",
    );
    await user.click(screen.getByRole("button", { name: "Save password" }));
    await screen.findByRole(
      "navigation",
      { name: "Pages" },
      { timeout: 10000 },
    );
    expect(
      screen.getByText("You do not have permission for this action."),
    ).toBeVisible();
    window.location.hash = "";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Invoices" },
        { timeout: 10000 },
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "User menu" })).toHaveTextContent(
      "Demo New Employee",
    );
    const repository = view.options.repository!;
    expect(
      (await repository.load(view.options.companyId)).people.find(
        (person) => person.username === "newemployee",
      )?.setup.password_complete,
    ).toBe(true);
    await openUserMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(
      await screen.findByText("Recent users on this computer"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "New Employee" }));
    expect(screen.getByLabelText("Username")).toHaveValue("newemployee");
    await user.type(screen.getByLabelText("Password"), "temp1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("incorrect");
    view.unmount();
    await show(undefined, view.options);
    await signIn("newemployee", "summer orchard");
    expect(
      await screen.findByRole(
        "heading",
        { name: "Invoices" },
        { timeout: 10000 },
      ),
    ).toBeVisible();
  });
  it("locks the same user, rejects another account password, and allows someone else to sign in", async () => {
    await show();
    const user = await signIn("cashier");
    await screen.findByRole(
      "navigation",
      { name: "Pages" },
      { timeout: 10000 },
    );
    await openUserMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Lock" }));
    expect(
      await screen.findByRole("heading", { name: "Screen locked" }),
    ).toBeVisible();
    window.location.hash = "lookup";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      screen.queryByRole("navigation", { name: "Pages" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Password"), "temp1234");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("incorrect");
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    expect(
      await screen.findByRole("navigation", { name: "Pages" }),
    ).toBeVisible();
    await openUserMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Lock" }));
    await user.click(
      await screen.findByRole("button", { name: "Sign in as someone else" }),
    );
    await signIn("floorworker");
    expect(
      await screen.findByRole(
        "button",
        { name: "User menu" },
        { timeout: 10000 },
      ),
    ).toHaveTextContent("Demo North York Floor Worker");
  });
  it("keeps demo controls in the Demo menu, confirms reset, and remembers theme and text size", async () => {
    const view = await show();
    const user = await signIn("cashier");
    await screen.findByRole(
      "navigation",
      { name: "Pages" },
      { timeout: 10000 },
    );
    expect(
      screen.queryByRole("button", { name: "Reset demo" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Demo" }));
    await user.click(screen.getByRole("menuitem", { name: "Reset demo" }));
    const dialog = screen.getByRole("dialog", { name: "Reset demo" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Comfortable text size" }),
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute(
      "data-text-size",
      "comfortable",
    );
    const before = (
      await view.options.repository!.loadBusiness(view.options.companyId)
    ).state;
    view.unmount();
    await showAuthenticated(view.options);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute(
      "data-text-size",
      "comfortable",
    );
    expect(
      (await view.options.repository!.loadBusiness(view.options.companyId))
        .state,
    ).toEqual(before);
  });
  it("focuses global product search with / and routes its query to Lookup", async () => {
    await show();
    const user = await signIn("cashier");
    const nav = await screen.findByRole(
      "navigation",
      { name: "Pages" },
      { timeout: 10000 },
    );
    await user.click(within(nav).getByRole("link", { name: "Lookup" }));
    screen.getByRole("main").focus();
    await user.keyboard("/");
    const search = screen.getByRole("textbox", { name: "Search all products" });
    expect(search).toHaveFocus();
    await user.type(search, "sumac{Enter}");
    expect(window.location.hash).toBe("#lookup?search=sumac");
  });
  it("locks after the configured idle time", async () => {
    const fixture = await signedInFixture("cashier");
    vi.useFakeTimers({
      toFake: [
        "Date",
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
      ],
    });
    vi.stubGlobal("setImmediate", nativeSetImmediate);
    await showAuthenticated(fixture.options);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60000);
    });
    await actualReady(() =>
      screen.queryByRole("heading", { name: "Screen locked" }),
    );
    expect(
      screen.getByRole("heading", { name: "Screen locked" }),
    ).toBeVisible();
  });
  it("requires a password before rendering a sensitive page after fifteen minutes", async () => {
    const fixture = await signedInFixture(
      "manager",
      new Date(Date.now() - 16 * 60000),
    );
    window.location.hash = "payables";
    await showAuthenticated(fixture.options);
    expect(
      screen.getByRole("dialog", { name: "Confirm your password" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Payables" }),
    ).not.toBeInTheDocument();
  });
  it("renders restored Persian copy before the language effect runs", async () => {
    const fixture = await signedInFixture("cashier");
    localStorage.setItem(LANGUAGE_KEY, "fa");
    window.location.hash = "lookup";
    render(
      <DemoProvider options={fixture.options}>
        <App />
      </DemoProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("در حال بارگذاری");
    expect(screen.queryByText("Loading…")).toBeNull();
    expect(
      await screen.findByRole(
        "heading",
        { name: "جست‌وجوی صندوق‌دار" },
        { timeout: 10000 },
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Cashier lookup" }),
    ).toBeNull();
  });
  it("re-prompts on a sensitive screen once password entry expires while the user stays active", async () => {
    const fixture = await signedInFixture("manager");
    window.location.hash = "payables";
    vi.useFakeTimers({
      toFake: [
        "Date",
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
      ],
    });
    vi.stubGlobal("setImmediate", nativeSetImmediate);
    await showAuthenticated(fixture.options);
    await actualReady(() =>
      screen.queryByRole("heading", { name: "Payables" }),
    );
    expect(screen.getByRole("heading", { name: "Payables" })).toBeVisible();
    for (let interval = 0; interval < 4; interval++) {
      fireEvent.pointerMove(window);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4 * 60000);
      });
    }
    await actualReady(() =>
      screen.queryByRole("dialog", { name: "Confirm your password" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Confirm your password" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Payables" }),
    ).not.toBeInTheDocument();
  });
});
