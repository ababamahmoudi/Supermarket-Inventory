import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import { migrateE1BusinessState } from "./e1-state-migration";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { reconcileFixture } from "./system-reconciliation-test-fixture";
import {
  capturePriceUpdateChanges,
  evaluatePriceUpdates,
  completePriceTasks,
} from "./price-updates";
import {
  clearAllNotifications,
  markNotificationRead,
  openNotificationGroup,
  savePriceChange,
} from "./sales";
import { projectSalesReadView } from "./sales-projections";
import {
  groupedNotifications,
  notificationTimestamp,
} from "./notification-groups";
import { resolveApproval } from "./approvals";
import type { DemoState } from "./types";
import type { AuthenticatedActor } from "./authority-types";

const now = new Date("2026-10-26T18:20:00Z");
let state: DemoState, manager: AuthenticatedActor, owner: AuthenticatedActor;
const clock = () =>
  reconcileFixture(
    state,
    "price_updates",
    (draft, source) => evaluatePriceUpdates(draft, source),
    now,
  );
function change(
  price = "5.99",
  branches = ["Branch 1", "Branch 2", "Branch 3"],
) {
  const before = cloneWithAuthority(state);
  savePriceChange(
    state,
    manager,
    {
      product_code: "0004",
      mode: "regular",
      scope: "selected",
      price,
      price_unit: "each",
      branches,
      starts_on: "2026-10-26",
      last_day: null,
      accept_below_margin: true,
      below_cost_reason: "Fictional reason",
      add_labels: false,
    },
    now,
  );
  capturePriceUpdateChanges(before, state, manager, now);
}
const priceRows = (actor = manager) =>
  projectSalesReadView(state, actor).notifications.filter(
    (row) => row.kind === "price_update_created",
  );
const priceGroups = (actor = manager) => groupedNotifications(priceRows(actor));
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  state = migrateE1BusinessState(initialState());
  state.sales = [];
  state.sale_events = [];
  state.sale_requests = [];
  state.notifications = [];
  state.offers = [];
  state.activity = [];
  manager = authenticatedTestActor(state, "manager", {
    selection: { kind: "location", location_id: "Branch 2" },
    now,
  });
  owner = authenticatedTestActor(state, "owner", { now });
  await clock();
  state.notifications = [];
});
afterEach(() => vi.useRealTimers());

