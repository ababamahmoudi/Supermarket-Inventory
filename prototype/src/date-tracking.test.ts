import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  addTrackedDate,
  DateTrackingError,
  nextTrackedDate,
  removeTrackedDate,
  scopedTrackedDates,
  setProductDateTracking,
  stopProductDateTracking,
  trackingChoiceForProduct,
  validTrackedDate,
  type AddTrackedDateInput,
  type DateRemovalReason,
} from "./date-tracking";
import {
  attachReversals,
  reverseActivity,
  type HistoryContext,
} from "./history";
import { configuredBranches } from "./settings";
import type { DemoState } from "./types";

function context(
  state: DemoState,
  overrides: Partial<HistoryContext> = {},
): HistoryContext {
  return {
    company_id: state.config.company.seed_key,
    branch: "all",
    allowed_branches: configuredBranches(state.config, true),
    role: "supervisor",
    actor: "Demo Supervisor",
    username: "supervisor",
    ...overrides,
  };
}
function input(
  state: DemoState,
  overrides: Partial<AddTrackedDateInput> = {},
): AddTrackedDateInput {
  return {
    product_code: state.products[0].code,
    branch: "Branch 1",
    date_type: "expiry",
    date: "2026-10-14",
    ...overrides,
  };
}

describe("manual date evidence and preference", () => {
  it("keeps explicit Yes/No separate from an unset preference", () => {
    expect(trackingChoiceForProduct({ date_tracking: true })).toBe("yes");
    expect(trackingChoiceForProduct({ date_tracking: false })).toBe("no");
    expect(trackingChoiceForProduct({})).toBeUndefined();
    expect(trackingChoiceForProduct(null)).toBeUndefined();
  });
  it("adds past Best before evidence and enables tracking without money or stock changes", () => {
    const state = initialState();
    const actor = context(state);
    const physical = structuredClone({
      stock: state.stock,
      movements: state.stock_movements,
      ledger: state.ledger,
      invoice: state.invoice,
    });
    const entry = addTrackedDate(
      state,
      actor,
      input(state, {
        date_type: "best_before",
        date: "2020-02-29",
        quantity: " 1.250 ",
        lot_number: " LOT-21 ",
        note: " Shelf check ",
      }),
    );
    expect(entry).toMatchObject({
      company_id: actor.company_id,
      branch: "Branch 1",
      source: "manual",
      date_type: "best_before",
      date: "2020-02-29",
      quantity: "1.25",
      lot_number: "LOT-21",
      note: "Shelf check",
      status: "active",
      created_by: actor.actor,
    });
    expect(entry.created_at).toEqual(expect.any(String));
    expect(state.activity.at(-1)).toMatchObject({
      action: "Add date",
      entity_id: entry.id,
      by: actor.actor,
      actor_username: actor.username,
      reversible: true,
    });
    expect({
      stock: state.stock,
      movements: state.stock_movements,
      ledger: state.ledger,
      invoice: state.invoice,
    }).toEqual(physical);
    expect(state.products[0].date_tracking).toBe(true);
  });
  it.each([
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-01",
    "2026-1-01",
    "not-a-date",
  ])("rejects invalid calendar date %s atomically", (date) => {
    const state = initialState();
    const before = structuredClone(state);
    expect(validTrackedDate(date)).toBe(false);
    expect(() =>
      addTrackedDate(state, context(state), input(state, { date })),
    ).toThrow(new DateTrackingError("date"));
    expect(state).toEqual(before);
  });
  it.each(["0", "-2", "NaN", "Infinity", "no"])(
    "rejects invalid optional quantity %s without a partial entry",
    (quantity) => {
      const state = initialState();
      const before = structuredClone(state);
      expect(() =>
        addTrackedDate(state, context(state), input(state, { quantity })),
      ).toThrow(new DateTrackingError("quantity"));
      expect(state).toEqual(before);
    },
  );
  it("requires an active own-company product and configured allowed location", () => {
    const state = initialState();
    const actor = context(state, { allowed_branches: ["Branch 1"] });
    const foreign = {
      ...state.products[0],
      code: "foreign",
      company_id: "other-company",
    };
    state.products.push(foreign);
    const before = structuredClone(state);
    for (const values of [
      { product_code: "foreign" },
      { branch: "Branch 2" },
      { branch: "all" },
      { branch: "unknown" },
    ]) {
      expect(() => addTrackedDate(state, actor, input(state, values))).toThrow(
        DateTrackingError,
      );
      expect(state).toEqual(before);
    }
    state.products[0].status = "archived";
    expect(() => addTrackedDate(state, actor, input(state))).toThrow(
      new DateTrackingError("product"),
    );
  });
  it("permits workers only in their assigned location and denies cashier mutations", () => {
    const state = initialState();
    const worker = context(state, {
      role: "floor_worker",
      branch: "Branch 1",
      allowed_branches: ["Branch 1"],
      actor: "Demo Floor Worker",
      username: "floorworker",
    });
    const entry = addTrackedDate(state, worker, input(state));
    expect(() =>
      addTrackedDate(state, worker, input(state, { branch: "Branch 2" })),
    ).toThrow(new DateTrackingError("location"));
    expect(() =>
      stopProductDateTracking(state, worker, entry.product_code, true),
    ).toThrow(new DateTrackingError("permission"));
    const cashier = { ...worker, role: "cashier" as const };
    expect(() => addTrackedDate(state, cashier, input(state))).toThrow(
      new DateTrackingError("permission"),
    );
    expect(() =>
      removeTrackedDate(state, cashier, entry.id, "sold_out"),
    ).toThrow(new DateTrackingError("permission"));
  });
});

