import { describe, expect, it } from "vitest";
import { initialState } from "./notes-dates-fixture.e1";
import {
  authenticatedTestFixture,
  authenticatedTestActor,
} from "./authority-test-fixture";
import {
  bindAuthoritySnapshot,
  actorAtLocation,
  authoritySnapshot,
} from "./authority";
import type { AuthenticatedActor, RoleId } from "./authority-types";
import {
  addTrackedDate,
  allowedDateLocations,
  nextTrackedDate,
  productDateDrafts,
  removeTrackedDate,
  scopedTrackedDates,
  setProductDateTracking,
  stopProductDateTracking,
} from "./date-tracking";
import { projectNotesDatesRequests } from "./notes-dates-projections";
import { saveDateReminderSettings } from "./date-reminder-settings";
import {
  addNotebookEntry,
  archiveNotebook,
  canEditNotebookEntry,
  canApplyNotebookEntryHistory,
  canApplyNotebookHistoryActivity,
  createNotebook,
  editNotebookEntry,
  editNotebook,
  newNotebookInput,
  readableNotebookEntries,
  updateNotebookEntryStatus,
  visibleNotebooks,
} from "./notebooks";
import {
  closeBranchRequest,
  listBranchRequests,
  markBranchRequestReceived,
  markBranchRequestSent,
  saveBranchRequestDraft,
  sendBranchRequest,
} from "./branch-requests";
const roles: RoleId[] = [
  "owner",
  "manager",
  "branch_supervisor",
  "floor_worker",
  "cashier",
];
function fresh(role: RoleId, locations = ["Branch 1"], aggregate = false) {
  const state = initialState();
  const fixture = authenticatedTestFixture(state, role, {
    locations,
    selection: aggregate
      ? {
          kind:
            role === "owner" || role === "manager"
              ? "all_locations"
              : "all_my_locations",
        }
      : { kind: "location", location_id: locations[0] },
  });
  return { state, ...fixture };
}
function newDate(code: string, branch = "Branch 1") {
  return {
    product_code: code,
    branch,
    date_type: "expiry" as const,
    date: "2026-11-01",
    quantity: "3",
  };
}
function money(state: ReturnType<typeof initialState>) {
  return JSON.stringify({
    ledger: state.ledger,
    stock: state.stock_movements,
    invoices: state.invoices,
  });
}

describe("E1 guarded operational projection preparation", () => {
  it("keeps custom Cashier ACL independent while omitting builtin notes, operational requests and private date evidence", () => {
    const { state, actor: manager } = fresh("manager");
    const privateNotebook = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Private",
      read_roles: ["manager"],
      add_roles: ["manager"],
    });
    const sharedNotebook = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Cashier custom",
      read_roles: ["manager", "cashier"],
      add_roles: ["manager", "cashier"],
    });
    const cashier = authenticatedTestActor(state, "cashier");
    const entry = addNotebookEntry(state, cashier, sharedNotebook.id, {
      text: "Permitted cashier entry",
    });
    const date = addTrackedDate(state, manager, {
      ...newDate(state.products[0].code),
      note: "Private note",
      lot_number: "Private lot",
    });
    const projected = projectNotesDatesRequests(state, cashier);
    expect(projected.notes).toEqual([]);
    expect(projected.branch_requests).toEqual([]);
    expect(projected.request_transfer_events).toEqual([]);
    expect(projected.notebooks?.map((record) => record.id)).toContain(
      sharedNotebook.id,
    );
    expect(projected.notebooks?.map((record) => record.id)).not.toContain(
      privateNotebook.id,
    );
    expect(projected.notebook_entries?.map((record) => record.id)).toContain(
      entry.id,
    );
    const hint = projected.expiry.find((record) => record.id === date.id)!;
    expect(hint.date).toBe(date.date);
    for (const key of [
      "quantity",
      "note",
      "lot_number",
      "invoice_id",
      "invoice_number",
      "created_by_user_id",
    ])
      expect(hint).not.toHaveProperty(key);
    projected.notebook_entries![0].text = "Changed projection";
    expect(
      state.notebook_entries!.find((record) => record.id === entry.id)!.text,
    ).toBe("Permitted cashier entry");
  });
  it("does not inherit Branch Supervisor ACL on a deliberately private new custom notebook", () => {
    const { state, actor: manager } = fresh("manager");
    const record = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "FW-only operational notebook",
    });
    const worker = authenticatedTestActor(state, "floor_worker");
    const entry = addNotebookEntry(state, worker, record.id, {
      text: "Visible to FW only",
    });
    const supervisor = authenticatedTestActor(state, "branch_supervisor");
    expect(
      projectNotesDatesRequests(state, supervisor).notebooks?.map(
        (row) => row.id,
      ),
    ).not.toContain(record.id);
    expect(
      projectNotesDatesRequests(state, supervisor).notebook_entries?.map(
        (row) => row.id,
      ),
    ).not.toContain(entry.id);
    expect(
      projectNotesDatesRequests(state, worker).notebook_entries?.map(
        (row) => row.id,
      ),
    ).toContain(entry.id);
    expect(() =>
      projectNotesDatesRequests(state, { ...worker } as AuthenticatedActor),
    ).toThrow();
  });
});

