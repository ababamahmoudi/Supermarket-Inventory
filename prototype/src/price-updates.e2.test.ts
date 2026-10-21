import { savePricingSettings } from "./settings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import { migrateE1BusinessState } from "./e1-state-migration";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { reconcileFixture } from "./system-reconciliation-test-fixture";
import { attachReversals, reverseActivity } from "./history";
import { effectivePrice } from "./catalog";
import {
  savePriceChange,
  changeSale,
  endSale,
  evaluateSales,
  markAllNotificationsRead,
  type ChangePriceInput,
} from "./sales";
import {
  addLabelsToWaitlist,
  prepareLabelPrint,
  confirmLabelsPrinted,
} from "./label-workflow";
import {
  capturePriceUpdateChanges,
  evaluatePriceUpdates,
  priceUpdateTasks,
  priceChangeHints,
  updatePriceTask,
  markPriceTaskSeen,
  completePriceTasks,
  queuePriceTaskLabels,
  preparePriceTaskPrint,
  recordPriceTaskPrint,
  confirmPriceTaskLabel,
  confirmPriceTaskWaitlistLabels,
  savePriceUpdateSettings,
  saveNotificationSettings,
  notificationSettings,
  type PriceUpdateTask,
} from "./price-updates";
import { projectSalesReadView } from "./sales-projections";
import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";

const now = new Date("2026-10-12T16:00:00Z");
let state: DemoState,
  manager: AuthenticatedActor,
  supervisor: AuthenticatedActor,
  floor: AuthenticatedActor,
  cashier: AuthenticatedActor;
const clock = (instant = now) =>
  reconcileFixture(
    state,
    "price_updates",
    (draft, source) => evaluatePriceUpdates(draft, source),
    instant,
  );
const saleClock = (instant: Date) =>
  reconcileFixture(
    state,
    "sales_clock",
    (draft, source) => evaluateSales(draft, source),
    instant,
  );
const tasks = () => state.price_update_tasks ?? [];
const task = (branch = "Branch 2") =>
  tasks().find((row) => row.branch === branch && row.status === "pending")!;
