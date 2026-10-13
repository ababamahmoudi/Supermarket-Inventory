import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { supplierPage, suppliersOverview } from "./suppliers";
import { authenticatedTestActor } from "./authority-test-fixture";
import { AuthorityError } from "./authority";
import type { DemoInvoice } from "./types";
import { companyDate } from "./invoice";

function fixture() {
  const state = initialState();
  const worker = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    name_en: "Demo Floor Worker",
  });
  const manager = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
    name_en: "Demo Manager",
  });
  return { state, worker, manager };
}
function invoice(
  state: ReturnType<typeof initialState>,
  patch: Partial<DemoInvoice>,
): DemoInvoice {
  return {
    ...structuredClone(state.invoice),
    id: "supplier-test-invoice",
    status: "posted",
    received_at: companyDate(state.config),
    ...patch,
  };
}
const financialKeys = new Set([
  "financial",
  "payments",
  "amount",
  "balance",
  "overdue",
  "compensation",
  "last_cost",
  "unit_cost_before_tax",
]);
function hasFinancialValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasFinancialValue);
  if (value && typeof value === "object")
    return Object.entries(value).some(
      ([key, child]) => financialKeys.has(key) || hasFinancialValue(child),
    );
  return false;
}

describe("Suppliers scoped read models", () => {
  it("omits financial values from worker overview and every supplier tab", () => {
    const { state, worker, manager } = fixture();
    expect(hasFinancialValue(suppliersOverview(state, worker))).toBe(false);
    for (const supplier of suppliersOverview(state, worker))
      expect(
        hasFinancialValue(supplierPage(state, worker, supplier.name)),
      ).toBe(false);
    expect(
      supplierPage(state, manager, "Fresh Valley Foods").supplier.financial,
    ).toBeDefined();
    const branchSupervisor = authenticatedTestActor(
      state,
      "branch_supervisor",
      { locations: ["Branch 1"] },
    );
    const operational = supplierPage(
      state,
      branchSupervisor,
      "Fresh Valley Foods",
    );
    expect(operational.supplier.financial).toBeUndefined();
    expect(operational.payments).toBeUndefined();
  });
  it("rejects another company, cashiers, and worker all-branches access", () => {
    const { state } = fixture();
    const foreign = initialState();
    foreign.config.company.seed_key = "other-company";
    expect(() =>
      suppliersOverview(
        state,
        authenticatedTestActor(foreign, "floor_worker", {
          locations: ["Branch 1"],
        }),
      ),
    ).toThrow(AuthorityError);
    expect(() =>
      supplierPage(
        state,
        authenticatedTestActor(state, "cashier", { locations: ["Branch 1"] }),
        "Fresh Valley Foods",
      ),
    ).toThrow(AuthorityError);
    expect(() =>
      suppliersOverview(
        state,
        authenticatedTestActor(state, "floor_worker", {
          locations: ["Branch 1"],
          selection: { kind: "all_locations" },
        }),
      ),
    ).toThrow(AuthorityError);
  });
  it("derives delivery dates, counts and shorts from scoped posted invoices", () => {
    const { state, worker } = fixture();
    const date = companyDate(state.config);
    const receipt = invoice(state, {
      id: "scoped-delivery",
      supplier: "Scoped Supplier",
      supplier_invoice_number: "SC-7",
      lines: [
        {
          ...state.invoice.lines[0],
          qty_invoiced: 12,
          qty_received_at_posting: 8,
          qty_later_received: 1,
        },
      ],
    });
    state.invoices = [
      receipt,
      invoice(state, { ...receipt, id: "branch-two", branch: "Branch 2" }),
      invoice(state, {
        ...receipt,
        id: "foreign",
        company_id: "other-company",
        supplier: "Foreign Supplier",
      }),
      invoice(state, {
        ...receipt,
        id: "draft",
        status: "draft",
        received_at: "2099-12-31",
      }),
    ];
    state.invoice.status = "empty";
    const scoped = suppliersOverview(state, worker).find(
      (supplier) => supplier.name === "Scoped Supplier",
    )!;
    expect(scoped.last_delivery).toBe(date);
    expect(scoped.deliveries_this_month).toBe(1);
    expect(scoped.open_shorts).toBe(1);
    const page = supplierPage(state, worker, "Scoped Supplier");
    expect(page.invoices.map((item) => item.id)).toEqual(["scoped-delivery"]);
    expect(page.shorts[0].quantity).toBe(3);
    expect(
      suppliersOverview(state, worker).some(
        (supplier) => supplier.name === "Foreign Supplier",
      ),
    ).toBe(false);
    expect(
      supplierPage(
        state,
        authenticatedTestActor(state, "manager", {
          locations: ["Branch 1"],
          selection: { kind: "all_locations" },
          name_en: "Demo Manager",
        }),
        "Scoped Supplier",
      ).invoices,
    ).toHaveLength(2);
    const assignedWorker = authenticatedTestActor(state, "floor_worker", {
      user_id: "test-assigned-two-worker",
      locations: ["Branch 1", "Branch 2"],
      selection: { kind: "all_my_locations" },
    });
    const assignedPage = supplierPage(state, assignedWorker, "Scoped Supplier");
    expect(assignedPage.invoices).toHaveLength(2);
    expect(hasFinancialValue(assignedPage)).toBe(false);
  });
  it("does not expose foreign-company products, alerts, returns, or notes", () => {
    const { state, worker } = fixture();
    state.products.push({
      ...state.products[0],
      company_id: "other-company",
      code: "FOREIGN",
      main_supplier: "Foreign Supplier",
    });
    state.alerts.push({
      ...state.alerts[0],
      id: "foreign-alert",
      company_id: "other-company",
      supplier: "Fresh Valley Foods",
    });
    state.returns.push({
      ...state.returns[0],
      id: "foreign-return",
      company_id: "other-company",
      supplier: "Fresh Valley Foods",
    });
    state.notes.push({
      ...state.notes[0],
      id: "foreign-note",
      company_id: "other-company",
      product_code: "0002",
    });
    const page = supplierPage(state, worker, "Fresh Valley Foods");
    expect(page.products.some((product) => product.code === "FOREIGN")).toBe(
      false,
    );
    expect(page.alerts.some((alert) => alert.id === "foreign-alert")).toBe(
      false,
    );
    expect(page.returns.some((record) => record.id === "foreign-return")).toBe(
      false,
    );
    expect(page.notes.some((note) => note.id === "foreign-note")).toBe(false);
  });
  it("keeps proposed suppliers with no deliveries and no made-up delivery date", () => {
    const { state, worker } = fixture();
    const supplier = suppliersOverview(state, worker).find(
      (item) => item.name === "Corner Spice Co.",
    )!;
    expect(supplier.status).toBe("proposed");
    expect(supplier.last_delivery).toBeUndefined();
    expect(supplier.deliveries_this_month).toBe(0);
  });
});
