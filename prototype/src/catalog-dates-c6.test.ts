import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { initialState } from "./store";
import { authenticatedTestActor } from "./authority-test-fixture";
import { actorAtLocation, freshActor } from "./authority";
import { reconcileFixture } from "./system-reconciliation-test-fixture";
import type { AuthenticatedActor, RoleId } from "./authority-types";
import type { DemoInvoice, DemoState, Product } from "./types";
import {
  activeTrackedDates,
  addTrackedDate,
  dateIsDueSoon,
  nextTrackedDate,
  productDateDrafts,
  productReminderDays,
  stopProductDateTracking,
  syncDateReminderAlerts as syncCanonicalDateReminderAlerts,
  dateReminderMessage,
} from "./date-tracking";
import {
  productEditSnapshot,
  saveProductEdits,
  type ProductEdits,
} from "./product-editor";
import { addProduct } from "./manual-product";
import { effectivePrice, effectiveOffer } from "./catalog";
import {
  firstAddedLocation,
  lookupLastReceipt,
  receiptLots,
  receiptLotsForProduct,
  recordInvoiceReceiptLots,
  reusableOtherLocationDates,
  scopedClearanceOffers,
  effectiveClearanceOffers,
  setLotClearance,
} from "./receipt-lots";
import { reconcileOffers, setAlertStatus } from "./approvals";
import { supplierRecords } from "./supplier-editor";
import { createReadModel } from "./e1-read-model";
import { completeReadModelProjectors } from "./e1-projectors";
import {
  addClearanceLabelToWaitlist,
  addLabelsToWaitlist,
  prepareLabelPrint,
} from "./label-workflow";

const now = new Date("2026-10-12T16:00:00Z");
const actors = new WeakMap<DemoState, Map<string, AuthenticatedActor>>();
function actor(
  state: DemoState,
  options: { role?: RoleId; branch?: string; allowed_branches?: string[] } = {},
): AuthenticatedActor {
  const role = options.role ?? "manager";
  const location = options.branch ?? "Branch 1";
  const key = JSON.stringify([role, location, options.allowed_branches]);
  let fixtures = actors.get(state);
  if (!fixtures) {
    fixtures = new Map();
    actors.set(state, fixtures);
  }
  const existing = fixtures.get(key);
  if (existing) return freshActor(state, existing);
  const genuine = authenticatedTestActor(state, role, {
    locations: options.allowed_branches,
    selection:
      location === "all"
        ? { kind: "all_locations" }
        : { kind: "location", location_id: location },
    name_en: role === "manager" ? "Demo Manager" : `Test ${role}`,
  });
  fixtures.set(key, genuine);
  return genuine;
}
function foreignActor(state: DemoState): AuthenticatedActor {
  const foreign = structuredClone(state);
  foreign.config.company.seed_key = "other-company";
  return authenticatedTestActor(foreign, "manager");
}
async function syncDateReminderAlerts(state: DemoState, at: Date) {
  return reconcileFixture(
    state,
    "date_reminders",
    (canonical, witness) =>
      syncCanonicalDateReminderAlerts(canonical, witness, at),
    at,
  );
}
function edits(product: Product): ProductEdits {
  return {
    name_en: product.name_en,
    name_fa: product.name_fa,
    description_en: product.description_en ?? "",
    description_fa: product.description_fa ?? "",
    unit_size: product.unit_size,
    ai_category: product.ai_category,
    pricing_category: product.pricing_category,
    barcode: product.barcode,
    main_supplier: product.main_supplier,
    date_tracking: product.date_tracking,
    scope: "all",
  };
}
function datedInvoice(
  state: DemoState,
  id: string,
  branch = "Branch 1",
  quantity = "12",
  cost = "1.8000",
  date = "2026-11-04",
): DemoInvoice {
  const original = state.invoice.lines.find(
    (line) => line.product_code === "0003",
  )!;
  const total = new Decimal(quantity).times(cost).toFixed(2);
  return {
    ...structuredClone(state.invoice),
    id,
    status: "posted",
    branch,
    branch_id: branch,
    supplier: "Fresh Valley Foods",
    supplier_invoice_number: id,
    invoice_date: "2026-10-12",
    received_at: "2026-10-12T14:00:00Z",
    posted_at: "2026-10-12T15:00:00Z",
    subtotal: total,
    tax: "0.00",
    final_total: total,
    lines: [
      {
        ...structuredClone(original),
        qty_invoiced: Number(quantity),
        qty_received_at_posting: Number(quantity),
        qty_later_received: 0,
        unit_cost_before_tax: cost,
        quantity_unit: "units",
        quantity_entered: quantity,
        date_tracking: true,
        date_confirmed: true,
        date_type: "expiry",
        date_value: date,
        short_dated: true,
        refused_units: 0,
      },
    ],
  };
}
function lotState(): DemoState {
  const state = initialState();
  state.invoices = [];
  state.invoice.status = "draft";
  // Isolate this lot-print workflow from the new C8 running-sale demo waitlist.
  state.label_waitlist = [];
  state.invoices.push(datedInvoice(state, "LOT-1"));
  return state;
}