const input = (patch: Partial<ChangePriceInput> = {}): ChangePriceInput => ({
  product_code: "0004",
  mode: "regular",
  scope: "selected",
  price: "5.99",
  price_unit: "each",
  branches: ["Branch 2"],
  starts_on: "2026-10-12",
  last_day: null,
  accept_below_margin: true,
  below_cost_reason: "Fictional demo test",
  add_labels: false,
  ...patch,
});
function change(patch: Partial<ChangePriceInput> = {}, instant = now) {
  const before = cloneWithAuthority(state);
  const result = savePriceChange(
    state,
    manager,
    input(
      patch.scope === "all"
        ? { ...patch, branches: ["Branch 1", "Branch 2", "Branch 3"] }
        : patch,
    ),
    instant,
  );
  capturePriceUpdateChanges(before, state, manager, instant);
  attachReversals(before, state, manager);
  return result;
}
function physicalLabel(row: PriceUpdateTask, actor = supervisor) {
  const sheet = preparePriceTaskPrint(state, actor, [row.id]);
  recordPriceTaskPrint(state, actor, sheet);
  confirmPriceTaskLabel(state, actor, row.id, sheet.id);
  return sheet;
}
const financial = () =>
  JSON.stringify({
    ledger: state.ledger,
    stock: state.stock,
    movements: state.stock_movements,
    returns: state.returns,
    invoice: state.invoice,
    invoices: state.invoices,
  });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  state = migrateE1BusinessState(initialState());
  state.sales = [];
  state.sale_events = [];
  state.sale_requests = [];
  state.sale_delivery_holds = [];
  state.notifications = [];
  state.offers = [];
  state.offer_store_suppressions = [];
  state.label_waitlist = [];
  state.activity = [];
  manager = authenticatedTestActor(state, "manager", {
    selection: { kind: "location", location_id: "Branch 1" },
    now,
  });
  supervisor = authenticatedTestActor(state, "branch_supervisor", {
    locations: ["Branch 2", "Branch 3"],
    selection: { kind: "location", location_id: "Branch 2" },
    now,
  });
  floor = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 2"],
    now,
  });
  cashier = authenticatedTestActor(state, "cashier", {
    locations: ["Branch 2"],
    now,
  });
  authenticatedTestActor(state, "owner", { now });
  await clock();
});
afterEach(() => vi.useRealTimers());
describe("E2 genuine canonical price changes", () => {
  it("seeds a baseline without an initial backlog or altering money", () => {
    expect(tasks()).toEqual([]);
    expect(state.prototype_e2_schema).toBe(1);
    expect(JSON.stringify(state.price_update_baseline)).not.toMatch(
      /unit_cost|cost_snapshot|margin|ledger|password/,
    );
  });
  it("creates one task per actually affected selling store, never Warehouse", () => {
    const money = financial();
    change({ scope: "all" });
    expect(
      tasks()
        .map((row) => row.branch)
        .sort(),
    ).toEqual(["Branch 1", "Branch 2", "Branch 3"]);
    expect(financial()).toBe(money);
    expect(
      tasks().every((row) => row.decided_by_user_id === manager.user_id),
    ).toBe(true);
  });
  it("does not create a task when the approved price and commercial terms are unchanged", () => {
    change();
    const count = tasks().length;
    change();
    expect(tasks()).toHaveLength(count);
    expect(task().version).toBe(1);
  });
  it("coalesces a newer price into one pending task and keeps both earlier steps", () => {
    change();
    const id = task().id;
    change({ price: "5.49" });
    expect(tasks()).toHaveLength(1);
    expect(task().id).toBe(id);
    expect(task().steps.map((step) => step.new_price.price)).toEqual([
      "5.99",
      "5.49",
    ]);
    expect(task().old_price.price).toBe("6.99");
  });
  it("invalidates old acknowledgements when the price changes, while retaining real actor evidence in History", () => {
    change();
    const row = task();
    updatePriceTask(state, supervisor, row.id, { register_changed: true });
    physicalLabel(row);
    change({ price: "5.49" });
    expect(task().register_changed).toBeUndefined();
    expect(task().label_printed).toBeUndefined();
    expect(
      state.activity.some(
        (entry) =>
          entry.action === "Confirm price update label" &&
          entry.actor_user_id === supervisor.user_id,
      ),
    ).toBe(true);
    // Ali's rule (Oct 2026): Done no longer depends on a checklist.
    completePriceTasks(state, supervisor, [row.id]);
    expect(tasks().find((item) => item.id === row.id)?.status).toBe("done");
  });
  it("real History Undo cancels an untouched task rather than creating another", () => {
    const before = cloneWithAuthority(state);
    savePriceChange(state, manager, input());
    capturePriceUpdateChanges(before, state, manager);
    attachReversals(before, state, manager);
    const source = state.activity.find(
      (entry) => entry.action === "Set regular price",
    )!;
    expect(source.reversible).toBe(true);
    const changedState = cloneWithAuthority(state);
    reverseActivity(state, manager, source.id, "undo");
    capturePriceUpdateChanges(changedState, state, manager);
    expect(tasks()).toHaveLength(1);
    expect(tasks()[0].status).toBe("cancelled");
    expect(effectivePrice(state, "0004", "Branch 2")).toBe("6.99");
  });
  it("does not cancel performed staff work when a later price returns to the original price", () => {
    change();
    updatePriceTask(state, supervisor, task().id, { register_changed: true });
    change({ price: "6.99" });
    expect(task().status).toBe("pending");
    expect(task().new_price.price).toBe("6.99");
    expect(task().version).toBe(2);
  });
  it("creates a fresh task after a previously completed change", () => {
    change();
    const first = task();
    updatePriceTask(state, supervisor, first.id, {
      register_changed: true,
      no_label_reason: "No shelf label",
    });
    completePriceTasks(state, supervisor, [first.id]);
    change({ price: "5.49" });
    expect(tasks()).toHaveLength(2);
    expect(first.status).toBe("done");
    expect(task().old_price.price).toBe("5.99");
  });
  it("detects an ordinary offer starting and ending even when the single-unit price is unchanged", async () => {
    const before = cloneWithAuthority(state);
    state.offers.push({
      id: "e2-multibuy",
      company_id: manager.company_id,
      branch: "Branch 2",
      product_code: "0003",
      scope: "branch",
      status: "active",
      label: "2 for $5",
      price: effectivePrice(state, "0003", "Branch 2")!,
      pool: "test",
      mix_and_match: true,
      currency: state.config.company.currency,
      start_date: "2026-10-12",
      end_date: "2026-10-12",
    });
    capturePriceUpdateChanges(before, state, manager);
    expect(task().new_price.offer_label).toBe("2 for $5");
    await clock(new Date("2026-10-13T04:00:00Z"));
    expect(tasks()[0].new_price.offer_id).toBeUndefined();
    expect(tasks()[0].steps).toHaveLength(2);
    expect(tasks()[0].status).toBe("cancelled");
  });
  it("a price change in a foreign company cannot enter this company's task stream", () => {
    const before = cloneWithAuthority(state);
    const foreign = structuredClone(state.products[0]);
    foreign.company_id = "other-company";
    foreign.code = "foreign-product";
    state.products.push(foreign);
    foreign.selling_price = "1.11";
    capturePriceUpdateChanges(before, state, manager);
    expect(tasks()).toEqual([]);
  });
});
describe("E2 sale mornings and clock authority", () => {
  it("scheduled sales make no early task, then create a start task on the store's first-day morning", async () => {
    change({
      mode: "sale",
      price: "4.99",
      starts_on: "2026-10-13",
      last_day: "2026-10-15",
    });
    expect(tasks()).toHaveLength(0);
    const starts = new Date("2026-10-13T04:00:00Z");
    await saleClock(starts);
    await clock(starts);
    expect(task().new_price.price).toBe("4.99");
    expect(task().new_price.sale_id).toBeTruthy();
  });
  it("prepares the sale-end task on last-day morning without changing today's customer price", async () => {
    change({ mode: "sale", price: "4.99", last_day: "2026-10-13" });
    const row = task();
    updatePriceTask(state, supervisor, row.id, {
      register_changed: true,
      no_label_reason: "No shelf label",
    });
    completePriceTasks(state, supervisor, [row.id]);
    const morning = new Date("2026-10-13T04:00:00Z");
    await saleClock(morning);
    await clock(morning);
    expect(task().reason).toBe("Sale ends after today");
    expect(task().new_price.price).toBe("6.99");
    expect(task().effective_at).toBe("2026-10-14T04:00:00.000Z");
    expect(effectivePrice(state, "0004", "Branch 2", morning)).toBe("4.99");
  });
  it("does not duplicate an end task the next morning, even after staff completed it at closing", async () => {
    change({ mode: "sale", price: "4.99", last_day: "2026-10-13" });
    await clock(new Date("2026-10-13T04:00:00Z"));
    const end = task();
    updatePriceTask(state, supervisor, end.id, {
      register_changed: true,
      no_label_reason: "No shelf label",
    });
    completePriceTasks(state, supervisor, [end.id]);
    const count = tasks().length;
    const after = new Date("2026-10-14T04:00:00Z");
    await saleClock(after);
    await clock(after);
    expect(tasks()).toHaveLength(count);
    expect(effectivePrice(state, "0004", "Branch 2", after)).toBe("6.99");
  });
  it("uses each store's time zone and survives daylight saving time", async () => {
    state.config.branches.find((row) => row.id === "Branch 2")!.timezone =
      "America/Los_Angeles";
    change({
      mode: "sale",
      price: "4.99",
      starts_on: "2026-11-01",
      last_day: "2026-11-02",
    });
    await clock(new Date("2026-11-01T06:59:59Z"));
    expect(tasks()).toHaveLength(0);
    const morning = new Date("2026-11-01T07:00:00Z");
    await saleClock(morning);
    await clock(morning);
    expect(task().new_price.price).toBe("4.99");
    await clock(new Date("2026-11-02T08:00:00Z"));
    expect(task().effective_at).toBe("2026-11-03T08:00:00.000Z");
  });
  it("changing an active sale coalesces its task and ending early restores the current regular price", () => {
    const result = change({
      mode: "sale",
      price: "4.99",
      last_day: "2026-10-25",
    });
    const sale = result.sales[0];
    let before = cloneWithAuthority(state);
    changeSale(
      state,
      manager,
      sale.id,
      input({
        mode: "sale",
        price: "4.49",
        last_day: "2026-10-25",
        existing_sale_id: sale.id,
        expected_revision: sale.revision,
      }),
    );
    capturePriceUpdateChanges(before, state, manager);
    expect(task().new_price.price).toBe("4.49");
    before = cloneWithAuthority(state);
    endSale(state, manager, sale.id, {
      expected_revision: state.sales!.find((row) => row.id === sale.id)!
        .revision,
    });
    capturePriceUpdateChanges(before, state, manager);
    expect(tasks()[0].new_price.price).toBe("6.99");
  });
  it("a plain fabricated system attribution cannot run E2 reconciliation", () => {
    expect(() =>
      evaluatePriceUpdates(state, {
        kind: "system",
        source_event_id: "fake",
        applied_at: now.toISOString(),
      }),
    ).toThrow();
  });
});
describe("E2 exact staff permissions and physical label confirmation", () => {
  it("Branch Supervisor reads own task, while another location and Cashier task-detail access fail", () => {
    change({ scope: "all" });
    expect(
      priceUpdateTasks(state, supervisor).map((row) => row.branch),
    ).toEqual(["Branch 2"]);
    const other = tasks().find((row) => row.branch === "Branch 1")!;
    expect(() =>
      updatePriceTask(state, supervisor, other.id, { register_changed: true }),
    ).toThrow();
    expect(() => priceUpdateTasks(state, cashier)).toThrow();
  });
  it("Floor Worker can confirm a real printed label but cannot claim register, waive label or finish by default", () => {
    change();
    physicalLabel(task(), floor);
    expect(task().label_printed?.by_user_id).toBe(floor.user_id);
    expect(() =>
      updatePriceTask(state, floor, task().id, { register_changed: true }),
    ).toThrow();
    expect(() =>
      updatePriceTask(state, floor, task().id, { no_label_reason: "No shelf" }),
    ).toThrow();
    expect(() => completePriceTasks(state, floor, [task().id])).toThrow();
  });
  it("a preview or queue addition does not count as a printed label", () => {
    change();
    preparePriceTaskPrint(state, supervisor, [task().id]);
    queuePriceTaskLabels(state, supervisor, [task().id]);
    expect(task().label_printed).toBeUndefined();
    expect(() =>
      updatePriceTask(state, supervisor, task().id, { label_printed: true }),
    ).toThrow("print");
    expect(task().label_printed).toBeUndefined();
  });
  it("Done needs no checklist and records the real person, time and Seen", () => {
    change();
    const row = task();
    completePriceTasks(state, supervisor, [row.id]);
    expect(row.status).toBe("done");
    expect(row.completed_by_user_id).toBe(supervisor.user_id);
    expect(row.completed_at).toBe(now.toISOString());
    expect(row.seen?.by_user_id).toBe(supervisor.user_id);
    expect(row.seen?.version).toBe(row.version);
    expect(() => completePriceTasks(state, supervisor, [row.id])).toThrow(
      "status",
    );
  });
  it("Seen records who and when once per version; a new change asks again", () => {
    change();
    const row = task();
    markPriceTaskSeen(state, floor, row.id);
    expect(row.seen?.by_user_id).toBe(floor.user_id);
    expect(row.seen?.at).toBe(now.toISOString());
    const audits = state.activity.filter(
      (entry) => entry.action === "Mark price update seen",
    ).length;
    markPriceTaskSeen(state, supervisor, row.id);
    expect(row.seen?.by_user_id).toBe(floor.user_id);
    expect(
      state.activity.filter(
        (entry) => entry.action === "Mark price update seen",
      ).length,
    ).toBe(audits);
    change({ price: "5.49" });
    expect(task().seen?.version).not.toBe(task().version);
    markPriceTaskSeen(state, supervisor, task().id);
    expect(task().seen?.by_user_id).toBe(supervisor.user_id);
    expect(task().seen?.version).toBe(task().version);
  });
  it("Seen is limited to people who may read the task at its location", () => {
    change();
    const row = task();
    expect(() => markPriceTaskSeen(state, cashier, row.id)).toThrow();
    expect(row.seen).toBeUndefined();
    completePriceTasks(state, supervisor, [row.id]);
    expect(() => markPriceTaskSeen(state, floor, row.id)).toThrow("status");
  });
  it("a reasoned no-label waiver is the alternative to physical label confirmation", () => {
    change();
    expect(() =>
      updatePriceTask(state, supervisor, task().id, { no_label_reason: " " }),
    ).toThrow("reason");
    updatePriceTask(state, supervisor, task().id, {
      register_changed: true,
      no_label_reason: "Displayed on the produce board",
    });
    completePriceTasks(state, supervisor, [task().id]);
    expect(tasks()[0].no_label?.reason).toBe("Displayed on the produce board");
  });
  it("the explicit Floor completion setting allows completion of an already-acknowledged register", () => {
    savePriceUpdateSettings(state, manager, {
      allow_floor_worker_complete: true,
      remind_after_hours: 24,
      escalate_after_hours: 48,
    });
    change();
    physicalLabel(task(), floor);
    updatePriceTask(state, supervisor, task().id, { register_changed: true });
    completePriceTasks(state, floor, [task().id]);
    expect(tasks()[0].completed_by_user_id).toBe(floor.user_id);
  });
  it("validates every task before completing a bulk selection", () => {
    change({ scope: "all" });
    const own = task(),
      other = tasks().find((row) => row.branch === "Branch 1")!;
    updatePriceTask(state, supervisor, own.id, {
      register_changed: true,
      no_label_reason: "No shelf label",
    });
    expect(() =>
      completePriceTasks(state, supervisor, [own.id, other.id]),
    ).toThrow();
    expect(own.status).toBe("pending");
  });
  it("a stale immutable print cannot acknowledge a newer coalesced price", () => {
    change();
    const sheet = preparePriceTaskPrint(state, supervisor, [task().id]);
    change({ price: "5.49" });
    expect(sheet.items[0].price.price).toBe("5.99");
    expect(() => recordPriceTaskPrint(state, supervisor, sheet)).toThrow(
      "stale_print",
    );
    expect(task().label_printed).toBeUndefined();
  });
  it("tampered print prices are rejected against canonical task and product terms", () => {
    change();
    const sheet = preparePriceTaskPrint(state, supervisor, [task().id]);
    sheet.batches[0].products[0].label_effective_price = "0.01";
    expect(() => recordPriceTaskPrint(state, supervisor, sheet)).toThrow(
      "stale_print",
    );
  });
  it("a last-day queued label prints tomorrow's intended regular price through the real Labels path", async () => {
    change({ mode: "sale", price: "4.99", last_day: "2026-10-13" });
    await clock(new Date("2026-10-13T04:00:00Z"));
    const row = task();
    queuePriceTaskLabels(state, supervisor, [row.id]);
    const template = state.templates.find((item) => item.style === "regular")!;
    const sheet = prepareLabelPrint(state, "Branch 2", template, 1, supervisor);
    expect(sheet.products[0].label_effective_price).toBe("6.99");
    expect(sheet.products[0].label_sale).toBeNull();
    confirmLabelsPrinted(state, sheet, supervisor);
    confirmPriceTaskWaitlistLabels(state, supervisor, sheet);
    expect(row.label_printed?.version).toBe(row.version);
  });
  it("ordinary label queues retain their existing price/print flow", () => {
    addLabelsToWaitlist(state, ["0004"], 1, "Branch 2", supervisor);
    const template = state.templates.find((item) => item.style === "regular")!;
    const sheet = prepareLabelPrint(state, "Branch 2", template, 1, supervisor);
    confirmLabelsPrinted(state, sheet, supervisor);
    confirmPriceTaskWaitlistLabels(state, supervisor, sheet);
    expect(tasks()).toHaveLength(0);
  });
});
describe("E2 reminders, notifications and public Cashier hints", () => {
  it("creates a genuine personal Branch Supervisor notification and no task notification for a Cashier", () => {
    change();
    const notifications = state.notifications ?? [];
    expect(
      notifications.some(
        (row) =>
          row.recipient_user_id === supervisor.user_id &&
          row.kind === "price_update_created",
      ),
    ).toBe(true);
    expect(
      notifications.some(
        (row) =>
          row.recipient_user_id === cashier.user_id &&
          row.kind.startsWith("price_update"),
      ),
    ).toBe(false);
  });
  it("reminds after24hours and escalates after48hours once, with a store count", async () => {
    change();
    await clock(new Date(now.getTime() + 24 * 3_600_000 - 1));
    expect(
      state.notifications?.filter(
        (row) => row.kind === "price_update_reminder",
      ),
    ).toHaveLength(0);
    await clock(new Date(now.getTime() + 24 * 3_600_000));
    expect(
      state.notifications?.filter(
        (row) =>
          row.kind === "price_update_reminder" &&
          row.recipient_user_id === supervisor.user_id,
      ),
    ).toHaveLength(1);
    await clock(new Date(now.getTime() + 48 * 3_600_000));
    const escalations =
      state.notifications?.filter(
        (row) => row.kind === "price_update_escalation",
      ) ?? [];
    expect(escalations).toHaveLength(2);
    expect(escalations.every((row) => row.count === 1)).toBe(true);
    const count = state.notifications!.length;
    await clock(new Date(now.getTime() + 49 * 3_600_000));
    expect(state.notifications).toHaveLength(count);
  });
  it("mandatory task reminders remain enabled when ordinary role routing is empty", async () => {
    const settings = notificationSettings(state);
    settings.events.price_updates = [];
    saveNotificationSettings(state, manager, settings);
    change();
    expect(
      state.notifications?.filter((row) => row.kind === "price_update_created"),
    ).toHaveLength(0);
    await clock(new Date(now.getTime() + 48 * 3_600_000));
    expect(
      state.notifications?.some(
        (row) =>
          row.kind === "price_update_reminder" &&
          row.recipient_user_id === supervisor.user_id,
      ),
    ).toBe(true);
    expect(
      state.notifications?.filter(
        (row) => row.kind === "price_update_escalation",
      ),
    ).toHaveLength(2);
  });
  it("Cashier sees minimal pending old and new prices only at their currently selected Store", () => {
    change({ scope: "all" });
    const hints = priceChangeHints(state, cashier);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      branch: "Branch 2",
      product_code: "0004",
      old_price: "6.99",
      new_price: "5.99",
    });
    expect(JSON.stringify(hints)).not.toMatch(
      /cost|margin|decided_by|steps|password|Branch 1/,
    );
  });
  it("the Cashier hint disappears after the genuine task is completed", () => {
    change();
    const row = task();
    expect(priceChangeHints(state, cashier)).toHaveLength(1);
    updatePriceTask(state, supervisor, row.id, {
      register_changed: true,
      no_label_reason: "No shelf",
    });
    completePriceTasks(state, supervisor, [row.id]);
    expect(priceChangeHints(state, cashier)).toEqual([]);
  });
  it("notifications are owned by their current real recipient; marking read cannot mark another person's rows", () => {
    change();
    const before = state
      .notifications!.filter(
        (row) => row.recipient_user_id !== supervisor.user_id,
      )
      .map((row) => ({ ...row }));
    markAllNotificationsRead(state, supervisor);
    expect(
      state
        .notifications!.filter(
          (row) => row.recipient_user_id === supervisor.user_id,
        )
        .every((row) => row.read_at),
    ).toBe(true);
    expect(
      state.notifications!.filter(
        (row) => row.recipient_user_id !== supervisor.user_id,
      ),
    ).toEqual(before);
    expect(projectSalesReadView(state, cashier).notifications).toEqual([]);
  });
  it("changing notification routing cannot grant Cashier private approval events", () => {
    const settings = notificationSettings(state);
    settings.events.approvals_waiting = ["cashier"];
    saveNotificationSettings(state, manager, settings);
    const before = cloneWithAuthority(state);
    capturePriceUpdateChanges(before, state, manager);
    expect(
      state.notifications?.some(
        (row) =>
          row.kind === "approval_waiting" &&
          row.recipient_user_id === cashier.user_id,
      ),
    ).toBe(false);
  });
});

