import { describe, expect, it } from "vitest";
import { returnCreateFixture } from "./return-create-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  authoritySnapshot,
  bindAuthoritySnapshot,
  cloneWithAuthority,
} from "./authority";
import {
  createReturn,
  returnCreateChoices,
  type CreateReturnInput,
} from "./return-create";
import { returnView } from "./return-projections";
import { returnUiStatus } from "./return-workflow";
import { supplierPage } from "./suppliers";
import { supplierBalanceSummary } from "./supplier-balances";
import {
  recordPickup,
  correctReturnPickup,
  submitFinancialClaim,
  postReturnClaim,
  type OperationalReturn,
} from "./operations";
import { awaitingPickupReturnCredits } from "./return-credit-preview";
import { saveCompanySettings } from "./settings";
import {
  createInvoice,
  addManualLine,
  postInvoice,
  invoiceBlockers,
} from "./invoice";
import type { AuthenticatedActor, RoleId } from "./authority-types";
import type { ReturnCreationPhoto } from "./return-create-files";

function setup(role: RoleId = "manager") {
  const state = returnCreateFixture();
  const actor = authenticatedTestActor(state, role, {
    locations: ["Branch 1"],
  });
  const choices = returnCreateChoices(state, actor, "Branch 1"),
    product = choices.products[0];
  const input: CreateReturnInput = {
    request_id: "test-return-request-123",
    branch: "Branch 1",
    supplier_id: product.supplier_id,
    product_code: product.product_code,
    source_fingerprint: product.source_fingerprint,
    quantity: "2",
    quantity_unit: "units",
    reason: "wrong_item",
    note: "Invented test return",
    photos: [],
  };
  return { state, actor, choices, input };
}
const unchanged = (state: ReturnType<typeof returnCreateFixture>) =>
  JSON.stringify([
    state.products,
    state.invoices,
    state.invoice,
    state.stock,
    state.stock_movements,
    state.ledger,
    state.approvals,
  ]);