describe("C6 atomic catalog and date editing", () => {
  it("accepts empty Persian name/category without manufacturing a translation or price", () => {
    const state = initialState();
    const product = state.products.find((item) => item.code === "0003")!;
    const price = effectivePrice(state, product, "Branch 1");
    saveProductEdits(
      state,
      actor(state),
      product.code,
      { ...edits(product), name_fa: "", ai_category: "" },
      productEditSnapshot(state, actor(state), product.code),
      now,
    );
    expect(product.name_fa).toBe("");
    expect(product.ai_category).toBe("");
    expect(effectivePrice(state, product, "Branch 1")).toBe(price);
  });
  it("saves name, reminder and add/change/remove dates in one audit with original evidence retained", () => {
    const state = initialState();
    const context = actor(state, { branch: "Branch 1" });
    const product = state.products[0];
    addTrackedDate(state, context, {
      product_code: product.code,
      branch: "Branch 1",
      date_type: "expiry",
      date: "2026-11-02",
      quantity: "2",
      lot_number: "A",
    });
    addTrackedDate(state, context, {
      product_code: product.code,
      branch: "Branch 1",
      date_type: "expiry",
      date: "2026-11-03",
    });
    const rows = productDateDrafts(state, context, product.code, "Branch 1");
    const beforeMoney = structuredClone({
      ledger: state.ledger,
      stock: state.stock,
      movements: state.stock_movements,
      invoice: state.invoice,
    });
    const beforeCount = state.activity.length;
    const first = rows[0].id!;
    const second = rows[1].id!;
    saveProductEdits(
      state,
      context,
      product.code,
      {
        ...edits(product),
        name_en: "Updated rice",
        date_reminder_days: 5,
        dates: [
          {
            ...rows[0],
            date: "2026-11-05",
            date_type: "best_before",
            quantity: "3.25",
            lot_number: "B",
          },
          { ...rows[1], remove_reason: "sold_out" },
          {
            product_code: product.code,
            branch: "Branch 1",
            date_type: "expiry",
            date: "2026-11-06",
            quantity: "1",
          },
        ],
      },
      productEditSnapshot(state, actor(state), product.code),
      now,
    );
    expect(product.name_en).toBe("Updated rice");
    expect(product.date_reminder_days).toBe(5);
    expect(state.activity).toHaveLength(beforeCount + 1);
    expect(state.expiry.find((entry) => entry.id === first)).toMatchObject({
      date: "2026-11-02",
      status: "removed",
      removal_action: "correction",
    });
    expect(
      state.expiry.find((entry) => entry.previous_entry_id === first),
    ).toMatchObject({
      date: "2026-11-05",
      date_type: "best_before",
      quantity: "3.25",
      lot_number: "B",
      status: "active",
    });
    expect(state.expiry.find((entry) => entry.id === second)).toMatchObject({
      status: "removed",
      removed_reason: "sold_out",
    });
    expect({
      ledger: state.ledger,
      stock: state.stock,
      movements: state.stock_movements,
      invoice: state.invoice,
    }).toEqual(beforeMoney);
  });
  it("a bad date or unauthorized location cannot partly change a product", () => {
    const state = initialState();
    const context = actor(state);
    const product = state.products[0];
    const before = structuredClone(state);
    for (const values of [
      { date: "2026-02-30", branch: "Branch 1" },
      { date: "2026-11-04", branch: "foreign" },
    ]) {
      expect(() =>
        saveProductEdits(
          state,
          context,
          product.code,
          {
            ...edits(product),
            name_en: "Must not save",
            date_tracking: true,
            dates: [
              { product_code: product.code, date_type: "expiry", ...values },
            ],
          },
          productEditSnapshot(state, actor(state), product.code),
          now,
        ),
      ).toThrow();
      expect(state).toEqual(before);
    }
  });
  it("new product and its first-location date commit together; invalid dates do not consume a code", () => {
    const state = initialState();
    const context = actor(state, { branch: "Branch 2" });
    const template = state.products[0];
    const code = String(
      Math.max(...state.products.map((item) => Number(item.code))) + 1,
    ).padStart(4, "0");
    const input = {
      ...edits(template),
      name_en: "C6 date product",
      name_fa: "",
      ai_category: "",
      barcode: "C6-NEW-BARCODE",
      last_cost_before_tax: "1.3000",
      date_tracking: true,
      date_reminder_days: 7,
      dates: [
        {
          product_code: code,
          branch: "Branch 2",
          date_type: "expiry" as const,
          date: "2026-11-04",
        },
      ],
    };
    const before = structuredClone(state);
    expect(() =>
      addProduct(
        state,
        context,
        { ...input, dates: [{ ...input.dates[0], date: "bad" }] },
        false,
        now,
      ),
    ).toThrow();
    expect(state).toEqual(before);
    const product = addProduct(state, context, input, false, now);
    expect(product).toMatchObject({
      code,
      name_fa: "",
      ai_category: "",
      first_added_branch: "Branch 2",
      date_reminder_days: 7,
    });
    expect(
      state.products.filter((item) => item.barcode === "C6-NEW-BARCODE"),
    ).toHaveLength(1);
    expect(effectivePrice(state, product, "Branch 1")).toBe(
      product.selling_price,
    );
    expect(firstAddedLocation(state, product)).toBe("Branch 2");
    expect(
      nextTrackedDate(
        state,
        actor(state, { branch: "Branch 1" }),
        product.code,
      ),
    ).toBeUndefined();
    expect(
      nextTrackedDate(state, actor(state, { branch: "Branch 2" }), product.code)
        ?.date,
    ).toBe("2026-11-04");
  });
  it("a normalized existing barcode is blocked without duplicate products", () => {
    const state = initialState();
    state.products[0].barcode = "ABC-123";
    const target = state.products[1];
    const before = structuredClone(state);
    expect(() =>
      saveProductEdits(
        state,
        actor(state),
        target.code,
        { ...edits(target), barcode: " ＡＢＣ-１２３ " },
        productEditSnapshot(state, actor(state), target.code),
        now,
      ),
    ).toThrow("barcode_conflict");
    expect(state).toEqual(before);
  });
});

