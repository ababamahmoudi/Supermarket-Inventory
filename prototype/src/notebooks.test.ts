import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { branchId, newBranch, saveBranchSettings } from "./settings";
import {
  addNotebookEntry,
  archiveNotebook,
  canAddNotebookEntry,
  canEditNotebookEntry,
  createNotebook,
  editNotebook,
  editNotebookEntry,
  hydrateNotebooks,
  readableNotebookEntries,
  updateNotebookEntryStatus,
  visibleNotebooks,
  type NotebookContext,
  type NotebookInput,
} from "./notebooks";
const supervisor: NotebookContext = {
  company_id: "super-arzon",
  branch: "Branch 1",
  role: "supervisor",
  actor: "Demo Supervisor",
};
const worker: NotebookContext = {
  ...supervisor,
  role: "floor_worker",
  actor: "Demo Floor Worker",
};
const cashier: NotebookContext = {
  ...supervisor,
  role: "cashier",
  actor: "Demo Cashier",
};
const input = (values: Partial<NotebookInput> = {}): NotebookInput => ({
  name_en: "Cleaning log",
  name_fa: "دفتر نظافت",
  branch: "all",
  read_roles: ["supervisor", "floor_worker", "cashier"],
  add_roles: ["supervisor", "floor_worker"],
  fields: {
    product: false,
    quantity: false,
    date: false,
    measurement: false,
    measurement_unit: "",
  },
  status_enabled: true,
  notify_supervisor: true,
  ...values,
});