describe("inline tracking preference and atomic auto-enable", () => {
  it.each([false, undefined])(
    "Add enables %s and one Undo restores the preference and retains Removed evidence",
    (preference) => {
      const state = initialState();
      state.products[0].date_tracking = preference;
      const actor = context(state);
      const before = structuredClone(state);
      const entry = addTrackedDate(state, actor, input(state));
      expect(state.products[0].date_tracking).toBe(true);
      const actions = attachReversals(before, state, actor);
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe("Add date");
      reverseActivity(state, actor, actions[0].id, "undo");
      expect(state.products[0].date_tracking).toBe(preference);
      expect(
        state.expiry.find((record) => record.id === entry.id),
      ).toMatchObject({ status: "removed", removal_action: "undo" });
      expect(state.ledger).toEqual(before.ledger);
      expect(state.stock_movements).toEqual(before.stock_movements);
    },
  );
  it("a worker can toggle the preference in their location without removing dates, and Undo preserves unrelated edits", () => {
    const state = initialState();
    const worker = context(state, {
      role: "floor_worker",
      branch: "Branch 1",
      allowed_branches: ["Branch 1"],
      username: "floorworker",
      actor: "Demo Floor Worker",
    });
    const entry = addTrackedDate(state, worker, input(state));
    const dates = structuredClone(state.expiry);
    const before = structuredClone(state);
    setProductDateTracking(
      state,
      worker,
      entry.product_code,
      false,
      "Branch 1",
    );
    expect(state.products[0].date_tracking).toBe(false);
    expect(state.expiry).toEqual(dates);
    const action = attachReversals(before, state, worker)[0];
    expect(action).toMatchObject({
      action: "Turn off date tracking",
      branch: "Branch 1",
      entity_type: "product",
      reversible: true,
    });
    state.products[1].name_en = "Unrelated later name";
    reverseActivity(state, worker, action.id, "undo");
    expect(state.products[0].date_tracking).toBe(true);
    expect(state.products[1].name_en).toBe("Unrelated later name");
    expect(state.expiry).toEqual(dates);
  });
  it("rejects foreign companies, forbidden locations, archived products and Cashier toggles atomically", () => {
    const state = initialState();
    const worker = context(state, {
      role: "floor_worker",
      branch: "Branch 1",
      allowed_branches: ["Branch 1"],
    });
    state.products.push({
      ...state.products[0],
      code: "foreign",
      company_id: "other-company",
    });
    const before = structuredClone(state);
    for (const [actor, code, location] of [
      [
        { ...worker, role: "cashier" as const },
        state.products[0].code,
        "Branch 1",
      ],
      [
        { ...worker, company_id: "other-company" },
        state.products[0].code,
        "Branch 1",
      ],
      [worker, state.products[0].code, "Branch 2"],
      [worker, "foreign", "Branch 1"],
    ] as const) {
      expect(() =>
        setProductDateTracking(state, actor, code, true, location),
      ).toThrow(DateTrackingError);
      expect(state).toEqual(before);
    }
    state.products[0].status = "archived";
    const archived = structuredClone(state);
    expect(() =>
      setProductDateTracking(
        state,
        worker,
        state.products[0].code,
        true,
        "Branch 1",
      ),
    ).toThrow(new DateTrackingError("product"));
    expect(state).toEqual(archived);
  });
  it("repeating an unchanged preference adds no duplicate history", () => {
    const state = initialState();
    const actor = context(state);
    setProductDateTracking(
      state,
      actor,
      state.products[0].code,
      true,
      "Branch 1",
    );
    const before = structuredClone(state);
    setProductDateTracking(
      state,
      actor,
      state.products[0].code,
      true,
      "Branch 1",
    );
    expect(state).toEqual(before);
  });
  it("worker Add Undo restores an Off preference but cannot overwrite an intervening switch or field edit", () => {
    const state = initialState();
    const worker = context(state, {
      role: "floor_worker",
      branch: "Branch 1",
      allowed_branches: ["Branch 1"],
      username: "floorworker",
      actor: "Demo Floor Worker",
    });
    state.products[0].date_tracking = false;
    let before = structuredClone(state);
    const entry = addTrackedDate(state, worker, input(state));
    const action = attachReversals(before, state, worker)[0];
    reverseActivity(state, worker, action.id, "undo");
    expect(state.products[0].date_tracking).toBe(false);
    expect(state.expiry.find((date) => date.id === entry.id)?.status).toBe(
      "removed",
    );
    before = structuredClone(state);
    const later = addTrackedDate(state, worker, input(state));
    const laterAction = attachReversals(before, state, worker)[0];
    state.products[0].date_tracking = false;
    const changed = structuredClone(state);
    expect(() =>
      reverseActivity(state, worker, laterAction.id, "undo"),
    ).toThrow("conflict");
    expect(state).toEqual(changed);
    expect(state.expiry.find((date) => date.id === later.id)?.status).toBe(
      "active",
    );
  });
  it("worker tracking reversals reject a tampered extra catalog patch atomically", () => {
    const state = initialState();
    const worker = context(state, {
      role: "floor_worker",
      branch: "Branch 1",
      allowed_branches: ["Branch 1"],
      username: "floorworker",
      actor: "Demo Floor Worker",
    });
    const before = structuredClone(state);
    setProductDateTracking(
      state,
      worker,
      state.products[0].code,
      true,
      "Branch 1",
    );
    const action = attachReversals(before, state, worker)[0];
    action.reversal!.push({
      path: [
        "products",
        { key: "code", value: state.products[0].code },
        "name_en",
      ],
      before: "Unauthorized restored name",
      after: state.products[0].name_en,
      before_exists: true,
      after_exists: true,
    });
    const tampered = structuredClone(state);
    expect(() => reverseActivity(state, worker, action.id, "undo")).toThrow(
      "permission",
    );
    expect(state).toEqual(tampered);
  });
  it("a worker's tracking Undo requires the same current concrete location", () => {
    const state = initialState();
    const worker = context(state, {
      role: "floor_worker",
      branch: "Branch 1",
      allowed_branches: ["Branch 1", "Branch 2"],
      username: "floorworker",
      actor: "Demo Floor Worker",
    });
    const before = structuredClone(state);
    setProductDateTracking(
      state,
      worker,
      state.products[0].code,
      true,
      "Branch 1",
    );
    const action = attachReversals(before, state, worker)[0];
    const saved = structuredClone(state);
    expect(() =>
      reverseActivity(
        state,
        { ...worker, branch: "Branch 2" },
        action.id,
        "undo",
      ),
    ).toThrow("permission");
    expect(state).toEqual(saved);
  });
});

