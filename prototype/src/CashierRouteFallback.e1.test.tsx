import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { DemoProvider, initialState } from "./store";
import i18n from "./i18n";

let fixture:
  Awaited<ReturnType<typeof authenticatedProviderFixture>> | undefined;

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  fixture = undefined;
  vi.unstubAllGlobals();
});

async function actualCashierHome() {
  fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "cashier",
    actorOptions: {
      selection: { kind: "location", location_id: "Branch 1" },
    },
  });
  render(
    <DemoProvider options={fixture.options}>
      <App />
    </DemoProvider>,
  );
  await screen.findByRole(
    "heading",
    { name: "Cashier lookup" },
    { timeout: 10000 },
  );
}
function visit(route: string) {
  window.location.hash = route;
  fireEvent(window, new HashChangeEvent("hashchange"));
}

it("keeps the actual Cashier's safe Lookup home for a plain unsupported Received route", async () => {
  await actualCashierHome();
  visit("received");
  expect(
    await screen.findByRole("heading", { name: "Cashier lookup" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Received" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Received" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("You do not have permission for this action."),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Store cost", { exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Margin %", { exact: true }),
  ).not.toBeInTheDocument();
});

it.each(["received?id=foreign-receipt", "received?location=Warehouse"])(
  "keeps the actual Cashier's parameterized protected route %s denied",
  async (route) => {
    await actualCashierHome();
    visit(route);
    expect(
      await screen.findByText("You do not have permission for this action."),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Cashier lookup" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Received" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Received" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Store cost", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Margin %", { exact: true }),
    ).not.toBeInTheDocument();
  },
);