it("keeps a first-seen last-day closing task pending even when tomorrow restores its original regular price", () => {
  change({ mode: "sale", price: "4.99", last_day: "2026-10-12" });
  expect(tasks()).toHaveLength(1);
  expect(task().status).toBe("pending");
  expect(task().reason).toBe("Sale ends after today");
  expect(task().effective_at).toBe("2026-10-13T04:00:00.000Z");
  expect(effectivePrice(state, "0004", "Branch 2", now)).toBe("4.99");
});
it("retains actual lb and kg displayed amounts while physical labels retain canonical per-lb money", () => {
  state.config.weighed_items!.main_display_unit = "lb";
  const before = cloneWithAuthority(state);
  const candidate = structuredClone(state.config);
  candidate.weighed_items!.main_display_unit = "kg";
  savePricingSettings(state, candidate, manager);
  capturePriceUpdateChanges(before, state, manager);
  const row = tasks().find(
    (task) => task.branch === "Branch 2" && task.product_code === "0016",
  )!;
  expect(row.reason).toBe("Pricing rules changed");
  expect(row.old_price).toMatchObject({ price: "7.49", unit: "lb" });
  expect(row.new_price).toMatchObject({
    price: "16.51",
    unit: "kg",
    canonical_price: "7.49",
  });
  const sheet = preparePriceTaskPrint(state, supervisor, [row.id]);
  expect(sheet.batches[0].products[0].label_effective_price).toBe("7.49");
  const hint = priceChangeHints(state, cashier).find(
    (hint) => hint.product_code === "0016",
  )!;
  expect(hint).toMatchObject({
    old_price: "7.49",
    old_unit: "lb",
    new_price: "16.51",
    new_unit: "kg",
  });
});
it("prefers the actual product decision over unrelated later bookkeeping at the same Store", () => {
  const before = cloneWithAuthority(state);
  savePriceChange(state, manager, input());
  state.activity.push({
    id: "unrelated-note",
    company_id: manager.company_id,
    branch: "Branch 2",
    entity_type: "note",
    entity_id: "some-note",
    action: "note_added",
    by: manager.actor,
    at: now.toISOString(),
  });
  capturePriceUpdateChanges(before, state, manager);
  expect(task().reason).toBe("Set regular price");
  expect(task().source_activity_id).not.toBe("unrelated-note");
});

