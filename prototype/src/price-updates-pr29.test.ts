import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import { migrateE1BusinessState } from "./e1-state-migration";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { reconcileFixture } from "./system-reconciliation-test-fixture";
import { savePriceChange } from "./sales";
import {
  bulkPriceTasks,
  capturePriceUpdateChanges,
  confirmPriceTaskLabel,
  evaluatePriceUpdates,
  markPriceTaskSeen,
  preparePriceTaskPrint,
  queuePriceTaskLabels,
  recordPriceTaskPrint,
  type PriceUpdateTask,
} from "./price-updates";
import { priceUpdatesCsv } from "./price-updates-csv";
import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";

const now = new Date("2026-11-20T16:00:00Z");
let state: DemoState,
  manager: AuthenticatedActor,
  supervisor: AuthenticatedActor,
  floor: AuthenticatedActor;
const tasks = () => state.price_update_tasks ?? [];
const pending = (branch: string) =>
  tasks().find((row) => row.branch === branch && row.status === "pending")!;

function changeAllStores(code = "0004", price = "5.99") {
  const before = cloneWithAuthority(state);
  savePriceChange(
    state,
    manager,
    {
      product_code: code,
      mode: "regular",
      scope: "all",
      price,
      price_unit: "each",
      branches: ["Branch 1", "Branch 2", "Branch 3"],
      starts_on: "2026-11-20",
      last_day: null,
      accept_below_margin: true,
      below_cost_reason: "Fictional demo test",
      add_labels: false,
    },
    now,
  );
  capturePriceUpdateChanges(before, state, manager, now);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  state = migrateE1BusinessState(initialState());
  state.sales = [];
  state.sale_requests = [];
  state.offers = [];
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
  authenticatedTestActor(state, "owner", { now });
  await reconcileFixture(
    state,
    "price_updates",
    (draft, source) => evaluatePriceUpdates(draft, source),
    now,
  );
  changeAllStores();
});
afterEach(() => vi.useRealTimers());

describe("PR 29 bulk Seen and Done", () => {
  it("marks each allowed update done with who and when, and skips the rest", () => {
    const ids = ["Branch 1", "Branch 2", "Branch 3"].map(
      (branch) => pending(branch).id,
    );
    const later = new Date("2026-11-20T17:05:00Z");
    const outcome = bulkPriceTasks(state, supervisor, ids, "done", later);
    // The supervisor works in Branch 2 and Branch 3 only.
    expect(outcome.changed.sort()).toEqual(ids.slice(1).sort());
    expect(outcome.skipped).toEqual([ids[0]]);
    for (const id of ids.slice(1)) {
      const row = tasks().find((task) => task.id === id)!;
      expect(row.status).toBe("done");
      expect(row.completed_by_user_id).toBe(supervisor.user_id);
      expect(row.completed_at).toBe(later.toISOString());
    }
    expect(tasks().find((task) => task.id === ids[0])!.status).toBe("pending");
  });

  it("skips updates already seen and records Seen with who and when", () => {
    const branch2 = pending("Branch 2");
    markPriceTaskSeen(state, floor, branch2.id, now);
    const outcome = bulkPriceTasks(
      state,
      supervisor,
      [branch2.id, pending("Branch 3").id],
      "seen",
    );
    expect(outcome).toEqual({
      changed: [pending("Branch 3").id],
      skipped: [branch2.id],
    });
    expect(pending("Branch 3").seen?.by_user_id).toBe(supervisor.user_id);
    expect(pending("Branch 2").seen?.by_user_id).toBe(floor.user_id);
  });
});

describe("PR 29 Print label choice", () => {
  it("prints one label in the chosen starting slot and records it", () => {
    const row = pending("Branch 2");
    const print = preparePriceTaskPrint(state, supervisor, [row.id], now, 3);
    expect(print.batches).toHaveLength(1);
    expect(print.batches[0].startSlot).toBe(3);
    expect(print.batches[0].pages).toHaveLength(1);
    expect(print.batches[0].pages[0].slice(0, 2)).toEqual([null, null]);
    expect(print.batches[0].pages[0][2]?.code).toBe("0004");
    recordPriceTaskPrint(state, supervisor, print);
    confirmPriceTaskLabel(state, supervisor, row.id, print.id);
    expect(pending("Branch 2").label_printed?.print_id).toBe(print.id);
  });

  it("Add to queue adds one waitlist entry and counts it up the second time", () => {
    const row = pending("Branch 2");
    queuePriceTaskLabels(state, supervisor, [row.id]);
    queuePriceTaskLabels(state, supervisor, [row.id]);
    const entries = (state.label_waitlist ?? []).filter(
      (entry) => entry.branch === "Branch 2" && entry.product_code === "0004",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].copies).toBe(2);
  });
});

describe("PR 29 Done export", () => {
  it("writes a header row and exactly the given rows with 2-decimal money", () => {
    const base = pending("Branch 2");
    const rows: PriceUpdateTask[] = [
      {
        ...base,
        product_code: "9001",
        old_price: { ...base.old_price, price: "4.5" },
        new_price: { ...base.new_price, price: "5" },
        seen: { by_user_id: "u1", by: "Fictional Seer", at: "s", version: 1 },
        completed_by: 'Fictional "Doer", Jr',
        completed_at: "d",
      },
      {
        ...base,
        product_code: "9002",
        seen: undefined,
        completed_by: undefined,
      },
    ];
    const csv = priceUpdatesCsv(rows, {
      product: (task) => `=Product ${task.product_code}`,
      location: () => "Fictional Store",
      stamp: (at) => `stamp-${at}`,
    });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Product,Code,Old price,New price,Location,Seen by,Seen at,Done by,Done at",
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      `'=Product 9001,9001,4.50,5.00,Fictional Store,Fictional Seer,stamp-s,"Fictional ""Doer"", Jr",stamp-d`,
    );
    expect(lines[2].split(",").slice(5)).toEqual(["", "", "", ""]);
  });
});
