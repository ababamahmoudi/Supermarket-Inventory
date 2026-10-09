import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  addLabelsToWaitlist,
  autoAddApprovedLabelChanges,
  branchLabelWaitlist,
  clearLabelWaitlist,
  confirmLabelsPrinted,
  editLabelWaitlist,
  emptyLabelFilters,
  filterLabelProducts,
  prepareLabelPrint,
  saveLabelTemplate,
  type LabelActor,
} from "./label-workflow";
import { labelLayout, labelSlotGeometry } from "./labels";
import type { LabelTemplate } from "./types";
const supervisor: LabelActor = {
  name: "Demo Supervisor",
  role: "supervisor",
  branch: "Branch 1",
};
const worker: LabelActor = {
  name: "Demo Floor Worker",
  role: "floor_worker",
  branch: "Branch 1",
};
const template: LabelTemplate = {
  id: "template1",
  company_id: initialState().config.company.seed_key,
  name: "Template 1",
  width: 60,
  height: 40,
  margin_top: 10,
  margin_bottom: 10,
  margin_left: 10,
  margin_right: 10,
  gap_x: 4,
  gap_y: 4,
  offset_x: 1,
  offset_y: -1,
};

describe("shared branch label waitlist", () => {
  it("combines copies for shared workers, persists stable IDs, and separates branches", () => {
    const state = initialState();
    addLabelsToWaitlist(state, ["0003", "0003"], 2, "Branch 1", worker);
    addLabelsToWaitlist(state, ["0003"], 1, "Branch 1", supervisor);
    addLabelsToWaitlist(state, ["0003"], 4, "Branch 2", supervisor);
    const reloaded = JSON.parse(JSON.stringify(state));
    expect(branchLabelWaitlist(reloaded, "Branch 1")).toHaveLength(1);
    expect(branchLabelWaitlist(reloaded, "Branch 1")[0].copies).toBe(3);
    expect(branchLabelWaitlist(reloaded, "Branch 2")[0].copies).toBe(4);
    expect(
      state.activity
        .filter((item) => item.action === "Add to waitlist")
        .every((item) => item.reversible),
    ).toBe(true);
  });
  it("blocks cashiers, cross-branch workers, pending new products and invalid copies atomically", () => {
    const state = initialState();
    for (const call of [
      () =>
        addLabelsToWaitlist(state, ["0003"], 1, "Branch 1", {
          ...worker,
          role: "cashier",
        }),
      () => addLabelsToWaitlist(state, ["0003"], 1, "Branch 2", worker),
      () => addLabelsToWaitlist(state, ["0003", "0015"], 1, "Branch 1", worker),
      () => addLabelsToWaitlist(state, ["0003"], 0.5, "Branch 1", worker),
    ])
      expect(call).toThrow();
    expect(state.label_waitlist ?? []).toHaveLength(0);
    expect(
      state.activity.filter((item) => item.action === "Add to waitlist"),
    ).toHaveLength(0);
  });
  it("uses approved prices and approved offers even when a lower proposal is pending", () => {
    const state = initialState();
    state.products.find((item) => item.code === "0003")!.pending_price = "0.99";
    addLabelsToWaitlist(state, ["0003"], 20, "Branch 1", worker);
    const snapshot = prepareLabelPrint(state, "Branch 1", template, 5, worker);
    expect(snapshot.pages).toHaveLength(2);
    expect(snapshot.pages[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(
      snapshot.products.every((item) => item.selling_price === "2.99"),
    ).toBe(true);
    expect(snapshot.products).toHaveLength(20);
  });
  it("leaves waitlist untouched without explicit confirmation, and confirmed prints preserve concurrent additions", () => {
    const state = initialState();
    addLabelsToWaitlist(state, ["0003"], 2, "Branch 1", worker);
    addLabelsToWaitlist(state, ["0005"], 1, "Branch 2", supervisor);
    const snapshot = prepareLabelPrint(state, "Branch 1", template, 1, worker);
    expect(branchLabelWaitlist(state, "Branch 1")[0].copies).toBe(2);
    addLabelsToWaitlist(state, ["0003"], 3, "Branch 1", supervisor);
    confirmLabelsPrinted(state, snapshot, worker);
    expect(branchLabelWaitlist(state, "Branch 1")[0].copies).toBe(3);
    confirmLabelsPrinted(state, snapshot, worker);
    expect(branchLabelWaitlist(state, "Branch 1")[0].copies).toBe(3);
    expect(branchLabelWaitlist(state, "Branch 2")[0].copies).toBe(1);
    const print = state.activity.at(-1)!;
    expect(print.action).toBe("Print labels");
    expect(print.reversible).toBe(false);
    expect(print.after).toMatchObject({ copies: 2, sheets: 1 });
  });
  it("edits/removes/clears only the allowed company's branch rows", () => {
    const state = initialState();
    addLabelsToWaitlist(state, ["0003", "0005"], 1, "Branch 1", worker);
    addLabelsToWaitlist(state, ["0003"], 2, "Branch 2", supervisor);
    const [first, second] = branchLabelWaitlist(state, "Branch 1");
    editLabelWaitlist(state, first.id, 4, "Branch 1", worker);
    expect(branchLabelWaitlist(state, "Branch 1")[0].copies).toBe(4);
    expect(() =>
      editLabelWaitlist(
        state,
        branchLabelWaitlist(state, "Branch 2")[0].id,
        1,
        "Branch 1",
        worker,
      ),
    ).toThrow("branch");
    editLabelWaitlist(state, second.id, null, "Branch 1", worker);
    clearLabelWaitlist(state, "Branch 1", worker);
    expect(branchLabelWaitlist(state, "Branch 1")).toHaveLength(0);
    expect(branchLabelWaitlist(state, "Branch 2")).toHaveLength(1);
  });
});

describe("label designer and filters", () => {
  it("saves/edits a valid preset, records history, and refuses a wide label with no room for its 8 mm logo", () => {
    const state = initialState();
    saveLabelTemplate(state, template, worker);
    saveLabelTemplate(
      state,
      { ...template, offset_x: 2, name: "Calibrated" },
      worker,
    );
    expect(state.templates).toHaveLength(1);
    expect(state.templates[0]).toMatchObject({
      name: "Calibrated",
      offset_x: 2,
    });
    expect(state.activity.at(-1)).toMatchObject({
      action: "Save template",
      reversible: true,
    });
    expect(() =>
      saveLabelTemplate(state, { ...template, height: 9 }, worker),
    ).toThrow("logo");
    expect(() =>
      saveLabelTemplate(state, { ...template, company_id: "other" }, worker),
    ).toThrow("permission");
  });
  it("moves all physical slots by calibration without changing capacity and prevents off-sheet printing", () => {
    expect(labelLayout(template)).toEqual({
      columns: 3,
      rows: 6,
      capacity: 18,
    });
    expect(labelSlotGeometry(template, 4)).toEqual({
      left: 75,
      top: 53,
      width: 60,
      height: 40,
    });
    expect(() => labelLayout({ ...template, offset_x: -11 })).toThrow(
      "calibration",
    );
    expect(() => labelLayout({ ...template, offset_y: 100 })).toThrow(
      "calibration",
    );
  });
  it("combines search/filters within the company and receiving branch", () => {
    const state = initialState();
    const now = new Date(`${state.demo_fixture_anchor_date}T12:00:00Z`);
    const found = filterLabelProducts(
      state,
      "Branch 1",
      { ...emptyLabelFilters, query: "0003", arrived: true, onOffer: true },
      now,
    );
    expect(found.map((item) => item.code)).toEqual(["0003"]);
    expect(
      filterLabelProducts(
        state,
        "Branch 3",
        { ...emptyLabelFilters, query: "0003", arrived: true },
        now,
      ),
    ).toHaveLength(0);
    expect(
      filterLabelProducts(
        state,
        "Branch 1",
        { ...emptyLabelFilters, query: state.products[0].name_fa },
        now,
      ).map((item) => item.code),
    ).toContain("0001");
    expect(
      filterLabelProducts(
        state,
        "Branch 1",
        { ...emptyLabelFilters, query: "0004", changed: true },
        now,
      ).map((item) => item.code),
    ).toContain("0004");
  });
  it("auto-add is off by default and follows only newly approved branch prices, not proposals", () => {
    const before = initialState();
    const next = structuredClone(before);
    next.products.find((item) => item.code === "0003")!.branch_prices = {
      "Branch 2": "3.99",
    };
    autoAddApprovedLabelChanges(before, next, supervisor.name);
    expect(next.label_waitlist ?? []).toHaveLength(0);
    next.label_settings = { recent_price_days: 3, auto_add_approved: true };
    next.products.find((item) => item.code === "0005")!.pending_price = "8.99";
    autoAddApprovedLabelChanges(before, next, supervisor.name);
    expect(
      branchLabelWaitlist(next, "Branch 2").map((item) => item.product_code),
    ).toEqual(["0003"]);
    expect(branchLabelWaitlist(next, "Branch 1")).toHaveLength(0);
    autoAddApprovedLabelChanges(before, next, supervisor.name);
    expect(branchLabelWaitlist(next, "Branch 2")).toHaveLength(1);
  });
});
