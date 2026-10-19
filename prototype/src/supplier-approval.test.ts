import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "./store";
import { createInvoice, invoiceBlockers } from "./invoice";
import type { DemoState } from "./types";
import type { AuthenticatedActor } from "./authority-types";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  confirmSupplier,
  resolveSupplierApproval,
  saveSupplier,
  supplierApprovalSnapshot,
  supplierChoices,
  type SupplierEdits,
} from "./supplier-editor";

let state: DemoState;
let manager: AuthenticatedActor;
let worker: AuthenticatedActor;
const edits: SupplierEdits = {
  name: "Orchard Confirmation Supply",
  phone: "416-555-0173",
  email: "orders@example.test",
  sales_rep_name: "Orchard Representative",
  sales_rep_phone: "416-555-0174",
  payment_terms: "Net 30",
  address: "",
  notes: "",
};
beforeEach(() => {
  state = initialState();
  manager = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
    name_en: "Signed-in Manager",
  });
  worker = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    name_en: "Receiving Worker",
  });
});
function proposal() {
  const supplier = saveSupplier(state, worker, edits, {
    invoice_quick_add: true,
  });
  state.invoice = createInvoice(state, manager, "Branch 1", true);
  state.invoice.supplier = supplier.name;
  state.invoice.supplier_confirmed = false;
  const approval = state.approvals.find(
    (item) => item.supplier_id === supplier.id,
  )!;
  return { supplier, approval };
}

describe("supplier confirmation approvals", () => {
  it("confirms the worker proposal, releases only the supplier gate and audits the actual Manager", () => {
    const { supplier, approval } = proposal();
    const products = structuredClone(state.products);
    const now = new Date("2026-10-08T13:00:00Z");
    expect(invoiceBlockers(state, worker)).toContain("supplier_pending");
    manager = authenticatedTestActor(state, "manager", {
      locations: ["Branch 2"],
      name_en: "Signed-in Manager",
    });
    resolveSupplierApproval(
      state,
      manager,
      approval.id,
      "approve",
      supplierApprovalSnapshot(state, manager, approval.id),
      now,
    );
    expect(supplier.status).toBe("confirmed");
    expect(approval.status).toBe("approved");
    expect(state.invoice.supplier_confirmed).toBe(true);
    expect(invoiceBlockers(state, worker)).not.toContain("supplier_pending");
    expect(invoiceBlockers(state, worker)).toContain("file");
    expect(state.products).toEqual(products);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Confirm supplier",
      by: manager.actor,
      actor_user_id: manager.user_id,
      actor_role_snapshot: "manager",
      at: now.toISOString(),
      entity_id: supplier.id,
      reversible: false,
    });
  });

  it("rejects without deleting records or confirming the supplier, keeping drafts blocked", () => {
    const { supplier, approval } = proposal();
    const originalId = state.invoice.id;
    resolveSupplierApproval(state, manager, approval.id, "reject");
    expect(approval.status).toBe("rejected");
    expect(supplier).toMatchObject({ status: "proposed", active: false });
    expect(state.suppliers).toContain(supplier);
    expect(state.invoice.id).toBe(originalId);
    expect(state.invoice.supplier_confirmed).toBe(false);
    expect(supplierChoices(state)).not.toContain(supplier);
    state.invoice.supplier_confirmed = true;
    expect(invoiceBlockers(state, worker)).toContain("supplier_pending");
    expect(() => confirmSupplier(state, manager, supplier.id)).toThrow(
      "inactive",
    );
    expect(state.activity.at(-1)).toMatchObject({
      action: "Reject supplier",
      by: manager.actor,
      entity_id: supplier.id,
      reversible: false,
    });
  });

  it.each(["approve", "reject"] as const)(
    "blocks %s from a worker, cashier, other company or Branch Supervisor without changes",
    (decision) => {
      const { approval } = proposal();
      const before = structuredClone(state);
      const foreign = initialState();
      foreign.config.company.seed_key = "other-company";
      const otherCompanyManager = authenticatedTestActor(foreign, "manager", {
        locations: ["Branch 1"],
      });
      const cashier = authenticatedTestActor(state, "cashier", {
        locations: ["Branch 1"],
      });
      const otherBranchSupervisor = authenticatedTestActor(
        state,
        "branch_supervisor",
        { locations: ["Branch 2"] },
      );
      for (const context of [
        worker,
        cashier,
        otherCompanyManager,
        otherBranchSupervisor,
      ]) {
        expect(() =>
          resolveSupplierApproval(state, context, approval.id, decision),
        ).toThrow();
        expect(state).toEqual(before);
      }
    },
  );

  it.each(["approve", "reject"] as const)(
    "requires a fresh supplier snapshot before %s",
    (decision) => {
      const { supplier, approval } = proposal();
      const snapshot = supplierApprovalSnapshot(state, manager, approval.id);
      supplier.phone = "416-555-0180";
      const edited = structuredClone(state);
      expect(() =>
        resolveSupplierApproval(
          state,
          manager,
          approval.id,
          decision,
          snapshot,
        ),
      ).toThrow("Supplier changed");
      expect(state).toEqual(edited);
    },
  );

  it("does not repeat an approval or create a second audit entry", () => {
    const { approval } = proposal();
    resolveSupplierApproval(state, manager, approval.id, "approve");
    const before = structuredClone(state);
    expect(() =>
      resolveSupplierApproval(state, manager, approval.id, "approve"),
    ).toThrow("no longer pending");
    expect(state).toEqual(before);
  });
});
