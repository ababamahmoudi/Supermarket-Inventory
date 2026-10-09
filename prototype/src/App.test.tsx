import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { pages } from "./App";
import { DemoProvider, initialState, STORAGE_KEY } from "./store";
import { AUTH_STORAGE_KEY, SESSION_KEY } from "./auth";
import i18n from "./i18n";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
  void i18n.changeLanguage("en");
});
afterEach(() => vi.useRealTimers());
function show() {
  return render(
    <DemoProvider>
      <App />
    </DemoProvider>,
  );
}
async function signIn(username: string, password = "demo1234") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), username);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}
async function openUserMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "User menu" }));
}
describe("V2 authentication and role-aware shell", () => {
  it("assigns a distinct icon to every sidebar destination", () => {
    expect(new Set(pages.map((page) => page.icon)).size).toBe(pages.length);
    expect(pages.find((page) => page.key === "invoices")?.icon).not.toBe(
      pages.find((page) => page.key === "received")?.icon,
    );
    expect(pages.find((page) => page.key === "orders")?.icon).not.toBe(
      pages.find((page) => page.key === "approvals")?.icon,
    );
  });
  it("hides lookup and navigation for a retained Cashier session whose store has become a warehouse", () => {
    const state = initialState();
    state.config.branches[0].type = "warehouse";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: "cashier",
        branch: "Branch 1",
        lang: "en",
        locked: false,
        authenticatedAt: Date.now(),
      }),
    );
    window.location.hash = "lookup";
    show();
    expect(
      screen.getByText(
        "This location is unavailable for your role. Ask your Supervisor to check your location assignment.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Pages" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Cashier lookup" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
  it("uses username and password, explains a failed attempt, and has a show/hide control", async () => {
    show();
    expect(screen.queryByLabelText("Demo PIN")).not.toBeInTheDocument();
    const user = await signIn("cashier", "wrong");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The username or password is incorrect. Try again.",
    );
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const nav = within(screen.getByRole("navigation", { name: "Pages" }));
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
    show();
    await signIn("floorworker");
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
      screen.queryByRole("heading", { name: "Payables" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });
  it("uses a custom branch selector and supports Persian RTL", async () => {
    show();
    const user = await signIn("supervisor");
    await user.click(screen.getByRole("combobox", { name: "Branch" }));
    await user.click(screen.getByRole("option", { name: "Richmond Hill" }));
    expect(screen.getByRole("combobox", { name: "Branch" })).toHaveTextContent(
      "Richmond Hill",
    );
    expect(document.querySelector("select")).toBeNull();
    await user.click(screen.getByRole("button", { name: "فارسی" }));
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("navigation", { name: "صفحه‌ها" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "English" }));
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });
  it("blocks every hash until the new employee saves a valid new password and persists it", async () => {
    const view = show();
    const user = await signIn("newemployee", "temp1234");
    expect(
      screen.getByRole("heading", { name: "Choose a new password" }),
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
    expect(screen.getByRole("alert")).toHaveTextContent(
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
    expect(screen.getByRole("heading", { name: "Invoices" })).toBeVisible();
    expect(screen.getByRole("button", { name: "User menu" })).toHaveTextContent(
      "Demo New Employee",
    );
    expect(
      JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)!).accounts.newemployee
        .mustChangePassword,
    ).toBe(false);
    await openUserMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(screen.getByText("Recent users on this computer")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "New Employee" }));
    expect(screen.getByLabelText("Username")).toHaveValue("newemployee");
    await user.type(screen.getByLabelText("Password"), "temp1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("incorrect");
    view.unmount();
    show();
    await signIn("newemployee", "summer orchard");
    expect(screen.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });
  it("locks the same user, rejects another account's password, and allows someone else to sign in", async () => {
    show();
    const user = await signIn("cashier");
    await openUserMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Lock" }));
    expect(
      screen.getByRole("heading", { name: "Screen locked" }),
    ).toBeVisible();
    window.location.hash = "lookup";
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      screen.queryByRole("navigation", { name: "Pages" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Password"), "temp1234");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.getByRole("alert")).toHaveTextContent("incorrect");
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeVisible();
    await openUserMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Lock" }));
    await user.click(
      screen.getByRole("button", { name: "Sign in as someone else" }),
    );
    await signIn("floorworker");
    expect(screen.getByRole("button", { name: "User menu" })).toHaveTextContent(
      "Demo Floor Worker",
    );
  });
  it("keeps demo controls in the Demo menu, confirms reset, and remembers theme and text size", async () => {
    const view = show();
    const user = await signIn("cashier");
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
    const business = localStorage.getItem(STORAGE_KEY);
    view.unmount();
    show();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute(
      "data-text-size",
      "comfortable",
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(business);
  });
  it("focuses global product search with / and routes its query to Lookup", async () => {
    show();
    const user = await signIn("cashier");
    await user.click(
      within(screen.getByRole("navigation", { name: "Pages" })).getByRole(
        "link",
        { name: "Lookup" },
      ),
    );
    await user.keyboard("/");
    const search = screen.getByRole("textbox", { name: "Search all products" });
    expect(search).toHaveFocus();
    await user.type(search, "sumac{Enter}");
    expect(window.location.hash).toBe("#lookup?search=sumac");
  });
  it("locks after the configured idle time", () => {
    vi.useFakeTimers();
    const now = Date.now();
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: "cashier",
        branch: "Branch 1",
        lang: "en",
        locked: false,
        authenticatedAt: now,
      }),
    );
    show();
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(
      screen.getByRole("heading", { name: "Screen locked" }),
    ).toBeVisible();
  });
  it("requires a password before rendering a sensitive page after fifteen minutes", () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: "supervisor",
        branch: "Branch 1",
        lang: "en",
        locked: false,
        authenticatedAt: Date.now() - 16 * 60_000,
      }),
    );
    window.location.hash = "payables";
    show();
    expect(
      screen.getByRole("dialog", { name: "Confirm your password" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Payables" }),
    ).not.toBeInTheDocument();
  });
  it("renders restored Persian copy before the language effect runs", () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: "cashier",
        branch: "Branch 1",
        lang: "fa",
        locked: false,
        authenticatedAt: Date.now(),
      }),
    );
    window.location.hash = "lookup";
    show();
    expect(
      screen.getByRole("heading", { name: "جست‌وجوی صندوق‌دار" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Cashier lookup" }),
    ).toBeNull();
  });
  it("re-prompts on a sensitive screen once the password entry expires while the user stays active", () => {
    vi.useFakeTimers();
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: "supervisor",
        branch: "Branch 1",
        lang: "en",
        locked: false,
        authenticatedAt: Date.now(),
      }),
    );
    window.location.hash = "payables";
    show();
    expect(screen.getByRole("heading", { name: "Payables" })).toBeVisible();
    for (let interval = 0; interval < 4; interval++) {
      fireEvent.pointerMove(window);
      act(() => {
        vi.advanceTimersByTime(4 * 60_000);
      });
    }
    expect(
      screen.getByRole("dialog", { name: "Confirm your password" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Payables" }),
    ).not.toBeInTheDocument();
  });
});
