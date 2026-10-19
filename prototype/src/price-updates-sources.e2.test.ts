import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import { migrateE1BusinessState } from "./e1-state-migration";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { reconcileFixture } from "./system-reconciliation-test-fixture";
import {
  capturePriceUpdateChanges,
  evaluatePriceUpdates,
  priceUpdateTasks,
  queuePriceTaskLabels,
  preparePriceTaskPrint,
  confirmPriceTaskWaitlistLabels,
  notificationSettings,
  saveNotificationSettings,
} from "./price-updates";
import {
  requestSale,
  resolveSaleRequest,
  userNotifications,
  type ChangePriceInput,
} from "./sales";
import { applyApprovedPrice, resolveApproval } from "./approvals";
import { receiptLots, setLotClearance } from "./receipt-lots";
import { prepareLabelPrint, confirmLabelsPrinted } from "./label-workflow";
import { saveBranchRequestDraft, sendBranchRequest } from "./branch-requests";
import { addTrackedDate, syncDateReminderAlerts } from "./date-tracking";
import type { DemoState } from "./types";
import type { AuthenticatedActor } from "./authority-types";
const now = new Date("2026-10-12T16:00:00Z");
let state: DemoState,
  manager: AuthenticatedActor,
  supervisor: AuthenticatedActor,
  floor: AuthenticatedActor,
  cashier: AuthenticatedActor;
const tick = () =>
  reconcileFixture(
    state,
    "price_updates",
    (draft, source) => evaluatePriceUpdates(draft, source),
    now,
  );
