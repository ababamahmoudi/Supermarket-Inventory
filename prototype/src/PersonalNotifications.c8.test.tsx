import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { PersonalNotifications } from "./PersonalNotifications";
import { requestSale, saleDateAfter, saleStoreDate } from "./sales";
import { DemoProvider, initialState, useDemo } from "./store";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { Menu } from "./ui";

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});

function Harness() {
  const { branch, state } = useDemo();
  return (
    <>
      <output aria-label="Selected location">{branch}</output>
      <output aria-label="Unread personal notifications">
        {(state.notifications ?? []).filter((item) => !item.read_at).length}
      </output>
      <Menu label="Notifications">
        <PersonalNotifications />
      </Menu>
    </>
  );
}

it("opens the notified location before navigating to its approval and marks the actual record read", async () => {
  const state = initialState();
  state.notifications = [];
  const manager = authenticatedTestFixture(state, "manager", {
    selection: { kind: "location", location_id: "Branch 2" },
  });
  const floorWorker = authenticatedTestFixture(state, "floor_worker", {
    locations: ["Branch 1"],
    selection: { kind: "location", location_id: "Branch 1" },
  });
  const today = saleStoreDate(state.config, "Branch 1");
  requestSale(state, floorWorker.actor, {
    product_code: "0006",
    mode: "sale",
    scope: "current",
    price: "1.19",
    price_unit: "each",
    branches: ["Branch 1"],
    starts_on: today,
    last_day: saleDateAfter(today, 7),
    accept_below_margin: false,
    below_cost_reason: "",
    add_labels: false,
    why: "slow seller",
  });
  const notification = state.notifications!.find(
    (item) => item.recipient_user_id === manager.actor.user_id,
  )!;
  expect(notification.branch).toBe("Branch 1");
  expect(notification.recipient_user_id).toBe(manager.actor.user_id);
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 2" } },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Harness />
    </DemoProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Selected location")).toHaveTextContent(
      "Branch 2",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: /Sale request.*Lavash Bread/ }),
  );
  await waitFor(async () => {
    expect(screen.getByLabelText("Selected location")).toHaveTextContent(
      "Branch 1",
    );
    expect([
      screen.getByLabelText("Unread personal notifications").textContent,
      Boolean(
        (await fixture.readCanonical()).notifications?.find(
          (item) => item.id === notification.id,
        )?.read_at,
      ),
    ]).toEqual(["0", true]);
  });
  expect(window.location.hash).toBe(`#${notification.href}`);
  expect(window.location.hash).toMatch(/^#approvals/);
});
