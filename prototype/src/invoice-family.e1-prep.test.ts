import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { initialState } from "./store";
import { authenticatedTestActor } from "./authority-test-fixture";
import { bindAuthoritySnapshot, authoritySnapshot } from "./authority";
import {
  createInvoice,
  receiveShort,
  demoSaleCostInvoice,
  previousReceiptCost,
  lowerPriceLines,
  lowerPriceLineIndexes,
} from "./invoice";
import {
  projectInvoiceState,
  purchaseInvoiceView,
} from "./invoice-projections";
import {
  projectPurchaseOperational,
  projectSuppliers,
  projectLedger,
} from "./purchase-projections";
import { suppliersOverview, supplierPage } from "./suppliers";
import { supplierItems } from "./supplier-items";
import {
  lookupLastReceipt,
  receiptLots,
  receiptLotsForProduct,
  effectiveProjectedClearanceOffers,
  setLotClearance,
} from "./receipt-lots";
import { receivedLog } from "./received";
import { createOrder, orderCandidates, placeOrder } from "./orders";
import { invoiceWorkspaceRead } from "./invoice-workspace-read";
import {
  compatibleInvoiceOrders,
  linkedInvoiceOrder,
  currentInvoiceOrderComparison,
} from "./invoice-orders";
import { canInvoiceAuthority } from "./invoice-authority";
import {
  invoicePurchaseEvidence,
  invoiceEvidenceActor,
  closePurchaseEvidence,
} from "./purchase-evidence.internal";
import type { DemoState } from "./types";
import type { RoleId } from "./authority-types";

function business(): DemoState {
  return initialState();
}

function actorFor(
  state: DemoState,
  role: RoleId,
  locations = ["Branch 1"],
  aggregate = false,
) {
  return authenticatedTestActor(state, role, {
    locations,
    selection: aggregate
      ? { kind: "all_my_locations" }
      : { kind: "location", location_id: locations[0] },
  });
}
const roles: RoleId[] = [
  "owner",
  "manager",
  "branch_supervisor",
  "floor_worker",
  "cashier",
];
const unchanged = (state: DemoState) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        products: state.products,
        stock: state.stock,
        ledger: state.ledger,
        invoices: state.invoices,
      }),
    )
    .digest("hex");

