import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { IDBFactory } from "fake-indexeddb";
import { AUTHORITY_DATABASE_NAME } from "./authority-repository";
import { PersonalNotifications } from "./PersonalNotifications";
import { DemoProvider, initialState, useDemo } from "./store";
import { authenticatedTestActor } from "./authority-test-fixture";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { migrateE1BusinessState } from "./e1-state-migration";
import { cloneWithAuthority } from "./authority";
import {
  capturePriceUpdateChanges,
  evaluatePriceUpdates,
} from "./price-updates";
import { savePriceChange } from "./sales";
import { reconcileFixture } from "./system-reconciliation-test-fixture";
import { groupedNotifications } from "./notification-groups";
import { Menu } from "./ui";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "./test/rendered-ui-readiness";

const locks: Array<{ release(): Promise<void> }> = [];
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  for (const lock of locks.splice(0)) await lock.release();
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
function Harness() {
  const { state } = useDemo();
  return (
    <>
      <output aria-label="Unread groups">
        {
          groupedNotifications(state.notifications ?? []).filter(
            (group) => group.unread,
          ).length
        }
      </output>
      <Menu
        label="Notifications"
        minWidth={380}
        maxViewportHeight={0.7}
        popupClassName="notifications-popover"
      >
        <PersonalNotifications />
      </Menu>
    </>
  );
}

it("keeps Mark all and Clear all in the open inbox, stores personal dismissal and closes with Escape after the focused action becomes disabled", async () => {
  const state = migrateE1BusinessState(initialState());
  state.sales = [];
  state.sale_events = [];
  state.sale_requests = [];
  state.notifications = [];
  state.offers = [];
  state.activity = [];
  const manager = authenticatedTestActor(state, "manager", {
    selection: { kind: "location", location_id: "Branch 2" },
  });
  const owner = authenticatedTestActor(state, "owner");
  await reconcileFixture(state, "price_updates", (draft, source) =>
    evaluatePriceUpdates(draft, source),
  );
  state.notifications = [];
  const before = cloneWithAuthority(state);
  savePriceChange(state, manager, {
    product_code: "0004",
    mode: "regular",
    scope: "all",
    price: "7.79",
    price_unit: "each",
    branches: ["Branch 1", "Branch 2", "Branch 3"],
    starts_on: "2026-10-26",
    last_day: null,
    accept_below_margin: true,
    below_cost_reason: "Fictional reason",
    add_labels: false,
  });
  capturePriceUpdateChanges(before, state, manager);
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
  await renderedUiReady(
    () => Number(screen.queryByLabelText("Unread groups")?.textContent) > 0,
  );
  expect(
    Number(screen.getByLabelText("Unread groups").textContent),
  ).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  expect(
    await screen.findAllByRole("menuitem", { name: /Price update.*Black Tea/ }),
  ).toHaveLength(1);
  const mark = screen.getByRole("menuitem", {
    name: "Mark all as read",
  });
  fireEvent.click(mark);
  await waitFor(() =>
    expect(screen.getByLabelText("Unread groups")).toHaveTextContent("0"),
  );
  expect(mark).toBeDisabled();
  expect(screen.getByRole("menu", { name: "Notifications" })).toBeVisible();
  const clear = screen.getByRole("menuitem", {
    name: "Clear all",
  });
  await waitFor(() => expect(clear).toBeEnabled());
  clear.focus();
  fireEvent.click(clear);
  expect(await screen.findByText("No new notifications.")).toBeVisible();
  expect(clear).toBeDisabled();
  const canonical = await fixture.readCanonical();
  const own = canonical.notifications!.filter(
    (row) =>
      row.kind === "price_update_created" &&
      row.recipient_user_id === manager.user_id,
  );
  expect(own).toHaveLength(3);
  expect(
    own.every((row) => Boolean(row.read_at) && Boolean(row.dismissed_at)),
  ).toBe(true);
  expect(
    canonical
      .notifications!.filter((row) => row.recipient_user_id === owner.user_id)
      .every((row) => !row.read_at && !row.dismissed_at),
  ).toBe(true);
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() =>
    expect(
      screen.queryByRole("menu", { name: "Notifications" }),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  expect(screen.getByText("No new notifications.")).toBeVisible();
});

/** Hold native transactions using reads only; no actor, command or query is mocked. */
async function holdActualReads(factory: IDBFactory, company: string) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(AUTHORITY_DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction(
    ["companies", "business"],
    "readwrite",
  );
  let hold = true;
  const complete = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
  await new Promise<void>((resolve, reject) => {
    const keepAlive = () => {
      const request = transaction.objectStore("business").get(company);
      request.onsuccess = () => {
        resolve();
        if (hold) keepAlive();
      };
      request.onerror = () => reject(request.error);
    };
    keepAlive();
  });
  let released: Promise<void> | undefined;
  const lock = {
    release() {
      if (!released) {
        hold = false;
        released = complete.finally(() => database.close());
      }
      return released;
    },
  };
  locks.push(lock);
  return lock;
}

for (const intent of ["close", "navigate"] as const)
  it(`does not replace newer ${intent} intent when a genuine notification command finishes later`, async () => {
    const factory = new IDBFactory();
    const fixture = await authenticatedProviderFixture({
      state: initialState(),
      role: "manager",
      factory,
      actorOptions: {
        selection: { kind: "location", location_id: "Branch 2" },
      },
    });
    fixtures.push(fixture);
    render(
      <DemoProvider options={fixture.options}>
        <Harness />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(
        Number(screen.getByLabelText("Unread groups").textContent),
      ).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    const item = (
      await screen.findAllByRole("menuitem", { name: /Approvals waiting/ })
    )[0];
    const before = await fixture.readCanonical();
    const notice = before.notifications!.find(
      (row) =>
        row.kind === "approval_waiting" &&
        row.recipient_user_id === fixture.actor.user_id,
    )!;
    const lock = await holdActualReads(factory, before.config.company.seed_key);
    fireEvent.click(item);
    if (intent === "close") fireEvent.keyDown(document, { key: "Escape" });
    else window.location.hash = "#returns";
    await lock.release();
    await waitFor(async () =>
      expect(
        (await fixture.readCanonical()).notifications!.find(
          (row) => row.id === notice.id,
        )?.read_at,
      ).toBeDefined(),
    );
    await waitFor(() =>
      expect(
        Number(screen.getByLabelText("Unread groups").textContent),
      ).toBeLessThan(
        before.notifications!.filter(
          (row) =>
            row.recipient_user_id === fixture.actor.user_id && !row.read_at,
        ).length,
      ),
    );
    expect(window.location.hash).toBe(intent === "navigate" ? "#returns" : "");
    if (intent === "close")
      expect(
        screen.queryByRole("menu", { name: "Notifications" }),
      ).not.toBeInTheDocument();
  });
