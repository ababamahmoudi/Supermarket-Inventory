import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { company } from "./config";
import i18n, { languageStorageKey } from "./i18n";

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

function healthyResponse() {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("development app shell", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(healthyResponse()));
  });

  it("shows configured company branding and the real API connection", async () => {
    renderApp();
    expect(
      screen.getByRole("heading", { name: "Your workspace is ready" }),
    ).toBeVisible();
    expect(screen.getAllByText(company.name).length).toBeGreaterThan(0);
    expect(await screen.findByText("Connected")).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      "/healthz",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      screen.queryByRole("button", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });

  it("switches to Persian, mirrors the page, and remembers the language", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "فارسی" }));
    expect(
      await screen.findByRole("heading", { name: "فضای کار شما آماده است" }),
    ).toBeVisible();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(document.documentElement).toHaveAttribute("lang", "fa");
    expect(localStorage.getItem(languageStorageKey)).toBe("fa");
    await user.click(screen.getByRole("button", { name: "English" }));
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });

  it("explains a failed connection and recovers when the owner retries", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network failure"))
      .mockResolvedValue(healthyResponse());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByText("Connection unavailable")).toBeVisible();
    expect(screen.getByText(/Start the services with make up/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("Connected")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not label an unexpected API response as connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "unhealthy" }), {
          status: 200,
        }),
      ),
    );
    renderApp();
    expect(await screen.findByText("Connection unavailable")).toBeVisible();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });

  it("opens the mobile menu with focus and closes it with Escape", async () => {
    const user = userEvent.setup();
    renderApp();
    const menu = screen.getByRole("button", { name: "Open menu" });
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(menu).toHaveAttribute("aria-expanded", "false"));
    expect(menu).toHaveFocus();
  });
});