describe("scoped next date and removal history", () => {
  it("shows only active dates within the company, allowed locations and current selection", () => {
    const state = initialState();
    state.expiry = [];
    const actor = context(state);
    const north = addTrackedDate(
      state,
      actor,
      input(state, { date: "2026-11-02" }),
    );
    const other = addTrackedDate(
      state,
      actor,
      input(state, { branch: "Branch 2", date: "2026-10-14" }),
    );
    state.expiry.push({
      ...north,
      id: "foreign",
      company_id: "other-company",
      date: "2020-01-01",
    });
    expect(nextTrackedDate(state, actor, north.product_code)?.id).toBe(
      other.id,
    );
    const northOnly = { ...actor, branch: "Branch 1" };
    expect(nextTrackedDate(state, northOnly, north.product_code)?.id).toBe(
      north.id,
    );
    expect(
      nextTrackedDate(
        state,
        { ...actor, allowed_branches: ["Branch 1"] },
        north.product_code,
      )?.id,
    ).toBe(north.id);
    expect(
      scopedTrackedDates(
        state,
        { ...actor, company_id: "other-company" },
        true,
      ),
    ).toEqual([]);
    removeTrackedDate(state, actor, other.id, "sold_out");
    expect(nextTrackedDate(state, actor, north.product_code)?.id).toBe(
      north.id,
    );
    expect(scopedTrackedDates(state, actor, true)).toHaveLength(2);
  });
  it("applies effective invoice relocation before guarding date scope", () => {
    const state = initialState();
    state.invoice.status = "posted";
    state.expiry = [
      {
        id: "from-invoice",
        company_id: state.config.company.seed_key,
        branch: "Branch 1",
        product_code: state.products[0].code,
        date: "2026-10-14",
        expires_in_days: 5,
        status: "active",
        invoice_id: state.invoice.id,
      },
    ];
    state.invoice_location_corrections = [
      {
        id: "move",
        company_id: state.config.company.seed_key,
        invoice_id: state.invoice.id,
        from_branch: "Branch 1",
        to_branch: "Branch 2",
        reason: "Wrong location",
        at: new Date().toISOString(),
        by: "Demo Supervisor",
        outstanding_amount: "0.00",
        currency: state.config.company.currency,
        allocations: [],
        receipt_ids: [],
        approval_ids: [],
        ledger_out_id: "move-out",
        ledger_in_id: "move-in",
      },
    ];
    const actor = context(state);
    expect(
      nextTrackedDate(
        state,
        { ...actor, branch: "Branch 1" },
        state.products[0].code,
      ),
    ).toBeUndefined();
    expect(
      nextTrackedDate(
        state,
        { ...actor, branch: "Branch 2" },
        state.products[0].code,
      )?.branch,
    ).toBe("Branch 2");
    expect(() =>
      removeTrackedDate(
        state,
        { ...actor, branch: "Branch 1" },
        "from-invoice",
        "sold_out",
      ),
    ).toThrow(new DateTrackingError("scope"));
    const worker = {
      ...actor,
      role: "floor_worker" as const,
      branch: "Branch 2",
      allowed_branches: ["Branch 2"],
      actor: "Richmond worker",
      username: "richmond-worker",
    };
    const before = structuredClone(state);
    removeTrackedDate(state, worker, "from-invoice", "sold_out");
    const action = attachReversals(before, state, worker)[0];
    reverseActivity(state, worker, action.id, "undo");
    expect(state.expiry[0].status).toBe("active");
    expect(state.expiry[0].branch).toBe("Branch 1");
    expect(nextTrackedDate(state, worker, state.products[0].code)?.branch).toBe(
      "Branch 2",
    );
  });
  it.each<DateRemovalReason>([
    "sold_out",
    "thrown_away",
    "returned_to_supplier",
    "entered_by_mistake",
  ])(
    "retains %s reason, actor/time and no physical or money change",
    (reason) => {
      const state = initialState();
      const actor = context(state);
      const entry = addTrackedDate(state, actor, input(state));
      const physical = structuredClone({
        stock: state.stock,
        movements: state.stock_movements,
        ledger: state.ledger,
        returns: state.returns,
      });
      removeTrackedDate(state, actor, entry.id, reason);
      expect(state.expiry.find((item) => item.id === entry.id)).toMatchObject({
        status: "removed",
        removed_reason: reason,
        removal_action: "remove",
        removed_by: actor.actor,
        removed_at: expect.any(String),
      });
      expect(state.activity.at(-1)?.action).toBe("Remove date");
      expect({
        stock: state.stock,
        movements: state.stock_movements,
        ledger: state.ledger,
        returns: state.returns,
      }).toEqual(physical);
      expect(() => removeTrackedDate(state, actor, entry.id, reason)).toThrow(
        new DateTrackingError("inactive"),
      );
    },
  );
  it("rejects an absent reason and unauthorized date removal without mutations", () => {
    const state = initialState();
    const actor = context(state);
    const entry = addTrackedDate(
      state,
      actor,
      input(state, { branch: "Branch 2" }),
    );
    const before = structuredClone(state);
    expect(() =>
      removeTrackedDate(state, actor, entry.id, "" as DateRemovalReason),
    ).toThrow(new DateTrackingError("reason"));
    expect(() =>
      removeTrackedDate(
        state,
        { ...actor, allowed_branches: ["Branch 1"] },
        entry.id,
        "sold_out",
      ),
    ).toThrow(new DateTrackingError("scope"));
    expect(state).toEqual(before);
  });
});

