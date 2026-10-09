import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  attachReversals,
  changedPaths,
  historyChangePreview,
  reverseActivity,
  selectHistory,
  HistoryError,
  type HistoryContext,
} from "./history";
import { saveProductEdits, productEditSnapshot } from "./product-editor";
import type { Activity, DemoState } from "./types";
import { restoreBState, B_BACKUP_KEY } from "./b-state";
import { saveLabelTemplate } from "./label-workflow";
import { stopOffer } from "./approvals";
import { saveSupplier } from "./supplier-editor";
import { supplierBalanceSummary } from "./supplier-balances";

const supervisor: HistoryContext = {
  company_id: "super-arzon",
  role: "supervisor",
  actor: "Demo Supervisor",
  username: "supervisor",
  branch: "Branch 1",
  allowed_branches: ["Branch 1", "Branch 2", "Branch 3"],
};
const context = (state: DemoState): HistoryContext => ({
  ...supervisor,
  company_id: state.config.company.seed_key,
});
function act(
  state: DemoState,
  mutate: (state: DemoState) => void,
  action = "Save product",
  branch = "all",
  by = "Demo Supervisor",
) {
  const before = structuredClone(state);
  mutate(state);
  const entry: Activity = {
    id: `test-${state.activity.length}`,
    company_id: state.config.company.seed_key,
    branch,
    action,
    by,
    at: new Date().toISOString(),
    reversible: true,
  };
  state.activity.push(entry);
  attachReversals(before, state, {
    ...context(state),
    actor: by,
    username: by === "Demo Supervisor" ? "supervisor" : "floorworker",
    role: by === "Demo Supervisor" ? "supervisor" : "floor_worker",
  });
  return entry;
}
describe("History and safe scoped reversal", () => {
  it("reverts a name change while preserving unrelated products and append-only evidence", () => {
    const state = initialState();
    const entry = act(state, (s) => {
      s.products[0].name_en = "Changed name";
    });
    state.products[1].name_en = "Independent edit";
    const previous = structuredClone(state.activity);
    const original = entry.reversal![0].before;
    reverseActivity(state, context(state), entry.id, "revert");
    expect(state.products[0].name_en).toBe(original);
    expect(state.products[1].name_en).toBe("Independent edit");
    expect(state.activity.slice(0, -1)).toEqual(previous);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Reverted Save product",
      reversible: false,
      reversed_activity_id: entry.id,
      by: "Demo Supervisor",
    });
  });
  it("detects an intervening edit to the same record and makes no partial mutation", () => {
    const state = initialState();
    const entry = act(state, (s) => {
      s.products[0].name_en = "Changed name";
      s.products[0].name_fa = "نام جدید";
    });
    state.products[0].barcode = "LATER-BARCODE";
    const before = structuredClone(state);
    expect(historyChangePreview(state, entry).some((row) => row.conflict)).toBe(
      true,
    );
    expect(() =>
      reverseActivity(state, context(state), entry.id, "revert"),
    ).toThrowError(HistoryError);
    expect(state).toEqual(before);
  });
  it("preserves subsequent independent settings edits", () => {
    const state = initialState();
    const entry = act(
      state,
      (s) => {
        s.config.company.name_en = "New shop";
      },
      "Company settings changed",
    );
    state.config.modules.notes = !state.config.modules.notes;
    const modules = structuredClone(state.config.modules);
    reverseActivity(state, context(state), entry.id, "revert");
    expect(state.config.company.name_en).not.toBe("New shop");
    expect(state.config.modules).toEqual(modules);
  });
  it("blocks undo after a barcode has become owned by another product", () => {
    const state = initialState();
    const original = state.products[0].barcode;
    const entry = act(state, (s) => {
      s.products[0].barcode = "FREE-CODE";
    });
    state.products[1].barcode = original;
    const before = structuredClone(state);
    expect(() =>
      reverseActivity(state, context(state), entry.id, "revert"),
    ).toThrow("barcode_conflict");
    expect(state).toEqual(before);
  });
  it("only exposes and reverses the signed-in worker's scoped actions", () => {
    const state = initialState();
    const entry = act(
      state,
      (s) => {
        s.expiry[0].status = "cleared";
      },
      "expiry_cleared",
      "Branch 1",
      "Demo Floor Worker",
    );
    const worker = {
      ...context(state),
      role: "floor_worker" as const,
      actor: "Demo Floor Worker",
      username: "floorworker",
      allowed_branches: ["Branch 1"],
    };
    expect(selectHistory(state, worker).map((item) => item.id)).toEqual([
      entry.id,
    ]);
    expect(() => reverseActivity(state, worker, entry.id, "revert")).toThrow(
      "irreversible",
    );
    reverseActivity(state, worker, entry.id, "undo");
    expect(state.expiry[0].status).toBe("active");
    expect(state.activity.at(-1)?.action).toBe("Undone");
  });
  it("blocks cashiers, another actor, another company and an unallowed branch", () => {
    const state = initialState();
    const entry = act(
      state,
      (s) => {
        s.expiry[0].status = "cleared";
      },
      "expiry_cleared",
      "Branch 1",
      "Demo Floor Worker",
    );
    for (const ctx of [
      { ...context(state), role: "cashier" as const },
      { ...context(state), company_id: "another-company" },
      { ...context(state), allowed_branches: ["Branch 2"] },
      {
        ...context(state),
        role: "floor_worker" as const,
        actor: "Another worker",
        username: "newemployee",
        allowed_branches: ["Branch 1"],
      },
    ]) {
      expect(selectHistory(state, ctx)).not.toContainEqual(entry);
      expect(() => reverseActivity(state, ctx, entry.id, "undo")).toThrow();
    }
  });
  it("shows only the worker's own shared template and quick-add actions and lets that worker undo their template", () => {
    const state = initialState();
    const worker = {
      ...context(state),
      role: "floor_worker" as const,
      actor: "Demo Floor Worker",
      username: "floorworker",
      allowed_branches: ["Branch 1"],
    };
    const before = structuredClone(state);
    saveLabelTemplate(
      state,
      {
        id: "worker-template",
        company_id: worker.company_id,
        name: "Worker template",
        width: 60,
        height: 40,
        margin_top: 10,
        margin_bottom: 10,
        margin_left: 10,
        margin_right: 10,
        gap_x: 4,
        gap_y: 4,
        offset_x: 0,
        offset_y: 0,
      },
      { name: worker.actor, role: worker.role, branch: worker.branch },
    );
    const [entry] = attachReversals(before, state, worker);
    const ownQuickAdd: Activity = {
      id: "own-supplier",
      company_id: worker.company_id,
      branch: "all",
      action: "Add supplier",
      by: worker.actor,
      actor_username: worker.username,
      at: new Date().toISOString(),
      reversible: false,
      entity_type: "supplier",
    };
    state.activity.push(
      ownQuickAdd,
      {
        ...ownQuickAdd,
        id: "other-worker-supplier",
        actor_username: "newemployee",
      },
      {
        ...ownQuickAdd,
        id: "foreign-supplier",
        company_id: "foreign-company",
      },
      {
        ...ownQuickAdd,
        id: "global-settings",
        action: "Company settings changed",
      },
    );
    expect(
      selectHistory(state, worker)
        .map((item) => item.id)
        .sort(),
    ).toEqual([entry.id, ownQuickAdd.id].sort());
    reverseActivity(state, worker, entry.id, "undo");
    expect(
      state.templates.find((template) => template.id === "worker-template"),
    ).toMatchObject({ archived: true });
    expect(state.activity.at(-1)).toMatchObject({
      action: "Undone",
      actor_username: "floorworker",
    });
    expect(selectHistory(state, worker)).toContainEqual(state.activity.at(-1));
  });
  it("rejects the worker's template Undo after another worker changes that shared template", () => {
    const state = initialState();
    const entry = act(
      state,
      (s) => {
        s.templates.push({
          id: "shared-template",
          company_id: s.config.company.seed_key,
          name: "Shared",
          width: 60,
          height: 40,
          margin_top: 10,
          margin_bottom: 10,
          margin_left: 10,
          margin_right: 10,
          gap_x: 4,
          gap_y: 4,
          offset_x: 0,
          offset_y: 0,
        });
      },
      "Create template",
      "all",
      "Demo Floor Worker",
    );
    state.templates.find((item) => item.id === "shared-template")!.offset_x = 2;
    const before = structuredClone(state);
    expect(() =>
      reverseActivity(
        state,
        {
          ...context(state),
          role: "floor_worker",
          actor: "Demo Floor Worker",
          username: "floorworker",
          allowed_branches: ["Branch 1"],
        },
        entry.id,
        "undo",
      ),
    ).toThrow("conflict");
    expect(state).toEqual(before);
  });
  it("allows a Floor Worker to undo stopping an offer in their branch without changing another branch", () => {
    const state = initialState();
    const worker = {
      ...context(state),
      role: "floor_worker" as const,
      actor: "Demo Floor Worker",
      username: "floorworker",
      allowed_branches: ["Branch 1"],
    };
    const offer = {
      ...state.offers[0],
      id: "worker-branch-offer",
      company_id: worker.company_id,
      branch: "Branch 1",
      scope: "branch" as const,
      status: "active" as const,
    };
    state.offers.push(offer);
    const otherBranches = structuredClone(
      state.offers.filter((item) => item.branch !== "Branch 1"),
    );
    const before = structuredClone(state);
    stopOffer(state, offer.id, false, "floor_worker");
    const [entry] = attachReversals(before, state, worker);
    reverseActivity(state, worker, entry.id, "undo");
    expect(state.offers.find((item) => item.id === offer.id)?.status).toBe(
      "active",
    );
    expect(state.offers.filter((item) => item.branch !== "Branch 1")).toEqual(
      otherBranches,
    );
  });
  it.each(["product", "invoice"] as const)(
    "keeps a newly added pricing category when a later %s uses it",
    (dependency) => {
      const state = initialState();
      const entry = act(
        state,
        (s) => {
          s.config.pricing_categories.push({
            ...s.config.pricing_categories[0],
            key: "new-category",
            label: "New category",
          });
        },
        "Pricing rules changed",
      );
      if (dependency === "product")
        state.products[0].pricing_category = "new-category";
      else state.invoice.lines[0].pricing_category = "new-category";
      const before = structuredClone(state);
      expect(() =>
        reverseActivity(state, context(state), entry.id, "revert"),
      ).toThrow("conflict");
      expect(state).toEqual(before);
    },
  );
  it("can remove an unused newly added pricing category through recorded Revert", () => {
    const state = initialState();
    const entry = act(
      state,
      (s) => {
        s.config.pricing_categories.push({
          ...s.config.pricing_categories[0],
          key: "unused",
          label: "Unused",
        });
      },
      "Pricing rules changed",
    );
    reverseActivity(state, context(state), entry.id, "revert");
    expect(
      state.config.pricing_categories.some((item) => item.key === "unused"),
    ).toBe(false);
    expect(state.activity.at(-1)?.reversed_activity_id).toBe(entry.id);
  });
  it("preserves supplier invoice and balance history recorded under a renamed supplier when reverting its name", () => {
    const state = initialState();
    const supplier = state.suppliers![0];
    const originalName = supplier.name;
    const foreignSupplier = {
      ...structuredClone(supplier),
      company_id: "foreign-company",
      name: "Foreign Supplier",
    };
    state.suppliers!.push(foreignSupplier);
    const before = structuredClone(state);
    saveSupplier(
      state,
      context(state),
      {
        ...supplier,
        name: "Orchard Logistics",
        address: supplier.address ?? "",
        notes: supplier.notes ?? "",
        similar_name_confirmed: true,
      },
      { id: supplier.id },
    );
    const [entry] = attachReversals(before, state, context(state));
    state.ledger.push({
      id: "later-invoice",
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      supplier: "Orchard Logistics",
      type: "invoice",
      amount: "17.00",
      date: "2026-10-08",
      reference: "LATER-1",
      currency: state.config.company.currency,
    });
    const expectedBalance = supplierBalanceSummary(
      state,
      context(state),
      "Orchard Logistics",
    ).balance;
    const ledger = structuredClone(state.ledger);
    reverseActivity(state, context(state), entry.id, "revert");
    const restored = state.suppliers!.find((item) => item.id === supplier.id)!;
    expect(restored.name).toBe(originalName);
    expect(restored.previous_names).toContain("Orchard Logistics");
    expect(state.ledger).toEqual(ledger);
    expect(
      state.suppliers!.find(
        (record) => record.company_id === "foreign-company",
      ),
    ).toEqual(foreignSupplier);
    expect(
      supplierBalanceSummary(state, context(state), originalName).balance,
    ).toBe(expectedBalance);
    expect(state.activity.at(-1)?.after).toMatchObject({
      previous_names: ["Orchard Logistics"],
    });
  });
  it("refuses double reversal without erasing original audit entries", () => {
    const state = initialState();
    const entry = act(state, (s) => {
      s.products[0].name_en = "Changed";
    });
    reverseActivity(state, context(state), entry.id, "undo");
    const before = structuredClone(state);
    expect(() =>
      reverseActivity(state, context(state), entry.id, "revert"),
    ).toThrow("irreversible");
    expect(state).toEqual(before);
  });
  it.each([
    "Print labels",
    "Posted invoice",
    "Record payment",
    "Opening count",
  ])("never offers simple undo for %s", (action) => {
    const state = initialState();
    const entry = act(
      state,
      (s) => {
        s.products[0].name_en = "Changed";
      },
      action,
    );
    expect(entry.reversible).toBe(false);
  });
  it.each(["ledger", "stock", "stock_movements"] as const)(
    "blocks any transaction that changes %s",
    (root) => {
      const state = initialState();
      const entry = act(state, (s) => {
        s.products[0].name_en = "Changed";
        if (root === "stock") s.stock["Branch 1:0001"]++;
        else if (root === "ledger") s.ledger[0].amount = "99.99";
        else s.stock_movements![0].qty++;
      });
      expect(entry.reversible).toBe(false);
    },
  );
  it("keeps newly-added notebook entries as archived records on Undo", () => {
    const state = initialState();
    const entry = act(
      state,
      (s) => {
        s.notebook_entries!.push({
          id: "new-entry",
          company_id: s.config.company.seed_key,
          branch: "Branch 1",
          notebook_id: s.notebooks![0].id,
          text: "Fridge reading",
          by: "Demo Floor Worker",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "open",
          notify_supervisor: false,
        });
      },
      "Add notebook entry",
      "Branch 1",
      "Demo Floor Worker",
    );
    reverseActivity(
      state,
      {
        ...context(state),
        role: "floor_worker",
        actor: "Demo Floor Worker",
        username: "floorworker",
        allowed_branches: ["Branch 1"],
      },
      entry.id,
      "undo",
    );
    expect(
      state.notebook_entries!.find((item) => item.id === "new-entry"),
    ).toMatchObject({ archived: true, text: "Fridge reading" });
  });
  it("restores a removed waitlist row without touching concurrently added rows", () => {
    const state = initialState();
    state.label_waitlist = [
      {
        id: "first",
        company_id: state.config.company.seed_key,
        branch: "Branch 1",
        product_code: "0001",
        copies: 2,
        added_by: "Demo Supervisor",
        added_at: new Date().toISOString(),
      },
    ];
    const entry = act(
      state,
      (s) => {
        s.label_waitlist = [];
      },
      "Remove from waitlist",
      "Branch 1",
    );
    state.label_waitlist!.push({
      id: "later",
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      product_code: "0002",
      copies: 3,
      added_by: "Demo Supervisor",
      added_at: new Date().toISOString(),
    });
    reverseActivity(state, context(state), entry.id, "undo");
    expect(state.label_waitlist!.map((item) => item.id)).toEqual([
      "later",
      "first",
    ]);
  });
  it("reverts approved price edits with related offers while retaining the decision record", () => {
    const state = initialState();
    const before = structuredClone(state);
    const product = state.products.find((item) => item.code === "0009")!;
    saveProductEdits(
      state,
      { ...context(state), allowed_branches: context(state).allowed_branches },
      product.code,
      {
        name_en: product.name_en,
        name_fa: product.name_fa,
        description_en: "",
        description_fa: "",
        unit_size: product.unit_size,
        ai_category: product.ai_category,
        pricing_category: product.pricing_category,
        barcode: product.barcode,
        main_supplier: product.main_supplier,
        date_tracking: Boolean(product.date_tracking),
        selling_price: "3.29",
        scope: "all",
      },
      productEditSnapshot(state, product.code),
    );
    const [entry] = attachReversals(before, state, context(state));
    const approvedIds = state.approvals.map((item) => item.id);
    reverseActivity(state, context(state), entry.id, "revert");
    expect(
      state.products.find((item) => item.code === "0009")!.selling_price,
    ).toBe("2.99");
    expect(state.approvals.map((item) => item.id)).toEqual(approvedIds);
    expect(state.approvals.at(-1)?.status).toBe("rejected");
    expect(
      state.offers.filter(
        (item) => item.product_code === "0009" && item.status === "active",
      ).length,
    ).toBeGreaterThan(0);
  });
  it("keeps foreign-company records isolated even when patches are forged", () => {
    const state = initialState();
    const foreign = {
      ...structuredClone(state.products[0]),
      code: "FOREIGN",
      company_id: "foreign-company",
    };
    state.products.push(foreign);
    const entry = act(state, (s) => {
      s.products.find((item) => item.code === "FOREIGN")!.name_en = "Tampered";
    });
    const before = structuredClone(state);
    expect(() =>
      reverseActivity(state, context(state), entry.id, "revert"),
    ).toThrow("scope");
    expect(state).toEqual(before);
  });
  it("records exact touched paths and excludes money and stock from reversal patches", () => {
    const before = initialState(),
      after = structuredClone(before);
    after.products[0].name_en = "New";
    after.ledger[0].amount = "9.99";
    after.stock["Branch 1:0001"]++;
    expect(changedPaths(before, after).map((patch) => patch.path[0])).toEqual([
      "products",
    ]);
  });
});
describe("B additive migration and verified restore", () => {
  it("backs up and preserves existing A2 edits and permits an exact restore", () => {
    const old = initialState();
    delete old.prototype_b_schema;
    delete old.notebooks;
    delete old.notebook_entries;
    delete old.suppliers;
    old.products[0].name_en = "Saved owner edit";
    old.config.company.name_en = "Saved company";
    const map = new Map<string, string>();
    const storage = {
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      getItem: (key: string) => map.get(key) ?? null,
    };
    const migrated = restoreBState(old, storage);
    expect(migrated).toMatchObject({ prototype_b_schema: 1 });
    expect(migrated.products[0].name_en).toBe("Saved owner edit");
    expect(migrated.config.company.name_en).toBe("Saved company");
    expect(JSON.parse(map.get(B_BACKUP_KEY)!)).toEqual(old);
    expect(old.prototype_b_schema).toBeUndefined();
    expect(restoreBState(migrated, storage)).toBe(migrated);
  });
  it("keeps the saved state intact when backup verification fails or storage throws", () => {
    const state = initialState();
    delete state.prototype_b_schema;
    const original = structuredClone(state);
    for (const storage of [
      { setItem: () => {}, getItem: () => "wrong" },
      {
        setItem: () => {
          throw new Error("full");
        },
        getItem: () => null,
      },
    ]) {
      expect(restoreBState(state, storage)).toBe(state);
      expect(state).toEqual(original);
    }
  });
});