describe("R2c 7.1 canonical new return", () => {
  it.each([
    "owner",
    "manager",
    "branch_supervisor",
    "floor_worker",
    "cashier",
  ] as RoleId[])(
    "creates an attributed received-product return for %s without financial/stock effects",
    (role) => {
      const { state, actor, input } = setup(role),
        before = unchanged(state);
      const id = createReturn(state, actor, input);
      const record = state.returns.find((record) => record.id === id)!;
      expect(record).toMatchObject({
        company_id: actor.company_id,
        branch: "Branch 1",
        supplier: "Cloudbay Wholesale",
        currency: "CAD",
        status: "open",
        created_by_user_id: actor.user_id,
        created_by: actor.actor,
        created_by_role_snapshot: role,
        lines: [
          {
            product_code: "0003",
            qty: 2,
            unit_cost: "7.1250",
            reason: "wrong_item",
            source_receipt: { invoice_id: "fictional-return-source" },
          },
        ],
      });
      expect(returnUiStatus(record)).toBe("waiting_for_pickup");
      expect(unchanged(state)).toBe(before);
      expect(state.activity).toHaveLength(1);
      expect(state.activity[0]).toMatchObject({
        actor_user_id: actor.user_id,
        entity_id: id,
        action: "Created return",
        reversible: false,
      });
      expect(JSON.stringify(state.activity[0])).not.toMatch(
        /unit_cost|source_receipt|idb-file/,
      );
      const read = returnView(state, actor, id);
      expect(read.evidence?.[0]).toMatchObject({
        kind: "created",
        actor_user_id: actor.user_id,
      });
      if (role !== "owner" && role !== "manager")
        expect(JSON.stringify(read)).not.toMatch(
          /7\.1250|unit_cost|source_receipt|fictional-return-source|creation_request_id|creation_fingerprint|currency/,
        );
    },
  );
  it("exposes only received supplier/products and hides private costs from cashier/floor", () => {
    for (const role of [
      "cashier",
      "floor_worker",
      "branch_supervisor",
      "manager",
    ] as RoleId[]) {
      const { state, choices } = setup(role);
      expect(choices.suppliers).toEqual([
        { id: "return-cloudbay", name: "Cloudbay Wholesale" },
      ]);
      expect(choices.products[0]).toMatchObject({
        name_en: "Meadow Jar",
        barcode: "FICT-RETURN-JAR",
        quantity_unit: "units",
        last_received_at: "2026-10-21T14:00:00Z",
      });
      expect(choices.products[0].unit_cost).toBe(
        role === "manager" || role === "branch_supervisor"
          ? "7.1250"
          : undefined,
      );
      expect(JSON.stringify(choices)).not.toContain("fictional-return-source");
      expect(JSON.stringify(choices)).not.toContain("Net 30");
      expect(state.products.length).toBeGreaterThan(choices.products.length);
    }
  });
  it("is idempotent per actual creator/request while distinct genuine returns are allowed", () => {
    const { state, actor, input } = setup();
    const id = createReturn(state, actor, input);
    expect(createReturn(state, actor, { ...input, quantity: "02" })).toBe(id);
    expect(state.returns).toHaveLength(1);
    expect(state.activity).toHaveLength(1);
    const snapshot = JSON.stringify(state);
    expect(() =>
      createReturn(state, actor, { ...input, quantity: "3" }),
    ).toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(
      createReturn(state, actor, {
        ...input,
        request_id: "different-return-request",
      }),
    ).not.toBe(id);
    expect(state.returns).toHaveLength(2);
  });
  it("requires quantity/unit/reason/Other note and real photos for damaged/expired, atomically", () => {
    const { state, actor, input } = setup();
    for (const patch of [
      { quantity: "0" },
      { quantity: "-1" },
      { quantity: "1.5" },
      { quantity: "NaN" },
      { quantity_unit: "lb" },
      { reason: "other", note: " " },
      { reason: "damaged" },
      { reason: "expired" },
      { reason: "invented" },
      { request_id: "bad" },
      { photos: [{ name: "fake.png" } as ReturnCreationPhoto] },
    ]) {
      const before = JSON.stringify(state);
      expect(() =>
        createReturn(state, actor, { ...input, ...patch } as CreateReturnInput),
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    }
  });
  it("denies branch/company/forged/revoked/module-off/inactive sources without writes", () => {
    const { state, actor, input } = setup();
    const cashier = authenticatedTestActor(state, "cashier", {
      locations: ["Branch 2"],
    });
    const foreign = returnCreateFixture();
    foreign.config.company.seed_key = "foreign";
    const outsider = authenticatedTestActor(foreign, "owner");
    for (const denied of [
      cashier,
      outsider,
      { ...actor, role: "owner" } as AuthenticatedActor,
    ]) {
      const before = JSON.stringify(state);
      expect(() => createReturn(state, denied, input)).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    }
    for (const patch of [
      { branch: "all" },
      { branch: "Branch 2" },
      { supplier_id: "unknown" },
      { product_code: "0004" },
    ]) {
      const before = JSON.stringify(state);
      expect(() =>
        createReturn(state, actor, { ...input, ...patch }),
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    }
    state.config.modules.returns = false;
    let before = JSON.stringify(state);
    expect(() => createReturn(state, actor, input)).toThrow();
    expect(() => returnCreateChoices(state, actor, "Branch 1")).toThrow();
    expect(JSON.stringify(state)).toBe(before);
    state.config.modules.returns = true;
    state.config.branches[0].active = false;
    before = JSON.stringify(state);
    expect(() => createReturn(state, actor, input)).toThrow();
    expect(JSON.stringify(state)).toBe(before);
    state.config.branches[0].active = true;
    const snapshot = structuredClone(authoritySnapshot(state));
    snapshot.people.find((person) => person.id === actor.user_id)!.status =
      "deactivated";
    bindAuthoritySnapshot(state, snapshot);
    expect(() => createReturn(state, actor, input)).toThrow();
  });
  it("rejects draft-only, fully refused and changed receipt sources, but follows real later deliveries and supplier aliases", () => {
    const { state, actor, input } = setup();
    state.invoices![0].status = "draft";
    expect(returnCreateChoices(state, actor, "Branch 1").products).toEqual([]);
    state.invoices![0].status = "posted";
    state.invoices![0].lines[0].refused_units = 20;
    expect(returnCreateChoices(state, actor, "Branch 1").products).toEqual([]);
    state.invoices![0].lines[0].refused_units = 0;
    state.invoices![0].lines[0].unit_cost_before_tax = "7.2500";
    const before = JSON.stringify(state);
    expect(() => createReturn(state, actor, input)).toThrow("changed");
    expect(JSON.stringify(state)).toBe(before);
    const supplier = state.suppliers![0];
    supplier.previous_names = [supplier.name];
    supplier.name = "Cloudbay Market Supply";
    expect(
      returnCreateChoices(state, actor, "Branch 1").suppliers[0].name,
    ).toBe(supplier.name);
    state.invoices![0].short_receipt_keys = ["late1"];
    state.stock_movements = [
      {
        id: "fictional-return-source:delivery:late1:stock",
        company_id: actor.company_id,
        branch: "Branch 1",
        product_code: "0003",
        qty: 2,
        type: "short_resolved_received",
        reference: "Fictional late delivery",
        by: "Fictional receiver",
        at: "2026-10-23T14:00:00Z",
        invoice_id: "fictional-return-source",
        line_index: 0,
      },
    ];
    expect(
      returnCreateChoices(state, actor, "Branch 1").products[0]
        .last_received_at,
    ).toBe("2026-10-23T14:00:00Z");
  });
  it("shows unresolved currency/cost/ambiguity explicitly and never invents or relabels source cost", () => {
    const { state, actor, input } = setup();
    state.invoices![0].import_currency = "USD";
    expect(
      returnCreateChoices(state, actor, "Branch 1").products[0],
    ).toMatchObject({ issue: "source_currency" });
    let before = JSON.stringify(state);
    expect(() => createReturn(state, actor, input)).toThrow("source_currency");
    expect(JSON.stringify(state)).toBe(before);
    // Conflicting explicit USD and retained CAD ledger evidence has no usable denomination.
    const conflicting = returnCreateChoices(state, actor, "Branch 1")
      .products[0];
    expect(conflicting.currency).toBeUndefined();
    expect(conflicting.unit_cost).toBeUndefined();
    state.ledger[0].currency = "USD";
    expect(
      returnCreateChoices(state, actor, "Branch 1").products[0],
    ).toMatchObject({ issue: "source_currency", currency: "USD" });
    state.ledger[0].currency = "CAD";
    state.invoices![0].import_currency = state.config.company.currency;
    state.invoices![0].lines[0].unit_cost_before_tax = "";
    expect(
      returnCreateChoices(state, actor, "Branch 1").products[0].issue,
    ).toBe("source_cost");
    state.invoices![0].lines[0].unit_cost_before_tax = "7.1250";
    const second = structuredClone(state.invoices![0]);
    second.id = "second-receipt";
    second.lines[0].unit_cost_before_tax = "8.0000";
    state.invoices!.push(second);
    expect(
      returnCreateChoices(state, actor, "Branch 1").products[0].issue,
    ).toBe("source_ambiguous");
    before = JSON.stringify(state);
    expect(() => createReturn(state, actor, input)).toThrow("source_ambiguous");
    expect(JSON.stringify(state)).toBe(before);
  });
  it("uses the genuine manual invoice posting currency after company settings change, without guessing", () => {
    const { state, actor } = setup();
    state.invoice = createInvoice(state, actor, "Branch 1", true);
    Object.assign(state.invoice, {
      supplier: "Cloudbay Wholesale",
      supplier_confirmed: true,
      supplier_invoice_number: "FICTIONAL-MANUAL-CAD",
      file_name: "fictional-original.png",
      file_data: "data:image/png;base64,ZmFrZQ==",
    });
    addManualLine(state, actor, "0003");
    Object.assign(state.invoice.lines[0], {
      review_confirmed: true,
      date_confirmed: true,
      date_value: "2026-12-30",
    });
    expect(invoiceBlockers(state, actor)).toEqual([]);
    expect(postInvoice(state, actor)).toBe(true);
    expect(state.invoice.import_currency).toBeUndefined();
    expect(
      state.ledger.find(
        (entry) =>
          entry.invoice_id === state.invoice.id && entry.type === "invoice",
      )?.currency,
    ).toBe("CAD");
    const original = returnCreateChoices(state, actor, "Branch 1").products[0];
    expect(original).toMatchObject({ currency: "CAD", unit_cost: "7.1250" });
    expect(original.issue).toBeUndefined();
    saveCompanySettings(
      state,
      { ...state.config.company, currency: "USD" },
      actor,
    );
    const source = returnCreateChoices(state, actor, "Branch 1").products[0];
    expect(source).toMatchObject({ issue: "source_currency", currency: "CAD" });
    const input: CreateReturnInput = {
      request_id: "manual-posting-currency",
      branch: "Branch 1",
      supplier_id: source.supplier_id,
      product_code: source.product_code,
      source_fingerprint: source.source_fingerprint,
      quantity: "1",
      quantity_unit: "units",
      reason: "wrong_item",
      note: "Fictional manual receipt",
      photos: [],
    };
    const before = JSON.stringify(state);
    expect(() => createReturn(state, actor, input)).toThrow("source_currency");
    expect(JSON.stringify(state)).toBe(before);
    saveCompanySettings(
      state,
      { ...state.config.company, currency: "CAD" },
      actor,
    );
    const id = createReturn(state, actor, input);
    recordPickup(state, actor, id, {
      quantities: { "0003": 1 },
      representative: "Fictional Audit Driver",
      slip: "MANUAL-CAD-PICKUP",
    });
    expect(state.returns.find((record) => record.id === id)).toMatchObject({
      currency: "CAD",
      pickup_memos: [{ currency: "CAD", expected_credit: "7.13" }],
    });
  });
  it("blocks missing and conflicting retained currency evidence for manual receipts without writes", () => {
    const { state, actor, input } = setup();
    delete state.invoices![0].import_currency;
    state.ledger = [];
    let source = returnCreateChoices(state, actor, "Branch 1").products[0];
    expect(source.issue).toBe("source_currency");
    expect(source.currency).toBeUndefined();
    let before = JSON.stringify(state);
    expect(() =>
      createReturn(state, actor, {
        ...input,
        source_fingerprint: source.source_fingerprint,
      }),
    ).toThrow("source_currency");
    expect(JSON.stringify(state)).toBe(before);
    const invoice = state.invoices![0];
    state.ledger = ["CAD", "USD"].map((currency) => ({
      id: `conflicting-${currency}`,
      company_id: actor.company_id,
      branch: "Branch 1",
      supplier: invoice.supplier,
      invoice_id: invoice.id,
      type: "invoice",
      date: "2026-10-21",
      reference: "FICTIONAL-CURRENCY-CONFLICT",
      amount: "142.50",
      currency,
    }));
    source = returnCreateChoices(state, actor, "Branch 1").products[0];
    expect(source.issue).toBe("source_currency");
    expect(source.currency).toBeUndefined();
    before = JSON.stringify(state);
    expect(() =>
      createReturn(state, actor, {
        ...input,
        source_fingerprint: source.source_fingerprint,
      }),
    ).toThrow("source_currency");
    expect(JSON.stringify(state)).toBe(before);
  });
  it("appears in supplier/Payables immediately without deduction; genuine pickup moves it once to pending credit", () => {
    const { state, actor, input } = setup();
    const before = supplierBalanceSummary(state, actor, "Cloudbay Wholesale");
    const id = createReturn(state, actor, input);
    const after = supplierBalanceSummary(state, actor, "Cloudbay Wholesale");
    expect(after.balance).toBe(before.balance);
    expect(after.pending_credit).toBe(before.pending_credit);
    expect(after.awaiting_pickup_returns).toMatchObject([
      { return_id: id, amount: "14.25", deducted: false },
    ]);
    expect(
      supplierPage(state, actor, "Cloudbay Wholesale").returns.some(
        (record) => record.id === id,
      ),
    ).toBe(true);
    // The immutable return cost survives later source/catalog price changes.
    state.invoices![0].lines[0].unit_cost_before_tax = "20.0000";
    state.products.find(
      (product) => product.code === "0003",
    )!.last_cost_before_tax = "30.0000";
    recordPickup(state, actor, id, {
      quantities: { "0003": 2 },
      representative: "Fictional Driver",
      slip: "FICT-PICKUP-1",
    });
    const picked = supplierBalanceSummary(state, actor, "Cloudbay Wholesale");
    expect(picked.awaiting_pickup_returns).toEqual([]);
    expect(picked.pending_credit).toBe("14.25");
    expect(picked.balance).toBe("128.25");
    expect(state.ledger).toHaveLength(1);
  });
  it("uses the immutable creation receipt despite unrelated later purchases with ambiguous costs", () => {
    const { state, actor, input } = setup();
    const id = createReturn(state, actor, input);
    for (const [invoiceId, cost] of [
      ["future-one", "8.0000"],
      ["future-two", "9.0000"],
    ]) {
      const next = structuredClone(state.invoices![0]);
      next.id = invoiceId;
      next.posted_at = "2026-10-25T15:01:00Z";
      next.received_at = "2026-10-25T15:00:00Z";
      next.lines[0].unit_cost_before_tax = cost;
      state.invoices!.push(next);
    }
    expect(
      returnCreateChoices(state, actor, "Branch 1").products[0].issue,
    ).toBe("source_ambiguous");
    const legacy = cloneWithAuthority(state);
    delete legacy.returns.find((record) => record.id === id)!
      .creation_request_id;
    const legacyBefore = JSON.stringify(legacy);
    expect(() =>
      recordPickup(legacy, actor, id, {
        quantities: { "0003": 2 },
        representative: "Fictional Audit Driver",
        slip: "LEGACY-AMBIGUITY-CHECK",
      }),
    ).toThrow("return_cost");
    expect(JSON.stringify(legacy)).toBe(legacyBefore);
    recordPickup(state, actor, id, {
      quantities: { "0003": 2 },
      representative: "Fictional Audit Driver",
      slip: "FROZEN-RECEIPT-PICKUP",
    });
    expect(
      state.returns.find((record) => record.id === id)?.pickup_memos?.[0],
    ).toMatchObject({
      currency: "CAD",
      expected_credit: "14.25",
      lines: [{ unit_cost: "7.1250" }],
    });
  });
  it("retains source currency after a real company settings change and rejects pickup without any write", () => {
    const { state, actor, input } = setup();
    const id = createReturn(state, actor, input);
    expect(awaitingPickupReturnCredits(state, actor)).toMatchObject([
      {
        return_id: id,
        amount: "14.25",
        currency: "CAD",
        currency_mismatch: false,
      },
    ]);
    saveCompanySettings(
      state,
      { ...state.config.company, currency: "USD" },
      actor,
    );
    const before = JSON.stringify(state);
    expect(awaitingPickupReturnCredits(state, actor)).toMatchObject([
      {
        return_id: id,
        amount: "14.25",
        currency: "CAD",
        currency_mismatch: true,
      },
    ]);
    const summary = supplierBalanceSummary(state, actor, "Cloudbay Wholesale");
    expect(summary.awaiting_pickup_credit).toBe("0.00");
    expect(summary.pending_credit).toBe("0.00");
    expect(summary.balance).toBe("0.00");
    expect(() =>
      recordPickup(state, actor, id, {
        quantities: { "0003": 2 },
        representative: "Fictional Audit Driver",
        slip: "CURRENCY-PICKUP-1",
      }),
    ).toThrow("return_currency");
    expect(JSON.stringify(state)).toBe(before);
    // No guessed FX: restoring the actual currency makes the original CAD snapshot usable again.
    saveCompanySettings(
      state,
      { ...state.config.company, currency: "CAD" },
      actor,
    );
    recordPickup(state, actor, id, {
      quantities: { "0003": 2 },
      representative: "Fictional Audit Driver",
      slip: "CURRENCY-PICKUP-1",
    });
    expect(
      state.returns.find((record) => record.id === id)?.pickup_memos?.[0],
    ).toMatchObject({ currency: "CAD", expected_credit: "14.25" });
  });
  it("rejects correction, new financial claims and posting retained claims after currency changes, atomically", () => {
    const { state, actor, input } = setup();
    const id = createReturn(state, actor, input);
    recordPickup(state, actor, id, {
      quantities: { "0003": 2 },
      representative: "Fictional Audit Driver",
      slip: "CURRENCY-PICKUP-2",
    });
    submitFinancialClaim(state, actor, id, {
      type: "cash_or_other",
      covers: { "0003": 2 },
      document: "FICTIONAL-CAD-REFUND",
      amount: "14.25",
    });
    const record = state.returns.find((record) => record.id === id)!;
    const claimId = (record as OperationalReturn).claims![0].id;
    const memoId = record.pickup_memos![0].id;
    saveCompanySettings(
      state,
      { ...state.config.company, currency: "USD" },
      actor,
    );
    const before = JSON.stringify(state);
    for (const attempt of [
      () =>
        correctReturnPickup(state, actor, id, {
          memo_id: memoId,
          quantities: { "0003": 2 },
          reason: "Fictional correction review",
        }),
      () =>
        submitFinancialClaim(state, actor, id, {
          type: "cash_or_other",
          covers: { "0003": 2 },
          document: "FICTIONAL-USD-REFUND",
          amount: "14.25",
        }),
      () => postReturnClaim(state, actor, id, claimId, "14.25"),
    ]) {
      expect(attempt).toThrow("return_currency");
      expect(JSON.stringify(state)).toBe(before);
    }
    expect(
      supplierBalanceSummary(state, actor, "Cloudbay Wholesale").pending_credit,
    ).toBe("0.00");
    expect(record.pickup_memos![0].currency).toBe("CAD");
    saveCompanySettings(
      state,
      { ...state.config.company, currency: "CAD" },
      actor,
    );
    postReturnClaim(state, actor, id, claimId, "14.25");
    expect(state.ledger.at(-1)).toMatchObject({
      type: "credit",
      amount: "-14.25",
      currency: "CAD",
    });
  });
  it("allows explicit aggregate location choice and weight quantities with a canonical lb unit", () => {
    const { state, actor } = setup();
    const all = authenticatedTestActor(state, "manager", {
      user_id: "aggregate-manager",
      selection: { kind: "all_locations" },
    });
    expect(returnCreateChoices(state, all, "Branch 1").products).toHaveLength(
      1,
    );
    state.invoices![0].lines[0].sold_by = "weight";
    state.products.find((product) => product.code === "0003")!.sold_by =
      "weight";
    const source = returnCreateChoices(state, actor, "Branch 1").products[0];
    const id = createReturn(state, actor, {
      request_id: "weight-return-request",
      branch: "Branch 1",
      supplier_id: source.supplier_id,
      product_code: source.product_code,
      source_fingerprint: source.source_fingerprint,
      quantity: "1.125",
      quantity_unit: "lb",
      reason: "short_dated",
      note: "",
      photos: [],
    });
    expect(
      state.returns.find((record) => record.id === id)?.lines[0],
    ).toMatchObject({ qty: 1.125, quantity_unit: "lb", unit_cost: "7.1250" });
    recordPickup(state, actor, id, {
      quantities: { "0003": 1.125 },
      representative: "Fictional Weight Driver",
      slip: "WEIGHT-PICKUP-THREE-DECIMALS",
    });
    expect(state.returns.find((record) => record.id === id)).toMatchObject({
      status: "picked_up",
      lines: [{ picked_up: 1.125 }],
      pickup_memos: [
        {
          currency: "CAD",
          expected_credit: "8.02",
          lines: [{ quantity: 1.125 }],
        },
      ],
    });
  });
  it("rejects four-decimal lb quantities before any canonical write", () => {
    const { state, actor, input } = setup();
    state.invoices![0].lines[0].sold_by = "weight";
    state.products.find((product) => product.code === "0003")!.sold_by =
      "weight";
    const source = returnCreateChoices(state, actor, "Branch 1").products[0];
    const before = JSON.stringify(state);
    for (const quantity of ["1.1234", "0.0001", "2.9999"]) {
      expect(() =>
        createReturn(state, actor, {
          ...input,
          source_fingerprint: source.source_fingerprint,
          quantity_unit: "lb",
          quantity,
        }),
      ).toThrow("quantity");
      expect(JSON.stringify(state)).toBe(before);
    }
  });
});
