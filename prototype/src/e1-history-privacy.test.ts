import { describe, expect, it } from "vitest";
import { returnFixture } from "./return-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import {
  attachReversals,
  canReverse,
  projectHistoryEntry,
  reverseActivity,
  selectHistory,
} from "./history";
import {
  addNotebookEntry,
  createNotebook,
  editNotebook,
  newNotebookInput,
  updateNotebookEntryStatus,
} from "./notebooks";
import type { Activity } from "./types";

function notebookFixture() {
  const state = returnFixture();
  state.activity = [];
  const manager = authenticatedTestActor(state, "manager");
  const worker = authenticatedTestActor(state, "floor_worker");
  const cashier = authenticatedTestActor(state, "cashier");
  const input = {
    ...newNotebookInput(),
    name_en: "Fictional shared check",
    name_fa: "بررسی آزمایشی",
    branch: "Branch 1",
    read_roles: ["owner", "manager", "floor_worker", "cashier"] as const,
    add_roles: ["owner", "manager", "floor_worker", "cashier"] as const,
  };
  const notebook = createNotebook(state, manager, {
    ...input,
    read_roles: [...input.read_roles],
    add_roles: [...input.add_roles],
  });
  const entry = addNotebookEntry(state, worker, notebook.id, {
    text: "Fictional shelf check",
  });
  const before = cloneWithAuthority(state);
  updateNotebookEntryStatus(state, cashier, entry.id, "done");
  const activity = attachReversals(before, state, cashier).find(
    (item) => item.action === "notebook_entry_done",
  )!;
  return { state, manager, worker, cashier, entry, notebook, input, activity };
}
describe("E1 History private values and canonical notebook source", () => {
  it("omits primitive protected inverse values and dotted financial keys from nonmanager History", () => {
    const state = returnFixture();
    const worker = authenticatedTestActor(state, "floor_worker");
    const manager = authenticatedTestActor(state, "manager");
    const entry: Activity = {
      id: "history-private-invoice",
      company_id: worker.company_id,
      branch: "Branch 1",
      action: "Review invoice",
      actor_user_id: worker.user_id,
      by: worker.actor,
      at: new Date().toISOString(),
      entity_type: "invoice",
      entity_id: state.invoice.id,
      before: {
        "invoice.lines.unit_cost_before_tax": "12.6000",
        name_en: "Fictional product",
      },
      after: { margin: "0.16", name_en: "Retained name" },
      reversible: true,
      reversal: [
        {
          path: [
            "invoice",
            "lines",
            { key: "product_code", value: "0003" },
            "unit_cost_before_tax",
          ],
          before: "12.6000",
          after: "14.2000",
          before_exists: true,
          after_exists: true,
        },
      ],
    };
    state.activity = [entry];
    const projected = projectHistoryEntry(state, worker, entry);
    expect(projected.before).toEqual({ name_en: "Fictional product" });
    expect(projected.after).toEqual({ name_en: "Retained name" });
    expect(projected.reversal![0].before).toBeUndefined();
    expect(projected.reversal![0].after).toBeUndefined();
    expect(JSON.stringify(projected)).not.toContain("12.6000");
    expect(JSON.stringify(projected)).not.toContain("14.2000");
    expect(projectHistoryEntry(state, manager, entry)).toEqual(entry);
    expect(state.activity[0]).toEqual(entry);
  });
  it("Cashier can Undo its own permitted status action on another author's entry without general History", () => {
    const { state, cashier, worker, entry, activity } = notebookFixture();
    expect(entry.by_user_id).toBe(worker.user_id);
    expect(activity.actor_user_id).toBe(cashier.user_id);
    expect(selectHistory(state, cashier)).toEqual([]);
    expect(canReverse(state, activity, cashier, "undo")).toBe(true);
    reverseActivity(state, cashier, activity.id, "undo");
    expect(
      state.notebook_entries!.find((item) => item.id === entry.id),
    ).toMatchObject({ status: "open", by_user_id: worker.user_id });
    expect(
      state.activity.find((item) => item.id === activity.id)?.actor_user_id,
    ).toBe(cashier.user_id);
    expect(selectHistory(state, cashier)).toEqual([]);
  });
  it("a current notebook ACL withdrawal removes that status Undo permission without changing business records", () => {
    const { state, manager, cashier, input, notebook, activity } =
      notebookFixture();
    editNotebook(state, manager, notebook.id, {
      ...input,
      read_roles: ["owner", "manager", "floor_worker"],
      add_roles: ["owner", "manager", "floor_worker"],
    });
    const before = cloneWithAuthority(state);
    expect(canReverse(state, activity, cashier, "undo")).toBe(false);
    expect(() =>
      reverseActivity(state, cashier, activity.id, "undo"),
    ).toThrow();
    expect(state).toEqual(before);
  });
  it("a later status action conflicts with the original inverse even for an eligible contributor", () => {
    const { state, worker, cashier, entry, activity } = notebookFixture();
    updateNotebookEntryStatus(state, worker, entry.id, "open");
    const before = cloneWithAuthority(state);
    expect(() => reverseActivity(state, cashier, activity.id, "undo")).toThrow(
      "conflict",
    );
    expect(state).toEqual(before);
  });
});