const requestInput = (): ChangePriceInput => ({
  product_code: "0004",
  mode: "sale",
  scope: "current",
  price: "5.49",
  price_unit: "each",
  branches: ["Branch 2"],
  starts_on: "2026-10-12",
  last_day: "2026-10-25",
  accept_below_margin: false,
  below_cost_reason: "",
  add_labels: false,
  why: "slow seller",
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  state = migrateE1BusinessState(initialState());
  state.sales = [];
  state.sale_events = [];
  state.sale_requests = [];
  state.notifications = [];
  state.label_waitlist = [];
  manager = authenticatedTestActor(state, "manager", { now });
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
  await tick();
  state.notifications = [];
});
afterEach(() => vi.useRealTimers());
describe("E2 actual source adapters and notification settings", () => {
  it("Black Tea Apply this price to all creates only Richmond Hill's actual conflict task", () => {
    const before = cloneWithAuthority(state);
    applyApprovedPrice(state, manager, "0004", "6.49", "all", "all");
    capturePriceUpdateChanges(before, state, manager);
    expect(state.price_update_tasks).toHaveLength(1);
    expect(state.price_update_tasks![0]).toMatchObject({
      branch: "Branch 2",
      product_code: "0004",
      reason: "Apply price to all branches",
      old_price: { price: "6.99" },
      new_price: { price: "6.49" },
    });
  });
  it("the existing genuine price approval creates the affected Store's task", () => {
    const approval = state.approvals.find(
      (row) => row.id === "demo-lavash-price",
    )!;
    const before = cloneWithAuthority(state);
    resolveApproval(
      state,
      manager,
      approval.id,
      "approve",
      "branch",
      "Branch 1",
    );
    capturePriceUpdateChanges(before, state, manager);
    expect(
      state.price_update_tasks?.some(
        (task) =>
          task.product_code === "0006" &&
          task.branch === "Branch 1" &&
          task.new_price.price === "2.99",
      ),
    ).toBe(true);
  });
  it("new product approval creates the first-price task without retroactive initial backlog", () => {
    const approval = state.approvals.find((row) => row.type === "new_product")!;
    const before = cloneWithAuthority(state);
    resolveApproval(
      state,
      manager,
      approval.id,
      "approve",
      "branch",
      "Branch 1",
    );
    capturePriceUpdateChanges(before, state, manager);
    expect(
      state.price_update_tasks?.some(
        (task) =>
          task.product_code === "0015" &&
          task.old_price.price === null &&
          !!task.new_price.price,
      ),
    ).toBe(true);
  });
  it("a real lot clearance remains separate from regular terms and requires its complete actual label sheet", () => {
    const line = structuredClone(
      state.invoice.lines.find((row) => row.product_code === "0003")!,
    );
    Object.assign(line, {
      qty_invoiced: 12,
      qty_received_at_posting: 12,
      qty_later_received: 0,
      quantity_unit: "units",
      quantity_entered: "12",
      date_tracking: true,
      date_confirmed: true,
      date_type: "expiry",
      date_value: "2026-11-04",
      short_dated: true,
      refused_units: 0,
    });
    state.invoices = [
      {
        ...structuredClone(state.invoice),
        id: "e2-clearance-original",
        company_id: manager.company_id,
        branch: "Branch 2",
        branch_id: "Branch 2",
        status: "posted",
        lines: [line],
        supplier_invoice_number: "E2-LOT-1",
        invoice_date: "2026-10-12",
        posted_at: now.toISOString(),
        received_at: now.toISOString(),
      },
    ];
    const lot = receiptLots(state)[0],
      before = cloneWithAuthority(state);
    const offer = setLotClearance(state, manager, lot.id, "2.49", now);
    capturePriceUpdateChanges(before, state, manager);
    const [task] = priceUpdateTasks(state, supervisor);
    expect(task.new_price.clearance_offers?.[0]).toMatchObject({
      id: offer.id,
      lot_id: lot.id,
      price: "2.49",
    });
    expect(task.old_price.price).toBe(task.new_price.price);
    const frozen = preparePriceTaskPrint(state, supervisor, [task.id]);
    expect(
      frozen.batches
        .flatMap((batch) => batch.products)
        .some(
          (product) =>
            product.label_lot_id === lot.id &&
            product.label_clearance_offer?.price === "2.49",
        ),
    ).toBe(true);
    queuePriceTaskLabels(state, supervisor, [task.id]);
    const template = state.templates.find((row) => row.style === "promo")!;
    const sheet = prepareLabelPrint(state, "Branch 2", template, 1, supervisor);
    expect(sheet.products).toEqual(
      frozen.batches.flatMap((batch) => batch.products),
    );
    const partial = structuredClone(sheet);
    partial.products = partial.products.filter(
      (product) => !product.label_lot_id,
    );
    confirmPriceTaskWaitlistLabels(state, supervisor, partial);
    expect(
      priceUpdateTasks(state, supervisor).find((row) => row.id === task.id)!
        .label_printed,
    ).toBeUndefined();
    confirmLabelsPrinted(state, sheet, supervisor);
    confirmPriceTaskWaitlistLabels(state, supervisor, sheet);
    expect(
      priceUpdateTasks(state, supervisor).find((row) => row.id === task.id)!
        .label_printed?.version,
    ).toBe(task.version);
  });
  it("the requester always gets their own exact rejection reason when ordinary decision routing is empty", async () => {
    const settings = notificationSettings(state);
    settings.events.sale_decisions = [];
    saveNotificationSettings(state, manager, settings);
    const request = requestSale(state, floor, requestInput(), now);
    resolveSaleRequest(
      state,
      manager,
      request.id,
      "reject",
      {
        expected_revision: request.revision,
        reason: "Fictional exact decision",
      },
      now,
    );
    await tick();
    expect(
      userNotifications(state, floor).find(
        (row) => row.kind === "sale_request_rejected",
      )?.reason,
    ).toBe("Fictional exact decision");
  });
  it("optional decision observers are actual company approvers and never receive the requester's private reason", async () => {
    const settings = notificationSettings(state);
    settings.events.sale_decisions = [
      "owner",
      "manager",
      "floor_worker",
      "cashier",
    ];
    saveNotificationSettings(state, manager, settings);
    const request = requestSale(state, floor, requestInput(), now);
    resolveSaleRequest(
      state,
      manager,
      request.id,
      "reject",
      {
        expected_revision: request.revision,
        reason: "Fictional private reason",
      },
      now,
    );
    await tick();
    const observers = (state.notifications ?? []).filter(
      (row) => row.kind === "sale_request_decision",
    );
    expect(observers.map((row) => row.recipient_user_id).sort()).toEqual([
      "demo-person-manager",
      "demo-person-owner",
    ]);
    expect(JSON.stringify(observers)).not.toContain("Fictional private reason");
    expect(userNotifications(state, cashier)).toEqual([]);
  });
  it("configured Branch Supervisors can receive own-location pending sale requests without approval authority", () => {
    const settings = notificationSettings(state);
    settings.events.sale_requests = ["branch_supervisor"];
    saveNotificationSettings(state, manager, settings);
    requestSale(state, floor, requestInput(), now);
    expect(
      state.notifications
        ?.filter((row) => row.kind === "sale_request_submitted")
        .map((row) => row.recipient_user_id),
    ).toEqual([supervisor.user_id]);
  });
  it("branch requests, genuine date reminders, approvals and waiting credit are routed from their actual canonical records", async () => {
    const request = saveBranchRequestDraft(state, manager, {
      from_branch: "Branch 1",
      to_branch: "Branch 2",
      items: [
        {
          kind: "catalog",
          product_code: "0004",
          quantity: "2",
          quantity_unit: "units",
        },
      ],
    });
    sendBranchRequest(state, manager, request.id, request.revision);
    addTrackedDate(state, supervisor, {
      product_code: "0004",
      branch: "Branch 2",
      date_type: "expiry",
      date: "2026-10-13",
    });
    await reconcileFixture(
      state,
      "date_reminders",
      (draft, source) => syncDateReminderAlerts(draft, source, now),
      now,
    );
    await tick();
    const notifications = state.notifications ?? [];
    expect(
      notifications.some(
        (row) =>
          row.kind === "branch_request_waiting" &&
          row.recipient_user_id === supervisor.user_id,
      ),
    ).toBe(true);
    expect(
      notifications.some(
        (row) =>
          row.kind === "expiry_date_waiting" &&
          row.recipient_user_id === supervisor.user_id,
      ),
    ).toBe(true);
    expect(
      notifications.some(
        (row) =>
          row.kind === "approval_waiting" &&
          row.recipient_user_id === manager.user_id,
      ),
    ).toBe(true);
    expect(
      notifications.some(
        (row) =>
          row.kind === "return_waiting_credit" &&
          row.recipient_user_id === manager.user_id,
      ),
    ).toBe(true);
    expect(userNotifications(state, cashier)).toEqual([]);
  });
  it("retained private event notifications lose access when their real recipient becomes a Cashier", async () => {
    await tick();
    expect(
      userNotifications(state, manager).some(
        (row) => row.kind === "approval_waiting",
      ),
    ).toBe(true);
    const changed = authenticatedTestActor(state, "cashier", {
      user_id: manager.user_id,
      username: "former-manager",
      locations: ["Branch 1", "Branch 2"],
      now,
    });
    expect(
      userNotifications(state, changed).some((row) =>
        [
          "approval_waiting",
          "return_waiting_credit",
          "price_update_escalation",
        ].includes(row.kind),
      ),
    ).toBe(false);
  });
});
