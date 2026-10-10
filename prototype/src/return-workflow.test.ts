import { afterEach, describe, expect, it, vi } from "vitest";
import { returnFixture } from "./return-test-fixture";
import {
  cancelReturn,
  ledgerSummary,
  postReturnClaim,
  receiveReplacement,
  recordPickup,
  reviewCancellation,
  submitFinancialClaim,
  type OperationalReturn,
  type OperationsContext,
} from "./operations";
import {
  pendingReturnCredits,
  returnClosureSubtype,
  returnFinancialFingerprint,
  returnSettings,
  returnUiStatus,
  syncReturnCreditAlerts,
  updateReturnSettings,
} from "./return-workflow";
import {
  supplierBalanceCsv,
  supplierBalanceSummary,
} from "./supplier-balances";
import { supplierPage } from "./suppliers";

const worker: OperationsContext = {
  company_id: "super-arzon",
  branch: "Branch 1",
  role: "floor_worker",
  actor: "Demo Floor Worker",
};
const supervisor: OperationsContext = {
  ...worker,
  role: "supervisor",
  actor: "Demo Supervisor",
};
function pickup(
  state: ReturnType<typeof returnFixture>,
  qty = 3,
  slip = "SIGNED-C4-001",
) {
  recordPickup(state, worker, "c4-return", {
    quantities: { "0003": qty },
    representative: "Demo Driver",
    slip,
  });
}
function replacement(state: ReturnType<typeof returnFixture>, covers = 3) {
  receiveReplacement(state, worker, "c4-return", {
    product_code: "0002",
    qty: covers,
    covers: { "0003": covers },
    representative: "Demo Driver",
    receipt: `C4-DELIVERY-${covers}`,
    date: "2026-10-09",
  });
}
function credit(
  state: ReturnType<typeof returnFixture>,
  amount = "25.00",
  covers = 3,
) {
  submitFinancialClaim(state, worker, "c4-return", {
    type: "credit_current_invoice",
    covers: { "0003": covers },
    invoice_id: "c4-base-invoice",
    document: "C4-CREDIT-001",
  });
  const record = state.returns[0] as OperationalReturn;
  postReturnClaim(state, supervisor, record.id, record.claims![0].id, amount);
}
afterEach(() => vi.useRealTimers());