describe("R2c grouped personal notifications", () => {
  it("joins exactly one real three-branch decision into one unread group", () => {
    change();
    expect(priceRows()).toHaveLength(3);
    expect(priceGroups()).toHaveLength(1);
    expect(priceGroups()[0].branches).toEqual([
      "Branch 1",
      "Branch 2",
      "Branch 3",
    ]);
    expect(priceGroups()[0].unread).toBe(true);
    expect(
      new Set(state.price_update_tasks!.map((task) => task.source_activity_id))
        .size,
    ).toBe(1);
    const projection = JSON.stringify(priceRows());
    expect(projection).not.toMatch(
      /cost_snapshot|minimum_margin|recipient_user_id|event_key|decided_by|source_decision/,
    );
  });
  it("keeps distinct genuine decisions on the same product separate even at the same instant", () => {
    change("5.99", ["Branch 1"]);
    change("5.49", ["Branch 2", "Branch 3"]);
    expect(priceGroups()).toHaveLength(2);
    expect(
      priceGroups()
        .map((group) => group.members.length)
        .sort(),
    ).toEqual([1, 2]);
  });
  it("keeps an unattributed legacy task separate rather than guessing from product or timestamp", () => {
    change();
    const task = state.price_update_tasks![0];
    delete task.steps[0].source_activity_id;
    expect(priceGroups()).toHaveLength(2);
  });
  it("counts mixed read and unread members once and marks only this recipient's entire group", () => {
    change();
    const first = priceRows()[0];
    markNotificationRead(state, manager, first.id, now);
    expect(priceGroups().filter((group) => group.unread)).toHaveLength(1);
    const destination = openNotificationGroup(state, manager, first.id, now);
    expect(destination.branch).toBe("Branch 2");
    expect(destination.href).toBe(
      `price-update?id=${state.price_update_tasks!.find((task) => task.branch === "Branch 2")!.id}`,
    );
    expect(priceRows().every((row) => row.read_at === now.toISOString())).toBe(
      true,
    );
    expect(priceRows(owner).every((row) => !row.read_at)).toBe(true);
    expect(priceGroups().filter((group) => group.unread)).toHaveLength(0);
  });
  it("persists personal Clear all across reconciliation without deleting any business or another inbox", async () => {
    change();
    const business = JSON.stringify({
      tasks: state.price_update_tasks,
      products: state.products,
      ledger: state.ledger,
      returns: state.returns,
      activity: state.activity,
    });
    const ids = state.notifications!.map((row) => row.id);
    const priceIds = state
      .notifications!.filter((row) => row.kind === "price_update_created")
      .map((row) => row.id);
    const other = JSON.stringify(
      state.notifications!.filter(
        (row) => row.recipient_user_id === owner.user_id,
      ),
    );
    clearAllNotifications(state, manager, now);
    expect(priceRows()).toEqual([]);
    expect(state.notifications!.map((row) => row.id)).toEqual(ids);
    expect(
      JSON.stringify(
        state.notifications!.filter(
          (row) => row.recipient_user_id === owner.user_id,
        ),
      ),
    ).toBe(other);
    expect(
      JSON.stringify({
        tasks: state.price_update_tasks,
        products: state.products,
        ledger: state.ledger,
        returns: state.returns,
        activity: state.activity,
      }),
    ).toBe(business);
    await clock();
    expect(priceRows()).toEqual([]);
    expect(
      state
        .notifications!.filter((row) => row.kind === "price_update_created")
        .map((row) => row.id),
    ).toEqual(priceIds);
    change("5.49");
    expect(priceGroups()).toHaveLength(1);
  });
  it("removes handled price tasks and pending approval notices from both projection and badge", async () => {
    change();
    const row = priceRows()[0];
    completePriceTasks(
      state,
      manager,
      state.price_update_tasks!.map((task) => task.id),
      now,
    );
    expect(priceGroups()).toEqual([]);
    expect(() => openNotificationGroup(state, manager, row.id, now)).toThrow();
    await clock();
    const approval = state.approvals.find(
      (row) => row.id === "demo-lavash-price",
    )!;
    expect(
      projectSalesReadView(state, manager).notifications.some(
        (row) => row.kind === "approval_waiting",
      ),
    ).toBe(true);
    resolveApproval(
      state,
      manager,
      approval.id,
      "approve",
      "branch",
      "Branch 1",
    );
    expect(
      projectSalesReadView(state, manager).notifications.some(
        (row) =>
          row.kind === "approval_waiting" &&
          state
            .notifications!.find((record) => record.id === row.id)
            ?.event_key.startsWith(`approval:${approval.id}:`),
      ),
    ).toBe(false);
  });
  it("scopes group branches to this actual person's allowed locations", () => {
    const supervisor = authenticatedTestActor(state, "branch_supervisor", {
      locations: ["Branch 2", "Branch 3"],
      selection: { kind: "location", location_id: "Branch 2" },
      now,
    });
    change();
    const groups = priceGroups(supervisor);
    expect(groups).toHaveLength(1);
    expect(groups[0].branches.sort()).toEqual(["Branch 2", "Branch 3"]);
    expect(JSON.stringify(groups)).not.toContain("Branch 1");
    const destination = openNotificationGroup(
      state,
      supervisor,
      groups[0].id,
      now,
    );
    expect(destination.branch).toBe("Branch 2");
  });
  it("rejects stale actor/role loss and preserves unread data on attempted open or clear", () => {
    change();
    const id = priceRows()[0].id;
    const changed = authenticatedTestActor(state, "cashier", {
      user_id: manager.user_id,
      locations: ["Branch 2"],
      now,
    });
    const before = JSON.stringify(state.notifications);
    expect(() => openNotificationGroup(state, manager, id, now)).toThrow();
    expect(() => clearAllNotifications(state, manager, now)).toThrow();
    expect(() => openNotificationGroup(state, changed, id, now)).toThrow();
    clearAllNotifications(state, changed, now);
    expect(JSON.stringify(state.notifications)).toBe(before);
  });
  it("rejects foreign source tasks and another recipient without marking either read", () => {
    change();
    const foreign = state.price_update_tasks![0];
    foreign.company_id = "fictional-foreign-company";
    const unavailable = state.notifications!.find(
      (row) =>
        row.task_id === foreign.id && row.recipient_user_id === manager.user_id,
    )!;
    expect(priceRows().some((row) => row.id === unavailable.id)).toBe(false);
    expect(() =>
      openNotificationGroup(state, manager, unavailable.id, now),
    ).toThrow();
    const other = priceRows(owner)[0];
    expect(() =>
      openNotificationGroup(state, manager, other.id, now),
    ).toThrow();
    expect(state.notifications!.every((row) => !row.read_at)).toBe(true);
  });
  it("ignores forged price href context and opens the currently authorized canonical task", () => {
    change();
    const id = priceRows()[0].id;
    for (const row of state.notifications!.filter(
      (row) =>
        row.recipient_user_id === manager.user_id &&
        row.kind === "price_update_created",
    ))
      row.href = "price-update?id=fictional-foreign-task";
    const destination = openNotificationGroup(state, manager, id, now);
    expect(destination.href).not.toContain("fictional-foreign-task");
  });
  it("rebuilds a pending approval's real screen even if its stored href names an unrelated record", async () => {
    await clock();
    const row = state.notifications!.find(
      (row) =>
        row.kind === "approval_waiting" &&
        row.recipient_user_id === manager.user_id,
    )!;
    row.href = "https://fictional.invalid/unrelated";
    expect(openNotificationGroup(state, manager, row.id, now)).toEqual({
      branch: row.branch,
      href: "approvals",
    });
  });
  it("formats Today and weekdays with a one-line 24-hour company-zone clock in both languages", () => {
    expect(
      notificationTimestamp(state.config, now.toISOString(), "en", now),
    ).toBe("Today 14:20");
    expect(
      notificationTimestamp(state.config, "2026-10-26T04:00:00Z", "en", now),
    ).toBe("Today 00:00");
    expect(
      notificationTimestamp(state.config, now.toISOString(), "fa", now),
    ).toBe("امروز 14:20");
    expect(
      notificationTimestamp(state.config, "2026-10-25T18:20:00Z", "en", now),
    ).toBe("Sun 14:20");
    expect(
      notificationTimestamp(state.config, "2026-10-25T18:20:00Z", "fa", now),
    ).not.toMatch(/AM|PM|ق.ظ|ب.ظ/);
  });
});
