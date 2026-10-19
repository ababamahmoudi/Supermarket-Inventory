import { describe, expect, it } from "vitest";
import { initialState } from "./notes-dates-fixture.e1";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { addNote, markNoteSeen, updateNoteStatus } from "./operations";
import {
  addNotebookEntry,
  createNotebook,
  editNotebook,
  markNotebookEntrySeen,
  newNotebookInput,
  updateNotebookEntryStatus,
} from "./notebooks";
import { attachReversals, reverseActivity } from "./history";
import { shouldShowUndoNotification } from "./undo-notification-policy";
import { projectNotesDatesRequests } from "./notes-dates-projections";
import { userNotifications } from "./sales";

describe("C9 independent note seen receipts and completion", () => {
  it("lets every built-in reader acknowledge once, records identity/order, and Undoes only that person's receipt and linked bell read", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager");
    const owner = authenticatedTestActor(state, "owner");
    const worker = authenticatedTestActor(state, "floor_worker");
    addNote(state, worker, {
      type: "note_to_supervisor",
      text: "Check tea price",
    });
    const note = state.notes[0];
    const managerNotice = userNotifications(state, manager).find(
      (row) => row.note_id === note.id,
    )!;
    expect(managerNotice).toBeDefined();
    const before = cloneWithAuthority(state);
    markNoteSeen(state, manager, note.id, new Date("2026-10-19T13:02:00Z"));
    const managerAction = attachReversals(before, state, manager).find(
      (row) => row.action === "note_seen",
    )!;
    expect(managerAction.actor_user_id).toBe(manager.user_id);
    expect(managerAction.reversible).toBe(true);
    expect(shouldShowUndoNotification(managerAction.action)).toBe(true);
    expect(managerNotice.read_at).toBe("2026-10-19T13:02:00.000Z");
    expect(
      userNotifications(state, owner).find((row) => row.note_id === note.id)
        ?.read_at,
    ).toBeUndefined();
    const count = state.activity.length;
    markNoteSeen(state, manager, note.id);
    expect(state.activity).toHaveLength(count);
    const beforeWorker = cloneWithAuthority(state);
    markNoteSeen(state, worker, note.id, new Date("2026-10-19T13:15:00Z"));
    attachReversals(beforeWorker, state, worker);
    expect(note.status).toBe("open");
    expect(note.seen_receipts?.map((row) => row.user_id)).toEqual([
      manager.user_id,
      worker.user_id,
    ]);
    reverseActivity(state, manager, managerAction.id, "undo");
    const restored = state.notes.find((row) => row.id === note.id)!;
    expect(restored.seen_receipts?.map((row) => row.user_id)).toEqual([
      worker.user_id,
    ]);
    expect(
      state.notifications?.find((row) => row.id === managerNotice.id)?.read_at,
    ).toBeUndefined();
    expect(
      state.activity.some(
        (row) => row.reversed_activity_id === managerAction.id,
      ),
    ).toBe(true);
  });

  it("keeps seen independent from Done and Reopen and preserves a later reader during completion Undo", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager");
    const worker = authenticatedTestActor(state, "floor_worker");
    addNote(state, worker, { type: "to_order", text: "Order shelf labels" });
    const note = state.notes[0];
    const before = cloneWithAuthority(state);
    updateNoteStatus(state, worker, note.id, "resolved");
    const done = attachReversals(before, state, worker).find(
      (row) => row.action === "Mark ordered",
    )!;
    expect(note).toMatchObject({
      status: "resolved",
      done_by_user_id: worker.user_id,
    });
    expect(note.done_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    markNoteSeen(state, manager, note.id);
    reverseActivity(state, worker, done.id, "undo");
    const restored = state.notes.find((row) => row.id === note.id)!;
    expect(restored.status).toBe("open");
    expect(restored.done_by_user_id).toBeUndefined();
    expect(restored.seen_receipts?.map((row) => row.user_id)).toEqual([
      manager.user_id,
    ]);
    updateNoteStatus(state, worker, note.id, "resolved");
    const beforeReopen = cloneWithAuthority(state);
    updateNoteStatus(state, worker, note.id, "open");
    const reopened = attachReversals(beforeReopen, state, worker).find(
      (row) => row.action === "note_reopened",
    )!;
    expect(restored.done_at).toBeUndefined();
    reverseActivity(state, worker, reopened.id, "undo");
    expect(state.notes.find((row) => row.id === note.id)).toMatchObject({
      status: "resolved",
      done_by_user_id: worker.user_id,
    });
  });

  it("gives a read-only Cashier personal seen and Undo without contribution, status, built-in, foreign-company or foreign-location grants", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager");
    const notebook = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Read-only handover",
      branch: "Branch 1",
      read_roles: ["manager", "cashier"],
      add_roles: ["manager"],
    });
    const entry = addNotebookEntry(state, manager, notebook.id, {
      text: "Check receipt roll",
    });
    const cashier = authenticatedTestActor(state, "cashier");
    const before = cloneWithAuthority(state);
    markNotebookEntrySeen(state, cashier, entry.id);
    const seen = attachReversals(before, state, cashier).find(
      (row) => row.action === "notebook_entry_seen",
    )!;
    expect(seen.reversible).toBe(true);
    expect(
      projectNotesDatesRequests(state, cashier).notebook_entries?.find(
        (row) => row.id === entry.id,
      )?.seen_receipts?.[0].user_id,
    ).toBe(cashier.user_id);
    expect(() =>
      updateNotebookEntryStatus(state, cashier, entry.id, "done"),
    ).toThrow();
    expect(() =>
      addNotebookEntry(state, cashier, notebook.id, { text: "Denied" }),
    ).toThrow();
    expect(() => markNoteSeen(state, cashier, state.notes[0].id)).toThrow();
    reverseActivity(state, cashier, seen.id, "undo");
    expect(
      state.notebook_entries?.find((row) => row.id === entry.id)?.seen_receipts,
    ).toEqual([]);
    const otherLocation = authenticatedTestActor(state, "cashier", {
      user_id: "other-cashier",
      locations: ["Branch 2"],
    });
    expect(() =>
      markNotebookEntrySeen(state, otherLocation, entry.id),
    ).toThrow();
    const foreign = initialState();
    foreign.config.company.seed_key = "another-company";
    const foreignReader = authenticatedTestActor(foreign, "cashier");
    expect(() =>
      markNotebookEntrySeen(state, foreignReader, entry.id),
    ).toThrow();
  });

  it("rechecks current read ACL for seen and its Undo, and leaves status-disabled notebooks unchanged", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager");
    const notebook = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Team log",
      branch: "Branch 1",
      read_roles: ["manager", "cashier"],
      add_roles: ["manager"],
    });
    const entry = addNotebookEntry(state, manager, notebook.id, {
      text: "Actual handover",
    });
    const cashier = authenticatedTestActor(state, "cashier");
    const before = cloneWithAuthority(state);
    markNotebookEntrySeen(state, cashier, entry.id);
    const seen = attachReversals(before, state, cashier).find(
      (row) => row.action === "notebook_entry_seen",
    )!;
    editNotebook(state, manager, notebook.id, {
      ...notebook,
      read_roles: ["manager"],
    });
    expect(() => markNotebookEntrySeen(state, cashier, entry.id)).toThrow();
    expect(() => reverseActivity(state, cashier, seen.id, "undo")).toThrow();
    editNotebook(state, manager, notebook.id, {
      ...notebook,
      status_enabled: false,
    });
    const snapshot = JSON.stringify(state.notebook_entries);
    expect(() => markNotebookEntrySeen(state, manager, entry.id)).toThrow();
    expect(() =>
      updateNotebookEntryStatus(state, manager, entry.id, "done"),
    ).toThrow();
    expect(JSON.stringify(state.notebook_entries)).toBe(snapshot);
  });
});