describe("C4 retained return memo and pending balance", () => {
  it("records a worker pickup as 570 owed / 30 pending without posting money or removing goods again", () => {
    const state = returnFixture();
    const ledger = structuredClone(state.ledger);
    const movements = structuredClone(state.stock_movements);
    const stock = structuredClone(state.stock);
    pickup(state);
    const summary = supplierBalanceSummary(
      state,
      supervisor,
      "Fresh Valley Foods",
    );
    expect(summary).toMatchObject({
      balance: "570.00",
      confirmed_balance: "600.00",
      pending_credit: "30.00",
    });
    expect(summary.pending_returns).toEqual([
      expect.objectContaining({
        return_id: "c4-return",
        reference: "RM-0001",
        amount: "30.00",
      }),
    ]);
    expect(ledgerSummary(state, supervisor, "Fresh Valley Foods").balance).toBe(
      "600.00",
    );
    expect(state.ledger).toEqual(ledger);
    expect(state.stock_movements).toEqual(movements);
    expect(state.stock).toEqual(stock);
    expect(state.returns[0].pickup_memos![0]).toMatchObject({
      representative: "Demo Driver",
      signed_evidence_reference: "SIGNED-C4-001",
      expected_credit: "30.00",
      lines: [
        expect.objectContaining({
          name_en: "Sour Cherry Juice 1 L",
          unit_cost: "10.0000",
          cost_source: "catalog-last-cost:0003",
        }),
      ],
    });
  });
  it("retains stable memo references and cost/name/location snapshots through catalog edits and reload", () => {
    const state = returnFixture();
    pickup(state);
    const saved = structuredClone(state.returns[0].pickup_memos![0]);
    state.products.find(
      (product) => product.code === "0003",
    )!.last_cost_before_tax = "99.9999";
    state.products.find((product) => product.code === "0003")!.name_en =
      "Later name";
    state.config.company.name = "Later company";
    state.config.branches[0].name = "Later location";
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    expect(restored.returns[0].pickup_memos![0]).toEqual(saved);
    expect(
      supplierBalanceSummary(restored, supervisor, "Fresh Valley Foods")
        .pending_credit,
    ).toBe("30.00");
  });
  it("retries a pickup without another memo, projection, physical event or audit entry", () => {
    const state = returnFixture();
    pickup(state);
    const original = structuredClone(state);
    pickup(state);
    expect(state).toEqual(original);
    expect(() =>
      recordPickup(state, worker, "c4-return", {
        quantities: { "0003": 2 },
        representative: "Demo Driver",
        slip: "SIGNED-C4-001",
      }),
    ).toThrow("duplicate_document");
    expect(state).toEqual(original);
  });
  it("retains separate partial pickup memos and releases only the covered quantities", () => {
    const state = returnFixture();
    pickup(state, 1);
    pickup(state, 2, "SIGNED-C4-002");
    replacement(state, 1);
    expect(
      state.returns[0].pickup_memos!.map((memo) => memo.reference),
    ).toEqual(["RM-0001", "RM-0002"]);
    expect(returnUiStatus(state.returns[0])).toBe("waiting_for_credit");
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods"),
    ).toMatchObject({
      balance: "580.00",
      pending_credit: "20.00",
      confirmed_balance: "600.00",
    });
    expect(pendingReturnCredits(state, supervisor)).toEqual([
      expect.objectContaining({ reference: "RM-0002", amount: "20.00" }),
    ]);
  });
  it("uses Decimal four-decimal cost and cent rounding without floating errors", () => {
    const state = returnFixture();
    state.products.find(
      (product) => product.code === "0003",
    )!.last_cost_before_tax = "0.3350";
    pickup(state);
    expect(state.returns[0].pickup_memos![0].expected_credit).toBe("1.01");
    replacement(state, 1);
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods")
        .pending_credit,
    ).toBe("0.67");
  });
  it("respects disabled pickup deduction without a ledger credit and keeps that pickup snapshot", () => {
    const state = returnFixture();
    state.config.returns!.deduct_expected_credit_at_pickup = false;
    pickup(state);
    state.config.returns!.deduct_expected_credit_at_pickup = true;
    expect(state.returns[0].pickup_memos![0]).toMatchObject({
      expected_credit: "30.00",
      deduct_expected_credit: false,
    });
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods"),
    ).toMatchObject({ balance: "600.00", pending_credit: "0.00" });
  });
  it("defaults to enabled pickup deduction and 14 days for older settings", () => {
    const state = returnFixture();
    delete state.config.returns;
    expect(returnSettings(state)).toEqual({
      deduct_expected_credit_at_pickup: true,
      waiting_credit_days: 14,
    });
  });
  it("retains canonical lb and Decimal partial weight coverage after a later sold-by edit", () => {
    const state = returnFixture();
    const product = state.products.find((item) => item.code === "0003")!;
    product.sold_by = "weight";
    state.returns[0].lines[0].qty = 0.3;
    pickup(state, 0.3);
    expect(state.returns[0].pickup_memos![0]).toMatchObject({
      expected_credit: "3.00",
      lines: [
        expect.objectContaining({
          quantity: 0.3,
          quantity_unit: "lb",
          unit_cost: "10.0000",
        }),
      ],
    });
    product.sold_by = "each";
    receiveReplacement(state, worker, "c4-return", {
      product_code: "0002",
      qty: 1,
      covers: { "0003": 0.1 },
      representative: "Demo Driver",
      receipt: "WEIGHT-PARTIAL",
      date: "2026-10-09",
    });
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods")
        .pending_credit,
    ).toBe("2.00");
    expect(state.returns[0].lines[0].quantity_unit).toBe("lb");
  });
  it("rejects fractional Each counts and weight precision above three decimals before pickup mutation", () => {
    const state = returnFixture();
    const before = structuredClone(state);
    expect(() => pickup(state, 0.5)).toThrow("quantity");
    expect(state).toEqual(before);
    state.products.find((item) => item.code === "0003")!.sold_by = "weight";
    const weighted = structuredClone(state);
    expect(() => pickup(state, 0.0001)).toThrow("weight_quantity");
    expect(state).toEqual(weighted);
  });
  it("freezes linked kg-source purchase cost as canonical lb expected credit rather than multiplying kg cost by lb", () => {
    const state = returnFixture();
    const product = state.products.find((item) => item.code === "0003")!;
    product.sold_by = "weight";
    product.last_cost_before_tax = "99.9999";
    const invoice = structuredClone(state.invoice);
    invoice.id = "kg-source-invoice";
    invoice.status = "posted";
    invoice.posted_at = "2026-10-01T12:00:00Z";
    invoice.lines = [
      {
        ...invoice.lines[0],
        product_code: "0003",
        quantity_unit: "kg",
        qty_invoiced: 2.20462,
        qty_received_at_posting: 2.20462,
        units_per_case: 1,
        unit_cost_before_tax: "4.9895",
        source_quantity: "1.000",
        source_quantity_unit: "kg",
        source_cost_before_tax: "11.0000",
        source_cost_unit: "kg",
        weight_conversion_factor: "2.20462",
        refused_units: 0,
        short_dated: false,
      },
    ];
    state.invoices = [invoice];
    state.returns[0].linked_invoice = invoice.id;
    state.returns[0].lines[0].qty = 1.25;
    pickup(state, 1.25);
    expect(state.returns[0].pickup_memos![0]).toMatchObject({
      expected_credit: "6.24",
      lines: [
        expect.objectContaining({
          quantity: 1.25,
          quantity_unit: "lb",
          unit_cost: "4.9895",
          cost_source: "invoice:kg-source-invoice:0",
        }),
      ],
    });
  });
  it("never fabricates a signed memo or pending amount from an old status alone", () => {
    const state = returnFixture();
    state.returns[0].status = "picked_up";
    expect(returnUiStatus(state.returns[0])).toBe("waiting_for_credit");
    expect(pendingReturnCredits(state, supervisor)).toEqual([]);
    syncReturnCreditAlerts(state, "2026-12-01");
    expect(state.returns[0].pickup_memos).toBeUndefined();
    expect(state.alerts).toEqual([]);
  });
  it("excludes foreign-company and foreign-location claims and refuses worker money access", () => {
    const state = returnFixture();
    pickup(state);
    const record = structuredClone(state.returns[0]);
    state.returns.push(
      { ...record, id: "foreign-company", company_id: "other-company" },
      { ...record, id: "foreign-location", branch: "Branch 2" },
    );
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods")
        .pending_credit,
    ).toBe("30.00");
    expect(() => pendingReturnCredits(state, worker)).toThrow("supervisor");
    expect(() =>
      pendingReturnCredits(state, {
        ...supervisor,
        company_id: "other-company",
      }),
    ).toThrow("scope");
    expect(() =>
      recordPickup(state, { ...worker, branch: "Branch 2" }, "c4-return", {
        quantities: { "0003": 1 },
        representative: "Demo Driver",
        slip: "OTHER",
      }),
    ).toThrow("scope");
    expect(
      supplierPage(state, worker, "Fresh Valley Foods").returns[0].financial,
    ).toBeUndefined();
  });
  it("does not create a memo or mutate pickup when cost evidence is unavailable or malformed", () => {
    const state = returnFixture();
    state.products.find(
      (product) => product.code === "0003",
    )!.last_cost_before_tax = "invalid";
    const before = structuredClone(state);
    expect(() => pickup(state)).toThrow("return_cost");
    expect(state).toEqual(before);
  });
});

