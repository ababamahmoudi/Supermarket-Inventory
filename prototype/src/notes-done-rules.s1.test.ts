import { describe, expect, it } from "vitest";
import { initialState } from "./notes-dates-fixture.e1";
import { authenticatedTestActor } from "./authority-test-fixture";
import { addNote, markNoteSeen, updateNoteStatus } from "./operations";
import {
  addNotebookEntry,
  createNotebook,
  editNotebook,
  markNotebookEntrySeen,
  newNotebookInput,
  saveBuiltInNoteDoneRule,
  updateNotebookEntryStatus,
} from "./notebooks";
import { doneRuleDecision, isNoteAuthor } from "./note-engagement";

// Ali's rules (Oct 2026): an author cannot mark their own note as seen, and a
// notebook setting decides who may mark its notes done.
describe("S1 note authors and who can mark notes done", () => {
  it("an author cannot mark their own built-in note or notebook entry as seen", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager");
    const worker = authenticatedTestActor(state, "floor_worker");
    addNote(state, worker, { type: "note_to_supervisor", text: "We are out" });
    const note = state.notes[0];
    expect(isNoteAuthor(note, worker)).toBe(true);
    expect(() => markNoteSeen(state, worker, note.id)).toThrow("own_note");
    markNoteSeen(state, manager, note.id);
    expect(note.seen_receipts?.map((row) => row.user_id)).toEqual([
      manager.user_id,
    ]);

    const notebook = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Deli checks",
    });
    const entry = addNotebookEntry(state, worker, notebook.id, {
      text: "Fridge 3 at 4 °C",
    });
    expect(() => markNotebookEntrySeen(state, worker, entry.id)).toThrow(
      "own_note",
    );
    markNotebookEntrySeen(state, manager, entry.id);
    expect(entry.seen_receipts?.map((row) => row.user_id)).toEqual([
      manager.user_id,
    ]);
  });

  it("a notebook's chosen roles and people decide who can mark its notes done", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager");
    const worker = authenticatedTestActor(state, "floor_worker");
    const supervisor = authenticatedTestActor(state, "branch_supervisor");
    const notebook = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Repairs",
      read_roles: ["owner", "manager", "branch_supervisor", "floor_worker"],
      add_roles: ["owner", "manager", "floor_worker"],
    });
    const entry = addNotebookEntry(state, worker, notebook.id, {
      text: "Door hinge is loose",
    });
    // Default: anyone who can add notes may mark them done.
    updateNotebookEntryStatus(state, worker, entry.id, "done");
    updateNotebookEntryStatus(state, worker, entry.id, "open");
    // Supervisors may read but not add, so they could not finish it before.
    expect(() =>
      updateNotebookEntryStatus(state, supervisor, entry.id, "done"),
    ).toThrow();
    editNotebook(state, manager, notebook.id, {
      ...notebook,
      done_rule: {
        mode: "chosen",
        roles: ["branch_supervisor"],
        user_ids: [],
      },
    });
    expect(() =>
      updateNotebookEntryStatus(state, worker, entry.id, "done"),
    ).toThrow("done_permission");
    updateNotebookEntryStatus(state, supervisor, entry.id, "done");
    expect(entry.status).toBe("done");
    expect(entry.done_by_user_id).toBe(supervisor.user_id);
  });

  it("a chosen rule must name at least one role or person", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager");
    expect(() =>
      createNotebook(state, manager, {
        ...newNotebookInput(),
        name_en: "Empty rule",
        done_rule: { mode: "chosen", roles: [], user_ids: [] },
      }),
    ).toThrow("done_rule");
  });

  it("built-in notebooks use the setting saved by an Owner or Manager", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager");
    const worker = authenticatedTestActor(state, "floor_worker");
    const supervisor = authenticatedTestActor(state, "branch_supervisor");
    addNote(state, worker, { type: "note_to_supervisor", text: "Leak" });
    const note = state.notes[0];
    expect(() =>
      saveBuiltInNoteDoneRule(state, supervisor, "for_supervisor", {
        mode: "chosen",
        roles: [],
        user_ids: [worker.user_id],
      }),
    ).toThrow();
    saveBuiltInNoteDoneRule(state, manager, "for_supervisor", {
      mode: "chosen",
      roles: [],
      user_ids: [worker.user_id],
    });
    const rule = state.config.notebooks.built_in.find(
      (item) => item.kind === "for_supervisor",
    )!.done_rule;
    expect(doneRuleDecision(rule, worker)).toBe("allowed");
    expect(doneRuleDecision(rule, supervisor)).toBe("denied");
    expect(() =>
      updateNoteStatus(state, supervisor, note.id, "resolved"),
    ).toThrow("done_permission");
    updateNoteStatus(state, worker, note.id, "resolved");
    expect(state.notes[0].status).toBe("resolved");
    saveBuiltInNoteDoneRule(state, manager, "for_supervisor", undefined);
    expect(
      state.config.notebooks.built_in.find(
        (item) => item.kind === "for_supervisor",
      )!.done_rule,
    ).toBeUndefined();
  });
});
