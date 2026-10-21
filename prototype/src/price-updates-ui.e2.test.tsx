import { useLayoutEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { savePriceChange, saleStoreDate } from "./sales";
import { capturePriceUpdateChanges, priceUpdateTasks } from "./price-updates";
import PriceUpdates from "./screens/PriceUpdates";
import { PriceChangedPill } from "./price-update-presentation";
import type { RoleId } from "./authority-types";

let live: ReturnType<typeof useDemo> | null = null;
let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>> | null =
  null;
function Probe() {
  const context = useDemo();
  useLayoutEffect(() => {
    live = context;
  }, [context]);
  return <output data-testid="role">{context.actor?.role}</output>;
}
function current() {
  if (!live?.actor)
    throw new Error("Actual authenticated Provider is not ready");
  return live;
}
function prepared() {
  const state = initialState();
  const manager = authenticatedTestFixture(state, "manager", {
    selection: { kind: "location", location_id: "Branch 2" },
  });
  const product = state.products.find((item) =>
    item.name_en.startsWith("Black Tea"),
  );
  if (!product) throw new Error("Configured Black Tea is missing");
  const before = cloneWithAuthority(state);
  savePriceChange(state, manager.actor, {
    product_code: product.code,
    mode: "regular",
    scope: "selected",
    branches: ["Branch 2"],
    price: "11.49",
    price_unit: "each",
    starts_on: saleStoreDate(state.config, "Branch 2"),
    last_day: null,
    accept_below_margin: true,
    below_cost_reason: "Fictional UI test",
    add_labels: false,
  });
  capturePriceUpdateChanges(before, state, manager.actor);
  const task = priceUpdateTasks(state, manager.actor).find(
    (item) => item.branch === "Branch 2" && item.product_code === product.code,
  );
  if (!task) throw new Error("Actual protected price decision created no task");
  return { state, task, product };
}
async function mount(role: RoleId, detail = true) {
  const data = prepared();
  fixture = await authenticatedProviderFixture({
    state: data.state,
    role,
    actorOptions: {
      locations: role === "cashier" ? ["Branch 1", "Branch 2"] : ["Branch 2"],
      selection: { kind: "location", location_id: "Branch 2" },
    },
  });
  window.location.hash = detail
    ? `price-update?id=${data.task.id}`
    : "price-updates";
  render(
    <DemoProvider options={fixture.options}>
      <Probe />
      <PriceUpdates />
    </DemoProvider>,
  );
  await waitFor(() => expect(current().actor?.role).toBe(role));
  return data;
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  fixture = null;
  live = null;
  vi.unstubAllGlobals();
});

it("uses the genuine Branch Supervisor Provider to mark Seen and Done, each with the real person and time", async () => {
  const { task } = await mount("branch_supervisor");
  const seen = await screen.findByRole(
    "button",
    { name: "Mark as seen" },
    { timeout: 10000 },
  );
  // Ali's rule (Oct 2026): no register or label checklist; only Seen and Done.
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.getByText("Not seen yet")).toBeVisible();
  fireEvent.click(seen);
  await waitFor(async () =>
    expect(
      (await fixture!.readCanonical()).price_update_tasks?.find(
        (row) => row.id === task.id,
      )?.seen?.by_user_id,
    ).toBe(current().actor!.user_id),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Mark as seen" }),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(
    await screen.findByRole(
      "button",
      { name: "Mark as done" },
      { timeout: 10000 },
    ),
  );
  await waitFor(async () =>
    expect(
      (await fixture!.readCanonical()).price_update_tasks?.find(
        (row) => row.id === task.id,
      )?.status,
    ).toBe("done"),
  );
  const saved = (await fixture!.readCanonical()).price_update_tasks!.find(
    (row) => row.id === task.id,
  )!;
  expect(saved.completed_by_user_id).toBe(current().actor!.user_id);
  expect(saved.completed_at).toBeTruthy();
  expect(saved.seen?.version).toBe(saved.version);
  await waitFor(() =>
    expect(
      document.querySelectorAll(".price-update-status-steps li.is-complete"),
    ).toHaveLength(2),
  );
});
it("lets the genuine Floor Worker mark own-store tasks seen but not done", async () => {
  const { task } = await mount("floor_worker");
  fireEvent.click(
    await screen.findByRole(
      "button",
      { name: "Mark as seen" },
      { timeout: 10000 },
    ),
  );
  await waitFor(async () =>
    expect(
      (await fixture!.readCanonical()).price_update_tasks?.find(
        (row) => row.id === task.id,
      )?.seen?.by_user_id,
    ).toBe(current().actor!.user_id),
  );
  expect(
    screen.queryByRole("button", { name: "Mark as done" }),
  ).not.toBeInTheDocument();
  const before = await fixture!.readCanonical();
  await act(async () => {
    await expect(
      current().command(
        "price_updates.complete",
        {
          company_id: task.company_id,
          kind: "location_record",
          location_ids: [task.branch],
          mutation: true,
        },
        () => {},
      ),
    ).rejects.toBeTruthy();
  });
  expect((await fixture!.readCanonical()).price_update_tasks).toEqual(
    before.price_update_tasks,
  );
  await act(async () => {
    window.location.hash = "price-updates";
  });
  const selection = await screen.findByRole("checkbox", {
    name: /^Select Black Tea/,
  });
  fireEvent.click(selection);
  expect(
    screen.queryByRole("button", { name: "Mark as done" }),
  ).not.toBeInTheDocument();
});
it("renders the public Cashier pill from the scoped Provider without decision/staff/cost fields", async () => {
  const { state, task, product } = prepared();
  fixture = await authenticatedProviderFixture({
    state,
    role: "cashier",
    actorOptions: {
      locations: ["Branch 1", "Branch 2"],
      selection: { kind: "location", location_id: "Branch 2" },
    },
  });
  render(
    <DemoProvider options={fixture.options}>
      <Probe />
      <PriceChangedPill product={product} />
    </DemoProvider>,
  );
  expect(
    await screen.findByText("Price changed", {}, { timeout: 10000 }),
  ).toBeVisible();
  expect(current().state.price_update_tasks ?? []).toEqual([]);
  expect(JSON.stringify(current().state.price_change_hints)).not.toMatch(
    /decided_by|register_changed|cost|margin/,
  );
  expect(current().state.price_change_hints).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        task_id: task.id,
        branch: "Branch 2",
        new_price: "11.49",
      }),
    ]),
  );
});

it("follows a notification's explicit location filter and later hash navigation without leaking another assigned store's rows", async () => {
  const { state, product } = prepared();
  fixture = await authenticatedProviderFixture({
    state,
    role: "branch_supervisor",
    actorOptions: {
      locations: ["Branch 2", "Branch 3"],
      selection: { kind: "all_my_locations" },
    },
  });
  window.location.hash = "price-updates?location=Branch%203&status=pending";
  render(
    <DemoProvider options={fixture.options}>
      <Probe />
      <PriceUpdates />
    </DemoProvider>,
  );
  expect(
    await screen.findByText(
      "No price updates match these filters.",
      {},
      { timeout: 10000 },
    ),
  ).toBeVisible();
  await act(async () => {
    window.location.hash = "price-updates?location=Branch%202&status=pending";
  });
  await waitFor(() =>
    expect(document.querySelector(".price-updates-row")).toHaveTextContent(
      product.name_en,
    ),
  );
  expect(document.querySelectorAll(".price-updates-row")).toHaveLength(1);
  expect(document.querySelector(".price-updates-row")).toHaveTextContent(
    "Richmond Hill",
  );
});
