import { useLayoutEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { navigationKey } from "../navigation";
import i18n from "../i18n";
import Payables from "./Payables";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>> | null =
  null;
let current: ReturnType<typeof useDemo> | null = null;
let releaseRefresh: (() => void) | null = null;
function ActualPayables() {
  const context = useDemo();
  useLayoutEffect(() => {
    current = context;
  }, [context]);
  return (
    <>
      <output data-testid="actual-location">{context.branch}</output>
      <Payables />
    </>
  );
}
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#payables";
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  releaseRefresh?.();
  releaseRefresh = null;
  cleanup();
  fixture?.dispose();
  fixture = null;
  current = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function show(
  role: "manager" | "floor_worker" = "manager",
  branch = "Branch 1",
) {
  fixture = await authenticatedProviderFixture({
    state: initialState(),
    role,
    actorOptions: {
      locations: ["Branch 1", "Branch 2"],
      selection:
        branch === "all"
          ? { kind: "all_locations" }
          : { kind: "location", location_id: branch },
    },
  });
  render(
    <DemoProvider options={fixture.options}>
      <ActualPayables />
    </DemoProvider>,
  );
  if (role === "manager")
    await screen.findByRole(
      "textbox",
      { name: "Search suppliers" },
      { timeout: 10000 },
    );
  else await waitFor(() => expect(current?.authStage).toBe("complete"));
  return fixture;
}

it("reselecting the current Payables branch preserves live supplier typing and focus during a delayed genuine authority refresh", async () => {
  const actual = await show();
  const before = await actual.readCanonical();
  const user = userEvent.setup();
  let selectionStarted = false,
    refreshHeld = false;
  let entered!: () => void;
  const held = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const originalTransaction = actual.repository.transaction.bind(
    actual.repository,
  );
  vi.spyOn(actual.repository, "transaction").mockImplementation(((
    ...args: Parameters<typeof originalTransaction>
  ) => {
    selectionStarted = true;
    return originalTransaction(...args);
  }) as typeof actual.repository.transaction);
  const originalQuery = actual.repository.queryBusiness.bind(actual.repository);
  vi.spyOn(actual.repository, "queryBusiness").mockImplementation((async (
    ...args: Parameters<typeof originalQuery>
  ) => {
    const result = await originalQuery(...args);
    // Delay only delivery of a real controller projection, after its actual IDB
    // read and fresh authority checks. No actor, permission, data or service result is replaced.
    if (
      selectionStarted &&
      !refreshHeld &&
      result.value &&
      typeof result.value === "object" &&
      "canonical" in result.value &&
      "view" in result.value &&
      "actor" in result.value
    ) {
      refreshHeld = true;
      entered();
      await release;
    }
    return result;
  }) as typeof actual.repository.queryBusiness);
  expect(current?.actor?.role).toBe("manager");
  expect(current?.can("payables.read")).toBe(true);
  const branch = screen.getByRole("combobox", { name: "Payables branch" });
  expect(branch).toHaveTextContent("North York");
  await user.click(branch);
  await user.click(await screen.findByRole("option", { name: "North York" }));
  // With the old implementation this is an unnecessary real selection task.
  // The corrected no-op starts no task; both paths get identical user assertions.
  if (selectionStarted) await held;
  const input = screen.getByRole("textbox", { name: "Search suppliers" });
  expect(input).toBeEnabled();
  await user.type(input, "fresh");
  await act(async () => {
    releaseRefresh?.();
  });
  await waitFor(() =>
    expect(
      screen.getByRole("textbox", { name: "Search suppliers" }),
    ).toHaveValue("fresh"),
  );
  expect(screen.getByRole("textbox", { name: "Search suppliers" })).toBe(input);
  expect(input).toHaveFocus();
  expect(screen.getByTestId("actual-location")).toHaveTextContent("Branch 1");
  expect(document.querySelectorAll(".payables-overview tbody tr")).toHaveLength(
    1,
  );
  expect(
    screen.getByRole("link", { name: "Fresh Valley Foods" }),
  ).toBeVisible();
  const key = navigationKey(
    before.config.company.seed_key,
    current!.user!.username,
    "Branch 1",
    "payables.search",
  );
  expect(JSON.parse(sessionStorage.getItem(key)!)).toBe("fresh");
  const after = await actual.readCanonical();
  expect(after.ledger).toEqual(before.ledger);
  expect(after.products).toEqual(before.products);
});

it("Clear filters still clears an aggregate Payables search and balance filters without changing financial records", async () => {
  const actual = await show("manager", "all");
  const before = await actual.readCanonical();
  fireEvent.change(screen.getByRole("textbox", { name: "Search suppliers" }), {
    target: { value: "fresh" },
  });
  fireEvent.click(screen.getByRole("button", { name: "With balance" }));
  expect(screen.getByRole("textbox", { name: "Search suppliers" })).toHaveValue(
    "fresh",
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() =>
    expect(
      screen.getByRole("textbox", { name: "Search suppliers" }),
    ).toHaveValue(""),
  );
  expect(screen.getByRole("button", { name: "With balance" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(screen.getByRole("button", { name: "Overdue only" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(screen.getByTestId("actual-location")).toHaveTextContent("all");
  expect((await actual.readCanonical()).ledger).toEqual(before.ledger);
});

it("retains the genuine Floor Worker Payables denial", async () => {
  const actual = await show("floor_worker");
  const before = await actual.readCanonical();
  expect(current?.can("payables.read")).toBe(false);
  expect(
    screen.queryByRole("textbox", { name: "Search suppliers" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Record external payment" }),
  ).not.toBeInTheDocument();
  expect((await actual.readCanonical()).ledger).toEqual(before.ledger);
});