describe("E1 invoice-family concrete preparation (not app integration proof)", () => {
  for (const role of roles) {
    it(`${role}: physical posting is allowed only at its permitted concrete location`, () => {
      const state = business();
      const actor = actorFor(state, role);
      state.invoice.branch = "Branch 1";
      state.invoice.handling_branch = "Branch 1";
      state.invoice.reviewer_origin_location_id = "Branch 1";
      expect(
        canInvoiceAuthority(
          state,
          actor,
          "invoices.post",
          state.invoice.id,
          true,
        ),
      ).toBe(role !== "cashier");
      state.invoice.branch = "Warehouse";
      expect(
        canInvoiceAuthority(
          state,
          actor,
          "invoices.post",
          state.invoice.id,
          true,
        ),
      ).toBe(role === "owner" || role === "manager");
    });
  }
  it("a forged spread cannot project any invoice or operational family", () => {
    const state = business(),
      actor = actorFor(state, "manager");
    expect(() => projectInvoiceState(state, { ...actor })).toThrow();
    expect(() => projectPurchaseOperational(state, { ...actor })).toThrow();
  });
  it("unknown retained fields never enter invoice, line, Order, or ledger DTOs", () => {
    const state = business(),
      actor = actorFor(state, "manager");
    Object.assign(state.invoice, { unknown_private_money: "SENTINEL-INVOICE" });
    Object.assign(state.invoice.lines[0], {
      unknown_private_margin: "SENTINEL-LINE",
    });
    Object.assign(state.ledger[0], {
      unknown_private_evidence: "SENTINEL-LEDGER",
    });
    const view = projectInvoiceState(state, actor);
    expect(JSON.stringify(view)).not.toContain("SENTINEL");
    expect(JSON.stringify(projectLedger(state, actor))).not.toContain(
      "SENTINEL",
    );
  });
  it("an actual epoch revocation rejects the previous branded actor", () => {
    const state = business(),
      actor = actorFor(state, "manager");
    const snapshot = structuredClone(authoritySnapshot(state));
    snapshot.people.find((person) => person.id === actor.user_id)!
      .authority_epoch++;
    bindAuthoritySnapshot(state, snapshot);
    expect(() => projectPurchaseOperational(state, actor)).toThrow();
  });
  it("assigned multi-location reads exclude a foreign store before projecting money", () => {
    const state = business(),
      actor = actorFor(
        state,
        "branch_supervisor",
        ["Branch 2", "Branch 3"],
        true,
      );
    const received = receivedLog(state, actor);
    expect(
      received.every((row) => ["Branch 2", "Branch 3"].includes(row.branch)),
    ).toBe(true);
    const invoices = projectInvoiceState(state, actor);
    expect(invoices.invoice).toBeNull();
    expect(
      invoices.invoices.every((row) =>
        ["Branch 2", "Branch 3"].includes(row.branch),
      ),
    ).toBe(true);
    expect(projectLedger(state, actor)).toEqual([]);
  });
  it("Branch Supervisor and Floor Worker public lot receipts contain no private unit cost", () => {
    for (const role of ["branch_supervisor", "floor_worker"] as const) {
      const state = business(),
        actor = actorFor(state, role);
      // The retained tracked-date records identify real seeded posted lines.
      for (const date of state.expiry) {
        const invoice = state.invoices?.find(
          (row) => row.id === date.invoice_id,
        );
        const line = invoice?.lines.find(
          (row) => row.product_code === date.product_code,
        );
        if (line) {
          line.date_value = date.date;
          line.date_type = "expiry";
        }
      }
      const view = projectPurchaseOperational(state, actor);
      expect(view.receipt_lots.length).toBeGreaterThan(0);
      for (const lot of view.receipt_lots) {
        expect(Object.hasOwn(lot, "unit_cost")).toBe(false);
        for (const receipt of lot.source_receipts)
          expect(Object.hasOwn(receipt, "unit_cost")).toBe(false);
      }
      expect(projectLedger(state, actor)).toEqual([]);
    }
  });
  it("Cashier lot hints carry no invoice relation or cost, and no stock/Order/Supplier families", () => {
    const state = business(),
      actor = actorFor(state, "cashier");
    // Populate real retained posted receipt dates so this privacy check cannot pass on empty lots.
    for (const date of state.expiry) {
      const invoice = state.invoices?.find((row) => row.id === date.invoice_id);
      const line = invoice?.lines.find(
        (row) => row.product_code === date.product_code,
      );
      if (line) {
        line.date_value = date.date;
        line.date_type = "expiry";
      }
    }
    const originalLots = receiptLots(state).filter(
      (lot) => lot.branch === "Branch 1",
    );
    expect(originalLots.length).toBeGreaterThan(0);
    const view = projectPurchaseOperational(state, actor);
    expect(view.receipt_lots).toEqual([]);
    expect(view.clearance_lots).toEqual(
      originalLots.map(({ id, company_id, product_code, branch }) => ({
        id,
        company_id,
        product_code,
        branch,
      })),
    );
    for (const lot of view.clearance_lots)
      expect(Object.keys(lot).sort()).toEqual([
        "branch",
        "company_id",
        "id",
        "product_code",
      ]);
    expect(
      receiptLotsForProduct(state, actor, originalLots[0].product_code),
    ).toEqual([]);
    const manager = actorFor(state, "manager");
    const when = new Date("2026-10-13T16:00:00Z");
    const lot = originalLots.find((row) => row.expiry_date >= "2026-10-13")!;
    const offer = setLotClearance(state, manager, lot.id, "0.01", when);
    expect(
      effectiveProjectedClearanceOffers(
        {
          config: state.config,
          products: state.products,
          offers: state.offers,
          receipt_lots: view.receipt_lots,
          clearance_lots: view.clearance_lots,
        },
        lot.product_code,
        "Branch 1",
        when,
      ),
    ).toEqual([offer]);
    expect(
      effectiveProjectedClearanceOffers(
        {
          config: state.config,
          products: state.products,
          offers: state.offers,
          clearance_lots: [],
        },
        lot.product_code,
        "Branch 1",
        when,
      ),
    ).toEqual([]);
    const hint = lookupLastReceipt(state, actor, lot.product_code);
    expect(hint).toBeDefined();
    expect(Object.keys(hint!).sort()).toEqual(["date"]);
    const operational = actorFor(state, "floor_worker");
    expect(
      projectPurchaseOperational(state, operational).receipt_lots.map(
        (row) => ({ id: row.id, quantity: row.received_quantity }),
      ),
    ).toEqual(
      originalLots.map((row) => ({
        id: row.id,
        quantity: row.received_quantity,
      })),
    );
    expect(view.stock).toEqual({});
    expect(view.stock_movements).toEqual([]);
    expect(view.orders).toEqual([]);
    expect(view.supplier_items).toEqual([]);
    expect(projectSuppliers(state, actor)).toEqual([]);
    for (const lot of view.receipt_lots)
      for (const receipt of lot.source_receipts) {
        expect(Object.hasOwn(receipt, "invoice_id")).toBe(false);
        expect(Object.hasOwn(receipt, "unit_cost")).toBe(false);
      }
  });
  it("Supplier money is omitted for Branch Supervisor and Floor Worker", () => {
    for (const role of ["branch_supervisor", "floor_worker"] as const) {
      const state = business(),
        actor = actorFor(state, role);
      const rows = suppliersOverview(state, actor);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => !Object.hasOwn(row, "financial"))).toBe(true);
      const page = supplierPage(state, actor, "Fresh Valley Foods");
      expect(page.payments).toBeUndefined();
      expect(
        page.invoices.every((row) => !Object.hasOwn(row, "financial")),
      ).toBe(true);
      expect(page.invoices.some((row) => Object.hasOwn(row, "purchase"))).toBe(
        role === "branch_supervisor",
      );
    }
  });
  it("Supplier Items purchase cost is granted to Branch Supervisor and omitted for Floor Worker", () => {
    for (const role of ["branch_supervisor", "floor_worker"] as const) {
      const state = business(),
        actor = actorFor(state, role),
        rows = supplierItems(state, actor, "Fresh Valley Foods");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((row) => Object.hasOwn(row, "financial"))).toBe(
        role === "branch_supervisor",
      );
    }
  });
  it("a Worker upload of HW-5012 never asks for manual-entry privilege", () => {
    const state = business(),
      actor = actorFor(state, "floor_worker");
    const before = unchanged(state);
    const invoice = demoSaleCostInvoice(state, actor, "Branch 1");
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.subtotal).toBe("42.60");
    expect(invoice.tax).toBe("5.54");
    expect(invoice.final_total).toBe("48.14");
    expect(invoice.lines[0].unit_cost_before_tax).toBe("14.2000");
    expect(unchanged(state)).toBe(before);
    expect(() => createInvoice(state, actor, "Branch 1", true)).toThrow();
  });
  it("retained own review permits the documented draft post while later receiving remains assigned", () => {
    const state = business(),
      actor = actorFor(state, "floor_worker", ["Warehouse"]);
    state.invoice.branch = "Branch 1";
    state.invoice.handling_branch = "Warehouse";
    state.invoice.reviewer_origin_location_id = "Warehouse";
    state.invoice.handler_user_ids = [actor.user_id];
    state.invoice.created_by_user_id = actor.user_id;
    expect(canInvoiceAuthority(state, actor, "invoices.read")).toBe(true);
    expect(
      canInvoiceAuthority(
        state,
        actor,
        "invoices.edit",
        state.invoice.id,
        true,
      ),
    ).toBe(true);
    const before = unchanged(state);
    expect(
      canInvoiceAuthority(
        state,
        actor,
        "invoices.post",
        state.invoice.id,
        true,
      ),
    ).toBe(true);
    expect(() => receiveShort(state, "0009", 1, "E1-DENIED", actor)).toThrow();
    const evidence = invoicePurchaseEvidence(
      state,
      actor,
      state.invoice.id,
      "invoice_post",
    );
    expect(
      invoiceEvidenceActor(state, evidence, state.invoice.id, "invoice_post")
        .user_id,
    ).toBe(actor.user_id);
    closePurchaseEvidence(evidence);
    expect(unchanged(state)).toBe(before);
    const manager = actorFor(state, "manager");
    expect(
      canInvoiceAuthority(
        state,
        manager,
        "invoices.post",
        state.invoice.id,
        true,
      ),
    ).toBe(true);
  });
  it("public no-SKU prior receipt never exposes Catalog cost while the retained private lower-price decision is unchanged", () => {
    const state = business(),
      actor = actorFor(state, "floor_worker");
    state.invoices = [];
    const line = state.invoice.lines.find(
      (row) => row.product_code === "0003",
    )!;
    expect(line.unit_cost_before_tax).toBe("1.80");
    expect(
      previousReceiptCost(state, actor, line.product_code, line),
    ).toBeNull();
    const lower = lowerPriceLines(state, actor);
    expect(lower.some((row) => row.product_code === "0003")).toBe(true);
    expect(
      JSON.stringify(lower.find((row) => row.product_code === "0003")),
    ).not.toContain("1.95");
    expect(lower.every((row) => !Object.hasOwn(row, "demo_note"))).toBe(true);
  });
  it("Cashier uses only the assigned-store receipt date hint and no proxy authority", () => {
    const state = business(),
      actor = actorFor(state, "cashier");
    const hint = lookupLastReceipt(state, actor, "0003");
    expect(hint).toBeDefined();
    expect(Object.keys(hint!)).toEqual(["date"]);
    expect(() => lookupLastReceipt(state, { ...actor }, "0003")).toThrow();
    const multiple = actorFor(state, "cashier", ["Branch 1", "Branch 2"], true);
    expect(() => lookupLastReceipt(state, multiple, "0003")).toThrow();
  });
  it("an exact-purpose witness cannot impersonate another effect and is unusable after close", () => {
    const state = business(),
      actor = actorFor(state, "manager");
    const handle = invoicePurchaseEvidence(
      state,
      actor,
      state.invoice.id,
      "invoice_review",
    );
    expect(() =>
      invoiceEvidenceActor(state, handle, state.invoice.id, "invoice_post"),
    ).toThrow();
    closePurchaseEvidence(handle);
    expect(() =>
      invoiceEvidenceActor(state, handle, state.invoice.id, "invoice_review"),
    ).toThrow();
  });
  it("own foreign-target review keeps incoming purchase fields while unrelated historical Order evidence is unavailable", () => {
    const state = business(),
      manager = actorFor(state, "manager");
    const candidate = orderCandidates(
      state,
      manager,
      state.invoice.supplier,
    ).find((row) => row.product_code === "0003");
    expect(candidate).toBeDefined();
    const actualOrder = createOrder(state, manager, {
      branch: "Branch 1",
      supplier: state.invoice.supplier,
      lines: [{ supplier_item_id: candidate!.id, cases: "1" }],
    });
    placeOrder(state, manager, actualOrder.id);
    const actor = actorFor(state, "floor_worker", ["Warehouse"]);
    state.invoice.branch = "Branch 1";
    state.invoice.handling_branch = "Warehouse";
    state.invoice.reviewer_origin_location_id = "Warehouse";
    state.invoice.handler_user_ids = [actor.user_id];
    state.invoice.created_by_user_id = actor.user_id;
    state.invoice.order_id = actualOrder.id;
    const before = unchanged(state),
      view = invoiceWorkspaceRead(state, actor);
    expect(view.invoice.final_total).toBe(state.invoice.final_total);
    expect(view.invoice.lines.map((row) => row.unit_cost_before_tax)).toEqual(
      state.invoice.lines.map((row) => row.unit_cost_before_tax),
    );
    expect(compatibleInvoiceOrders(state, actor)).toEqual([]);
    expect(linkedInvoiceOrder(state, actor)).toBeNull();
    expect(currentInvoiceOrderComparison(state, actor)).toBeNull();
    expect(Object.hasOwn(view.invoice, "order_comparison")).toBe(false);
    expect(view.lineDetails.every((row) => row.previous === null)).toBe(true);
    expect(view.blockers).toContain("order");
    expect(unchanged(state)).toBe(before);
  });
  it("the private lower-price option stays available after Short-dated without returning its Catalog calculation basis", () => {
    const state = business(),
      actor = actorFor(state, "floor_worker");
    state.invoices = [];
    const index = state.invoice.lines.findIndex(
      (row) => row.product_code === "0003",
    );
    expect(index).toBeGreaterThanOrEqual(0);
    expect(lowerPriceLineIndexes(state, actor)).toContain(index);
    state.invoice.lines[index].short_dated = true;
    expect(lowerPriceLineIndexes(state, actor)).not.toContain(index);
    expect(lowerPriceLineIndexes(state, actor, true)).toContain(index);
    expect(
      previousReceiptCost(state, actor, "0003", state.invoice.lines[index]),
    ).toBeNull();
    expect(state.invoice.lines[index].unit_cost_before_tax).toBe("1.80");
  });
  it("a financial invoice subtype validates real allowed amounts and excludes original storage references", () => {
    const state = business(),
      actor = actorFor(state, "floor_worker"),
      view = purchaseInvoiceView(state, actor);
    expect(view.subtotal).toBe(state.invoice.subtotal);
    expect(view.final_total).toBe(state.invoice.final_total);
    expect(view.lines.map((row) => row.line_total)).toEqual(
      state.invoice.lines.map((row) => row.line_total),
    );
    expect(Object.hasOwn(view, "file_data")).toBe(false);
    expect(Object.hasOwn(view, "legacy_demo_original")).toBe(false);
    const cashier = actorFor(state, "cashier");
    expect(() => purchaseInvoiceView(state, cashier)).toThrow();
  });
});
