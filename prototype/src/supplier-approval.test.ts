import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "./store";
import { createInvoice, invoiceBlockers } from "./invoice";
import type { DemoState } from "./types";
import type { OperationsContext } from "./operations";
import {
  confirmSupplier,
  resolveSupplierApproval,
  saveSupplier,
  supplierApprovalSnapshot,
  supplierChoices,
  type SupplierEdits,
} from "./supplier-editor";

let state: DemoState;
let supervisor: OperationsContext;
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
  supervisor = {
    company_id: state.config.company.seed_key,
    role: "supervisor",
    branch: "Branch 1",
    actor: "Signed-in Supervisor",
  };
});
function proposal() {
  const supplier = saveSupplier(
    state,
    { ...supervisor, role: "floor_worker", actor: "Receiving Worker" },
    edits,
    { invoice_quick_add: true },
  );
  state.invoice = createInvoice(state, "Branch 1", true);
  state.invoice.supplier = supplier.name;
  state.invoice.supplier_confirmed = false;
  const approval = state.approvals.find(
    (item) => item.supplier_id === supplier.id,
  )!;
  return { supplier, approval };
}

describe("supplier confirmation approvals", () => {
  it("confirms the worker proposal, releases only the supplier gate and audits the actual Supervisor", () => {
    const { supplier, approval } = proposal();
    const products = structuredClone(state.products);
    const now = new Date("2026-10-08T13:00:00Z");
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toContain(
      "supplier_pending",
    );
    resolveSupplierApproval(
      state,
      supervisor,
      approval.id,
      "approve",
      supplierApprovalSnapshot(state, approval.id),
      now,
    );
    expect(supplier.status).toBe("confirmed");
    expect(approval.status).toBe("approved");
    expect(state.invoice.supplier_confirmed).toBe(true);
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).not.toContain(
      "supplier_pending",
    );
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toContain(
      "file",
    );
    expect(state.products).toEqual(products);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Confirm supplier",
      by: supervisor.actor,
      at: now.toISOString(),
      entity_id: supplier.id,
      reversible: false,
    });
  });

  it("rejects without deleting records or confirming the supplier, keeping drafts blocked", () => {
    const { supplier, approval } = proposal();
    const originalId = state.invoice.id;
    resolveSupplierApproval(state, supervisor, approval.id, "reject");
    expect(approval.status).toBe("rejected");
    expect(supplier).toMatchObject({ status: "proposed", active: false });
    expect(state.suppliers).toContain(supplier);
    expect(state.invoice.id).toBe(originalId);
    expect(state.invoice.supplier_confirmed).toBe(false);
    expect(supplierChoices(state)).not.toContain(supplier);
    state.invoice.supplier_confirmed = true;
    expect(invoiceBlockers(state, "floor_worker", "Branch 1")).toContain(
      "supplier_pending",
    );
    expect(() => confirmSupplier(state, supervisor, supplier.id)).toThrow(
      "inactive",
    );
    expect(state.activity.at(-1)).toMatchObject({
      action: "Reject supplier",
      by: supervisor.actor,
      entity_id: supplier.id,
      reversible: false,
    });
  });

  it.each(["approve", "reject"] as const)(
    "blocks %s from a worker, cashier, other company or another branch without changes",
    (decision) => {
      const { approval } = proposal();
      const before = structuredClone(state);
      for (const context of [
        { ...supervisor, role: "floor_worker" as const },
        { ...supervisor, role: "cashier" as const },
        { ...supervisor, company_id: "other-company" },
        { ...supervisor, branch: "Branch 2" },
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
      const snapshot = supplierApprovalSnapshot(state, approval.id);
      supplier.phone = "416-555-0180";
      const edited = structuredClone(state);
      expect(() =>
        resolveSupplierApproval(
          state,
          supervisor,
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
    resolveSupplierApproval(state, supervisor, approval.id, "approve");
    const before = structuredClone(state);
    expect(() =>
      resolveSupplierApproval(state, supervisor, approval.id, "approve"),
    ).toThrow("no longer pending");
    expect(state).toEqual(before);
  });
});