describe("custom notebook permissions and retained records", () => {
  it("hydrates fictional Deli temperatures once and preserves saved custom definitions", () => {
    const state = initialState();
    expect(visibleNotebooks(state, worker)[0].name_en).toBe(
      "Deli temperatures",
    );
    expect(readableNotebookEntries(state, worker)[0].measurement).toBe("3.2");
    const saved = createNotebook(state, supervisor, input());
    hydrateNotebooks(state);
    expect(state.notebooks).toHaveLength(2);
    expect(state.notebooks?.find((item) => item.id === saved.id)).toEqual(
      saved,
    );
    state.notebooks = [];
    hydrateNotebooks(state);
    expect(state.notebooks).toEqual([]);
  });
  it("only Supervisor creates, edits, archives and restores definitions", () => {
    const state = initialState();
    for (const context of [worker, cashier])
      expect(() => createNotebook(state, context, input())).toThrow(
        "supervisor",
      );
    const record = createNotebook(state, supervisor, input());
    for (const context of [worker, cashier]) {
      expect(() => editNotebook(state, context, record.id, input())).toThrow(
        "supervisor",
      );
      expect(() => archiveNotebook(state, context, record.id)).toThrow(
        "supervisor",
      );
    }
    archiveNotebook(state, supervisor, record.id);
    archiveNotebook(state, supervisor, record.id, false);
    expect(record.archived).toBe(false);
  });
  it("separates read and add permissions while Supervisor keeps access", () => {
    const state = initialState(),
      record = createNotebook(state, supervisor, input());
    expect(visibleNotebooks(state, cashier).map((item) => item.id)).toEqual([
      record.id,
    ]);
    expect(canAddNotebookEntry(record, cashier)).toBe(false);
    expect(() =>
      addNotebookEntry(state, cashier, record.id, { text: "Cashier entry" }),
    ).toThrow("add_permission");
    const entry = addNotebookEntry(state, worker, record.id, {
      text: "Cleaned deli counter",
    });
    expect(
      readableNotebookEntries(state, cashier).map((item) => item.id),
    ).toContain(entry.id);
    editNotebook(
      state,
      supervisor,
      record.id,
      input({ read_roles: [], add_roles: [] }),
    );
    expect(record.read_roles).toEqual(["supervisor"]);
    expect(record.add_roles).toEqual(["supervisor"]);
    expect(visibleNotebooks(state, cashier)).toEqual([]);
    expect(canAddNotebookEntry(record, supervisor)).toBe(true);
  });
  it("enables Cashier contributions only through explicit permissions", () => {
    const state = initialState(),
      record = createNotebook(
        state,
        supervisor,
        input({ add_roles: ["cashier"] }),
      );
    const entry = addNotebookEntry(state, cashier, record.id, {
      text: "Customer left a bag",
    });
    expect(entry.by).toBe("Demo Cashier");
    expect(entry.branch).toBe("Branch 1");
    updateNotebookEntryStatus(state, cashier, entry.id, "done");
    expect(entry.status).toBe("done");
  });
  it("blocks foreign company reads and mutations even with a known ID", () => {
    const state = initialState(),
      record = createNotebook(state, supervisor, input());
    const foreign = { ...supervisor, company_id: "another-company" };
    expect(visibleNotebooks(state, foreign)).toEqual([]);
    expect(readableNotebookEntries(state, foreign)).toEqual([]);
    expect(() =>
      addNotebookEntry(state, foreign, record.id, { text: "Wrong company" }),
    ).toThrow("scope");
    expect(() => editNotebook(state, foreign, record.id, input())).toThrow(
      "scope",
    );
  });
  it("scopes definitions and entries by selected and explicitly allowed branches", () => {
    const state = initialState(),
      record = createNotebook(state, supervisor, input({ branch: "Branch 1" }));
    addNotebookEntry(state, worker, record.id, { text: "Branch one only" });
    const branchTwo = { ...worker, branch: "Branch 2" };
    expect(
      visibleNotebooks(state, branchTwo).map((item) => item.id),
    ).not.toContain(record.id);
    expect(() =>
      addNotebookEntry(state, branchTwo, record.id, { text: "Wrong branch" }),
    ).toThrow("scope");
    expect(
      readableNotebookEntries(state, {
        ...worker,
        branch: "all",
        allowed_branches: ["Branch 2"],
      }),
    ).toEqual([]);
    expect(() =>
      addNotebookEntry(
        state,
        { ...worker, branch: "all" },
        "demo-deli-temperatures",
        { text: "Unscoped" },
      ),
    ).toThrow("branch");
  });
  it("retains authorized searchable entries through archive and restore", () => {
    const state = initialState(),
      record = createNotebook(state, supervisor, input());
    const entry = addNotebookEntry(state, worker, record.id, {
      text: "Retained cleaning record",
    });
    archiveNotebook(state, supervisor, record.id);
    expect(
      visibleNotebooks(state, worker).map((item) => item.id),
    ).not.toContain(record.id);
    expect(
      visibleNotebooks(state, worker, { includeArchived: true }).map(
        (item) => item.id,
      ),
    ).toContain(record.id);
    expect(
      readableNotebookEntries(state, cashier).map((item) => item.id),
    ).toContain(entry.id);
    expect(() =>
      addNotebookEntry(state, worker, record.id, { text: "Cannot write" }),
    ).toThrow("archived");
    archiveNotebook(state, supervisor, record.id, false);
    expect(visibleNotebooks(state, worker).map((item) => item.id)).toContain(
      record.id,
    );
  });
  it("preserves old fields, units and author when definition changes", () => {
    const state = initialState(),
      deli = state.notebooks![0],
      entry = readableNotebookEntries(state, worker)[0];
    const before = structuredClone(entry);
    editNotebook(state, supervisor, deli.id, {
      ...deli,
      name_en: "Deli checks",
      fields: { ...deli.fields, measurement: false, measurement_unit: "°F" },
    });
    expect(entry).toEqual(before);
    expect(entry.measurement_unit).toBe("°C");
    expect(
      addNotebookEntry(state, worker, deli.id, {
        text: "Visual check",
        measurement: "10",
      }).measurement,
    ).toBeUndefined();
  });
  it("validates measurement, date, quantity and company catalog links without changing stock", () => {
    const state = initialState(),
      record = createNotebook(
        state,
        supervisor,
        input({
          fields: {
            product: true,
            quantity: true,
            date: true,
            measurement: true,
            measurement_unit: "°C",
          },
        }),
      );
    for (const invalid of [
      { measurement: "NaN" },
      { measurement: "Infinity" },
      { date: "2026-02-30" },
      { qty: 0 },
      { product_code: "foreign-product" },
    ])
      expect(() =>
        addNotebookEntry(state, worker, record.id, {
          text: "Check",
          ...invalid,
        }),
      ).toThrow();
    const stock = structuredClone(state.stock);
    const entry = addNotebookEntry(state, worker, record.id, {
      text: "Freezer check",
      date: "2026-10-08",
      qty: 1.5,
      measurement: "-18.000",
      product_code: "0001",
    });
    expect(entry.measurement).toBe("-18");
    expect(entry.notify_supervisor).toBe(true);
    expect(state.stock).toEqual(stock);
  });
  it("records actor, branch, time and before/after for definition and entry actions", () => {
    const state = initialState(),
      record = createNotebook(state, supervisor, input()),
      entry = addNotebookEntry(state, worker, record.id, {
        text: "Cleaned shelves",
      });
    updateNotebookEntryStatus(state, worker, entry.id, "done");
    const action = state.activity[0];
    expect(action).toMatchObject({
      action: "notebook_entry_done",
      by: "Demo Floor Worker",
      branch: "Branch 1",
      company_id: "super-arzon",
      entity_type: "notebook_entry",
      entity_id: entry.id,
      reversible: true,
      before: { status: "open" },
      after: { status: "done" },
    });
    expect(new Date(action.at).getTime()).not.toBeNaN();
    expect(
      state.activity.find((item) => item.entity_id === record.id)?.after,
    ).toMatchObject({ name_en: "Cleaning log" });
  });
  it("preserves saved records across reload and omits entries archived by Undo", () => {
    const state = initialState(),
      record = createNotebook(state, supervisor, input()),
      entry = addNotebookEntry(state, worker, record.id, {
        text: "Saved on this computer",
      });
    entry.archived = true;
    const restored = hydrateNotebooks(JSON.parse(JSON.stringify(state)));
    expect(restored.notebooks).toEqual(state.notebooks);
    expect(
      readableNotebookEntries(restored, worker).map((item) => item.id),
    ).not.toContain(entry.id);
    expect(
      readableNotebookEntries(restored, worker, { includeArchived: true }).map(
        (item) => item.id,
      ),
    ).toContain(entry.id);
  });
  it("uses dynamically configured stable branch IDs after creation and rename", () => {
    const state = initialState(),
      configured = newBranch(state.config);
    configured.name_en = "New store";
    configured.name_fa = "فروشگاه جدید";
    saveBranchSettings(state, configured, {
      role: "supervisor",
      company_id: supervisor.company_id,
      by: supervisor.actor,
    });
    const branch = branchId(configured),
      record = createNotebook(state, supervisor, input({ branch })),
      actor = { ...worker, branch };
    addNotebookEntry(state, actor, record.id, { text: "New store check" });
    configured.name_en = "Renamed store";
    saveBranchSettings(state, configured, {
      role: "supervisor",
      company_id: supervisor.company_id,
      by: supervisor.actor,
    });
    expect(
      readableNotebookEntries(state, actor).map((item) => item.notebook_id),
    ).toContain(record.id);
  });
  it("lets the author edit only within the original ten seconds, and an edit never restarts that window", () => {
    const state = initialState();
    const record = createNotebook(state, supervisor, input());
    const entry = addNotebookEntry(state, worker, record.id, {
      text: "Original",
    });
    const created = Date.parse(entry.created_at);
    expect(
      canEditNotebookEntry(state, worker, entry.id, new Date(created + 9999)),
    ).toBe(true);
    editNotebookEntry(
      state,
      worker,
      entry.id,
      { text: "First correction" },
      JSON.stringify(entry),
      new Date(created + 9000),
    );
    editNotebookEntry(
      state,
      worker,
      entry.id,
      { text: "Second correction" },
      JSON.stringify(entry),
      new Date(created + 9999),
    );
    expect(entry.created_at).toBe(new Date(created).toISOString());
    expect(
      canEditNotebookEntry(state, worker, entry.id, new Date(created + 10000)),
    ).toBe(false);
    const before = structuredClone(state);
    expect(() =>
      editNotebookEntry(
        state,
        worker,
        entry.id,
        { text: "Too late" },
        undefined,
        new Date(created + 10000),
      ),
    ).toThrow("expired");
    expect(state).toEqual(before);
  });
  it("allows the Supervisor to edit old entries from all allowed branches while preserving creator metadata and append-only history", () => {
    const state = initialState();
    const notebook = createNotebook(state, supervisor, input());
    const entry = addNotebookEntry(state, worker, notebook.id, {
      text: "Original",
    });
    updateNotebookEntryStatus(state, worker, entry.id, "done");
    const before = structuredClone(entry),
      originalActivity = structuredClone(state.activity);
    const actor = {
      ...supervisor,
      branch: "all",
      allowed_branches: ["Branch 1"],
    };
    const later = new Date(Date.parse(entry.created_at) + 86400000);
    expect(canEditNotebookEntry(state, actor, entry.id, later)).toBe(true);
    editNotebookEntry(
      state,
      actor,
      entry.id,
      { text: "Supervisor correction" },
      JSON.stringify(entry),
      later,
    );
    expect(entry).toMatchObject({
      id: before.id,
      company_id: before.company_id,
      branch: before.branch,
      notebook_id: before.notebook_id,
      by: before.by,
      created_at: before.created_at,
      status: "done",
      notify_supervisor: before.notify_supervisor,
      text: "Supervisor correction",
      updated_at: later.toISOString(),
    });
    expect(state.activity.slice(1)).toEqual(originalActivity);
    expect(state.activity[0]).toMatchObject({
      action: "notebook_entry_updated",
      by: supervisor.actor,
      branch: "Branch 1",
      at: later.toISOString(),
      reversible: true,
      before,
      after: entry,
    });
  });
  it("blocks other authors, another company/branch and revoked contribution permissions without mutating an entry", () => {
    const state = initialState();
    const notebook = createNotebook(state, supervisor, input());
    const entry = addNotebookEntry(state, worker, notebook.id, {
      text: "Original",
    });
    const now = new Date(Date.parse(entry.created_at) + 1);
    for (const context of [
      { ...worker, actor: "Another worker" },
      { ...worker, company_id: "foreign-company" },
      { ...worker, branch: "Branch 2" },
      { ...supervisor, branch: "all", allowed_branches: ["Branch 2"] },
      { ...cashier, actor: worker.actor },
    ]) {
      const before = structuredClone(state);
      expect(canEditNotebookEntry(state, context, entry.id, now)).toBe(false);
      expect(() =>
        editNotebookEntry(
          state,
          context,
          entry.id,
          { text: "Unauthorized" },
          undefined,
          now,
        ),
      ).toThrow();
      expect(state).toEqual(before);
    }
    editNotebook(state, supervisor, notebook.id, input({ add_roles: [] }));
    const before = structuredClone(state);
    expect(() =>
      editNotebookEntry(
        state,
        worker,
        entry.id,
        { text: "Revoked" },
        undefined,
        now,
      ),
    ).toThrow("add_permission");
    expect(state).toEqual(before);
  });
  it("preserves disabled historical fields and original measurement units during editing and validates enabled values before mutation", () => {
    const state = initialState();
    const notebook = createNotebook(
      state,
      supervisor,
      input({
        fields: {
          product: true,
          quantity: true,
          date: true,
          measurement: true,
          measurement_unit: "°C",
        },
      }),
    );
    const entry = addNotebookEntry(state, worker, notebook.id, {
      text: "First check",
      product_code: "0001",
      qty: 2,
      date: "2026-10-08",
      measurement: "3.2",
    });
    editNotebook(state, supervisor, notebook.id, {
      ...notebook,
      fields: {
        product: false,
        quantity: false,
        date: false,
        measurement: true,
        measurement_unit: "°F",
      },
    });
    editNotebookEntry(state, supervisor, entry.id, {
      text: "Corrected check",
      measurement: "3.8",
    });
    expect(entry).toMatchObject({
      product_code: "0001",
      qty: 2,
      date: "2026-10-08",
      measurement: "3.8",
      measurement_unit: "°C",
    });
    const before = structuredClone(state);
    expect(() =>
      editNotebookEntry(state, supervisor, entry.id, {
        text: "Invalid",
        measurement: "NaN",
      }),
    ).toThrow("measurement");
    expect(state).toEqual(before);
    archiveNotebook(state, supervisor, notebook.id);
    expect(() =>
      editNotebookEntry(state, supervisor, entry.id, { text: "Archived" }),
    ).toThrow("archived");
    archiveNotebook(state, supervisor, notebook.id, false);
    expect(entry.text).toBe("Corrected check");
    expect(canEditNotebookEntry(state, supervisor, entry.id)).toBe(true);
  });
  it("detects changes made after opening the editor and keeps both records intact", () => {
    const state = initialState();
    const notebook = createNotebook(state, supervisor, input());
    const entry = addNotebookEntry(state, worker, notebook.id, {
      text: "Original",
    });
    const snapshot = JSON.stringify(entry);
    updateNotebookEntryStatus(state, worker, entry.id, "done");
    const before = structuredClone(state);
    expect(() =>
      editNotebookEntry(
        state,
        supervisor,
        entry.id,
        { text: "Stale correction" },
        snapshot,
      ),
    ).toThrow("stale");
    expect(state).toEqual(before);
  });
});
