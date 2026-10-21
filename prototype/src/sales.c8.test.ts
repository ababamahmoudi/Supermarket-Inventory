import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import {
  evaluateFixtureSales,
  receiptCostFixture,
} from "./sale-reconciliation-test-fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { initialState } from "./e1-bootstrap";
import {
  activeSaleAt,
  changeSale,
  decideSaleCostAlert,
  editSaleRequest,
  endSale,
  hydrateSalesState,
  markNotificationRead,
  pendingSaleRequest,
  previewPriceChange,
  quickSalePrices,
  requestSale,
  resolveSaleRequest,
  saleCanonicalPrice,
  salePriceDisplay,
  saleRequestInput,
  savePriceChange,
  saveSalesSettings,
  sellingSaleBranches,
  userNotifications,
  withdrawSaleRequest,
  type ChangePriceInput,
  type SalesContext,
} from "./sales";
import { effectiveOffer, effectivePrice, regularPrice } from "./catalog";
import {
  applyApprovedPrice,
  approvalSnapshot,
  manualRegularApprovalPreview,
  resolveApproval,
} from "./approvals";
import { manualPrice } from "./manual-prices";
import { attachReversals, canReverse, reverseActivity } from "./history";
import { configuredBranches } from "./settings";
import {
  demoSaleCostInvoice,
  initializeInvoiceManualPriceDecisions,
  manualDecisionForLine,
  postInvoice,
  receiveShort,
} from "./invoice";
import {
  invoiceContentCorrectionPreview,
  correctPostedInvoice,
} from "./invoice-corrections";
import { productStoreCost } from "./product-costs";
import type { DemoState } from "./types";
const now = new Date("2026-10-12T16:00:00Z");
let state: DemoState;
let manager: SalesContext;
let worker: SalesContext;
let cashier: SalesContext;
const otherWorker = () =>
  authenticatedTestActor(state, "floor_worker", {
    user_id: "e1-test-other-worker",
    username: "another-worker",
    name_en: "Another fixture worker",
    locations: ["Branch 1"],
  });
const input = (patch: Partial<ChangePriceInput> = {}): ChangePriceInput => ({
  product_code: "0012",
  mode: "sale",
  scope: "current",
  price: "16.99",
  price_unit: "each",
  branches: ["Branch 1"],
  starts_on: "2026-10-12",
  last_day: "2026-10-25",
  accept_below_margin: false,
  below_cost_reason: "",
  add_labels: true,
  ...patch,
});
const product = () =>
  state.products.find(
    (entry) => entry.code === "0012" && entry.company_id === manager.company_id,
  )!;
const finance = () =>
  JSON.stringify({
    stock: state.stock,
    movements: state.stock_movements,
    ledger: state.ledger,
    returns: state.returns,
  });
function begin(patch: Partial<ChangePriceInput> = {}) {
  return savePriceChange(state, manager, input(patch), now).sales[0];
}
function costInvoice(cost = "14.2000") {
  state.invoice = demoSaleCostInvoice(state, worker, "Branch 1");
  state.invoice.lines[0].unit_cost_before_tax = cost;
  state.invoice.lines[0].case_cost_before_tax = new Decimal(cost)
    .times(3)
    .toFixed(4);
  state.invoice.lines[0].line_total = new Decimal(cost).times(3).toFixed(2);
  state.invoice.lines[0].line_tax = new Decimal(
    state.invoice.lines[0].line_total,
  )
    .times("0.13")
    .toFixed(2);
  state.invoice.subtotal = state.invoice.lines[0].line_total;
  state.invoice.tax = state.invoice.lines[0].line_tax;
  state.invoice.final_total = new Decimal(state.invoice.subtotal)
    .plus(state.invoice.tax)
    .toFixed(2);
  state.invoice.file_name = "fictional-hw-5012.svg";
  state.invoice.file_data = "data:image/svg+xml,retained-fixture";
  state.invoice.receiving_employee = worker.actor;
  state.invoice.supplier_confirmed = true;
  state.invoice.lines[0].review_confirmed = true;
  state.invoice.lines[0].date_confirmed = true;
  state.invoice.lower_price_answers = { same_expiry: "no_previous_stock" };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  state = initialState();
  manager = authenticatedTestActor(state, "manager", {
    username: "supervisor",
    name_en: "Demo Supervisor",
    selection: { kind: "location", location_id: "Branch 1" },
  });
  worker = authenticatedTestActor(state, "floor_worker", {
    username: "floorworker",
    name_en: "Demo Floor Worker",
    locations: ["Branch 1"],
  });
  cashier = authenticatedTestActor(state, "cashier", {
    username: "cashier",
    name_en: "Demo Cashier",
    locations: ["Branch 1"],
  });
  state.sales = [];
  state.sale_requests = [];
  state.sale_events = [];
  state.sale_delivery_holds = [];
  state.notifications = [];
  state.sale_label_effects = [];
  state.label_waitlist = [];
});
afterEach(() => vi.useRealTimers());