describe("C4 actual settlements and preserved physical evidence", () => {
  it("replaces the expected 30 with actual 25 once, restoring the missing 5 owed", () => {
    const state = returnFixture();
    pickup(state);
    credit(state);
    const record = state.returns[0] as OperationalReturn;
    postReturnClaim(
      state,
      supervisor,
      record.id,
      record.claims![0].id,
      "25.00",
    );
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods"),
    ).toMatchObject({
      balance: "575.00",
      confirmed_balance: "575.00",
      pending_credit: "0.00",
    });
    expect(
      state.ledger.filter((entry) => entry.type === "credit"),
    ).toHaveLength(1);
    expect(returnUiStatus(record)).toBe("closed");
    expect(returnClosureSubtype(record)).toBe("credited");
    expect(record.pickup_memos).toHaveLength(1);
  });
  it("does not allow a worker to confirm a financial credit or write-off", () => {
    const state = returnFixture();
    pickup(state);
    submitFinancialClaim(state, worker, "c4-return", {
      type: "credit_current_invoice",
      covers: { "0003": 3 },
      invoice_id: "c4-base-invoice",
      document: "C4-CREDIT-001",
    });
    const record = state.returns[0] as OperationalReturn;
    const before = structuredClone(state);
    expect(() =>
      postReturnClaim(state, worker, record.id, record.claims![0].id, "25.00"),
    ).toThrow("supervisor");
    expect(() =>
      submitFinancialClaim(state, worker, record.id, {
        type: "no_compensation",
        covers: { "0003": 3 },
        reason: "Refused",
      }),
    ).toThrow("supervisor");
    expect(state).toEqual(before);
  });
  it("releases pending replacement credit 570→600 without new purchase or confirmed credit", () => {
    const state = returnFixture();
    pickup(state);
    const ledger = structuredClone(state.ledger);
    replacement(state);
    replacement(state);
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods"),
    ).toMatchObject({
      balance: "600.00",
      pending_credit: "0.00",
      confirmed_balance: "600.00",
    });
    expect(state.ledger).toEqual(ledger);
    expect(
      state.stock_movements!.filter(
        (movement) =>
          movement.type === "replacement_received" &&
          movement.reference === "C4-DELIVERY-3",
      ),
    ).toHaveLength(1);
    expect(returnClosureSubtype(state.returns[0])).toBe("replaced");
  });
  it("requires write-off reason and releases projection while retaining pickup evidence", () => {
    const state = returnFixture();
    pickup(state);
    expect(() =>
      submitFinancialClaim(state, supervisor, "c4-return", {
        type: "no_compensation",
        covers: { "0003": 3 },
      }),
    ).toThrow("reason");
    submitFinancialClaim(state, supervisor, "c4-return", {
      type: "no_compensation",
      covers: { "0003": 3 },
      reason: "Supplier refused the claim; decision retained",
    });
    const record = state.returns[0] as OperationalReturn;
    const ledger = structuredClone(state.ledger);
    postReturnClaim(state, supervisor, record.id, record.claims![0].id);
    expect(
      supplierBalanceSummary(state, supervisor, record.supplier),
    ).toMatchObject({ balance: "600.00", pending_credit: "0.00" });
    expect(state.ledger).toEqual(ledger);
    expect(returnClosureSubtype(record)).toBe("written_off");
    expect(record.evidence!.some((event) => event.kind === "pickup")).toBe(
      true,
    );
  });
  it("keeps partial actual credit uncovered quantities pending without double deduction", () => {
    const state = returnFixture();
    pickup(state);
    credit(state, "8.00", 1);
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods"),
    ).toMatchObject({
      balance: "572.00",
      confirmed_balance: "592.00",
      pending_credit: "20.00",
    });
    expect(returnUiStatus(state.returns[0])).toBe("waiting_for_credit");
  });
  it("unsettled cancellation releases pending and recovers zero supplier-held goods", () => {
    const state = returnFixture();
    pickup(state);
    const movements = structuredClone(state.stock_movements);
    cancelReturn(state, worker, "c4-return", {
      reason: "Claim withdrawn; supplier still holds all originals",
      dispositions: { "0003": "supplier_held" },
      recovered: { "0003": 0 },
      safe: false,
    });
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods"),
    ).toMatchObject({ balance: "600.00", pending_credit: "0.00" });
    expect(state.stock_movements).toEqual(movements);
    expect(state.returns[0].original_units_recovered).toBe(0);
    expect(state.returns[0].pickup_memos).toHaveLength(1);
  });
  it("requires settled cancellation review and never erases posted credit or replacement receipts", () => {
    const state = returnFixture();
    pickup(state);
    credit(state);
    const ledger = structuredClone(state.ledger);
    cancelReturn(state, worker, "c4-return", {
      reason: "Review disputed settlement",
      dispositions: { "0003": "supplier_held" },
      recovered: { "0003": 0 },
      safe: false,
    });
    expect(state.returns[0].status).toBe("cancellation_review");
    expect(() =>
      reviewCancellation(state, worker, "c4-return", {
        accept: true,
        settlement_retained: true,
        note: "Keep evidence",
      }),
    ).toThrow("supervisor");
    reviewCancellation(state, supervisor, "c4-return", {
      accept: true,
      settlement_retained: true,
      note: "Original credit retained; no reversal was posted",
    });
    expect(state.ledger).toEqual(ledger);
    expect(
      supplierBalanceSummary(state, supervisor, "Fresh Valley Foods").balance,
    ).toBe("575.00");
  });
  it("rejects unsafe and over-cap recovery without physical or financial side effects", () => {
    const state = returnFixture();
    pickup(state);
    const before = structuredClone(state);
    expect(() =>
      cancelReturn(state, worker, "c4-return", {
        reason: "Unsafe originals",
        dispositions: { "0003": "unsafe_on_site" },
        recovered: { "0003": 1 },
        safe: false,
      }),
    ).toThrow("safe");
    expect(state).toEqual(before);
    expect(() =>
      cancelReturn(state, worker, "c4-return", {
        reason: "Too many",
        dispositions: { "0003": "recovered_sellable" },
        recovered: { "0003": 4 },
        safe: true,
      }),
    ).toThrow("recovery_cap");
    expect(state).toEqual(before);
  });
  it("retains confirmed allocations and exports pending claims as a separate reconciliation", () => {
    const state = returnFixture();
    pickup(state);
    const summary = supplierBalanceSummary(
      state,
      supervisor,
      "Fresh Valley Foods",
    );
    expect(summary.invoices[0].amount).toBe("600.00");
    const csv = supplierBalanceCsv(summary, "Fresh Valley Foods");
    expect(csv).toContain('"Confirmed balance","600.00"');
    expect(csv).toContain('"Pending credit","30.00"');
    expect(csv).toContain('"Projected owed","570.00"');
    expect(csv).toContain('"RM-0001"');
  });
  it("changes the financial confirmation fingerprint after a concurrent payment or return update", () => {
    const state = returnFixture();
    pickup(state);
    const fingerprint = returnFinancialFingerprint(state, "c4-return");
    state.ledger[0].amount = "599.00";
    expect(returnFinancialFingerprint(state, "c4-return")).not.toBe(
      fingerprint,
    );
  });
  it("uses historical pickup and settlement times for month-end pending projection", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const state = returnFixture();
    pickup(state);
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    credit(state);
    expect(
      supplierBalanceSummary(
        state,
        supervisor,
        "Fresh Valley Foods",
        "2026-10-31",
      ),
    ).toMatchObject({
      balance: "570.00",
      confirmed_balance: "600.00",
      pending_credit: "30.00",
    });
    expect(
      supplierBalanceSummary(
        state,
        supervisor,
        "Fresh Valley Foods",
        "2026-11-30",
      ),
    ).toMatchObject({ balance: "575.00", pending_credit: "0.00" });
  });
});