describe("C6 tracking stop and reminders", () => {
  it("accepts a nonnegative whole product reminder without an invented upper limit", () => {
    const state = initialState();
    const product = state.products[0];
    saveProductEdits(
      state,
      actor(state),
      product.code,
      { ...edits(product), date_reminder_days: 4000 },
      productEditSnapshot(state, actor(state), product.code),
      now,
    );
    expect(product.date_reminder_days).toBe(4000);
  });
  it.each([-1, 1.5])(
    "rejects invalid product reminder %s without saving other changes",
    (days) => {
      const state = initialState();
      const product = state.products[0];
      const before = structuredClone(state);
      expect(() =>
        saveProductEdits(
          state,
          actor(state),
          product.code,
          {
            ...edits(product),
            name_en: "Must not save",
            date_reminder_days: days,
          },
          productEditSnapshot(state, actor(state), product.code),
          now,
        ),
      ).toThrow("reminder");
      expect(state).toEqual(before);
    },
  );
  it("restores one suppressed reminder after tracking resumes and keeps a manually resolved reminder closed", async () => {
    const state = initialState();
    state.expiry = [];
    const context = actor(state, { branch: "Branch 1" });
    const product = state.products[0];
    const entry = addTrackedDate(state, context, {
      product_code: product.code,
      branch: "Branch 1",
      date_type: "expiry",
      date: "2026-10-17",
    });
    await syncDateReminderAlerts(state, now);
    const alert = () =>
      state.alerts.find((item) => item.expiry_id === entry.id)!;
    const originalId = alert().id;
    stopProductDateTracking(state, context, product.code, "keep");
    await syncDateReminderAlerts(state, now);
    expect(alert()).toMatchObject({
      status: "resolved",
      date_suppressed: true,
    });
    state.products.find(
      (item) =>
        item.code === product.code &&
        item.company_id === state.config.company.seed_key,
    )!.date_tracking = true;
    await syncDateReminderAlerts(state, now);
    await syncDateReminderAlerts(state, now);
    expect(alert()).toMatchObject({
      id: originalId,
      status: "pending",
      date_suppressed: false,
    });
    expect(
      state.alerts.filter((item) => item.expiry_id === entry.id),
    ).toHaveLength(1);
    setAlertStatus(state, actor(state), originalId, "resolved");
    state.products.find(
      (item) =>
        item.code === product.code &&
        item.company_id === state.config.company.seed_key,
    )!.date_tracking = false;
    await syncDateReminderAlerts(state, now);
    state.products.find(
      (item) =>
        item.code === product.code &&
        item.company_id === state.config.company.seed_key,
    )!.date_tracking = true;
    await syncDateReminderAlerts(state, now);
    expect(alert()).toMatchObject({
      id: originalId,
      status: "resolved",
      date_suppressed: false,
    });
  });
  it.each(["keep", "clear"] as const)(
    "%s always leaves all active queues and stops reminders",
    async (choice) => {
      const state = initialState();
      state.expiry = [];
      const context = actor(state, { branch: "Branch 1" });
      const product = state.products[0];
      const entry = addTrackedDate(state, context, {
        product_code: product.code,
        branch: "Branch 1",
        date_type: "expiry",
        date: "2026-10-17",
      });
      await syncDateReminderAlerts(state, now);
      expect(
        state.alerts.filter(
          (alert) =>
            alert.type === "date_reminder" && alert.expiry_id === entry.id,
        ),
      ).toHaveLength(1);
      const source = structuredClone({
        stock: state.stock,
        movements: state.stock_movements,
        ledger: state.ledger,
      });
      stopProductDateTracking(state, context, product.code, choice);
      await syncDateReminderAlerts(state, now);
      expect(activeTrackedDates(state, context)).toEqual([]);
      expect(
        state.alerts.find((alert) => alert.expiry_id === entry.id)?.status,
      ).toBe("resolved");
      if (choice === "keep")
        expect(nextTrackedDate(state, context, product.code)?.id).toBe(
          entry.id,
        );
      else {
        expect(nextTrackedDate(state, context, product.code)).toBeUndefined();
        expect(state.expiry.find((item) => item.id === entry.id)).toMatchObject(
          { status: "removed", removal_action: "stop_tracking" },
        );
      }
      expect({
        stock: state.stock,
        movements: state.stock_movements,
        ledger: state.ledger,
      }).toEqual(source);
    },
  );
  it("turning off in Edit product requires an explicit choice before any save", () => {
    const state = initialState();
    const context = actor(state);
    const product = state.products[0];
    state.products.find(
      (item) =>
        item.code === product.code &&
        item.company_id === state.config.company.seed_key,
    )!.date_tracking = true;
    const before = structuredClone(state);
    expect(() =>
      saveProductEdits(
        state,
        context,
        product.code,
        { ...edits(product), name_en: "Must not save", date_tracking: false },
        productEditSnapshot(state, actor(state), product.code),
        now,
      ),
    ).toThrow("stop_choice");
    expect(state).toEqual(before);
  });
  it("uses the product window, emits once when entering it, and updates the same alert across days", async () => {
    const state = initialState();
    state.expiry = [];
    const context = actor(state, { branch: "Branch 1" });
    const product = state.products[0];
    product.date_reminder_days = 5;
    const entry = addTrackedDate(state, context, {
      product_code: product.code,
      branch: "Branch 1",
      date_type: "expiry",
      date: "2026-10-18",
    });
    expect(productReminderDays(state, {})).toBe(
      state.config.expiry.expiring_soon_days,
    );
    expect(dateIsDueSoon(state, entry, now)).toBe(false);
    await syncDateReminderAlerts(state, now);
    expect(state.alerts.some((alert) => alert.expiry_id === entry.id)).toBe(
      false,
    );
    const next = new Date("2026-10-13T16:00:00Z");
    await syncDateReminderAlerts(state, next);
    await syncDateReminderAlerts(state, next);
    expect(
      state.alerts.filter((alert) => alert.expiry_id === entry.id),
    ).toHaveLength(1);
    const id = state.alerts.find((alert) => alert.expiry_id === entry.id)!.id;
    await syncDateReminderAlerts(state, new Date("2026-10-14T16:00:00Z"));
    expect(state.alerts.find((alert) => alert.id === id)).toMatchObject({
      days_left: 4,
    });
    expect(
      dateReminderMessage(
        createReadModel(completeReadModelProjectors())(state, actor(state)),
        state.alerts.find((alert) => alert.id === id)!,
        "en",
        new Date("2026-10-14T16:00:00Z"),
      ),
    ).toContain("expires in 4 days");
  });
  it("foreign or stopped dates never generate reminders", async () => {
    const state = initialState();
    state.expiry = [];
    const context = actor(state, { branch: "Branch 1" });
    const product = state.products[0];
    const entry = addTrackedDate(state, context, {
      product_code: product.code,
      branch: "Branch 1",
      date_type: "expiry",
      date: "2026-10-17",
    });
    state.expiry.push({ ...entry, id: "foreign", company_id: "foreign" });
    state.products.find(
      (item) =>
        item.code === product.code &&
        item.company_id === state.config.company.seed_key,
    )!.date_tracking = false;
    await syncDateReminderAlerts(state, now);
    expect(
      state.alerts.some(
        (alert) =>
          alert.expiry_id === entry.id || alert.expiry_id === "foreign",
      ),
    ).toBe(false);
  });
});