it("a scheduled ordinary offer uses its actual terms rather than an older Sale's cause", async () => {
  const result = change({
    mode: "sale",
    price: "4.99",
    last_day: "2026-10-25",
  });
  const sale = result.sales[0];
  const before = cloneWithAuthority(state);
  endSale(state, manager, sale.id, { expected_revision: sale.revision });
  capturePriceUpdateChanges(before, state, manager);
  state.offers.push({
    id: "offer-after-sale",
    company_id: manager.company_id,
    branch: "Branch 2",
    product_code: "0004",
    scope: "branch",
    status: "active",
    label: "2 for $12",
    price: "6.99",
    pool: "own",
    mix_and_match: true,
    currency: state.config.company.currency,
    start_date: "2026-10-13",
    end_date: "2026-10-20",
  });
  await clock(new Date("2026-10-13T04:00:00Z"));
  const latest = task();
  expect(latest.new_price.offer_id).toBe("offer-after-sale");
  expect(latest.reason).toBe("Create offer");
  expect(latest.reason).not.toBe("End sale");
});

it("preserves exact entered kg Sale cents rather than rounding its per-lb conversion first", () => {
  state.config.weighed_items!.main_display_unit = "kg";
  change({
    product_code: "0016",
    mode: "sale",
    price: "15.99",
    price_unit: "kg",
    last_day: "2026-10-25",
  });
  const row = tasks().find(
    (row) => row.branch === "Branch 2" && row.product_code === "0016",
  )!;
  expect(row.new_price).toMatchObject({
    price: "15.99",
    unit: "kg",
    regular_price: "16.51",
  });
  const print = preparePriceTaskPrint(state, supervisor, [row.id]);
  expect(print.batches[0].products[0].label_sale).toMatchObject({
    sale_price: "15.99",
    price_unit: "kg",
  });
});
