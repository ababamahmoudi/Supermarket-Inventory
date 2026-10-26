import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initialState } from "../e1-bootstrap";
import { authenticatedTestActor } from "../authority-test-fixture";
import { suppliersOverview } from "../suppliers";
import { navigationKey, saveNavigationValue } from "../navigation";
import Suppliers from "./Suppliers";

const queryResult = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
  pending: false,
  reload: vi.fn(),
}));
const context = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("../use-protected-query", () => ({
  useProtectedQuery: () => queryResult,
}));
vi.mock("../store", async (original) => ({
  ...(await original<typeof import("../store")>()),
  useDemo: () => context.value,
}));
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.location.hash = "#suppliers";
  const state = initialState();
  const actor = authenticatedTestActor(state, "manager", {
    selection: { kind: "all_locations" },
  });
  context.value = {
    state,
    actor,
    can: () => true,
    branch: "all",
    setBranch: vi.fn(async () => {}),
    locationIds: ["Branch 1", "Branch 2", "Branch 3"],
    lang: "en",
    navigate: vi.fn(),
    t: (en: string) => en,
    user: { username: "manager" },
    command: vi.fn(),
  };
  queryResult.data = {
    overview: suppliersOverview(state, actor),
    current: undefined,
    detail: null,
    itemCount: null,
  };
  queryResult.error = null;
  queryResult.pending = false;
  queryResult.reload.mockClear();
});
afterEach(cleanup);
it("shows the true incomplete suppliers under the remembered chip", () => {
  const { state } = context.value as { state: ReturnType<typeof initialState> };
  saveNavigationValue(
    navigationKey(
      state.config.company.seed_key,
      "manager",
      "all",
      "suppliers.filters",
    ),
    ["proposed"],
  );
  render(<Suppliers />);
  expect(
    screen.getByRole("button", { name: "Profile incomplete" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText(/No suppliers yet/)).not.toBeInTheDocument();
  expect(
    document.querySelectorAll(".supplier-overview-row").length,
  ).toBeGreaterThan(0);
});
it("never calls a failed protected read an empty company and offers retry", () => {
  queryResult.data = null;
  queryResult.error = new Error("read interrupted");
  render(<Suppliers />);
  expect(screen.queryByText(/No suppliers yet/)).not.toBeInTheDocument();
  expect(screen.queryByText("0 suppliers")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Couldn't load suppliers",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(queryResult.reload).toHaveBeenCalledOnce();
});
it("uses the filters empty message even for an empty company with remembered search", () => {
  const { state } = context.value as { state: ReturnType<typeof initialState> };
  saveNavigationValue(
    navigationKey(
      state.config.company.seed_key,
      "manager",
      "all",
      "suppliers.search",
    ),
    "unmatched fictional supplier",
  );
  queryResult.data = {
    overview: [],
    current: undefined,
    detail: null,
    itemCount: null,
  };
  render(<Suppliers />);
  expect(screen.getByText("No suppliers match these filters.")).toBeVisible();
  expect(screen.queryByText(/No suppliers yet/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByText(/No suppliers yet/)).toBeVisible();
});

it("shows one supplier heading/edit action, seven contact fields and a single completion link", async () => {
  const { state, actor } = context.value as {
    state: ReturnType<typeof initialState>;
    actor: ReturnType<typeof authenticatedTestActor>;
  };
  const { supplierPage } = await import("../suppliers");
  const overview = suppliersOverview(state, actor);
  const current = overview.find(
    (supplier) => supplier.name === "Corner Spice Co.",
  )!;
  queryResult.data = {
    overview,
    current,
    detail: supplierPage(state, actor, current.name),
    itemCount: 0,
  };
  window.location.hash = `#suppliers?name=${encodeURIComponent(current.name)}`;
  render(<Suppliers />);
  expect(
    screen.getByRole("heading", { level: 1, name: current.name }),
  ).toBeVisible();
  expect(document.querySelectorAll(".supplier-contact-grid dt")).toHaveLength(
    7,
  );
  expect(screen.getAllByRole("button", { name: /^Edit$/ })).toHaveLength(1);
  expect(
    screen.queryByRole("button", { name: "Edit supplier" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByRole("link", { name: "Complete profile" }),
  ).toHaveLength(1);
  expect(
    document.querySelectorAll(".supplier-kpis .ui-summary-tile"),
  ).toHaveLength(4);
  expect(
    document.querySelectorAll(".supplier-kpis .summary-tile-dot"),
  ).toHaveLength(4);
  expect(
    document.querySelector(".supplier-kpis .ui-summary-tile")?.tagName,
  ).toBe("DIV");
  expect(document.querySelectorAll(".supplier-header-name")).toHaveLength(0);
});
