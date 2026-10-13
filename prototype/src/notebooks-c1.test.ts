import { describe, expect, it } from "vitest";
import { initialState as pureInitialState } from "./notes-dates-fixture.e1";
import { authenticatedTestActor } from "./authority-test-fixture";
import { actorAtLocation, inheritAuthoritySnapshot } from "./authority";
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

let supervisor: NotebookContext;
let worker: NotebookContext;
let cashier: NotebookContext;
function foreignActor(state: ReturnType<typeof pureInitialState>) {
  const foreign = structuredClone(state);
  foreign.config.company.seed_key = "foreign-company";
  return authenticatedTestActor(foreign, "manager", {
    selection: { kind: "all_locations" },
  });
}
function locationWorker(
  state: ReturnType<typeof pureInitialState>,
  location: string,
  userId = `test-worker-${location}`,
) {
  return authenticatedTestActor(state, "floor_worker", {
    user_id: userId,
    locations: [location],
    selection: { kind: "location", location_id: location },
    name_en: "Demo Floor Worker",
  });
}
function aggregateWorker(state: ReturnType<typeof pureInitialState>) {
  return authenticatedTestActor(state, "floor_worker", {
    user_id: "test-aggregate-worker",
    locations: ["Branch 1", "Branch 2"],
    selection: { kind: "all_my_locations" },
    name_en: "Demo Floor Worker",
  });
}
function initialState() {
  const state = pureInitialState();
  supervisor = authenticatedTestActor(state, "manager", {
    name_en: "Demo Supervisor",
    username: "supervisor",
    locations: ["Branch 1", "Branch 2", "Branch 3"],
    selection: { kind: "all_locations" },
  });
  worker = authenticatedTestActor(state, "floor_worker", {
    name_en: "Demo Floor Worker",
    username: "floorworker",
    locations: ["Branch 1"],
  });
  cashier = authenticatedTestActor(state, "cashier", {
    name_en: "Demo Cashier",
    username: "cashier",
    locations: ["Branch 1"],
  });
  return state;
}

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
    // This retained case describes a company with three configured stores.
    // Company roles now get their scope from that configuration, not a fake role proxy.
    state.config.branches = state.config.branches.filter(
      (location) => location.id !== "Warehouse",
    );
    expect(canAddNotebookEntry(state, notebook, supervisor)).toBe(false);
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
    const branchTwoWorker = locationWorker(
      state,
      "Branch 2",
      "test-branch-two-worker",
    );
    const restored = inheritAuthoritySnapshot(
      state,
      JSON.parse(JSON.stringify(state)),
    );
    expect(
      readableNotebookEntries(restored, branchTwoWorker).map((item) => item.id),
    ).toContain(entry.id);
    expect(
      readableNotebookEntries(state, worker).map((item) => item.id),
    ).not.toContain(entry.id);
  });

  it("retains default Supervisor/Floor Worker contribution at a normal location without granting Cashier", () => {
    const { state, notebook } = setup();
    for (const context of [
      worker,
      actorAtLocation(state, supervisor, "Branch 1"),
    ]) {
      expect(
        addNotebookEntry(state, context, notebook.id, {
          text: `${context.actor} check`,
        }).branch,
      ).toBe("Branch 1");
    }
    const before = structuredClone(state);
    expect(() =>
      addNotebookEntry(state, cashier, notebook.id, {
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
      [supervisor, "Foreign", "scope"],
      [worker, "Branch 2", "scope"],
      [aggregateWorker(state), undefined, "branch"],
      [foreignActor(state), "Branch 1", "company"],
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
    ).toThrow("location");
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
    saveBranchSettings(state, location, supervisor);
    const id = branchId(location);
    const actor = authenticatedTestActor(state, "manager", {
      name_en: supervisor.actor,
      selection: { kind: "all_locations" },
    });
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