describe("conflict-aware date Undo and stopping preference", () => {
  it("Undo Add retains Removed evidence and Undo Remove restores the original active record", () => {
    const state = initialState();
    const actor = context(state);
    let before = structuredClone(state);
    const added = addTrackedDate(state, actor, input(state));
    const addAction = attachReversals(before, state, actor)[0];
    reverseActivity(state, actor, addAction.id, "undo");
    expect(state.expiry.find((entry) => entry.id === added.id)).toMatchObject({
      status: "removed",
      removal_action: "undo",
      removed_by: actor.actor,
      removed_at: expect.any(String),
      date: added.date,
    });
    const active = addTrackedDate(state, actor, input(state));
    const original = structuredClone(active);
    before = structuredClone(state);
    removeTrackedDate(state, actor, active.id, "thrown_away");
    const removeAction = attachReversals(before, state, actor)[0];
    reverseActivity(state, actor, removeAction.id, "undo");
    expect(state.expiry.find((entry) => entry.id === active.id)).toEqual(
      original,
    );
    expect(state.activity.at(-1)).toMatchObject({
      action: "Undone",
      reversed_activity_id: removeAction.id,
    });
  });
  it("Stop keeps dates unless explicitly selected, and removes only allowed dates when selected", () => {
    const state = initialState();
    state.expiry = [];
    const actor = context(state);
    const north = addTrackedDate(state, actor, input(state));
    const other = addTrackedDate(
      state,
      actor,
      input(state, { branch: "Branch 2" }),
    );
    state.products[0].date_tracking = true;
    stopProductDateTracking(state, actor, north.product_code, false);
    expect(state.products[0].date_tracking).toBe(false);
    expect(state.expiry.every((entry) => entry.status === "active")).toBe(true);
    state.products[0].date_tracking = true;
    const before = structuredClone(state);
    const scoped = { ...actor, allowed_branches: ["Branch 1"] };
    stopProductDateTracking(state, scoped, north.product_code, true);
    expect(state.expiry.find((entry) => entry.id === north.id)).toMatchObject({
      status: "removed",
      removal_action: "stop_tracking",
    });
    expect(state.expiry.find((entry) => entry.id === other.id)?.status).toBe(
      "active",
    );
    const action = attachReversals(before, state, scoped)[0];
    reverseActivity(state, actor, action.id, "undo");
    expect(state.products[0].date_tracking).toBe(true);
    expect(state.expiry).toEqual(before.expiry);
  });
  it("refuses Undo when another employee changes the same date without losing their evidence", () => {
    const state = initialState();
    const actor = context(state);
    const entry = addTrackedDate(state, actor, input(state));
    const before = structuredClone(state);
    removeTrackedDate(state, actor, entry.id, "sold_out");
    const action = attachReversals(before, state, actor)[0];
    state.expiry.find((item) => item.id === entry.id)!.note =
      "Another employee's evidence";
    const conflict = structuredClone(state);
    expect(() => reverseActivity(state, actor, action.id, "undo")).toThrow(
      "conflict",
    );
    expect(state).toEqual(conflict);
  });
});
