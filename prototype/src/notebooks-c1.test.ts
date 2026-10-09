import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { branchId, newBranch, saveBranchSettings } from "./settings";
import {
  addNotebookEntry,
  canAddNotebookEntry,
  createNotebook,
  editNotebookEntry,
  newNotebookInput,
  notebookEntryLocations,
  readableNotebookEntries,
  type NotebookContext,
} from "./notebooks";

const supervisor: NotebookContext = {
  company_id: "super-arzon",
  branch: "all",
  role: "supervisor",
  actor: "Demo Supervisor",
  allowed_branches: ["Branch 1", "Branch 2", "Branch 3"],
};
const worker: NotebookContext = {
  ...supervisor,
  branch: "Branch 1",
  role: "floor_worker",
  actor: "Demo Floor Worker",
  allowed_branches: ["Branch 1"],
};

function setup(branch = "all") {
  const state = initialState();
  const notebook = createNotebook(state, supervisor, {
    ...newNotebookInput(),
    branch,
    name_en: "Cleaning log",
    name_fa: "دفتر نظافت",
  });
  return { state, notebook };
}

describe("C1 custom notebook entry location", () => {
  it("lets Supervisor in All branches explicitly choose an allowed location and retains concrete entry/history scope", () => {
    const { state, notebook } = setup();
    expect(canAddNotebookEntry(notebook, supervisor)).toBe(false);
    expect(notebookEntryLocations(state, notebook, supervisor)).toEqual([
      "Branch 1",
      "Branch 2",
      "Branch 3",
    ]);
    const entry = addNotebookEntry(state, supervisor, notebook.id, {
      branch: "Branch 2",
      text: "Delivery entrance cleaned",
    });
    expect(entry).toMatchObject({
      branch: "Branch 2",
      company_id: "super-arzon",
      by: supervisor.actor,
      text: "Delivery entrance cleaned",
    });
    expect(supervisor.branch).toBe("all");
    expect(state.activity[0]).toMatchObject({
      action: "notebook_entry_added",
      branch: "Branch 2",
      by: supervisor.actor,
      after: entry,
    });
    expect(
      readableNotebookEntries(JSON.parse(JSON.stringify(state)), {
        ...worker,
        branch: "Branch 2",
        allowed_branches: ["Branch 2"],
      }).map((item) => item.id),
    ).toContain(entry.id);
    expect(
      readableNotebookEntries(state, worker).map((item) => item.id),
    ).not.toContain(entry.id);
  });

  it("retains default Supervisor/Floor Worker contribution at a normal location without granting Cashier", () => {
    const { state, notebook } = setup();
    for (const context of [worker, { ...supervisor, branch: "Branch 1" }]) {
      expect(
        addNotebookEntry(state, context, notebook.id, {
          text: `${context.actor} check`,
        }).branch,
      ).toBe("Branch 1");
    }
    const before = structuredClone(state);
    expect(() =>
      addNotebookEntry(state, { ...worker, role: "cashier" }, notebook.id, {
        text: "Not granted",
      }),
    ).toThrow("add_permission");
    expect(state).toEqual(before);
  });

  it("rejects an unselected, unconfigured, unassigned or outside-notebook location atomically", () => {
    const { state, notebook } = setup();
    const cases: Array<[NotebookContext, string | undefined, string]> = [
      [supervisor, undefined, "branch"],
      [supervisor, "all", "branch"],
      [
        { ...supervisor, allowed_branches: undefined },
        "Foreign",
        "location_unavailable",
      ],
      [{ ...supervisor, allowed_branches: ["Branch 1"] }, "Branch 2", "scope"],
      [worker, "Branch 2", "scope"],
      [{ ...worker, branch: "all" }, "Branch 1", "add_permission"],
      [{ ...supervisor, company_id: "foreign-company" }, "Branch 1", "scope"],
    ];
    for (const [context, branch, error] of cases) {
      const before = structuredClone(state);
      expect(() =>
        addNotebookEntry(state, context, notebook.id, {
          branch,
          text: "Cannot cross scope",
        }),
      ).toThrow(error);
      expect(state).toEqual(before);
    }
    const scoped = setup("Branch 1");
    expect(
      notebookEntryLocations(scoped.state, scoped.notebook, supervisor),
    ).toEqual(["Branch 1"]);
    const before = structuredClone(scoped.state);
    expect(() =>
      addNotebookEntry(scoped.state, supervisor, scoped.notebook.id, {
        branch: "Branch 2",
        text: "Outside notebook",
      }),
    ).toThrow("scope");
    expect(scoped.state).toEqual(before);
  });

  it("excludes inactive locations from new-entry choices while retaining their readable historical notes", () => {
    const { state, notebook } = setup();
    const entry = addNotebookEntry(state, supervisor, notebook.id, {
      branch: "Branch 2",
      text: "Historical check",
    });
    const config = state.config.branches.find(
      (item) => branchId(item) === "Branch 2",
    )!;
    config.active = false;
    expect(notebookEntryLocations(state, notebook, supervisor)).not.toContain(
      "Branch 2",
    );
    const before = structuredClone(state);
    expect(() =>
      addNotebookEntry(state, supervisor, notebook.id, {
        branch: "Branch 2",
        text: "Inactive check",
      }),
    ).toThrow("location_unavailable");
    expect(state).toEqual(before);
    expect(readableNotebookEntries(state, supervisor)).toContainEqual(entry);
    editNotebookEntry(state, supervisor, entry.id, {
      text: "Corrected historical check",
    });
    expect(entry.text).toBe("Corrected historical check");
  });

  it("accepts a dynamically configured warehouse but never moves an existing note through its editor", () => {
    const { state, notebook } = setup();
    const location = newBranch(state.config);
    location.type = "warehouse";
    location.name_en = "Receiving warehouse";
    location.name_fa = "انبار دریافت";
    saveBranchSettings(state, location, {
      role: "supervisor",
      company_id: supervisor.company_id,
      by: supervisor.actor,
    });
    const id = branchId(location);
    const actor = {
      ...supervisor,
      allowed_branches: [...supervisor.allowed_branches!, id],
    };
    expect(notebookEntryLocations(state, notebook, actor)).toContain(id);
    const entry = addNotebookEntry(state, actor, notebook.id, {
      branch: id,
      text: "Warehouse unloading check",
    });
    expect(entry.branch).toBe(id);
    const before = structuredClone(state);
    expect(() =>
      editNotebookEntry(state, actor, entry.id, {
        text: "Moved without authorization",
        branch: "Branch 1",
      }),
    ).toThrow("scope");
    expect(state).toEqual(before);
  });
});
