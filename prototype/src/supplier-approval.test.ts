import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { initialState } from "./e1-bootstrap";
import { createInvoice, invoiceBlockers } from "./invoice";
import type { DemoState } from "./types";
import type { AuthenticatedActor } from "./authority-types";
import { authenticatedTestActor } from "./authority-test-fixture";
import { authoritySnapshot } from "./authority";
import {
  BrowserAuthorityRepository,
  AUTHORITY_DATABASE_NAME,
} from "./authority-repository";
import { projectSalesReadView } from "./sales-projections";
import {
  supplierChoices,
  saveSupplier,
  similarSupplierNames,
  dismissSimilarSupplier,
  type SupplierEdits,
} from "./supplier-editor";
import {
  activatePendingSuppliersDraft,
  migrateSupplierProfiles,
  syncSupplierProfileNotifications,
} from "./supplier-profiles";

let state: DemoState;
let manager: AuthenticatedActor;
let worker: AuthenticatedActor;
const edits = (name: string): SupplierEdits => ({
  name,
  phone: "",
  email: "",
  sales_rep_name: "",
  sales_rep_phone: "",
  payment_terms: "",
  address: "",
  notes: "",
});
beforeEach(() => {
  state = initialState();
  manager = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
  });
  worker = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
  });
});

describe("R2 suppliers without approval", () => {
  it("creates a worker's name-only supplier as active with no approval, preserving posting's real gates", () => {
    const beforeProducts = structuredClone(state.products);
    const supplier = saveSupplier(
      state,
      worker,
      edits("Orchard Receiving Supply"),
      { invoice_quick_add: true },
    );
    expect(supplier).toMatchObject({
      status: "confirmed",
      active: true,
      notes: "",
      invoice_review_required: false,
    });
    expect(supplierChoices(state)).toContain(supplier);
    expect(
      state.approvals.some((item) => item.supplier_id === supplier.id),
    ).toBe(false);
    state.invoice.supplier = supplier.name;
    for (const blocker of [
      "supplier_pending",
      "supplier_details",
      "supplier_review",
    ])
      expect(invoiceBlockers(state, worker)).not.toContain(blocker);
    expect(state.products).toEqual(beforeProducts);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Add supplier",
      actor_user_id: worker.user_id,
    });
  });

  it("keeps standalone creation, editing and opening balances permission guarded", () => {
    const before = structuredClone(state);
    expect(() =>
      saveSupplier(state, worker, edits("Orchard Standalone")),
    ).toThrow();
    expect(state).toEqual(before);
    const cashier = authenticatedTestActor(state, "cashier");
    expect(() =>
      saveSupplier(state, cashier, edits("Orchard Cashier"), {
        invoice_quick_add: true,
      }),
    ).toThrow();
    expect(() =>
      saveSupplier(
        state,
        worker,
        {
          ...edits("Orchard Balance"),
          opening_balances: [
            { branch: "Branch 1", amount: "1.00", date: "2026-10-21" },
          ],
        },
        { invoice_quick_add: true },
      ),
    ).toThrow();
    const supplier = saveSupplier(state, manager, edits("Orchard Standalone"));
    expect(supplier.status).toBe("confirmed");
    expect(() =>
      saveSupplier(state, worker, edits(supplier.name), { id: supplier.id }),
    ).toThrow();
  });

  it("warns only for distinctive or closely matching names, never the common Foods Inc ending", () => {
    const sunrise = saveSupplier(
      state,
      manager,
      edits("Sunrise Fine Foods Inc."),
    );
    expect(
      similarSupplierNames(state, "Cedar Valley Foods Inc."),
    ).not.toContain(sunrise);
    const cedar = saveSupplier(
      state,
      manager,
      edits("Cedar Valley Foods Inc."),
    );
    expect(similarSupplierNames(state, "Cedar Valley Food Inc")).toContain(
      cedar,
    );
    expect(similarSupplierNames(state, "Cedar Vally Food Ltd")).toContain(
      cedar,
    );
    expect(cedar.name).toBe("Cedar Valley Foods Inc.");
  });

  it.each([false, true])(
    "saves the correct legal name unchanged next to an unrelated Foods Inc supplier (quick add %s)",
    (quickAdd) => {
      saveSupplier(state, manager, edits("Sunrise Fine Foods Inc."));
      const supplier = saveSupplier(
        state,
        quickAdd ? worker : manager,
        edits("Cedar Valley Foods Inc."),
        { invoice_quick_add: quickAdd },
      );
      expect(supplier.name).toBe("Cedar Valley Foods Inc.");
    },
  );

  it("remembers a distinct pair without changing either supplier name and preserves other warnings", () => {
    const cedar = saveSupplier(
      state,
      manager,
      edits("Cedar Valley Foods Inc."),
    );
    dismissSimilarSupplier(
      state,
      worker,
      "Cedar Valley Food Inc",
      cedar.id,
      true,
    );
    expect(similarSupplierNames(state, "Cedar Valley Food Inc")).toEqual([]);
    const other = saveSupplier(state, worker, edits("Cedar Valley Food Inc"), {
      invoice_quick_add: true,
    });
    expect(other.name).toBe("Cedar Valley Food Inc");
    expect(
      similarSupplierNames(state, "Cedar Valley Foods Inc.", cedar.id),
    ).not.toContain(other);
    expect(similarSupplierNames(state, "Cedar Valley Food Ltd")).toContain(
      cedar,
    );
    expect(state.supplier_name_distinctions).toHaveLength(1);
  });

  it("notifies each Owner and Manager once, routes to Edit supplier, clears when complete, and exposes nothing to workers", () => {
    const owner = authenticatedTestActor(state, "owner");
    const supplier = saveSupplier(
      state,
      worker,
      edits("Orchard Profile Supply"),
      { invoice_quick_add: true },
    );
    syncSupplierProfileNotifications(state);
    syncSupplierProfileNotifications(state);
    const live = (actor: AuthenticatedActor) =>
      projectSalesReadView(state, actor).notifications.filter(
        (row) =>
          row.kind === "supplier_profile_incomplete" &&
          row.supplier_id === supplier.id,
      );
    expect(live(manager)).toHaveLength(1);
    expect(live(owner)).toHaveLength(1);
    expect(live(worker)).toEqual([]);
    expect(live(manager)[0].href).toContain("&edit=1");
    saveSupplier(
      state,
      manager,
      {
        ...edits(supplier.name),
        phone: "416-555-0181",
        email: "fictional@example.test",
        sales_rep_name: "Orchard Representative",
        sales_rep_phone: "416-555-0182",
        payment_terms: "Net 30",
        address: "1 Fictional Way",
      },
      { id: supplier.id },
    );
    expect(live(manager)).toEqual([]);
    expect(live(owner)).toEqual([]);
    expect(
      state.notifications!.filter((row) => row.supplier_id === supplier.id),
    ).toHaveLength(2);
  });

  it("rejects a forged migration witness without changing state", () => {
    const before = structuredClone(state);
    expect(() => activatePendingSuppliersDraft(state, {} as never)).toThrow();
    expect(state).toEqual(before);
  });

  it("backs up exact source, activates waiting suppliers once, retires approval work, audits and restores the saved source", async () => {
    const supplier = saveSupplier(
      state,
      manager,
      edits("Orchard Legacy Supplier"),
    );
    supplier.status = "proposed";
    supplier.invoice_review_required = true;
    const foreign = {
      ...structuredClone(supplier),
      id: "foreign-supplier",
      company_id: "other-company",
    };
    const inactive = {
      ...structuredClone(supplier),
      id: "inactive-supplier",
      active: false,
    };
    state.suppliers!.push(foreign, inactive);
    state.invoice = createInvoice(state, manager, "Branch 1", true);
    state.invoice.supplier = supplier.name;
    state.invoice.supplier_confirmed = false;
    state.invoice.supplier_review_required = true;
    state.approvals.push({
      id: "legacy-supplier-request",
      company_id: supplier.company_id,
      branch: "Branch 1",
      type: "new_supplier",
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      product_code: "",
      proposed_price: "",
      status: "pending",
    });
    const factory = new IDBFactory();
    const repository = new BrowserAuthorityRepository(factory);
    const snapshot = authoritySnapshot(state);
    await repository.initialize({
      ...structuredClone(snapshot),
      people: [...structuredClone(snapshot.people)],
      sessions: [...structuredClone(snapshot.sessions)],
      devices: [...structuredClone(snapshot.devices)],
      credentials: [],
      setup_challenges: [],
      audit: [],
    });
    await repository.initializeBusiness(state);
    const original = await repository.loadBusiness<DemoState>(
      supplier.company_id,
    );
    const raw = JSON.stringify(original.state);
    const archive = vi.spyOn(repository, "archivePrivateBackup");
    await migrateSupplierProfiles(repository, supplier.company_id);
    expect(archive).toHaveBeenCalledTimes(1);
    const migrated = await repository.loadBusiness<DemoState>(
      supplier.company_id,
    );
    expect(
      migrated.state.suppliers!.find((row) => row.id === supplier.id),
    ).toMatchObject({
      status: "confirmed",
      active: true,
      invoice_review_required: false,
    });
    expect(
      migrated.state.approvals.find(
        (row) => row.id === "legacy-supplier-request",
      )?.status,
    ).toBe("superseded");
    expect(
      migrated.state.activity.filter(
        (row) => row.action === "Activate supplier without approval",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity_id: supplier.id, by: "System" }),
      ]),
    );
    expect(migrated.state.ledger).toEqual(original.state.ledger);
    expect(migrated.state.products).toEqual(original.state.products);
    expect(
      migrated.state.suppliers!.find((row) => row.id === foreign.id),
    ).toEqual(foreign);
    expect(
      migrated.state.suppliers!.find((row) => row.id === inactive.id),
    ).toEqual(inactive);
    await migrateSupplierProfiles(repository, supplier.company_id);
    expect(
      (await repository.loadBusiness<DemoState>(supplier.company_id)).revision,
    ).toBe(migrated.revision);
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open(AUTHORITY_DATABASE_NAME);
      request.onsuccess = () => resolve(request.result);
    });
    const backups = await new Promise<{ raw: string }[]>((resolve) => {
      const request = database
        .transaction("private_backups")
        .objectStore("private_backups")
        .getAll();
      request.onsuccess = () => resolve(request.result);
    });
    const retained = backups.find((row) => row.raw === raw)!;
    expect(retained).toBeDefined();
    const restored: DemoState = JSON.parse(retained.raw);
    expect(restored).toEqual(original.state);
    expect(
      restored.suppliers!.find((row) => row.id === supplier.id)?.status,
    ).toBe("proposed");
    database.close();
    repository.dispose();
  });
});