describe("E1 date tracking preparation with the real central authority", () => {
  it.each([
    "owner",
    "manager",
    "branch_supervisor",
    "floor_worker",
  ] as RoleId[])(
    "%s reads aggregate product date drafts without inventing a concrete write location",
    (role) => {
      const { state, actor } = fresh(role, ["Branch 1", "Branch 2"], true);
      const code = state.products[0].code;
      const one = addTrackedDate(
        state,
        actorAtLocation(state, actor, "Branch 1"),
        newDate(code),
      );
      const two = addTrackedDate(
        state,
        actorAtLocation(state, actor, "Branch 2"),
        newDate(code, "Branch 2"),
      );
      expect(
        productDateDrafts(state, actor, code, "all").map((row) => row.id),
      ).toEqual(expect.arrayContaining([one.id, two.id]));
      expect(
        productDateDrafts(state, actor, code, "Branch 1").map((row) => row.id),
      ).toContain(one.id);
      expect(
        productDateDrafts(state, actor, code, "Branch 1").map((row) => row.id),
      ).not.toContain(two.id);
      expect(() =>
        addTrackedDate(state, actor, newDate(code, "all")),
      ).toThrow();
    },
  );
  it("re-resolves canonical date and request readers after a working-selection change without mutating business data", () => {
    const { state, actor } = fresh("manager");
    const code = state.products[0].code;
    const one = addTrackedDate(state, actor, newDate(code));
    const secondActor = actorAtLocation(state, actor, "Branch 2");
    const two = addTrackedDate(state, secondActor, newDate(code, "Branch 2"));
    const input = {
      to_branch: "Branch 3",
      items: [
        {
          kind: "free_text" as const,
          free_text: "Bags",
          quantity: "1",
          quantity_unit: "units" as const,
        },
      ],
    };
    const firstRequest = saveBranchRequestDraft(state, actor, {
      ...input,
      from_branch: "Branch 1",
    });
    const secondRequest = saveBranchRequestDraft(state, secondActor, {
      ...input,
      from_branch: "Branch 2",
    });
    const snapshot = authoritySnapshot(state);
    const before = JSON.stringify(state);
    bindAuthoritySnapshot(state, {
      ...snapshot,
      directory_version: snapshot.directory_version + 1,
      sessions: snapshot.sessions.map((session) =>
        session.id === actor.session_id
          ? {
              ...session,
              selected_location: { kind: "location", location_id: "Branch 2" },
            }
          : session,
      ),
    });
    const dates = scopedTrackedDates(state, actor);
    expect(dates.map((row) => row.id)).toContain(two.id);
    expect(dates.map((row) => row.id)).not.toContain(one.id);
    expect(nextTrackedDate(state, actor, code)?.branch).toBe("Branch 2");
    expect(listBranchRequests(state, actor).map((row) => row.id)).toContain(
      secondRequest.id,
    );
    expect(listBranchRequests(state, actor).map((row) => row.id)).not.toContain(
      firstRequest.id,
    );
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each(roles)(
    "%s obeys canonical date writes, preference rules and unchanged money",
    (role) => {
      const { state, actor } = fresh(role);
      const product = state.products.find((item) => item.status === "active")!;
      const beforeMoney = money(state);
      if (role === "cashier") {
        expect(allowedDateLocations(state, actor)).toEqual([]);
        expect(() =>
          addTrackedDate(state, actor, newDate(product.code)),
        ).toThrow();
      } else {
        const entry = addTrackedDate(state, actor, newDate(product.code));
        expect(entry.created_by_user_id).toBe(actor.user_id);
        expect(entry.quantity).toBe("3");
        expect(
          scopedTrackedDates(state, actor).some((row) => row.id === entry.id),
        ).toBe(true);
        removeTrackedDate(state, actor, entry.id, "entered_by_mistake");
        expect(entry.status).toBe("removed");
        expect(entry.removed_by_user_id).toBe(actor.user_id);
        if (role === "owner" || role === "manager") {
          setProductDateTracking(state, actor, product.code, false, "Branch 1");
        } else {
          expect(() =>
            setProductDateTracking(
              state,
              actor,
              product.code,
              false,
              "Branch 1",
            ),
          ).toThrow();
          expect(() =>
            stopProductDateTracking(state, actor, product.code, "keep"),
          ).toThrow();
        }
      }
      expect(money(state)).toBe(beforeMoney);
    },
  );
  it.each(["branch_supervisor", "floor_worker"] as RoleId[])(
    "%s aggregate reads assigned locations but writes only an explicitly chosen location",
    (role) => {
      const { state, actor } = fresh(role, ["Branch 2", "Branch 3"], true);
      expect(allowedDateLocations(state, actor)).toEqual([
        "Branch 2",
        "Branch 3",
      ]);
      const code = state.products[0].code;
      expect(() =>
        addTrackedDate(state, actor, newDate(code, "all")),
      ).toThrow();
      expect(() =>
        addTrackedDate(state, actor, newDate(code, "Branch 1")),
      ).toThrow();
      const chosen = actorAtLocation(state, actor, "Branch 3");
      const row = addTrackedDate(state, chosen, newDate(code, "Branch 3"));
      expect(row.branch).toBe("Branch 3");
      expect(
        scopedTrackedDates(state, actor).some((entry) => entry.id === row.id),
      ).toBe(true);
    },
  );
  it.each(["owner", "manager"] as RoleId[])(
    "%s removes retained inactive-location dates and clears them without new inactive entries or money changes",
    (role) => {
      const { state, actor } = fresh(role, ["Branch 1"], true);
      const code = state.products[0].code;
      const first = addTrackedDate(
        state,
        actorAtLocation(state, actor, "Branch 2"),
        newDate(code, "Branch 2"),
      );
      const second = addTrackedDate(
        state,
        actorAtLocation(state, actor, "Branch 2"),
        { ...newDate(code, "Branch 2"), date: "2026-11-02" },
      );
      state.config.branches.find(
        (location) => location.id === "Branch 2",
      )!.active = false;
      const beforeMoney = money(state);
      expect(() =>
        addTrackedDate(state, actor, newDate(code, "Branch 2")),
      ).toThrow();
      removeTrackedDate(state, actor, first.id, "entered_by_mistake");
      expect(first.status).toBe("removed");
      expect(first.removed_by_user_id).toBe(actor.user_id);
      expect(first.removed_reason).toBe("entered_by_mistake");
      expect(first.removal_action).toBe("remove");
      expect(
        state.activity.find((item) => item.entity_id === first.id)?.branch,
      ).toBe("Branch 2");
      stopProductDateTracking(state, actor, code, "clear");
      expect(second.status).toBe("removed");
      expect(second.removal_action).toBe("stop_tracking");
      expect(second.removed_by_user_id).toBe(actor.user_id);
      expect(money(state)).toBe(beforeMoney);
    },
  );
  it.each(["branch_supervisor", "floor_worker"] as RoleId[])(
    "%s cannot remove or clear an inactive-location date retained after location deactivation",
    (role) => {
      const { state, actor } = fresh(role, ["Branch 1", "Branch 2"], true);
      const code = state.products[0].code;
      const entry = addTrackedDate(
        state,
        actorAtLocation(state, actor, "Branch 2"),
        newDate(code, "Branch 2"),
      );
      state.config.branches.find(
        (location) => location.id === "Branch 2",
      )!.active = false;
      const before = JSON.stringify(state);
      expect(() =>
        removeTrackedDate(state, actor, entry.id, "entered_by_mistake"),
      ).toThrow();
      expect(() =>
        stopProductDateTracking(state, actor, code, "clear"),
      ).toThrow();
      expect(() =>
        addTrackedDate(state, actor, newDate(code, "Branch 2")),
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    },
  );
  it("rejects a spread actor and an actor revoked after the screen opened", () => {
    const { state, actor, snapshot } = fresh("floor_worker");
    const code = state.products[0].code;
    expect(() =>
      addTrackedDate(state, { ...actor } as AuthenticatedActor, newDate(code)),
    ).toThrow();
    bindAuthoritySnapshot(state, {
      ...snapshot,
      directory_version: snapshot.directory_version + 1,
      people: snapshot.people.map((person) =>
        person.id === actor.user_id
          ? {
              ...person,
              status: "deactivated",
              authority_epoch: person.authority_epoch + 1,
            }
          : person,
      ),
    });
    expect(() => addTrackedDate(state, actor, newDate(code))).toThrow();
    expect(scopedTrackedDates(state, actor)).toEqual([]);
  });
  it("keeps a Cashier's Lookup date hint while hiding note, quantity, lot and invoice evidence", () => {
    const { state, actor } = fresh("cashier");
    state.expiry = [
      {
        ...newDate(state.products[0].code),
        id: "hint",
        company_id: actor.company_id,
        status: "active",
        expires_in_days: 20,
        lot_number: "private-lot",
        note: "private-note",
        invoice_id: "private-original",
      },
    ];
    const hint = nextTrackedDate(state, actor, state.products[0].code)!;
    expect(hint.date).toBe("2026-11-01");
    expect(hint).not.toHaveProperty("quantity");
    expect(hint).not.toHaveProperty("lot_number");
    expect(hint).not.toHaveProperty("note");
    expect(hint).not.toHaveProperty("invoice_id");
    expect(scopedTrackedDates(state, actor)).toEqual([]);
  });
  it("never reads or edits another company's same-code date", () => {
    const { state, actor } = fresh("manager");
    const code = state.products[0].code;
    state.expiry.push({
      ...newDate(code),
      id: "foreign",
      company_id: "other-company",
      status: "active",
      expires_in_days: 20,
    });
    expect(
      scopedTrackedDates(state, actor).some((row) => row.id === "foreign"),
    ).toBe(false);
    expect(() =>
      removeTrackedDate(state, actor, "foreign", "sold_out"),
    ).toThrow();
  });
  it.each(roles)(
    "%s receives the exact global reminder-settings capability",
    (role) => {
      const { state, actor } = fresh(role);
      const before = state.config.expiry.expiring_soon_days;
      if (role === "owner" || role === "manager") {
        saveDateReminderSettings(state, actor, 31);
        expect(state.config.expiry.expiring_soon_days).toBe(31);
        expect(state.activity[0].actor_user_id).toBe(actor.user_id);
      } else {
        expect(() => saveDateReminderSettings(state, actor, 31)).toThrow();
        expect(state.config.expiry.expiring_soon_days).toBe(before);
      }
    },
  );
});

describe("E1 custom notebook ACL and stable ownership preparation", () => {
  it.each(["branch_supervisor", "floor_worker", "cashier"] as RoleId[])(
    "%s retains own audited status Undo on another author's custom entry with canonical current ACL",
    (role) => {
      const { state, actor: manager } = fresh("manager");
      const roles: RoleId[] = ["owner", "manager", role];
      const notebook = createNotebook(state, manager, {
        ...newNotebookInput(),
        name_en: `Status ${role}`,
        read_roles: roles,
        add_roles: roles,
      });
      const entry = addNotebookEntry(state, manager, notebook.id, {
        text: "Written by Manager",
      });
      const addAction = state.activity[0];
      const contributor = authenticatedTestActor(state, role);
      updateNotebookEntryStatus(state, contributor, entry.id, "done");
      const statusAction = state.activity[0];
      expect(statusAction.actor_user_id).toBe(contributor.user_id);
      expect(entry.by_user_id).not.toBe(contributor.user_id);
      expect(
        canApplyNotebookHistoryActivity(state, contributor, statusAction.id),
      ).toBe(true);
      expect(
        canApplyNotebookHistoryActivity(state, contributor, addAction.id),
      ).toBe(false);
      const other = authenticatedTestActor(state, role, {
        user_id: `other-status-${role}`,
      });
      expect(
        canApplyNotebookHistoryActivity(state, other, statusAction.id),
      ).toBe(false);
      expect(
        canApplyNotebookHistoryActivity(state, manager, statusAction.id),
      ).toBe(true);
      editNotebook(state, manager, notebook.id, {
        ...newNotebookInput(),
        name_en: `Status ${role}`,
        read_roles: roles,
        add_roles: ["owner", "manager"],
      });
      expect(
        canApplyNotebookHistoryActivity(state, contributor, statusAction.id),
      ).toBe(false);
    },
  );
  it("keeps History's current ACL and creator guard separate from the editor deadline", () => {
    const { state, actor: manager } = fresh("manager");
    const notebook = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "History deadline",
    });
    const worker = authenticatedTestActor(state, "floor_worker");
    const entry = addNotebookEntry(state, worker, notebook.id, {
      text: "Original",
    });
    // A valid edit near the original deadline can still have a recent History
    // action after that separate editor deadline has ended.
    entry.created_at = new Date(Date.now() - 12_000).toISOString();
    editNotebookEntry(
      state,
      worker,
      entry.id,
      { text: "Edited near the deadline" },
      undefined,
      new Date(Date.parse(entry.created_at) + 9_000),
    );
    expect(canEditNotebookEntry(state, worker, entry.id)).toBe(false);
    expect(canApplyNotebookEntryHistory(state, worker, entry.id)).toBe(true);
    const other = authenticatedTestActor(state, "floor_worker", {
      user_id: "other-history-author",
      name_en: worker.actor,
    });
    expect(canApplyNotebookEntryHistory(state, other, entry.id)).toBe(false);
    delete entry.by_user_id;
    expect(canApplyNotebookEntryHistory(state, worker, entry.id)).toBe(false);
    expect(canApplyNotebookEntryHistory(state, manager, entry.id)).toBe(true);
    editNotebook(state, manager, notebook.id, {
      ...newNotebookInput(),
      name_en: "History deadline",
      add_roles: [],
    });
    expect(canApplyNotebookEntryHistory(state, worker, entry.id)).toBe(false);
    archiveNotebook(state, manager, notebook.id);
    expect(canApplyNotebookEntryHistory(state, manager, entry.id)).toBe(false);
  });
  it("defaults a new notebook to Owner/Manager/Floor Worker, without inheriting Branch Supervisor access", () => {
    const { state, actor: manager } = fresh("manager");
    const record = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "A new private pattern",
    });
    expect(record.read_roles).toEqual(["owner", "manager", "floor_worker"]);
    const branchSupervisor = authenticatedTestActor(state, "branch_supervisor");
    expect(
      visibleNotebooks(state, branchSupervisor).some(
        (row) => row.id === record.id,
      ),
    ).toBe(false);
    expect(() =>
      addNotebookEntry(state, branchSupervisor, record.id, {
        text: "not allowed",
      }),
    ).toThrow();
  });
  it.each(["branch_supervisor", "floor_worker", "cashier"] as RoleId[])(
    "%s uses only the explicitly configured custom notebook ACL",
    (role) => {
      const { state, actor: manager } = fresh("manager");
      const record = createNotebook(state, manager, {
        ...newNotebookInput(),
        name_en: `Allowed ${role}`,
        read_roles: ["owner", "manager", role],
        add_roles: ["owner", "manager", role],
      });
      const worker = authenticatedTestActor(state, role);
      const entry = addNotebookEntry(state, worker, record.id, {
        text: "Own note",
      });
      expect(entry.by_user_id).toBe(worker.user_id);
      expect(
        readableNotebookEntries(state, worker).some(
          (row) => row.id === entry.id,
        ),
      ).toBe(true);
      updateNotebookEntryStatus(state, worker, entry.id, "done");
      expect(entry.status).toBe("done");
      expect(() =>
        createNotebook(state, worker, {
          ...newNotebookInput(),
          name_en: "No definition grant",
        }),
      ).toThrow();
    },
  );
  it("cannot borrow another author's edit window by using the same display name", () => {
    const { state, actor: manager } = fresh("manager");
    const record = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Ownership",
    });
    const author = authenticatedTestActor(state, "floor_worker", {
      user_id: "author-one",
      username: "author-one",
      name_en: "Same Name",
    });
    const entry = addNotebookEntry(state, author, record.id, {
      text: "Original",
    });
    const other = authenticatedTestActor(state, "floor_worker", {
      user_id: "author-two",
      username: "author-two",
      name_en: "Same Name",
    });
    expect(canEditNotebookEntry(state, other, entry.id)).toBe(false);
    expect(() =>
      editNotebookEntry(state, other, entry.id, { text: "Hijack" }),
    ).toThrow();
    expect(entry.text).toBe("Original");
    expect(canEditNotebookEntry(state, author, entry.id)).toBe(true);
  });
  it("refreshes audit names from the directory while ownership stays attached to the stable person ID", () => {
    const { state, actor: manager } = fresh("manager");
    const record = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Renamed author",
    });
    const worker = authenticatedTestActor(state, "floor_worker", {
      name_en: "Original Name",
    });
    const entry = addNotebookEntry(state, worker, record.id, {
      text: "Original",
    });
    const snapshot = authoritySnapshot(state);
    bindAuthoritySnapshot(state, {
      ...snapshot,
      people: snapshot.people.map((person) =>
        person.id === worker.user_id
          ? {
              ...person,
              name_en: "Renamed Author",
              version: person.version + 1,
            }
          : person,
      ),
    });
    expect(canEditNotebookEntry(state, worker, entry.id)).toBe(true);
    const next = addNotebookEntry(state, worker, record.id, { text: "New" });
    expect(next.by).toBe("Renamed Author");
    expect(next.by_user_id).toBe(entry.by_user_id);
    expect(entry.by).toBe("Original Name");
    expect(state.activity[0].by).toBe("Renamed Author");
  });
  it("retains the original edit deadline and does not infer ownership from a legacy author name", () => {
    const { state, actor: manager } = fresh("manager");
    const record = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Deadline",
    });
    const worker = authenticatedTestActor(state, "floor_worker");
    const entry = addNotebookEntry(state, worker, record.id, {
      text: "Original",
    });
    const deadline = new Date(Date.parse(entry.created_at) + 10000);
    expect(canEditNotebookEntry(state, worker, entry.id, deadline)).toBe(false);
    delete entry.by_user_id;
    expect(canEditNotebookEntry(state, worker, entry.id)).toBe(false);
    expect(canEditNotebookEntry(state, manager, entry.id)).toBe(true);
  });
  it("preserves Owner/Manager correction of retained inactive-location entries while denying new entries", () => {
    const { state, actor: manager } = fresh("manager", ["Branch 1"], true);
    const record = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Historical correction",
    });
    const entry = addNotebookEntry(state, manager, record.id, {
      text: "Original",
      branch: "Branch 2",
    });
    state.config.branches.find(
      (location) => location.id === "Branch 2",
    )!.active = false;
    expect(
      readableNotebookEntries(state, manager).map((row) => row.id),
    ).toContain(entry.id);
    expect(() =>
      addNotebookEntry(state, manager, record.id, {
        text: "New entry",
        branch: "Branch 2",
      }),
    ).toThrow();
    editNotebookEntry(state, manager, entry.id, {
      text: "Corrected historical check",
    });
    expect(entry.text).toBe("Corrected historical check");
  });
  it("requires a chosen concrete location for an aggregate notebook entry", () => {
    const { state, actor: manager } = fresh("manager", ["Branch 1"], true);
    const record = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Concrete location",
    });
    expect(() =>
      addNotebookEntry(state, manager, record.id, { text: "Missing location" }),
    ).toThrow();
    const entry = addNotebookEntry(state, manager, record.id, {
      text: "Chosen location",
      branch: "Branch 3",
    });
    expect(entry.branch).toBe("Branch 3");
  });
  it("revokes custom notebook read and edit after deactivation, even if old UI retained the actor", () => {
    const { state, actor: manager } = fresh("manager");
    const record = createNotebook(state, manager, {
      ...newNotebookInput(),
      name_en: "Revoked",
    });
    const worker = authenticatedTestActor(state, "floor_worker");
    const entry = addNotebookEntry(state, worker, record.id, {
      text: "Original",
    });
    const snapshot = authoritySnapshot(state);
    bindAuthoritySnapshot(state, {
      ...snapshot,
      people: snapshot.people.map((person) =>
        person.id === worker.user_id
          ? {
              ...person,
              status: "deactivated",
              authority_epoch: person.authority_epoch + 1,
            }
          : person,
      ),
    });
    expect(visibleNotebooks(state, worker)).toEqual([]);
    expect(canEditNotebookEntry(state, worker, entry.id)).toBe(false);
    expect(() =>
      addNotebookEntry(state, worker, record.id, { text: "Old form" }),
    ).toThrow();
  });
});