describe("C6 recent dates, invoice lots and scoped clearance", () => {
  it("keeps receipt supplier identity and evidence isolated when another company has the same supplier name", () => {
    const state = lotState();
    const suppliers = structuredClone([...supplierRecords(state)]);
    state.suppliers = suppliers;
    const baseline = structuredClone(receiptLots(state));
    const ownSupplier = suppliers.find(
      (supplier) =>
        supplier.company_id === state.config.company.seed_key &&
        supplier.name === state.invoices![0].supplier,
    )!;
    suppliers.unshift({
      ...structuredClone(ownSupplier),
      company_id: "foreign-company",
      id: "foreign-supplier-secret-id",
      phone: "FOREIGN-SECRET-PHONE",
      email: "foreign-secret@example.invalid",
      notes: "FOREIGN-SECRET-NOTES",
    });
    const lots = receiptLots(state);
    expect(lots).toEqual(baseline);
    expect(lots[0].supplier_id).toBe(ownSupplier.id);
    recordInvoiceReceiptLots(state, state.invoices![0]);
    expect(state.receipt_lots).toEqual(baseline);
    expect(JSON.stringify(lots)).not.toContain("foreign");
    expect(JSON.stringify(state.receipt_lots)).not.toContain("FOREIGN-SECRET");
  });
  it("shares only recent same-product/supplier date evidence with a one-branch worker", () => {
    const state = lotState();
    state.expiry = [];
    const company = state.config.company.seed_key;
    const product = state.products.find((item) => item.code === "0003")!;
    const record = {
      id: "recent",
      company_id: company,
      branch: "Branch 2",
      product_code: product.code,
      status: "active" as const,
      date_type: "expiry" as const,
      date: "2026-11-04",
      expires_in_days: 23,
      created_at: "2026-10-11T15:00:00Z",
      supplier: "Fresh Valley Foods",
      lot_number: "LOT-B",
      quantity: "99",
    };
    state.expiry.push(
      record,
      { ...record, id: "old", created_at: "2026-10-01T15:00:00Z" },
      { ...record, id: "same-location", branch: "Branch 1" },
      {
        ...record,
        id: "different-supplier",
        supplier: "Golden Grain Wholesale",
      },
      { ...record, id: "foreign", company_id: "other" },
    );
    const worker = actor(state, {
      role: "floor_worker",
      branch: "Branch 1",
      allowed_branches: ["Branch 1"],
    });
    const results = reusableOtherLocationDates(
      state,
      worker,
      {
        product_code: product.code,
        supplier: "Fresh Valley Foods",
        branch: "Branch 1",
      },
      now,
    );
    expect(results).toEqual([
      {
        id: "recent",
        branch: "Branch 2",
        date_type: "expiry",
        date: "2026-11-04",
        lot_number: "LOT-B",
        entered_date: "2026-10-11",
      },
    ]);
    expect(JSON.stringify(results)).not.toContain("quantity");
    expect(JSON.stringify(results)).not.toContain("invoice");
    expect(JSON.stringify(results)).not.toContain("cost");
    expect(() =>
      reusableOtherLocationDates(
        state,
        actor(state, {
          role: "cashier",
          branch: "Branch 1",
          allowed_branches: ["Branch 1"],
        }),
        {
          product_code: product.code,
          supplier: "Fresh Valley Foods",
          branch: "Branch 1",
        },
        now,
      ),
    ).toThrow("capability");
  });
  it("groups identical expiry receipts at one store with exact immutable source costs and idempotence", () => {
    const state = lotState();
    const first = state.invoices![0];
    const second = datedInvoice(state, "LOT-2", "Branch 1", "2", "1.5500");
    second.received_at = "2026-10-12T15:00:00Z";
    state.invoices!.push(second);
    const beforeMoney = structuredClone({
      ledger: state.ledger,
      stock: state.stock,
      movements: state.stock_movements,
    });
    recordInvoiceReceiptLots(state, first);
    recordInvoiceReceiptLots(state, second);
    const before = structuredClone(state.receipt_lots);
    recordInvoiceReceiptLots(state, first);
    recordInvoiceReceiptLots(state, second);
    expect(state.receipt_lots).toEqual(before);
    expect(receiptLots(state)).toHaveLength(1);
    expect(receiptLots(state)[0]).toMatchObject({
      received_quantity: "14",
      unit_cost: "1.5500",
      branch: "Branch 1",
    });
    expect(
      receiptLots(state)[0].source_receipts.map((item) => item.unit_cost),
    ).toEqual(["1.8000", "1.5500"]);
    expect({
      ledger: state.ledger,
      stock: state.stock,
      movements: state.stock_movements,
    }).toEqual(beforeMoney);
    state.invoices!.push(datedInvoice(state, "LOT-3", "Branch 2"));
    expect(receiptLots(state)).toHaveLength(2);
    expect(state.products.filter((item) => item.code === "0003")).toHaveLength(
      1,
    );
  });
  it("ignores drafts/refused receipts and follows invoice relocation without rewriting original receipts", () => {
    const state = lotState();
    const original = structuredClone(state.invoices![0]);
    state.invoices!.push(
      { ...datedInvoice(state, "DRAFT"), status: "draft" },
      {
        ...datedInvoice(state, "REFUSED"),
        lines: [
          { ...datedInvoice(state, "REFUSED").lines[0], refused_units: 12 },
        ],
      },
    );
    expect(receiptLots(state)).toHaveLength(1);
    state.invoice_location_corrections = [
      {
        id: "move",
        company_id: state.config.company.seed_key,
        invoice_id: original.id,
        from_branch: "Branch 1",
        to_branch: "Branch 2",
        reason: "Test relocation",
        by: "Demo Supervisor",
        at: now.toISOString(),
        outstanding_amount: "0.00",
        currency: state.config.company.currency,
        allocations: [],
        receipt_ids: [],
        approval_ids: [],
        ledger_out_id: "out",
        ledger_in_id: "in",
      },
    ];
    expect(receiptLots(state)[0].branch).toBe("Branch 2");
    expect(state.invoices![0]).toEqual(original);
  });
  it("cashier receives only the own-store clearance plus expiry, while regular prices/offers stay intact", () => {
    const state = lotState();
    const lot = receiptLots(state)[0];
    const price = effectivePrice(state, "0003", "Branch 1");
    const normalOffer = effectiveOffer(state, "0003", "Branch 1");
    const offer = setLotClearance(state, actor(state), lot.id, "2.49", now);
    const cashier = actor(state, {
      role: "cashier",
      branch: "Branch 1",
      allowed_branches: ["Branch 1"],
    });
    expect(scopedClearanceOffers(state, cashier, "0003", now)).toEqual([offer]);
    expect(effectiveClearanceOffers(state, "0003", "Branch 2", now)).toEqual(
      [],
    );
    expect(() =>
      scopedClearanceOffers(
        state,
        actorAtLocation(state, cashier, "Branch 2"),
        "0003",
        now,
      ),
    ).toThrow("location");
    expect(receiptLotsForProduct(state, cashier, "0003")).toEqual([]);
    expect(effectivePrice(state, "0003", "Branch 1")).toBe(price);
    expect(effectiveOffer(state, "0003", "Branch 1")).toEqual(normalOffer);
    const metadata = lookupLastReceipt(state, cashier, "0003");
    expect(metadata).toEqual({ date: "2026-10-12" });
    expect(() =>
      scopedClearanceOffers(state, foreignActor(state), "0003", now),
    ).toThrow("company");
  });
  it("clearance is explicit, idempotent, one per product/store, and independent of regular repricing", () => {
    const state = lotState();
    const lot = receiptLots(state)[0];
    const context = actor(state);
    const offer = setLotClearance(state, context, lot.id, "2.49", now);
    const after = structuredClone(state);
    expect(setLotClearance(state, context, lot.id, "2.49", now).id).toBe(
      offer.id,
    );
    expect(state).toEqual(after);
    const replacement = setLotClearance(state, context, lot.id, "1.99", now);
    expect(offer.status).toBe("stopped");
    expect(replacement.id).not.toBe(offer.id);
    state.products.find((item) => item.code === "0003")!.selling_price = "3.99";
    reconcileOffers(state, context, "0003");
    expect(replacement.status).toBe("active");
    const before = structuredClone(state);
    expect(() =>
      setLotClearance(
        state,
        actor(state, {
          role: "floor_worker",
          branch: "Branch 1",
          allowed_branches: ["Branch 1"],
        }),
        lot.id,
        "1.49",
        now,
      ),
    ).toThrow("capability");
    expect(() =>
      setLotClearance(state, foreignActor(state), lot.id, "1.49", now),
    ).toThrow("company");
    expect(() => setLotClearance(state, context, lot.id, "9.99", now)).toThrow(
      "price",
    );
    expect(state).toEqual(before);
    expect(
      effectiveClearanceOffers(
        state,
        "0003",
        "Branch 1",
        new Date("2026-11-05T16:00:00Z"),
      ),
    ).toEqual([]);
  });
  it.each(["2.49", "1.99"])(
    "hides clearance and blocks its Promo when regular repricing reaches %s without rewriting the offer",
    (regular) => {
      const state = lotState();
      const product = state.products.find((item) => item.code === "0003")!;
      product.selling_price = "3.99";
      delete product.branch_prices;
      const lot = receiptLots(state)[0];
      const context = actor(state);
      const offer = setLotClearance(state, context, lot.id, "2.49", now);
      const evidence = structuredClone(offer);
      const labelActor = actorAtLocation(state, context, "Branch 1");
      addClearanceLabelToWaitlist(
        state,
        product.code,
        lot.id,
        1,
        "Branch 1",
        labelActor,
      );
      const promo = state.templates.find(
        (template) => template.style === "promo",
      )!;
      expect(
        prepareLabelPrint(state, "Branch 1", promo, 1, labelActor).pages[0][0],
      ).toMatchObject({ label_lot_id: lot.id });
      product.selling_price = regular;
      reconcileOffers(state, context, product.code);
      expect(offer).toEqual(evidence);
      expect(effectiveClearanceOffers(state, product, "Branch 1", now)).toEqual(
        [],
      );
      expect(() =>
        prepareLabelPrint(state, "Branch 1", promo, 1, labelActor),
      ).toThrow("lot");
    },
  );
  it("prints a lot price only through a concrete-store Promo snapshot, separate from regular copies", () => {
    const state = lotState();
    const lot = receiptLots(state)[0];
    const context = actor(state);
    setLotClearance(state, context, lot.id, "2.49", now);
    const labelActor = actorAtLocation(state, context, "Branch 1");
    addLabelsToWaitlist(state, ["0003"], 1, "Branch 1", labelActor);
    addClearanceLabelToWaitlist(
      state,
      "0003",
      lot.id,
      2,
      "Branch 1",
      labelActor,
    );
    expect(state.label_waitlist).toHaveLength(2);
    expect(state.label_waitlist!.find((item) => item.lot_id)?.copies).toBe(2);
    const regular = state.templates.find(
      (item) => item.built_in === "regular",
    )!;
    const promo = state.templates.find((item) => item.built_in === "promo")!;
    expect(() =>
      prepareLabelPrint(state, "Branch 1", regular, 1, labelActor),
    ).toThrow("lot");
    const snapshot = prepareLabelPrint(state, "Branch 1", promo, 1, labelActor);
    expect(
      snapshot.products.filter(
        (product) => product.label_clearance_offer?.price === "2.49",
      ),
    ).toHaveLength(2);
    expect(snapshot.pages).toHaveLength(2);
    expect(snapshot.template).toMatchObject({ width: 210, height: 148.5 });
    const before = structuredClone(state);
    expect(() =>
      addClearanceLabelToWaitlist(
        state,
        "0003",
        lot.id,
        1,
        "Branch 2",
        actor(state, {
          role: "floor_worker",
          branch: "Branch 1",
          allowed_branches: ["Branch 1"],
        }),
      ),
    ).toThrow("location");
    expect(state).toEqual(before);
  });
});
