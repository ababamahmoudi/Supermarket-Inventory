import { describe, expect, it } from "vitest";
import { returnCreateFixture } from "./return-create-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import { authoritySnapshot, bindAuthoritySnapshot } from "./authority";
import {
  createReturn,
  returnCreateChoices,
  type CreateReturnInput,
} from "./return-create";
import { returnView } from "./return-projections";
import { returnUiStatus } from "./return-workflow";
import { supplierPage } from "./suppliers";
import { supplierBalanceSummary } from "./supplier-balances";
import { recordPickup } from "./operations";
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
          /7\.1250|unit_cost|source_receipt|fictional-return-source|creation_request_id|creation_fingerprint/,
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
    ).toMatchObject({ issue: "source_currency", currency: "USD" });
    let before = JSON.stringify(state);
    expect(() => createReturn(state, actor, input)).toThrow("source_currency");
    expect(JSON.stringify(state)).toBe(before);
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
  });
});
