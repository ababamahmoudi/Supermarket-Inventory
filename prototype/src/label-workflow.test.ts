import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
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
  duplicateLabelTemplate,
  setLabelTemplateArchived,
} from "./label-workflow";
import { labelLayout, labelSlotGeometry } from "./labels";
import type { DemoState, LabelTemplate } from "./types";
import { catalogTestActor } from "./catalog-authority-test-fixture";
import { cloneWithAuthority } from "./authority";
const supervisor = (state: DemoState) => catalogTestActor(state, "manager");
const worker = (state: DemoState) => catalogTestActor(state, "floor_worker");
function emptyManualQueueState() {
  const state = initialState();
  // C8 seeds a real Sale-start Promo label. These existing manual-add scenarios
  // start after the operator clears it through the permitted branch workflow.
  clearLabelWaitlist(state, "Branch 1", supervisor(state));
  return state;
}
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
    const state = emptyManualQueueState();
    addLabelsToWaitlist(state, ["0003", "0003"], 2, "Branch 1", worker(state));
    addLabelsToWaitlist(state, ["0003"], 1, "Branch 1", supervisor(state));
    addLabelsToWaitlist(state, ["0003"], 4, "Branch 2", supervisor(state));
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
    const state = emptyManualQueueState();
    for (const call of [
      () =>
        addLabelsToWaitlist(
          state,
          ["0003"],
          1,
          "Branch 1",
          catalogTestActor(state, "cashier"),
        ),
      () => addLabelsToWaitlist(state, ["0003"], 1, "Branch 2", worker(state)),
      () =>
        addLabelsToWaitlist(
          state,
          ["0003", "0015"],
          1,
          "Branch 1",
          worker(state),
        ),
      () =>
        addLabelsToWaitlist(state, ["0003"], 0.5, "Branch 1", worker(state)),
    ])
      expect(call).toThrow();
    expect(state.label_waitlist ?? []).toHaveLength(0);
    expect(
      state.activity.filter((item) => item.action === "Add to waitlist"),
    ).toHaveLength(0);
  });
  it("uses approved prices and approved offers even when a lower proposal is pending", () => {
    const state = emptyManualQueueState();
    state.products.find((item) => item.code === "0003")!.pending_price = "0.99";
    addLabelsToWaitlist(state, ["0003"], 20, "Branch 1", worker(state));
    const snapshot = prepareLabelPrint(
      state,
      "Branch 1",
      template,
      5,
      worker(state),
    );
    expect(snapshot.pages).toHaveLength(2);
    expect(snapshot.pages[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(
      snapshot.products.every((item) => item.selling_price === "2.99"),
    ).toBe(true);
    expect(snapshot.products).toHaveLength(20);
  });
  it("leaves waitlist untouched without explicit confirmation, and confirmed prints preserve concurrent additions", () => {
    const state = emptyManualQueueState();
    addLabelsToWaitlist(state, ["0003"], 2, "Branch 1", worker(state));
    addLabelsToWaitlist(state, ["0005"], 1, "Branch 2", supervisor(state));
    const snapshot = prepareLabelPrint(
      state,
      "Branch 1",
      template,
      1,
      worker(state),
    );
    expect(branchLabelWaitlist(state, "Branch 1")[0].copies).toBe(2);
    addLabelsToWaitlist(state, ["0003"], 3, "Branch 1", supervisor(state));
    confirmLabelsPrinted(state, snapshot, worker(state));
    expect(branchLabelWaitlist(state, "Branch 1")[0].copies).toBe(3);
    confirmLabelsPrinted(state, snapshot, worker(state));
    expect(branchLabelWaitlist(state, "Branch 1")[0].copies).toBe(3);
    expect(branchLabelWaitlist(state, "Branch 2")[0].copies).toBe(1);
    const print = state.activity.at(-1)!;
    expect(print.action).toBe("Print labels");
    expect(print.reversible).toBe(false);
    expect(print.after).toMatchObject({ copies: 2, sheets: 1 });
  });
  it("edits/removes/clears only the allowed company's branch rows", () => {
    const state = initialState();
    addLabelsToWaitlist(state, ["0003", "0005"], 1, "Branch 1", worker(state));
    addLabelsToWaitlist(state, ["0003"], 2, "Branch 2", supervisor(state));
    const [first, second] = branchLabelWaitlist(state, "Branch 1");
    editLabelWaitlist(state, first.id, 4, "Branch 1", worker(state));
    expect(branchLabelWaitlist(state, "Branch 1")[0].copies).toBe(4);
    expect(() =>
      editLabelWaitlist(
        state,
        branchLabelWaitlist(state, "Branch 2")[0].id,
        1,
        "Branch 1",
        worker(state),
      ),
    ).toThrow("branch");
    editLabelWaitlist(state, second.id, null, "Branch 1", worker(state));
    clearLabelWaitlist(state, "Branch 1", worker(state));
    expect(branchLabelWaitlist(state, "Branch 1")).toHaveLength(0);
    expect(branchLabelWaitlist(state, "Branch 2")).toHaveLength(1);
  });
});

