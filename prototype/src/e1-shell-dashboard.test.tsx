import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DemoProvider, initialState, useDemo } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { authoritySnapshot } from "./authority";
import { locationDashboardView } from "./location-dashboard";
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "dashboard";
});
afterEach(() => {
  fixtures.splice(0).forEach((fixture) => fixture.dispose());
  vi.unstubAllGlobals();
});
async function setup(
  role: Parameters<typeof authenticatedProviderFixture>[0]["role"],
  locations?: string[],
) {
  const fixture = await authenticatedProviderFixture({
    state: initialState(),
    role,
    actorOptions: locations
      ? { locations, selection: { kind: "all_my_locations" } }
      : undefined,
  });
  fixtures.push(fixture);
  return fixture;
}
function ReadViewProbe() {
  const { state, actor, can } = useDemo();
  return (
    <>
      <output data-testid="actor">{actor?.role}</output>
      <output data-testid="public-view">{JSON.stringify(state)}</output>
      <output data-testid="bound">
        {(() => {
          try {
            authoritySnapshot(state);
            return "private directory leaked";
          } catch {
            return "unbound";
          }
        })()}
      </output>
      <output data-testid="company-dashboard">
        {String(can("dashboard.company"))}
      </output>
    </>
  );
}
describe("genuine E1 shell dashboard and public-view authority boundary", () => {
  it("renders the Branch Supervisor operational dashboard across assigned locations without supplier money", async () => {
    const fixture = await setup("branch_supervisor", ["Branch 2", "Branch 3"]);
    const dto = (
      await fixture.repository.queryBusiness<
        ReturnType<typeof initialState>,
        ReturnType<typeof locationDashboardView>
      >(fixture.identity, (state, actor) => locationDashboardView(state, actor))
    ).value;
    expect(dto.location_ids).toEqual(["Branch 2", "Branch 3"]);
    expect(Object.keys(dto)).toEqual([
      "location_ids",
      "arrivals",
      "sales",
      "dates",
      "returns",
      "requests",
      "notes",
    ]);
    expect(JSON.stringify(dto)).not.toMatch(
      /"(?:amount|balance|unit_cost|cost|margin|supplier_balance|expected_credit|currency)"\s*:/,
    );
    render(
      <DemoProvider options={fixture.options}>
        <App />
      </DemoProvider>,
    );
    const nav = await screen.findByRole(
      "navigation",
      { name: "Pages" },
      { timeout: 10000 },
    );
    expect(
      within(nav).getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await screen.findByRole(
        "heading",
        { name: "Arrived this week" },
        { timeout: 10000 },
      ),
    ).toBeVisible();
    expect(screen.queryByText("Traffic by Supplier")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Payables" }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelectorAll(".location-dashboard-kpis .ui-kpi"),
    ).toHaveLength(4);
  });
  it("keeps Floor Worker home on Invoices and denies the operational Dashboard query", async () => {
    const fixture = await setup("floor_worker");
    await expect(
      fixture.repository.queryBusiness<
        ReturnType<typeof initialState>,
        ReturnType<typeof locationDashboardView>
      >(fixture.identity, (state, actor) =>
        locationDashboardView(state, actor),
      ),
    ).rejects.toThrow();
    window.location.hash = "";
    render(
      <DemoProvider options={fixture.options}>
        <App />
      </DemoProvider>,
    );
    const nav = await screen.findByRole(
      "navigation",
      { name: "Pages" },
      { timeout: 10000 },
    );
    expect(
      within(nav).queryByRole("link", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole(
        "heading",
        { name: "Invoices" },
        { timeout: 10000 },
      ),
    ).toBeVisible();
  });
  it("never binds the private directory to the public view while private permission and query checks work", async () => {
    const fixture = await setup("manager");
    render(
      <DemoProvider options={fixture.options}>
        <ReadViewProbe />
      </DemoProvider>,
    );
    await waitFor(
      () => expect(screen.getByTestId("actor")).toHaveTextContent("manager"),
      { timeout: 10000 },
    );
    expect(screen.getByTestId("bound")).toHaveTextContent("unbound");
    expect(screen.getByTestId("company-dashboard")).toHaveTextContent("true");
    const publicJson = screen.getByTestId("public-view").textContent!;
    expect(publicJson).not.toContain("demo-owner@example");
    for (const key of [
      "session_id",
      "authority_epoch",
      "password_verifier",
      "password_salt",
      "setup_challenges",
      "second_step_verified_at",
      "last_sign_in_at",
    ])
      expect(publicJson).not.toContain(`"${key}"`);
    expect(
      (
        await fixture.repository.queryBusiness(
          fixture.identity,
          (_state, actor) => ({ id: actor.user_id, role: actor.role }),
        )
      ).value,
    ).toEqual({ id: "demo-person-manager", role: "manager" });
  });
});