describe("E1 canonical request endpoints preparation", () => {
  it("lets assigned people complete each physical endpoint and never exposes costs or changes supplier money", () => {
    const { state, actor: source } = fresh("branch_supervisor", [
      "Branch 2",
      "Branch 3",
    ]);
    const destination = authenticatedTestActor(state, "floor_worker", {
      user_id: "warehouse-floor",
      username: "warehouse-floor",
      locations: ["Warehouse"],
      selection: { kind: "location", location_id: "Warehouse" },
    });
    const beforeLedger = JSON.stringify(state.ledger);
    state.branch_requests = [];
    state.request_transfer_events = [];
    const saved = saveBranchRequestDraft(state, source, {
      from_branch: "Branch 2",
      to_branch: "Warehouse",
      items: [
        {
          kind: "catalog",
          product_code: state.products[0].code,
          quantity: "1",
          quantity_unit: "cases",
          units_per_case: 12,
        },
      ],
    });
    expect(listBranchRequests(state, destination)).toEqual([]);
    sendBranchRequest(state, source, saved.id, saved.revision);
    expect(
      listBranchRequests(state, destination).map((row) => row.id),
    ).toContain(saved.id);
    markBranchRequestSent(state, destination, saved.id, saved.revision, [
      { item_id: saved.items[0].id, decision: "sent" },
    ]);
    markBranchRequestReceived(state, source, saved.id, saved.revision, [
      { item_id: saved.items[0].id, decision: "received" },
    ]);
    closeBranchRequest(state, source, saved.id, saved.revision);
    expect(saved.status).toBe("closed");
    expect(
      state.request_transfer_events?.map((event) => event.normalized_units),
    ).toEqual([12, 12]);
    expect(
      state.request_transfer_events?.map((event) => event.by_user_id),
    ).toEqual([destination.user_id, source.user_id]);
    expect(JSON.stringify(state.ledger)).toBe(beforeLedger);
    expect(JSON.stringify(saved)).not.toContain("unit_cost");
  });
  it("denies an unassigned source, an aggregate default, a forged actor and Cashier requests", () => {
    const { state, actor } = fresh(
      "branch_supervisor",
      ["Branch 2", "Branch 3"],
      true,
    );
    const input = {
      from_branch: "Branch 2",
      to_branch: "Warehouse",
      items: [
        {
          kind: "free_text" as const,
          free_text: "Paper bags",
          quantity: "1",
          quantity_unit: "cases" as const,
        },
      ],
    };
    expect(() => saveBranchRequestDraft(state, actor, input)).toThrow();
    expect(() =>
      saveBranchRequestDraft(state, actorAtLocation(state, actor, "Branch 2"), {
        ...input,
        from_branch: "Branch 1",
      }),
    ).toThrow();
    expect(() =>
      saveBranchRequestDraft(state, { ...actor } as AuthenticatedActor, input),
    ).toThrow();
    const cashier = authenticatedTestActor(state, "cashier", {
      locations: ["Branch 2"],
    });
    expect(listBranchRequests(state, cashier)).toEqual([]);
    expect(() => saveBranchRequestDraft(state, cashier, input)).toThrow();
  });
  it("filters other-company requests with matching endpoints and reference", () => {
    const { state, actor } = fresh("manager");
    const saved = saveBranchRequestDraft(state, actor, {
      from_branch: "Branch 1",
      to_branch: "Branch 2",
      items: [
        {
          kind: "free_text",
          free_text: "Paper bags",
          quantity: "1",
          quantity_unit: "cases",
        },
      ],
    });
    state.branch_requests!.push({
      ...structuredClone(saved),
      id: "foreign-request",
      company_id: "other-company",
    });
    expect(
      listBranchRequests(state, actor).some(
        (row) => row.id === "foreign-request",
      ),
    ).toBe(false);
  });
});