describe("label designer and filters", () => {
  it("saves/edits a valid preset, records history, and refuses a wide label with no room for its 8 mm logo", () => {
    const state = initialState();
    saveLabelTemplate(state, template, worker(state));
    saveLabelTemplate(
      state,
      { ...template, offset_x: 2, name: "Calibrated" },
      worker(state),
    );
    expect(state.templates).toHaveLength(3);
    expect(
      state.templates.find((item) => item.id === template.id),
    ).toMatchObject({
      name: "Calibrated",
      offset_x: 2,
    });
    expect(state.activity.at(-1)).toMatchObject({
      action: "Save template",
      reversible: true,
    });
    expect(() =>
      saveLabelTemplate(state, { ...template, height: 9 }, worker(state)),
    ).toThrow("logo");
    expect(() =>
      saveLabelTemplate(
        state,
        { ...template, company_id: "other" },
        worker(state),
      ),
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
    const before = emptyManualQueueState();
    const next = cloneWithAuthority(before);
    next.products.find((item) => item.code === "0003")!.branch_prices = {
      "Branch 2": "3.99",
    };
    autoAddApprovedLabelChanges(before, next, supervisor(next));
    expect(next.label_waitlist ?? []).toHaveLength(0);
    next.label_settings = { recent_price_days: 3, auto_add_approved: true };
    next.products.find((item) => item.code === "0005")!.pending_price = "8.99";
    autoAddApprovedLabelChanges(before, next, supervisor(next));
    expect(
      branchLabelWaitlist(next, "Branch 2").map((item) => item.product_code),
    ).toEqual(["0003"]);
    expect(branchLabelWaitlist(next, "Branch 1")).toHaveLength(0);
    autoAddApprovedLabelChanges(before, next, supervisor(next));
    expect(branchLabelWaitlist(next, "Branch 2")).toHaveLength(1);
  });
});

describe("built-in label library", () => {
  it("duplicates a ready Promo preset, edits it and archives/restores without deleting or reusing its ID", () => {
    const state = initialState();
    const promo = state.templates.find((item) => item.built_in === "promo")!;
    const copy = duplicateLabelTemplate(
      state,
      promo.id,
      worker(state),
      "Weekend Promo",
    );
    expect(copy.id).not.toBe(promo.id);
    expect(copy).toMatchObject({
      name: "Weekend Promo",
      style: "promo",
      width: 210,
      height: 148.5,
    });
    expect(copy.built_in).toBeUndefined();
    saveLabelTemplate(
      state,
      { ...copy, name: "Clearance Promo" },
      worker(state),
    );
    setLabelTemplateArchived(state, promo.id, true, worker(state));
    expect(state.templates).toHaveLength(3);
    expect(state.templates.find((item) => item.id === promo.id)?.archived).toBe(
      true,
    );
    expect(() =>
      saveLabelTemplate(state, { ...promo, archived: false }, worker(state)),
    ).toThrow("template");
    expect(() =>
      prepareLabelPrint(state, "Branch 1", promo, 1, worker(state)),
    ).toThrow("template");
    setLabelTemplateArchived(state, promo.id, false, worker(state));
    expect(state.templates.find((item) => item.id === promo.id)?.archived).toBe(
      false,
    );
    expect(state.templates.find((item) => item.id === copy.id)?.name).toBe(
      "Clearance Promo",
    );
    expect(state.activity.slice(-4).map((item) => item.action)).toEqual([
      "Duplicate template",
      "Save template",
      "Archive template",
      "Restore template",
    ]);
    expect(state.activity.slice(-4).every((item) => item.reversible)).toBe(
      true,
    );
  });
  it("rejects Cashier and foreign-company template management without mutations", () => {
    const state = initialState();
    const regular = state.templates.find(
      (item) => item.built_in === "regular",
    )!;
    state.templates.push({
      ...regular,
      id: "foreign",
      company_id: "foreign-company",
    });
    const before = structuredClone(state);
    expect(() =>
      duplicateLabelTemplate(
        state,
        regular.id,
        catalogTestActor(state, "cashier"),
        "Copy",
      ),
    ).toThrow("capability");
    expect(() =>
      setLabelTemplateArchived(state, "foreign", true, supervisor(state)),
    ).toThrow("template");
    expect(() =>
      duplicateLabelTemplate(state, "foreign", supervisor(state), "Copy"),
    ).toThrow("template");
    expect(state).toEqual(before);
  });
  it("prints every Promo copy over exactly two slots per A4 sheet, retaining queue until Yes", () => {
    const state = emptyManualQueueState();
    const promo = state.templates.find((item) => item.built_in === "promo")!;
    addLabelsToWaitlist(state, ["0003"], 5, "Branch 1", worker(state));
    const snapshot = prepareLabelPrint(
      state,
      "Branch 1",
      promo,
      1,
      worker(state),
    );
    expect(snapshot.pages.map((page) => page.length)).toEqual([2, 2, 1]);
    expect(branchLabelWaitlist(state, "Branch 1")[0].copies).toBe(5);
    confirmLabelsPrinted(state, snapshot, worker(state));
    expect(branchLabelWaitlist(state, "Branch 1")).toHaveLength(0);
  });
});