describe("C4 waiting-credit alerts", () => {
  it("permits only scoped Supervisor settings changes and keeps before/after audit", () => {
    const state = returnFixture();
    const before = structuredClone(state);
    const settings = {
      deduct_expected_credit_at_pickup: false,
      waiting_credit_days: 500,
    };
    expect(() => updateReturnSettings(state, worker, settings)).toThrow(
      "supervisor",
    );
    expect(() =>
      updateReturnSettings(
        state,
        { ...supervisor, company_id: "another-company" },
        settings,
      ),
    ).toThrow("scope");
    expect(() =>
      updateReturnSettings(state, supervisor, {
        ...settings,
        waiting_credit_days: 1.5,
      }),
    ).toThrow("return_days");
    expect(state).toEqual(before);
    updateReturnSettings(state, supervisor, settings);
    expect(state.config.returns).toEqual(settings);
    expect(state.activity[0]).toMatchObject({
      action: "Return settings changed",
      entity_type: "settings",
      entity_id: "returns",
      before: {
        deduct_expected_credit_at_pickup: true,
        waiting_credit_days: 14,
      },
      after: settings,
      reversible: true,
    });
  });
  it("creates one alert only after more than configured 14 days and resolves it at closure", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    const state = returnFixture();
    pickup(state);
    syncReturnCreditAlerts(state, "2026-10-15");
    expect(state.alerts).toEqual([]);
    syncReturnCreditAlerts(state, "2026-10-16");
    syncReturnCreditAlerts(state, "2026-10-16");
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0]).toMatchObject({
      return_id: "c4-return",
      status: "pending",
      branch: worker.branch,
      type: "return_credit_overdue",
    });
    replacement(state);
    expect(state.alerts[0].status).toBe("resolved");
    expect(state.alerts).toHaveLength(1);
  });
  it("honors configurable reminder days and reopens only automatically resolved alerts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    const state = returnFixture();
    pickup(state);
    state.config.returns!.waiting_credit_days = 2;
    syncReturnCreditAlerts(state, "2026-10-04");
    expect(state.alerts).toHaveLength(1);
    state.config.returns!.waiting_credit_days = 10;
    syncReturnCreditAlerts(state, "2026-10-04");
    expect(state.alerts[0].status).toBe("resolved");
    state.config.returns!.waiting_credit_days = 2;
    syncReturnCreditAlerts(state, "2026-10-04");
    expect(state.alerts[0].status).toBe("pending");
    state.alerts[0].status = "resolved";
    syncReturnCreditAlerts(state, "2026-10-04");
    expect(state.alerts[0].status).toBe("resolved");
  });
  it("does not create alerts for another company and retains duplicate audit records as resolved", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    const state = returnFixture();
    pickup(state);
    state.returns.push({
      ...structuredClone(state.returns[0]),
      id: "foreign",
      company_id: "another-company",
    });
    syncReturnCreditAlerts(state, "2026-10-20");
    state.alerts.push({ ...state.alerts[0], id: "older-duplicate" });
    syncReturnCreditAlerts(state, "2026-10-20");
    expect(state.alerts).toHaveLength(2);
    expect(
      state.alerts.filter((alert) => alert.status === "pending"),
    ).toHaveLength(1);
    expect(
      state.alerts.find((alert) => alert.id === "older-duplicate")!.status,
    ).toBe("resolved");
    expect(state.alerts.some((alert) => alert.return_id === "foreign")).toBe(
      false,
    );
  });
});