describe("C8 scoped independent sale pricing", () => {
  it("offers configured downward quick picks without float rounding", async () => {
    expect(quickSalePrices("20.99", state).map((item) => item.price)).toEqual([
      "18.49",
      "17.49",
      "16.49",
      "15.49",
    ]);
    state.config.sales!.round_down_endings = ["0.29"];
    expect(quickSalePrices("20.99", state)[0].price).toBe("18.29");
  });
  it("starts a real sale overlay, leaves regular provenance and finance untouched, and queues Promo once", async () => {
    const before = finance(),
      baseline = structuredClone(product());
    const sale = begin();
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("16.99");
    expect(regularPrice(state, "0012", "Branch 1")).toBe("20.99");
    expect(effectivePrice(state, "0012", "Branch 2", now)).toBe("20.99");
    expect(product()).toEqual(baseline);
    expect(finance()).toBe(before);
    expect(state.label_waitlist).toHaveLength(1);
    expect(state.label_waitlist![0].preferred_template).toBe("promo");
    expect(state.sale_events![0].sale_id).toBe(sale.id);
    const snapshot = JSON.stringify(state);
    expect(await evaluateFixtureSales(state, now)).toBe(false);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it("checks every target's own regular price atomically", async () => {
    product().branch_prices = { "Branch 2": "15.99" };
    const before = cloneWithAuthority(state);
    const proposal = input({
      scope: "all",
      branches: sellingSaleBranches(state),
    });
    expect(
      previewPriceChange(state, manager, proposal, now).issues,
    ).toContainEqual({
      code: "sale_price_not_lower",
      field: "price",
      branch: "Branch 2",
      regular_price: "15.99",
    });
    expect(() => savePriceChange(state, manager, proposal, now)).toThrow(
      "sale_price_not_lower",
    );
    expect(state).toEqual(before);
  });
  it.each(["Warehouse", "all", "foreign-store"])(
    "forbids a sale target %s without writes",
    async (branch) => {
      const before = cloneWithAuthority(state);
      expect(() => begin({ branches: [branch] })).toThrow("stores");
      expect(state).toEqual(before);
    },
  );
  it("excludes inactive or non-selling stores and rejects an unauthorized company or role", async () => {
    state.config.branches.find((entry) => entry.id === "Branch 2")!.active =
      false;
    state.config.branches.find(
      (entry) => entry.id === "Branch 3",
    )!.sells_to_customers = false;
    expect(sellingSaleBranches(state)).toEqual(["Branch 1"]);
    const before = cloneWithAuthority(state);
    for (const ctx of [
      worker,
      cashier,
      { ...manager, company_id: "another-company" },
    ])
      expect(() => savePriceChange(state, ctx, input(), now)).toThrow();
    expect(state).toEqual(before);
  });
  it("enforces positive cent price, strict reduction and ordered valid inclusive dates", async () => {
    for (const patch of [
      { price: "0" },
      { price: "16.999" },
      { price: "20.99" },
      { starts_on: "2026-02-30" },
      { last_day: "2026-10-11" },
      { starts_on: "2026-10-26", last_day: "2026-10-25" },
    ]) {
      const before = cloneWithAuthority(state);
      expect(() => begin(patch)).toThrow();
      expect(state).toEqual(before);
    }
  });
  it("requires an explicit below-margin choice and separately a below-cost reason", async () => {
    const before = cloneWithAuthority(state);
    expect(() => begin({ price: "14.99" })).toThrow("below_margin");
    expect(state).toEqual(before);
    expect(() => begin({ price: "11.99", accept_below_margin: true })).toThrow(
      "below_cost_reason",
    );
    expect(state).toEqual(before);
    expect(
      begin({
        price: "11.99",
        accept_below_margin: true,
        below_cost_reason: "Approved damaged packaging sale",
      }).sale_price,
    ).toBe("11.99");
  });
  it("retains exact entered weighed cents and derives secondary without a lb rounding roundtrip", async () => {
    const weighed = state.products.find((entry) => entry.code === "0016")!;
    weighed.selling_price = "20.99";
    weighed.last_cost_before_tax = "1.0000";
    state.config.weighed_items!.main_display_unit = "kg";
    const sale = begin({
      product_code: weighed.code,
      price: "16.99",
      price_unit: "kg",
    });
    expect(sale.sale_price).toBe("16.99");
    expect(sale.price_unit).toBe("kg");
    expect(salePriceDisplay(sale, state.config).main).toEqual({
      amount: "16.99",
      unit: "kg",
    });
    expect(
      new Decimal(saleCanonicalPrice(sale, state.config))
        .times("2.20462")
        .toFixed(2),
    ).toBe("16.99");
    expect(effectivePrice(state, weighed, "Branch 1", now)).toBe(
      saleCanonicalPrice(sale, state.config),
    );
    expect(regularPrice(state, weighed, "Branch 1")).toBe("20.99");
  });
  it("keeps mapped multi-buy evidence active while pausing it only at the sale store", async () => {
    const old = structuredClone(
      state.offers.filter((entry) => entry.product_code === "0006"),
    );
    expect(effectiveOffer(state, "0006", "Branch 1", now)).not.toBeNull();
    const sale = begin({
      product_code: "0006",
      price: "1.49",
      accept_below_margin: true,
      below_cost_reason: "Approved clearance sale",
    });
    expect(effectiveOffer(state, "0006", "Branch 1", now)).toBeNull();
    expect(effectiveOffer(state, "0006", "Branch 2", now)).not.toBeNull();
    expect(
      state.offers.filter((entry) => entry.product_code === "0006"),
    ).toEqual(old);
    endSale(state, manager, sale.id, { expected_revision: sale.revision }, now);
    expect(effectiveOffer(state, "0006", "Branch 1", now)).not.toBeNull();
  });
  it("does not treat a sale matching a mapping as a multi-buy offer", async () => {
    begin({
      product_code: "0006",
      price: "0.99",
      accept_below_margin: true,
      below_cost_reason: "Supervisor price test",
    });
    expect(effectiveOffer(state, "0006", "Branch 1", now)).toBeNull();
  });
  it("does not show another company's sale or request even when product IDs match", async () => {
    const sale = begin();
    state.sales![0].company_id = "another-company";
    state.sale_requests = [
      {
        id: "foreign",
        company_id: "another-company",
        branch: "Branch 1",
        branch_id: "Branch 1",
        product_code: "0012",
        requested_price: "0.01",
        price_unit: "each",
        starts_on: "2026-10-12",
        last_day: null,
        requester: "Foreign",
        requester_username: "other",
        requested_at: now.toISOString(),
        revision: 1,
        status: "pending",
        add_promo_labels: false,
      },
    ];
    expect(activeSaleAt(state, "0012", "Branch 1", now)).toBeNull();
    expect(pendingSaleRequest(state, "0012", "Branch 1", now)).toBeNull();
    const before = cloneWithAuthority(state);
    expect(() =>
      endSale(
        state,
        manager,
        sale.id,
        { expected_revision: sale.revision },
        now,
      ),
    ).toThrow("stores");
    expect(state).toEqual(before);
  });
});

describe("C8 local calendar lifecycle and version guards", () => {
  it("schedules without a live price or labels, starts on local morning and queues once", async () => {
    const sale = begin({ starts_on: "2026-10-13", last_day: "2026-10-19" });
    expect(sale.status).toBe("scheduled");
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("20.99");
    expect(state.label_waitlist).toHaveLength(0);
    expect(
      await evaluateFixtureSales(state, new Date("2026-10-13T03:59:59Z")),
    ).toBe(false);
    expect(
      await evaluateFixtureSales(state, new Date("2026-10-13T04:00:00Z")),
    ).toBe(true);
    expect(
      effectivePrice(
        state,
        "0012",
        "Branch 1",
        new Date("2026-10-13T04:00:00Z"),
      ),
    ).toBe("16.99");
    const events = state.sale_events!.length;
    await evaluateFixtureSales(state, new Date("2026-10-13T16:00:00Z"));
    expect(state.sale_events).toHaveLength(events);
    expect(state.label_waitlist).toHaveLength(1);
  });
  it("ends after inclusive last day through Toronto's 25-hour DST day", async () => {
    begin({ starts_on: "2026-11-01", last_day: "2026-11-01" });
    await evaluateFixtureSales(state, new Date("2026-11-01T04:00:00Z"));
    expect(
      effectivePrice(
        state,
        "0012",
        "Branch 1",
        new Date("2026-11-02T04:59:59Z"),
      ),
    ).toBe("16.99");
    await evaluateFixtureSales(state, new Date("2026-11-02T05:00:00Z"));
    expect(state.sales![0].ended_at).toBe("2026-11-02T05:00:00.000Z");
    expect(
      effectivePrice(
        state,
        "0012",
        "Branch 1",
        new Date("2026-11-02T05:00:00Z"),
      ),
    ).toBe("20.99");
    expect(state.label_waitlist![0].preferred_template).toBe("regular");
  });
  it("evaluates store-local days independently and does not emit retroactive Promo after a missed interval", async () => {
    state.config.branches.find((entry) => entry.id === "Branch 2")!.timezone =
      "Asia/Tokyo";
    begin({
      scope: "selected",
      branches: ["Branch 1", "Branch 2"],
      starts_on: "2026-10-12",
      last_day: "2026-10-13",
    });
    await evaluateFixtureSales(state, new Date("2026-10-13T16:00:00Z"));
    expect(
      state.sales!.find((entry) => entry.branch === "Branch 1")!.status,
    ).toBe("active");
    expect(
      state.sales!.find((entry) => entry.branch === "Branch 2")!.status,
    ).toBe("ended");
    state.sales = [];
    state.sale_events = [];
    state.label_waitlist = [];
    begin({ starts_on: "2026-10-13", last_day: "2026-10-13" });
    await evaluateFixtureSales(state, new Date("2026-10-14T16:00:00Z"));
    expect(state.sale_events!.map((entry) => entry.kind)).toEqual([
      "scheduled",
      "ended",
    ]);
    expect(
      state.label_waitlist!.every(
        (entry) => entry.preferred_template === "regular",
      ),
    ).toBe(true);
  });
  it("restores today's newly approved regular price and defers Regular labels while the sale runs", async () => {
    const sale = begin();
    const promo = structuredClone(state.label_waitlist![0]);
    savePriceChange(
      state,
      manager,
      input({ mode: "regular", price: "24.99", add_labels: true }),
      now,
    );
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("16.99");
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
    expect(manualPrice(state, product(), "Branch 1")?.price).toBe("24.99");
    expect(state.label_waitlist![0]).toEqual(promo);
    endSale(state, manager, sale.id, { expected_revision: sale.revision }, now);
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("24.99");
    expect(state.label_waitlist![0].preferred_template).toBe("regular");
  });
  it("blocks inclusive overlaps but allows the day after, and rejects stale revisions atomically", async () => {
    const sale = begin({ last_day: "2026-10-19" });
    let before = cloneWithAuthority(state);
    expect(() =>
      begin({ starts_on: "2026-10-19", last_day: "2026-10-25" }),
    ).toThrow("sale_overlap");
    expect(state).toEqual(before);
    expect(
      begin({ starts_on: "2026-10-20", last_day: "2026-10-25" }).status,
    ).toBe("scheduled");
    before = cloneWithAuthority(state);
    expect(() =>
      changeSale(
        state,
        manager,
        sale.id,
        input({ price: "17.99", expected_revision: sale.revision - 1 }),
        now,
      ),
    ).toThrow("revision");
    expect(state).toEqual(before);
  });
  it("changes reviewed scope without deleting an old store's sale evidence", async () => {
    const sale = begin({
      scope: "selected",
      branches: ["Branch 1", "Branch 2"],
    });
    changeSale(
      state,
      manager,
      sale.id,
      input({
        price: "17.99",
        scope: "selected",
        branches: ["Branch 1", "Branch 3"],
        expected_revision: sale.revision,
      }),
      now,
    );
    expect(
      state.sales!.find((entry) => entry.branch === "Branch 2")!.status,
    ).toBe("ended");
    expect(effectivePrice(state, "0012", "Branch 2", now)).toBe("20.99");
    expect(effectivePrice(state, "0012", "Branch 3", now)).toBe("17.99");
    expect(
      state.sale_events!.some(
        (entry) => entry.branch === "Branch 2" && entry.kind === "ended",
      ),
    ).toBe(true);
  });
  it("reminds every configured interval once, Keep it resets the interval, and a printed queue cannot be re-added by retry", async () => {
    const sale = begin({ last_day: null });
    state.label_waitlist = [];
    await evaluateFixtureSales(state, new Date("2026-10-26T16:00:00Z"));
    const reminder = state.alerts.find(
      (entry) => entry.type === "sale_no_end_reminder",
    )!;
    expect(reminder.sale_id).toBe(sale.id);
    expect(state.notifications).toHaveLength(1);
    await evaluateFixtureSales(state, new Date("2026-10-26T16:00:00Z"));
    expect(state.notifications).toHaveLength(1);
    expect(state.label_waitlist).toHaveLength(0);
    decideSaleCostAlert(
      state,
      manager,
      reminder.id,
      { decision: "keep", expected_sale_revision: state.sales![0].revision },
      new Date("2026-10-27T16:00:00Z"),
    );
    await evaluateFixtureSales(state, new Date("2026-11-09T16:00:00Z"));
    expect(state.notifications).toHaveLength(1);
    await evaluateFixtureSales(state, new Date("2026-11-10T16:00:00Z"));
    expect(state.notifications).toHaveLength(2);
  });
  it("supports configured positive day counts beyond a year without an invented cap", async () => {
    saveSalesSettings(state, manager, {
      ...state.config.sales!,
      default_length_days: 500,
      open_ended_reminder_days: 600,
    });
    expect(state.config.sales!.default_length_days).toBe(500);
    expect(() =>
      saveSalesSettings(state, manager, {
        ...state.config.sales!,
        default_length_days: 1.5,
      }),
    ).toThrow();
  });
});

describe("C8 private worker requests and real decisions", () => {
  it("submits the below-margin Oil request with optional Why and no private preview data", async () => {
    const proposal = input({ product_code: "0008", price: "7.99", why: "" });
    const before = finance();
    const preview = previewPriceChange(state, worker, proposal, now);
    expect(preview.can_save).toBe(true);
    expect(preview.effects[0]).toMatchObject({
      cost: null,
      margin: null,
      minimum_margin: null,
      below_cost: false,
      below_minimum_margin: false,
    });
    const request = requestSale(state, worker, proposal, now);
    expect(request.why).toBeUndefined();
    expect(request.status).toBe("pending");
    expect(effectivePrice(state, "0008", "Branch 1", now)).toBe("9.49");
    expect(pendingSaleRequest(state, "0008", "Branch 1", now)?.id).toBe(
      request.id,
    );
    expect(finance()).toBe(before);
    expect(userNotifications(state, manager)[0].kind).toBe(
      "sale_request_submitted",
    );
  });
  it("enforces one pending request, own requester revision, own store, and cashier read-only", async () => {
    const request = requestSale(state, worker, input(), now);
    const before = cloneWithAuthority(state);
    expect(() => requestSale(state, worker, input(), now)).toThrow(
      "request_exists",
    );
    expect(() =>
      requestSale(state, cashier, input({ product_code: "0008" }), now),
    ).toThrow("permission");
    expect(() =>
      editSaleRequest(
        state,
        otherWorker(),
        request.id,
        input({ price: "17.99" }),
        request.revision,
        now,
      ),
    ).toThrow("permission");
    expect(() =>
      editSaleRequest(
        state,
        worker,
        request.id,
        input({ branches: ["Branch 2"] }),
        request.revision,
        now,
      ),
    ).toThrow("stores");
    expect(state).toEqual(before);
    editSaleRequest(
      state,
      worker,
      request.id,
      input({ price: "17.99", why: "Slow seller" }),
      request.revision,
      now,
    );
    expect(state.sale_requests![0].requested_price).toBe("17.99");
    withdrawSaleRequest(
      state,
      worker,
      request.id,
      state.sale_requests![0].revision,
      now,
    );
    expect(pendingSaleRequest(state, "0012", "Branch 1", now)).toBeNull();
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("20.99");
  });
  it("bare approval cannot bypass the Supervisor's margin acknowledgement and explicit approval is atomic/idempotent", async () => {
    const request = requestSale(
      state,
      worker,
      input({ product_code: "0008", price: "7.99" }),
      now,
    );
    const before = cloneWithAuthority(state);
    expect(() =>
      resolveSaleRequest(
        state,
        manager,
        request.id,
        "approve",
        { expected_revision: request.revision },
        now,
      ),
    ).toThrow("below_margin");
    expect(state).toEqual(before);
    resolveSaleRequest(
      state,
      manager,
      request.id,
      "approve",
      {
        expected_revision: request.revision,
        input: {
          ...saleRequestInput(request, state, now),
          accept_below_margin: true,
        },
      },
      now,
    );
    expect(effectivePrice(state, "0008", "Branch 1", now)).toBe("7.99");
    expect(userNotifications(state, worker).map((entry) => entry.kind)).toEqual(
      ["sale_request_approved"],
    );
    const snapshot = JSON.stringify(state);
    resolveSaleRequest(
      state,
      manager,
      request.id,
      "approve",
      { expected_revision: request.revision },
      now,
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it("requires rejection reason, records it and sends only the original requester a notification", async () => {
    const request = requestSale(state, worker, input(), now);
    const before = cloneWithAuthority(state);
    expect(() =>
      resolveSaleRequest(
        state,
        manager,
        request.id,
        "reject",
        { expected_revision: request.revision },
        now,
      ),
    ).toThrow("reason");
    expect(state).toEqual(before);
    resolveSaleRequest(
      state,
      manager,
      request.id,
      "reject",
      {
        expected_revision: request.revision,
        reason: "Stock already sells well",
      },
      now,
    );
    expect(userNotifications(state, worker)[0].reason).toBe(
      "Stock already sells well",
    );
    expect(userNotifications(state, otherWorker())).toEqual([]);
    expect(() =>
      markNotificationRead(
        state,
        otherWorker(),
        state.notifications!.at(-1)!.id,
        now,
      ),
    ).toThrow("permission");
  });
  it("approves after the requested start at approval, keeping the last day, and expires elapsed requests once", async () => {
    const request = requestSale(
      state,
      worker,
      input({ starts_on: "2026-10-12", last_day: "2026-10-14" }),
      now,
    );
    const later = new Date("2026-10-13T16:00:00Z");
    const adjusted = saleRequestInput(request, state, later);
    expect(adjusted.starts_on).toBe("2026-10-13");
    resolveSaleRequest(
      state,
      manager,
      request.id,
      "approve",
      { expected_revision: request.revision, input: adjusted },
      later,
    );
    expect(state.sales![0]).toMatchObject({
      starts_on: "2026-10-13",
      last_day: "2026-10-14",
      status: "active",
    });
    state.sales = [];
    state.sale_requests = [];
    state.notifications = [];
    const expires = requestSale(
      state,
      worker,
      input({ last_day: "2026-10-12" }),
      now,
    );
    await evaluateFixtureSales(state, new Date("2026-10-13T16:00:00Z"));
    expect(state.sale_requests![0].status).toBe("expired");
    expect(userNotifications(state, worker)[0].kind).toBe(
      "sale_request_expired",
    );
    const snapshot = JSON.stringify(state);
    await evaluateFixtureSales(state, new Date("2026-10-13T16:00:00Z"));
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(() =>
      resolveSaleRequest(
        state,
        manager,
        expires.id,
        "approve",
        { expected_revision: expires.revision },
        later,
      ),
    ).toThrow("request_decided");
  });
});

describe("C8 accepted regular invoice cost and held-delivery evidence", () => {
  it("has no live alert for an unposted draft, posts the actual old/new cost and sale margin once", async () => {
    const sale = begin();
    costInvoice();
    expect(
      state.alerts.some((entry) => entry.type === "sale_cost_increase"),
    ).toBe(false);
    expect(postInvoice(state, worker)).toBe(true);
    const alert = state.alerts.find(
      (entry) => entry.type === "sale_cost_increase",
    )!;
    expect(alert).toMatchObject({
      previous_cost: "12.6000",
      new_cost: "14.2000",
      sale_price: "16.99",
      sale_id: sale.id,
      regular_price_before: "20.99",
      proposed_regular_price: "23.49",
      invoice_id: "demo-c8-hw-5012",
      branch: "Branch 1",
    });
    expect(new Decimal(alert.prior_margin!).times(100).toFixed(0)).toBe("26");
    expect(new Decimal(alert.new_margin!).times(100).toFixed(0)).toBe("16");
    const proposal = state.approvals.find(
      (entry) =>
        entry.source_invoice_id === state.invoice.id &&
        entry.product_code === "0012",
    )!;
    expect(proposal.applies_after_sale).toBe(true);
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("16.99");
    const snapshot = JSON.stringify(state);
    expect(postInvoice(state, worker)).toBe(false);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it("produces the distinct lower/equal-regular alert without silently ending a kept sale", async () => {
    const sale = begin();
    costInvoice("9.0000");
    postInvoice(state, worker);
    const alert = state.alerts.find(
      (entry) => entry.type === "sale_regular_not_above_sale",
    )!;
    expect(alert).toBeDefined();
    expect(
      state.alerts.some((entry) => entry.type === "sale_cost_increase"),
    ).toBe(false);
    const before = finance();
    decideSaleCostAlert(
      state,
      manager,
      alert.id,
      { decision: "keep", expected_sale_revision: sale.revision },
      now,
    );
    expect(state.sales![0].status).toBe("active");
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("16.99");
    expect(finance()).toBe(before);
  });
  it("a hold is an actual linked instruction and its release waits until the first local day after changed/early end without stock or money writes", async () => {
    const sale = begin();
    costInvoice();
    postInvoice(state, worker);
    const alert = state.alerts.find(
      (entry) => entry.type === "sale_cost_increase",
    )!;
    const before = finance();
    decideSaleCostAlert(
      state,
      manager,
      alert.id,
      {
        decision: "keep",
        expected_sale_revision: sale.revision,
        hold_delivery: true,
      },
      now,
    );
    const hold = state.sale_delivery_holds![0];
    const note = state.notes.find((entry) => entry.id === hold.note_id)!;
    expect(note.text).toContain("HW-5012");
    expect(note.text).toContain("Stainless Steel Pot");
    expect(hold).toMatchObject({
      branch: "Branch 1",
      invoice_id: state.invoice.id,
      sale_id: sale.id,
      product_code: "0012",
    });
    expect(finance()).toBe(before);
    changeSale(
      state,
      manager,
      sale.id,
      input({
        price: "18.99",
        last_day: "2026-10-30",
        expected_revision: sale.revision,
      }),
      now,
    );
    await evaluateFixtureSales(state, now);
    expect(state.sale_delivery_holds![0].planned_last_day).toBe("2026-10-30");
    const live = state.sales![0];
    endSale(state, manager, live.id, { expected_revision: live.revision }, now);
    expect(state.sales![0].release_reminder_on).toBe("2026-10-13");
    expect(
      state.alerts.filter((entry) => entry.type === "sale_delivery_release"),
    ).toHaveLength(0);
    expect(
      state.notifications!.filter(
        (entry) => entry.kind === "sale_delivery_release",
      ),
    ).toHaveLength(0);
    expect(state.sale_delivery_holds![0].released_reminder_at).toBeUndefined();
    const todaySnapshot = JSON.stringify(state);
    expect(
      await evaluateFixtureSales(state, new Date("2026-10-13T03:59:59Z")),
    ).toBe(false);
    expect(JSON.stringify(state)).toBe(todaySnapshot);
    expect(
      await evaluateFixtureSales(state, new Date("2026-10-13T04:00:00Z")),
    ).toBe(true);
    expect(
      state.alerts.filter((entry) => entry.type === "sale_delivery_release"),
    ).toHaveLength(1);
    expect(state.sale_delivery_holds![0].released_reminder_at).toBe(
      "2026-10-13T04:00:00.000Z",
    );
    expect(
      state.notifications!.filter(
        (entry) => entry.kind === "sale_delivery_release",
      ),
    ).toHaveLength(1);
    const snapshot = JSON.stringify(state);
    await evaluateFixtureSales(state, new Date("2026-10-13T16:00:00Z"));
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(finance()).toBe(before);
  });
  it.each(["automatic", "explicit after the last day"])(
    "releases a held delivery on the first day after the inclusive last day through Toronto's 25-hour day (%s)",
    async (ending) => {
      const sale = begin({
        starts_on: "2026-11-01",
        last_day: "2026-11-01",
      });
      const start = new Date("2026-11-01T04:00:00Z");
      vi.setSystemTime(start);
      await evaluateFixtureSales(state, start);
      costInvoice();
      postInvoice(state, worker);
      const alert = state.alerts.find(
        (entry) => entry.type === "sale_cost_increase",
      )!;
      decideSaleCostAlert(
        state,
        manager,
        alert.id,
        {
          decision: "keep",
          expected_sale_revision: state.sales![0].revision,
          hold_delivery: true,
        },
        start,
      );
      const before = finance();
      const beforeMidnight = JSON.stringify(state);
      expect(
        await evaluateFixtureSales(state, new Date("2026-11-02T04:59:59Z")),
      ).toBe(false);
      expect(JSON.stringify(state)).toBe(beforeMidnight);
      const midnight = new Date("2026-11-02T05:00:00Z");
      if (ending === "automatic") await evaluateFixtureSales(state, midnight);
      else
        endSale(
          state,
          manager,
          sale.id,
          { expected_revision: state.sales![0].revision },
          midnight,
        );
      expect(state.sales![0]).toMatchObject({
        status: "ended",
        release_reminder_on: "2026-11-02",
      });
      expect(
        state.alerts.filter((entry) => entry.type === "sale_delivery_release"),
      ).toHaveLength(1);
      expect(state.sale_delivery_holds![0].released_reminder_at).toBe(
        midnight.toISOString(),
      );
      expect(finance()).toBe(before);
      const snapshot = JSON.stringify(state);
      await evaluateFixtureSales(state, new Date("2026-11-02T17:00:00Z"));
      expect(JSON.stringify(state)).toBe(snapshot);
    },
  );
  it("derives an earlier saved hold's next local day without trusting the editable ending reason", async () => {
    const sale = begin();
    costInvoice();
    postInvoice(state, worker);
    const alert = state.alerts.find(
      (entry) => entry.type === "sale_cost_increase",
    )!;
    decideSaleCostAlert(
      state,
      manager,
      alert.id,
      {
        decision: "keep",
        expected_sale_revision: sale.revision,
        hold_delivery: true,
      },
      now,
    );
    const before = finance();
    endSale(
      state,
      manager,
      sale.id,
      {
        expected_revision: state.sales![0].revision,
        reason: "Last day passed",
      },
      now,
    );
    // Earlier C8 saved records retain ended_at but do not have the new optional date.
    delete state.sales![0].release_reminder_on;
    const snapshot = JSON.stringify(state);
    expect(
      await evaluateFixtureSales(state, new Date("2026-10-13T03:59:59Z")),
    ).toBe(false);
    expect(JSON.stringify(state)).toBe(snapshot);
    await evaluateFixtureSales(state, new Date("2026-10-13T04:00:00Z"));
    expect(state.sales![0].release_reminder_on).toBeUndefined();
    expect(
      state.alerts.filter((entry) => entry.type === "sale_delivery_release"),
    ).toHaveLength(1);
    expect(finance()).toBe(before);
  });
  it("same cost preserves manual regular price even when the stale UI choice says calculated; changed cost defaults calculated", async () => {
    savePriceChange(
      state,
      manager,
      input({ mode: "regular", price: "24.99" }),
      now,
    );
    costInvoice("12.6000");
    expect(
      manualDecisionForLine(state, manager, state.invoice.lines[0], "Branch 1"),
    ).toBeNull();
    state.invoice.lines[0].manual_price_decision = "rule";
    postInvoice(state, worker);
    expect(
      state.approvals.some(
        (entry) =>
          entry.source_invoice_id === state.invoice.id &&
          entry.product_code === "0012" &&
          entry.type === "price_change",
      ),
    ).toBe(false);
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
    state.invoice = demoSaleCostInvoice(state, worker, "Branch 1");
    delete state.invoice.lines[0].manual_price_decision;
    expect(
      manualDecisionForLine(state, manager, state.invoice.lines[0], "Branch 1")
        ?.price,
    ).toBe("24.99");
    initializeInvoiceManualPriceDecisions(state, manager);
    expect(state.invoice.lines[0].manual_price_decision).toBe("rule");
    state.invoice.lines[0].manual_price_decision = "keep";
    initializeInvoiceManualPriceDecisions(state, manager);
    expect(state.invoice.lines[0].manual_price_decision).toBe("keep");
  });
});

describe("C8 retained History and additive restore", () => {
  it("reverts a new sale without deleting lifecycle evidence or restoring an unrelated regular price", async () => {
    const before = cloneWithAuthority(state);
    const sale = begin();
    const entry = attachReversals(before, state, manager).find(
      (item) => item.entity_type === "sale",
    )!;
    expect(canReverse(state, entry, manager, "revert")).toBe(true);
    applyApprovedPrice(state, manager, "0012", "24.99", "branch", "Branch 1");
    const financeBefore = finance();
    const oldEvents = structuredClone(state.sale_events);
    reverseActivity(state, manager, entry.id, "revert", now);
    expect(state.sales!.find((item) => item.id === sale.id)!.status).toBe(
      "ended",
    );
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
    expect(state.sale_events!.slice(0, oldEvents!.length)).toEqual(oldEvents);
    expect(finance()).toBe(financeBefore);
  });
  it("refuses a stale sale reversal and cannot revive an elapsed sale", async () => {
    const sale = begin();
    const prior = cloneWithAuthority(state);
    endSale(state, manager, sale.id, { expected_revision: sale.revision }, now);
    const entry = attachReversals(prior, state, manager).find(
      (item) => item.entity_type === "sale",
    )!;
    const snapshot = cloneWithAuthority(state);
    expect(() =>
      reverseActivity(
        state,
        manager,
        entry.id,
        "revert",
        new Date("2026-10-26T16:00:00Z"),
      ),
    ).toThrow("expired");
    expect(state).toEqual(snapshot);
    reverseActivity(state, manager, entry.id, "revert", now);
    expect(state.sales![0].status).toBe("active");
    expect(() =>
      reverseActivity(state, manager, entry.id, "revert", now),
    ).toThrow("irreversible");
  });
  it("migrates a saved shop additively, preserving exact business records, files and custom settings without demo injection", async () => {
    const retained = initialState();
    delete retained.prototype_c8_schema;
    delete retained.sales;
    delete retained.sale_requests;
    retained.config.sales = {
      ...retained.config.sales!,
      default_length_days: 21,
    };
    retained.products[0].name_fa = "Custom saved name 100";
    retained.invoice.file_data = "data:application/pdf;base64,EXACTORIGINAL";
    const preserved = JSON.stringify({
      products: retained.products,
      invoices: retained.invoices,
      invoice: retained.invoice,
      ledger: retained.ledger,
      returns: retained.returns,
      activity: retained.activity,
    });
    hydrateSalesState(retained);
    expect(retained.config.sales!.default_length_days).toBe(21);
    expect(retained.sales).toEqual([]);
    expect(retained.sale_requests).toEqual([]);
    expect(
      JSON.stringify({
        products: retained.products,
        invoices: retained.invoices,
        invoice: retained.invoice,
        ledger: retained.ledger,
        returns: retained.returns,
        activity: retained.activity,
      }),
    ).toBe(preserved);
    const roundtrip = JSON.parse(JSON.stringify(retained)) as DemoState;
    hydrateSalesState(roundtrip);
    expect(roundtrip).toEqual(retained);
  });
  it("fresh seed has the real Pot sale/Oil request and correct actual prior store cost", async () => {
    const demo = initialState();
    expect(activeSaleAt(demo, "0012", "Branch 1", now)?.sale_price).toBe(
      "16.99",
    );
    expect(
      pendingSaleRequest(demo, "0008", "Branch 1", now)?.requested_price,
    ).toBe("7.99");
    expect(
      productStoreCost(
        demo,
        authenticatedTestActor(demo, "manager", {
          username: "supervisor",
          name_en: "Demo Supervisor",
          selection: { kind: "location", location_id: "Branch 1" },
        }),
        demo.products.find((item) => item.code === "0012")!,
      ),
    ).toBe("12.6000");
    expect(
      demo.products.find((item) => item.code === "0015")!.name_fa,
    ).toContain("۱۰۰");
    expect(configuredBranches(demo.config)).toContain("Warehouse");
  });
});

describe("C8 adversarial source evidence and later receipts", () => {
  it("rejects unrelated existing-sale IDs and foreign previews without reading private data or writing", async () => {
    const sale = begin();
    const before = cloneWithAuthority(state);
    expect(() =>
      changeSale(
        state,
        manager,
        sale.id,
        input({
          product_code: "0008",
          price: "7.99",
          accept_below_margin: true,
          expected_revision: sale.revision,
        }),
        now,
      ),
    ).toThrow("revision");
    expect(state).toEqual(before);
    const foreignState = structuredClone(state);
    foreignState.config.company.seed_key = "foreign-company";
    const foreignActor = authenticatedTestActor(foreignState, "manager");
    expect(() => previewPriceChange(state, foreignActor, input(), now)).toThrow(
      "permission",
    );
    expect(state).toEqual(before);
  });
  it("rejects forged narrowed assignment claims before any group edit", async () => {
    const sale = begin({
      branches: ["Branch 1", "Branch 2"],
      scope: "selected",
    });
    const before = cloneWithAuthority(state);
    expect(() =>
      changeSale(
        state,
        { ...manager, allowed_branches: ["Branch 1"] },
        sale.id,
        input({ expected_revision: sale.revision }),
        now,
      ),
    ).toThrow("permission");
    expect(state).toEqual(before);
  });
  it("honors an explicitly deferred Regular label after sale end even when the automatic end setting is off", async () => {
    const sale = begin();
    state.config.sales!.add_regular_labels_on_end = false;
    const promo = structuredClone(state.label_waitlist![0]);
    savePriceChange(
      state,
      manager,
      input({ mode: "regular", price: "24.99", add_labels: true }),
      now,
    );
    expect(state.label_waitlist![0]).toEqual(promo);
    endSale(state, manager, sale.id, { expected_revision: sale.revision }, now);
    expect(state.label_waitlist![0].preferred_template).toBe("regular");
  });
  it("an actual older invoice delivered later becomes the current regular cost with exact original short restoration", async () => {
    begin();
    costInvoice();
    state.invoice.lines[0].qty_received_at_posting = 0;
    postInvoice(state, worker);
    const oldId = state.invoice.id;
    expect(
      state.alerts.filter((entry) => entry.type === "sale_cost_increase"),
    ).toHaveLength(0);
    vi.setSystemTime(new Date("2026-10-13T16:00:00Z"));
    costInvoice("13.3000");
    state.invoice.id = "newer-regular-receipt";
    state.invoice.supplier_invoice_number = "HW-NEWER";
    postInvoice(state, worker);
    expect(productStoreCost(state, manager, product())).toBe("13.3000");
    vi.setSystemTime(new Date("2026-10-14T16:00:00Z"));
    state.invoice = structuredClone(
      state.invoices!.find((entry) => entry.id === oldId)!,
    );
    const ledger = structuredClone(state.ledger),
      movements = structuredClone(state.stock_movements!);
    const stock = state.stock["Branch 1:0012"];
    expect(receiveShort(state, "0012", 1, "LATER-HW-ONE", worker, 0)).toBe(
      "16.05",
    );
    expect(state.ledger.slice(0, ledger.length)).toEqual(ledger);
    expect(
      state.ledger
        .slice(ledger.length)
        .map((entry) => [entry.type, entry.amount]),
    ).toEqual([["short_restoration", "16.05"]]);
    expect(state.stock_movements!.slice(0, movements.length)).toEqual(
      movements,
    );
    expect(state.stock["Branch 1:0012"]).toBe(stock + 1);
    expect(productStoreCost(state, manager, product())).toBe("14.2000");
    expect(
      state.alerts.find(
        (entry) =>
          entry.id.includes("LATER-HW-ONE") &&
          entry.type === "sale_cost_increase",
      ),
    ).toMatchObject({
      previous_cost: "13.3000",
      new_cost: "14.2000",
      invoice_id: oldId,
    });
    expect(
      state.approvals.find((entry) => entry.id.includes("LATER-HW-ONE")),
    ).toMatchObject({ proposed_price: "23.49", applies_after_sale: true });
    const snapshot = JSON.stringify(state);
    expect(receiveShort(state, "0012", 1, "LATER-HW-ONE", worker, 0)).toBe(
      "0.00",
    );
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it("corrected cost uses its immutable correction source, preserves original receipt bytes/stock and deduplicates retry", async () => {
    begin();
    costInvoice();
    postInvoice(state, worker);
    const original = structuredClone(state.invoice),
      stock = structuredClone(state.stock),
      movements = structuredClone(state.stock_movements);
    const lines = structuredClone(state.invoice.lines);
    lines[0].unit_cost_before_tax = "15.2000";
    lines[0].case_cost_before_tax = "45.6000";
    const input = {
      lines,
      reason: "Supplier corrected the invoiced regular unit cost.",
    };
    const preview = invoiceContentCorrectionPreview(
      state,
      manager,
      state.invoice.id,
      input,
    );
    expect(preview.blockers).toEqual([]);
    const correction = correctPostedInvoice(
      state,
      manager,
      state.invoice.id,
      input,
      preview.snapshot,
      "C8-CORRECTION-1",
    );
    expect(state.invoice).toEqual(original);
    expect(state.stock).toEqual(stock);
    expect(state.stock_movements).toEqual(movements);
    expect(
      state.alerts.find(
        (entry) =>
          entry.id.startsWith(correction.id) &&
          entry.type === "sale_cost_increase",
      ),
    ).toMatchObject({
      previous_cost: "14.2000",
      new_cost: "15.2000",
      regular_price_before: "20.99",
    });
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("16.99");
    const snapshot = JSON.stringify(state);
    correctPostedInvoice(
      state,
      manager,
      state.invoice.id,
      input,
      preview.snapshot,
      "C8-CORRECTION-1",
    );
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(
      receiptCostFixture(
        state,
        manager,
        {
          invoice_id: state.invoice.id,
          product_code: "0012",
          line_index: 0,
          previous_cost: "0.0000",
          new_cost: "15.2000",
          regular_price_before: "20.99",
          proposed_regular_price: "0.99",
          source_event_id: "fabricated-correction",
        },
        now,
      ),
    ).toEqual([]);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("C8 reversible held instructions", () => {
  it("refreshes the real instruction without marking physical action done, preserving each prior reminder after a reversal", async () => {
    const sale = begin();
    costInvoice();
    postInvoice(state, worker);
    const alert = state.alerts.find(
      (entry) => entry.type === "sale_cost_increase",
    )!;
    decideSaleCostAlert(
      state,
      manager,
      alert.id,
      {
        decision: "keep",
        expected_sale_revision: sale.revision,
        hold_delivery: true,
      },
      now,
    );
    const hold = state.sale_delivery_holds![0],
      original = structuredClone(
        state.notes.find((entry) => entry.id === hold.note_id)!,
      );
    const before = cloneWithAuthority(state);
    endSale(state, manager, sale.id, { expected_revision: sale.revision }, now);
    const end = attachReversals(before, state, manager).find(
      (entry) => entry.entity_type === "sale" && entry.action === "End sale",
    )!;
    const note = state.notes.find((entry) => entry.id === hold.note_id)!;
    expect(note.text).toMatch(/^Sale ended: put the held/);
    expect(note.text_fa).toContain("حراج پایان یافت");
    expect(note.status).toBe("open");
    expect(
      state.activity.some(
        (entry) =>
          entry.action === "Update held delivery instruction" &&
          (entry.before as { text: string })?.text === original.text,
      ),
    ).toBe(true);
    const money = finance();
    expect(
      state.alerts.filter((entry) => entry.type === "sale_delivery_release"),
    ).toHaveLength(0);
    const firstAfterEnd = new Date("2026-10-13T16:00:00Z");
    await evaluateFixtureSales(state, firstAfterEnd);
    reverseActivity(state, manager, end.id, "revert", firstAfterEnd);
    expect(state.notes.find((entry) => entry.id === hold.note_id)!.text).toBe(
      original.text,
    );
    expect(
      state.alerts
        .filter((entry) => entry.type === "sale_delivery_release")
        .map((entry) => entry.status),
    ).toEqual(["resolved"]);
    const live = state.sales![0];
    expect(live.release_reminder_on).toBeUndefined();
    endSale(
      state,
      manager,
      live.id,
      { expected_revision: live.revision },
      firstAfterEnd,
    );
    expect(state.sales![0].release_reminder_on).toBe("2026-10-14");
    expect(
      state.alerts
        .filter((entry) => entry.type === "sale_delivery_release")
        .map((entry) => entry.status),
    ).toEqual(["resolved"]);
    await evaluateFixtureSales(state, new Date("2026-10-14T04:00:00Z"));
    expect(
      state.alerts
        .filter((entry) => entry.type === "sale_delivery_release")
        .map((entry) => entry.status),
    ).toEqual(["resolved", "pending"]);
    expect(finance()).toBe(money);
    const snapshot = JSON.stringify(state);
    await evaluateFixtureSales(state, new Date("2026-10-14T16:00:00Z"));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("C8 canonical regular weighed preview", () => {
  it("previews the exact stored canonical regular amount while temporary sales preserve entered kg cents", async () => {
    const weighed = state.products.find((entry) => entry.code === "0016")!;
    weighed.selling_price = "20.99";
    weighed.last_cost_before_tax = "1.0000";
    state.config.weighed_items!.main_display_unit = "kg";
    const proposal = input({
      product_code: weighed.code,
      mode: "regular",
      price: "16.99",
      price_unit: "kg",
    });
    const preview = previewPriceChange(state, manager, proposal, now);
    expect(preview.effects[0].proposed_price).toBe("7.71");
    savePriceChange(state, manager, proposal, now);
    expect(regularPrice(state, weighed.code, "Branch 1")).toBe("7.71");
    const before = cloneWithAuthority(state);
    expect(() =>
      savePriceChange(state, manager, { ...proposal, price: "0.01" }, now),
    ).toThrow("price");
    expect(state).toEqual(before);
  });
});

describe("C8 Manager decision on changed-cost manual regular invoices", () => {
  const prepare = (
    price = "24.99",
    recommendation: "keep" | "rule" = "keep",
  ) => {
    savePriceChange(
      state,
      manager,
      input({ mode: "regular", price, accept_below_margin: true }),
      now,
    );
    costInvoice();
    state.invoice.lines[0].manual_price_decision = recommendation;
    postInvoice(state, worker);
    return state.approvals.find(
      (entry) =>
        entry.source_invoice_id === state.invoice.id &&
        entry.product_code === "0012" &&
        entry.status === "pending",
    )!;
  };
  it("receiver Keep is only a recommendation: default pending proposal is calculated, and Manager Keep preserves exact price/provenance/evidence", async () => {
    const review = prepare();
    expect(review).toMatchObject({
      type: "price_change",
      status: "pending",
      proposed_price: "23.49",
      manual_price_review: {
        kept_price: "24.99",
        calculated_price: "23.49",
        prior_cost: "12.6000",
        received_cost: "14.2000",
        receiver_recommendation: "keep",
      },
    });
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
    expect(manualRegularApprovalPreview(state, manager, review).price).toBe(
      "23.49",
    );
    const marker = structuredClone(manualPrice(state, product(), "Branch 1")),
      evidence = finance(),
      invoice = structuredClone(state.invoice);
    resolveApproval(
      state,
      manager,
      review.id,
      "approve",
      "branch",
      "Branch 1",
      undefined,
      approvalSnapshot(state, manager, "0012"),
      "keep",
    );
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
    expect(manualPrice(state, product(), "Branch 1")).toEqual(marker);
    expect(review.manual_price_review!.decision).toBe("keep");
    expect(review.status).toBe("approved");
    expect(state.invoice).toEqual(invoice);
    expect(finance()).toBe(evidence);
    expect(state.activity.at(-1)!.action).toBe("Keep regular price");
  });
  it("Manager's default Use calculated clears only that store's manual marker after explicit approval", async () => {
    savePriceChange(
      state,
      manager,
      input({
        mode: "regular",
        scope: "all",
        branches: sellingSaleBranches(state),
        price: "24.99",
      }),
      now,
    );
    costInvoice();
    state.invoice.lines[0].manual_price_decision = "keep";
    postInvoice(state, worker);
    const review = state.approvals.find(
      (entry) =>
        entry.source_invoice_id === state.invoice.id &&
        entry.product_code === "0012",
    )!;
    const evidence = finance();
    resolveApproval(
      state,
      manager,
      review.id,
      "approve",
      "branch",
      "Branch 1",
      undefined,
      approvalSnapshot(state, manager, "0012"),
    );
    expect(regularPrice(state, "0012", "Branch 1")).toBe("23.49");
    expect(manualPrice(state, product(), "Branch 1")).toBeNull();
    expect(regularPrice(state, "0012", "Branch 2")).toBe("24.99");
    expect(manualPrice(state, product(), "Branch 2")?.price).toBe("24.99");
    expect(review.manual_price_review!.decision).toBe("rule");
    expect(finance()).toBe(evidence);
  });
  it("keeps a same-cost manual regular price after the conflicting sale is explicitly ended", async () => {
    const sale = begin();
    savePriceChange(
      state,
      manager,
      input({
        mode: "regular",
        price: "15.99",
        accept_below_margin: true,
        regular_sale_resolutions: [
          { sale_id: sale.id, expected_revision: sale.revision, action: "end" },
        ],
      }),
      now,
    );
    costInvoice("12.6000");
    state.invoice.lines[0].manual_price_decision = "keep";
    const approvals = structuredClone(state.approvals),
      alerts = structuredClone(state.alerts),
      baseline = regularPrice(state, "0012", "Branch 1");
    postInvoice(state, worker);
    expect(state.approvals).toEqual(approvals);
    expect(state.alerts).toEqual(alerts);
    expect(regularPrice(state, "0012", "Branch 1")).toBe(baseline);
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("15.99");
  });
  it("requires a reason to Keep below minimum and blocks stale or company-wide Keep decisions without writes", async () => {
    const review = prepare("17.99"),
      snapshot = approvalSnapshot(state, manager, "0012"),
      before = cloneWithAuthority(state);
    expect(
      manualRegularApprovalPreview(state, manager, review, "keep")
        .below_minimum_margin,
    ).toBe(true);
    expect(() =>
      resolveApproval(
        state,
        manager,
        review.id,
        "approve",
        "branch",
        "Branch 1",
        undefined,
        snapshot,
        "keep",
      ),
    ).toThrow("reason");
    expect(state).toEqual(before);
    expect(() =>
      resolveApproval(
        state,
        manager,
        review.id,
        "approve",
        "all",
        "all",
        "Approved slower-selling product",
        snapshot,
        "keep",
      ),
    ).toThrow("receiving location");
    expect(state).toEqual(before);
    resolveApproval(
      state,
      manager,
      review.id,
      "approve",
      "branch",
      "Branch 1",
      "Approved slower-selling product",
      snapshot,
      "keep",
    );
    expect(regularPrice(state, "0012", "Branch 1")).toBe("17.99");
    expect(review.acknowledgment_reason).toBe(
      "Approved slower-selling product",
    );
    state = cloneWithAuthority(before);
    savePriceChange(
      state,
      manager,
      input({ mode: "regular", price: "24.99" }),
      now,
    );
    const changed = cloneWithAuthority(state);
    expect(() =>
      resolveApproval(
        state,
        manager,
        review.id,
        "approve",
        "branch",
        "Branch 1",
        "Reviewed",
        undefined,
        "keep",
      ),
    ).toThrow("Prices changed");
    expect(state).toEqual(changed);
  });
});

describe("C8 fresh manual decisions after actual cost transitions", () => {
  it("does not reuse a historically approved Keep decision when a later invoice returns to a previous cost", async () => {
    savePriceChange(
      state,
      manager,
      input({ mode: "regular", price: "24.99" }),
      now,
    );
    const receipt = (cost: string, id: string, date: string) => {
      vi.setSystemTime(new Date(date));
      // Each later business day is a new authenticated session, as the critical approval requires.
      manager = authenticatedTestActor(state, "manager", {
        username: "supervisor",
        name_en: "Demo Supervisor",
        selection: { kind: "location", location_id: "Branch 1" },
      });
      worker = authenticatedTestActor(state, "floor_worker", {
        username: "floorworker",
        name_en: "Demo Floor Worker",
        locations: ["Branch 1"],
      });
      costInvoice(cost);
      state.invoice.id = id;
      state.invoice.supplier_invoice_number = id;
      state.invoice.lines[0].manual_price_decision = "keep";
      postInvoice(state, worker);
      return state.approvals.find(
        (entry) =>
          entry.source_invoice_id === id &&
          entry.product_code === "0012" &&
          entry.status === "pending",
      )!;
    };
    const first = receipt(
      "14.2000",
      "manual-cost-first",
      "2026-10-12T16:00:00Z",
    );
    resolveApproval(
      state,
      manager,
      first.id,
      "approve",
      "branch",
      "Branch 1",
      undefined,
      undefined,
      "keep",
    );
    const second = receipt(
      "12.6000",
      "manual-cost-second",
      "2026-10-13T16:00:00Z",
    );
    resolveApproval(
      state,
      manager,
      second.id,
      "approve",
      "branch",
      "Branch 1",
      undefined,
      undefined,
      "keep",
    );
    const again = receipt(
      "14.2000",
      "manual-cost-again",
      "2026-10-14T16:00:00Z",
    );
    expect(again).toBeDefined();
    expect(again.id).not.toBe(first.id);
    expect(again.proposed_price).toBe("23.49");
    expect(again.manual_price_review!.receiver_recommendation).toBe("keep");
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
  });
  it("later delivery and corrected cost retain receiver Keep as a recommendation instead of bypassing a manual-price review", async () => {
    savePriceChange(
      state,
      manager,
      input({ mode: "regular", price: "24.99" }),
      now,
    );
    costInvoice();
    state.invoice.lines[0].qty_received_at_posting = 0;
    state.invoice.lines[0].manual_price_decision = "keep";
    postInvoice(state, worker);
    expect(
      state.approvals.some(
        (entry) =>
          entry.source_invoice_id === state.invoice.id &&
          entry.product_code === "0012",
      ),
    ).toBe(false);
    receiveShort(state, "0012", 1, "MANUAL-LATER", worker, 0);
    const review = state.approvals.find((entry) =>
      entry.id.includes("MANUAL-LATER"),
    )!;
    expect(review.manual_price_review).toMatchObject({
      kept_price: "24.99",
      calculated_price: "23.49",
      receiver_recommendation: "keep",
    });
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
    // A new fully accepted regular invoice gives the correction its own retained source.
    vi.setSystemTime(new Date("2026-10-13T16:00:00Z"));
    costInvoice();
    state.invoice.id = "manual-corrected-source";
    state.invoice.lines[0].manual_price_decision = "keep";
    postInvoice(state, worker);
    const lines = structuredClone(state.invoice.lines);
    lines[0].unit_cost_before_tax = "15.2000";
    lines[0].case_cost_before_tax = "45.6000";
    const change = { lines, reason: "Supplier corrected the unit cost." };
    const preview = invoiceContentCorrectionPreview(
      state,
      manager,
      state.invoice.id,
      change,
    );
    const correction = correctPostedInvoice(
      state,
      manager,
      state.invoice.id,
      change,
      preview.snapshot,
      "MANUAL-CORRECTION",
    );
    const corrected = state.approvals.find(
      (entry) => entry.correction_id === correction.id,
    )!;
    expect(corrected.type).toBe("price_change");
    expect(corrected.manual_price_review!.kept_price).toBe("24.99");
    expect(corrected.manual_price_review!.received_cost).toBe("15.2000");
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
  });
});
