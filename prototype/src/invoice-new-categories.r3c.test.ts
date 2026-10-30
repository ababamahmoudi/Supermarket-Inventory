import { describe, expect, it } from "vitest";
import {
  actorAtLocation,
  authoritySnapshot,
  bindAuthoritySnapshot,
  cloneWithAuthority,
  freshActor,
} from "./authority";
import { authenticatedTestActor } from "./authority-test-fixture";
import { initialState } from "./e1-bootstrap";
import { attachReversals, reverseActivity } from "./history";
import { createInvoice } from "./invoice";
import {
  confirmInvoiceLineChecks,
  setInvoiceLineCategory,
} from "./invoice-checks";
import {
  answerInvoiceFreeCases,
  freeCaseActionQuote,
  groupInvoiceFreeCases,
  validFreeCaseGroup,
  type FreeCaseChoice,
} from "./invoice-free-cases";
import { invoiceLineAmount } from "./invoice-weight";
import { businessAuditRead } from "./business-audit-read";
import { invoiceWorkspaceRead } from "./invoice-workspace-read";
import {
  newInvoiceCategoriesRead,
  setNewInvoiceLineCategories,
} from "./invoice-new-categories";
import {
  receivingPriceProblem,
  receivingPriceQuote,
  setInvoiceReceivingPrice,
} from "./invoice-receiving-price";
import type { DemoState } from "./types";

function fixture() {
  const state = initialState();
  let floor = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1", "Branch 2"],
    name_en: "Fictional category receiver",
  });
  const authority = structuredClone(authoritySnapshot(state));
  authority.sessions.find(
    (session) => session.id === floor.session_id,
  )!.device_id = "fictional-category-device";
  authority.devices = [
    ...authority.devices,
    {
      id: "fictional-category-device",
      company_id: floor.company_id,
      name: "Fictional category device",
      location_id: "Branch 1",
      active: true,
      version: 1,
      registered_at: "2026-10-30T10:00:00.000Z",
      registered_by_user_id: floor.user_id,
    },
  ];
  bindAuthoritySnapshot(state, authority);
  floor = freshActor(state, floor);
  state.invoice = createInvoice(state, floor, "Branch 1");
  const existing = structuredClone(state.invoice.lines[0]);
  Object.assign(existing, {
    id: "existing",
    review_confirmed: true,
    low_confidence_fields: [],
    line_total: "91.23",
    quantity_entered: "17",
  });
  const next = (id: string) => ({
    ...structuredClone(existing),
    id,
    product_code: "NEW",
    description: `Fictional ${id} printed pack`,
    new_name_en: `Fictional ${id} 330 g`,
    pricing_category: "grocery",
    unit_cost_before_tax: "1.0000",
    qty_invoiced: 2,
    qty_received_at_posting: 1,
    refused_units: 0,
    quantity_unit: "units" as const,
    quantity_entered: "2",
    line_total: "2.00",
    line_tax: "0.00",
    tax_profile: "non_taxable",
    taxable: false,
    taxable_inferred: true,
    review_confirmed: false,
    low_confidence_fields: [
      "description",
      "pricing_category",
      "quantity_entered",
    ],
  });
  state.invoice.lines = [existing, next("new-a"), next("new-b")];
  Object.assign(state.invoice, {
    status: "review",
    subtotal: "95.23",
    tax: "0.00",
    final_total: "95.23",
    final_total_manual: true,
    low_confidence_fields: ["supplier_invoice_number", "tax"],
    reading_record: {
      source: "imported",
      file_name: "fictional-categories.png",
      page_sha256s: ["a".repeat(64)],
      models: [],
      reading_cost_usd: "0.0000",
      exported_at: "2026-10-30T12:00:00Z",
      ai_source: "Fictional source",
    },
  });
  state.activity.push({
    id: "fictional-existing-invoice-activity",
    company_id: floor.company_id,
    branch: "Branch 1",
    action: "Edit draft",
    by: floor.actor,
    at: "2026-10-30T11:00:00Z",
    entity_type: "invoice",
    entity_id: state.invoice.id,
  });
  return { state, floor };
}
function request(
  state: DemoState,
  actor: ReturnType<typeof authenticatedTestActor>,
) {
  const read = newInvoiceCategoriesRead(state, actor)!;
  return {
    invoice_id: state.invoice.id,
    expected_token: read.token,
    line_ids: read.line_ids,
    category: "grocery_taxable",
  };
}
const financial = (state: DemoState) => ({
  products: state.products,
  stock: state.stock,
  movements: state.stock_movements,
  ledger: state.ledger,
  approvals: state.approvals,
  suppliers: state.suppliers,
  bindings: state.supplier_items,
});

describe("F6 current new-product categories", () => {
  it("gives the actual Floor handler only the current IDs/count and opaque token without a read write", () => {
    const { state, floor } = fixture();
    const before = structuredClone(state);
    const read = invoiceWorkspaceRead(state, floor).newProductCategories!;
    expect(Object.keys(read).sort()).toEqual(["count", "line_ids", "token"]);
    expect(read).toMatchObject({ count: 2, line_ids: ["new-a", "new-b"] });
    expect(read.token).toMatch(/^sha256:[a-f\d]{64}$/);
    expect(state).toEqual(before);
  });

  it("changes exactly the NEW category questions, preserves paper/other rows and explicit tax, and audits one real receiver", () => {
    const { state, floor } = fixture();
    Object.assign(state.invoice.lines[2], {
      taxable_inferred: false,
      taxable: true,
      tax_profile: "non_taxable",
      line_tax: "0.17",
    });
    const before = structuredClone(state);
    setNewInvoiceLineCategories(
      state,
      floor,
      request(state, floor),
      new Date("2026-10-30T12:00:00Z"),
    );
    expect(financial(state)).toEqual(financial(before));
    expect(state.invoice.lines[0]).toEqual(before.invoice.lines[0]);
    for (const line of state.invoice.lines.slice(1)) {
      expect(line.pricing_category).toBe("grocery_taxable");
      expect(line.review_confirmed).toBe(false);
      expect(line.low_confidence_fields).toEqual([
        "description",
        "quantity_entered",
      ]);
      expect(line.checked_fields?.pricing_category.checked_by_user_id).toBe(
        floor.user_id,
      );
      expect(line.checked_fields?.pricing_category.checked_at).toBe(
        "2026-10-30T12:00:00.000Z",
      );
    }
    expect(state.invoice.lines[1]).toMatchObject({
      taxable: true,
      line_tax: "0.26",
    });
    expect(state.invoice.lines[2]).toMatchObject({
      taxable: true,
      tax_profile: "non_taxable",
      line_tax: "0.17",
      taxable_inferred: false,
    });
    for (const key of [
      "subtotal",
      "tax",
      "final_total",
      "final_total_manual",
      "low_confidence_fields",
      "file_data",
      "original_pages",
      "reading_record",
    ] as const)
      expect(state.invoice[key], key).toEqual(before.invoice[key]);
    for (const index of [1, 2])
      for (const key of [
        "description",
        "unit_cost_before_tax",
        "line_total",
        "quantity_entered",
        "qty_invoiced",
        "qty_received_at_posting",
        "pack_size",
      ] as const)
        expect(state.invoice.lines[index][key], key).toEqual(
          before.invoice.lines[index][key],
        );
    const added = state.activity.slice(before.activity.length);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      by: floor.actor,
      actor_user_id: floor.user_id,
      device_id: floor.device_id,
      at: "2026-10-30T12:00:00.000Z",
      reversible: true,
      entity_id: state.invoice.id,
      invoice_category_selection: {
        category: "grocery_taxable",
        count: 2,
        line_ids: ["new-a", "new-b"],
      },
    });
  });

  it("keeps the original K4 price/editor but requires genuine revalidation for the changed category", () => {
    const { state, floor } = fixture();
    setInvoiceReceivingPrice(
      state,
      floor,
      1,
      "1.49",
      receivingPriceQuote(state, 1),
    );
    const proposal = structuredClone(state.invoice.lines[1].receiving_price);
    setNewInvoiceLineCategories(state, floor, request(state, floor));
    expect(state.invoice.lines[1].receiving_price).toEqual(proposal);
    expect(receivingPriceProblem(state, 1)).toBe(true);
  });

  it.each(["missing", "duplicate", "existing", "invalid-category"])(
    "rejects %s targets atomically",
    (kind) => {
      const { state, floor } = fixture();
      const input = request(state, floor);
      if (kind === "missing") input.line_ids.pop();
      if (kind === "duplicate") input.line_ids = ["new-a", "new-a"];
      if (kind === "existing") input.line_ids = ["existing", "new-b"];
      if (kind === "invalid-category")
        input.category = "fictional-absent-category";
      const before = structuredClone(state);
      expect(() => setNewInvoiceLineCategories(state, floor, input)).toThrow();
      expect(state).toEqual(before);
    },
  );

  it.each([
    "matched",
    "added",
    "source",
    "cost",
    "config",
    "tax-config",
    "history",
    "earlier-history",
    "topology",
    "archived-category",
  ])("rejects a changed %s quote without a partial category write", (kind) => {
    const { state, floor } = fixture();
    const input = request(state, floor);
    if (kind === "matched") state.invoice.lines[1].product_code = "0002";
    if (kind === "added")
      state.invoice.lines.push({
        ...structuredClone(state.invoice.lines[1]),
        id: "new-c",
      });
    if (kind === "source")
      state.invoice.file_data = "fictional-changed-original";
    if (kind === "cost") state.invoice.lines[1].unit_cost_before_tax = "1.2345";
    if (kind === "config")
      state.config.pricing_categories[0].cost_divisor = "0.67";
    if (kind === "tax-config") state.config.tax.profiles[0].rate = "0.10";
    if (kind === "topology") state.config.branches[0].tax_region = "changed";
    if (kind === "archived-category")
      state.config.pricing_categories.find(
        (category) => category.key === input.category,
      )!.archived = true;
    if (kind === "earlier-history")
      state.activity.find((entry) => entry.entity_id === state.invoice.id)!.by =
        "Changed retained actor evidence";
    if (kind === "history")
      state.activity.push({
        id: "fictional-new-history-witness",
        company_id: floor.company_id,
        branch: "Branch 1",
        action: "Edit draft",
        by: floor.actor,
        at: new Date().toISOString(),
      });
    const before = structuredClone(state);
    expect(() => setNewInvoiceLineCategories(state, floor, input)).toThrow();
    expect(state).toEqual(before);
  });

  it.each(["posted", "cancelled", "reading"] as const)(
    "has no bulk affordance or write for %s invoices",
    (status) => {
      const { state, floor } = fixture();
      const input = request(state, floor);
      state.invoice.status = status;
      const before = structuredClone(state);
      expect(newInvoiceCategoriesRead(state, floor)).toBeNull();
      expect(() => setNewInvoiceLineCategories(state, floor, input)).toThrow();
      expect(state).toEqual(before);
    },
  );

  it("rejects another real receiver, location context, Cashier and foreign actor", () => {
    const { state, floor } = fixture();
    const input = request(state, floor);
    const manager = authenticatedTestActor(state, "manager");
    const cashier = authenticatedTestActor(state, "cashier");
    const anotherLocation = actorAtLocation(state, floor, "Branch 2");
    const foreign = initialState();
    foreign.config.company.seed_key = "fictional-foreign-company";
    const intruder = authenticatedTestActor(foreign, "manager");
    for (const actor of [manager, cashier, anotherLocation, intruder]) {
      const before = structuredClone(state);
      expect(() => setNewInvoiceLineCategories(state, actor, input)).toThrow();
      expect(state).toEqual(before);
    }
    expect(newInvoiceCategoriesRead(state, cashier)).toBeNull();
  });

  it("applies to the actual retained target without touching the active workspace, and real Undo restores it", () => {
    const { state, floor } = fixture();
    const target = structuredClone(state.invoice);
    state.invoices = [target];
    state.invoice = createInvoice(state, floor, "Branch 1");
    const active = structuredClone(state.invoice);
    const read = invoiceWorkspaceRead(
      state,
      floor,
      target.id,
    ).newProductCategories!;
    const input = {
      invoice_id: target.id,
      expected_token: read.token,
      line_ids: read.line_ids,
      category: "grocery_taxable",
    };
    const before = cloneWithAuthority(state);
    setNewInvoiceLineCategories(state, floor, input);
    expect(state.invoice).toEqual(active);
    expect(state.invoices[0].lines[1].pricing_category).toBe("grocery_taxable");
    expect(state.invoices[0].lines[0]).toEqual(target.lines[0]);
    const activity = attachReversals(before, state, floor).find(
      (entry) => entry.action === "Set category for new invoice products",
    )!;
    reverseActivity(state, floor, activity.id, "undo");
    expect(state.invoices[0]).toEqual(target);
    expect(state.invoice).toEqual(active);
    const restored = structuredClone(state);
    expect(() => setNewInvoiceLineCategories(state, floor, input)).toThrow();
    expect(state).toEqual(restored);
  });

  it.each(["session", "device", "revoked-session", "revoked-person"])(
    "rejects a changed %s atomically using fresh authority",
    (kind) => {
      const { state, floor } = fixture();
      const input = request(state, floor);
      let actor = floor;
      if (kind === "session")
        actor = authenticatedTestActor(state, "floor_worker", {
          locations: ["Branch 1", "Branch 2"],
          name_en: floor.actor,
        });
      else {
        const snapshot = structuredClone(authoritySnapshot(state));
        const session = snapshot.sessions.find(
          (row) => row.id === floor.session_id,
        )!;
        const person = snapshot.people.find((row) => row.id === floor.user_id)!;
        if (kind === "device") session.device_id = "fictional-other-device";
        if (kind === "revoked-session") session.state = "revoked";
        if (kind === "revoked-person") person.authority_epoch++;
        bindAuthoritySnapshot(state, snapshot);
      }
      const before = structuredClone(state);
      expect(() => setNewInvoiceLineCategories(state, actor, input)).toThrow();
      expect(state).toEqual(before);
    },
  );

  it.each(["processing", "no-new", "duplicate-id"])(
    "hides and atomically rejects %s canonical targets",
    (kind) => {
      const { state, floor } = fixture();
      const input = request(state, floor);
      if (kind === "processing")
        state.invoice.live_reading = {
          ...state.invoice.live_reading!,
          phase: "processing",
        };
      if (kind === "no-new")
        state.invoice.lines.forEach((line) => (line.product_code = "0001"));
      if (kind === "duplicate-id") state.invoice.lines[2].id = "new-a";
      const before = structuredClone(state);
      expect(newInvoiceCategoriesRead(state, floor)).toBeNull();
      expect(() => setNewInvoiceLineCategories(state, floor, input)).toThrow();
      expect(state).toEqual(before);
    },
  );

  it("refreshes only previously calculated headers and leaves unrelated missing paper questions and provenance exact", () => {
    const { state, floor } = fixture();
    Object.assign(state.invoice, {
      calculated_fields: ["subtotal"],
      calculated_from_lines: true,
      subtotal: "0.00",
      tax: "",
      final_total: "95.23",
      low_confidence_fields: ["tax", "supplier_invoice_number"],
    });
    const before = structuredClone(state.invoice);
    setNewInvoiceLineCategories(state, floor, request(state, floor));
    expect(state.invoice.subtotal).toBe("95.23");
    for (const field of [
      "tax",
      "final_total",
      "low_confidence_fields",
      "calculated_fields",
      "calculated_from_lines",
      "final_total_manual",
    ] as const)
      expect(state.invoice[field], field).toEqual(before[field]);
    expect(state.invoice.lines[0]).toEqual(before.lines[0]);
  });

  it("makes the genuine category choice without fabricating receipts for absent questions", () => {
    const { state, floor } = fixture();
    state.invoice.lines[1].low_confidence_fields = ["description"];
    setNewInvoiceLineCategories(state, floor, request(state, floor));
    expect(state.invoice.lines[1].pricing_category).toBe("grocery_taxable");
    expect(state.invoice.lines[1].checked_fields).toBeUndefined();
    expect(state.invoice.lines[1].low_confidence_fields).toEqual([
      "description",
    ]);
    expect(state.invoice.lines[1].review_confirmed).toBe(false);
  });

  it("does not publish a first row or an audit if a later inferred tax calculation fails", () => {
    const { state, floor } = fixture();
    state.invoice.lines[1].taxable_inferred = false;
    const category = state.config.pricing_categories.find(
      (item) => item.key === "grocery_taxable",
    )!;
    state.config.tax.profiles.find(
      (profile) => profile.key === category.default_tax_profile,
    )!.rate = "fictional-invalid-rate";
    const input = request(state, floor);
    const before = structuredClone(state);
    expect(() => setNewInvoiceLineCategories(state, floor, input)).toThrow();
    expect(state).toEqual(before);
  });

  it("retains weighed source basis and explicit paper tax while inferred tax follows the selected category", () => {
    const { state, floor } = fixture();
    Object.assign(state.invoice.lines[1], {
      sold_by: "weight",
      quantity_unit: "kg",
      quantity_entered: "2.500",
      source_quantity: "2.500",
      source_quantity_unit: "kg",
      source_cost_before_tax: "3.1234",
      source_cost_unit: "kg",
      line_total: "7.81",
      paper_line_total: "7.80",
    });
    const before = structuredClone(state.invoice.lines[1]);
    setNewInvoiceLineCategories(state, floor, request(state, floor));
    expect(state.invoice.lines[1].line_tax).toBe("1.02");
    for (const field of [
      "sold_by",
      "quantity_unit",
      "quantity_entered",
      "source_quantity",
      "source_quantity_unit",
      "source_cost_before_tax",
      "source_cost_unit",
      "line_total",
      "paper_line_total",
      "unit_cost_before_tax",
    ] as const)
      expect(state.invoice.lines[1][field], field).toEqual(before[field]);
  });

  it("real Undo restores the exact invoice, retains History, and retires the old action after ABA", () => {
    const { state, floor } = fixture();
    const input = request(state, floor);
    const before = cloneWithAuthority(state);
    setNewInvoiceLineCategories(state, floor, input);
    const activity = attachReversals(before, state, floor).find(
      (entry) => entry.action === "Set category for new invoice products",
    )!;
    expect(activity.reversible).toBe(true);
    reverseActivity(state, floor, activity.id, "undo");
    expect(state.invoice).toEqual(before.invoice);
    const restored = structuredClone(state);
    expect(newInvoiceCategoriesRead(state, floor)!.token).not.toBe(
      input.expected_token,
    );
    expect(() => setNewInvoiceLineCategories(state, floor, input)).toThrow();
    expect(state).toEqual(restored);
  });
});

function groupedFixture(choice?: FreeCaseChoice, inferredTax = true) {
  const current = fixture();
  const { state, floor } = current;
  const paid = structuredClone(state.invoice.lines[1]);
  Object.assign(paid, {
    id: "fictional-paid-member",
    description: "FICTIONAL MEADOW JAM 330G PAID",
    printed_description: "FICTIONAL MEADOW JAM 330G PAID",
    new_name_en: "Fictional Meadow Jam 330 g",
    qty_invoiced: 2,
    qty_received_at_posting: 2,
    units_per_case: 1,
    units_per_case_inferred: false,
    pack_size: "1 × 330 g",
    taxable_inferred: inferredTax,
    imported_unit_cost_basis: undefined,
    low_confidence_fields: ["description", "pricing_category"],
  });
  const free = {
    ...structuredClone(paid),
    id: "fictional-free-member",
    description: "FICTIONAL MEADOW JAM 330G FREE",
    printed_description: "FICTIONAL MEADOW JAM 330G FREE",
    qty_invoiced: 1,
    qty_received_at_posting: 1,
    quantity_entered: "1",
    unit_cost_before_tax: "0.0000",
    line_total: "0.00",
  };
  const groups = groupInvoiceFreeCases([paid, free]);
  expect(groups).toHaveLength(1);
  state.invoice.lines = [
    state.invoice.lines[0],
    groups[0],
    state.invoice.lines[2],
  ];
  if (choice)
    answerInvoiceFreeCases(
      state,
      floor,
      1,
      choice,
      freeCaseActionQuote(state, floor, 1),
      new Date("2026-10-30T12:00:00Z"),
    );
  return current;
}

describe("F6 categories with K8 protected paid/free answers", () => {
  it.each(["bonus", "two_for_one", "mistake"] as const)(
    "retains the valid %s answer and exact paper while inferred tax/category changes retire the K4 price",
    (choice) => {
      const { state, floor } = groupedFixture(choice);
      expect(validFreeCaseGroup(state.invoice.lines[1])).toBe(true);
      setInvoiceReceivingPrice(
        state,
        floor,
        1,
        "2.99",
        receivingPriceQuote(state, 1),
      );
      const before = structuredClone(state);
      const oldGroup = before.invoice.lines[1].free_case_group!;
      const oldFreeQuote = freeCaseActionQuote(state, floor, 1);
      setNewInvoiceLineCategories(
        state,
        floor,
        request(state, floor),
        new Date("2026-10-30T13:00:00Z"),
      );
      const line = state.invoice.lines[1];
      expect(validFreeCaseGroup(line)).toBe(true);
      expect(line).toMatchObject({
        pricing_category: "grocery_taxable",
        taxable: true,
        taxable_inferred: true,
        tax_profile: "hst_13",
        line_tax: "0.26",
        review_confirmed: false,
      });
      expect(invoiceLineAmount(line)).toBe("2.00");
      expect(line.free_case_group).toEqual({
        ...oldGroup,
        answer: {
          ...oldGroup.answer,
          basis: line.free_case_group!.answer!.basis,
        },
      });
      expect(line.free_case_group!.answer!.basis).not.toBe(
        oldGroup.answer!.basis,
      );
      expect(line.receiving_price).toEqual(
        before.invoice.lines[1].receiving_price,
      );
      expect(receivingPriceProblem(state, 1)).toBe(true);
      expect(line.low_confidence_fields).toEqual(["description"]);
      expect(state.invoice.lines[0]).toEqual(before.invoice.lines[0]);
      expect(financial(state)).toEqual(financial(before));
      for (const field of [
        "subtotal",
        "tax",
        "final_total",
        "reading_record",
        "original_pages",
        "file_data",
      ] as const)
        expect(state.invoice[field], field).toEqual(before.invoice[field]);
      const saved = structuredClone(state);
      expect(() =>
        answerInvoiceFreeCases(state, floor, 1, "bonus", oldFreeQuote),
      ).toThrow(/changed/);
      expect(state).toEqual(saved);
      const publicRead = invoiceWorkspaceRead(state, floor);
      expect(publicRead.lineDetails[1].freeCaseQuote).toMatch(/^sha256:/);
      expect(publicRead.invoice.lines[1].free_case).toMatchObject({
        decision: choice,
        valid: true,
      });
      expect(JSON.stringify(publicRead.invoice)).not.toMatch(
        /free_case_group|source_fingerprint/,
      );
      expect(
        JSON.stringify(businessAuditRead(state.activity.at(-1))),
      ).not.toMatch(/free_case_group|source_fingerprint/);
    },
  );

  it("retains explicit tax and its valid attributed answer through the shared single-line setter", () => {
    const { state } = groupedFixture("bonus", false);
    const line = state.invoice.lines[1];
    const before = structuredClone(line);
    setInvoiceLineCategory(line, "grocery_taxable", state.config);
    expect(validFreeCaseGroup(line)).toBe(true);
    expect(line.free_case_group).toEqual(before.free_case_group);
    for (const field of [
      "taxable",
      "tax_profile",
      "line_tax",
      "taxable_inferred",
    ] as const)
      expect(line[field], field).toEqual(before[field]);
    expect(line.pricing_category).toBe("grocery_taxable");
    expect(line.review_confirmed).toBe(false);
  });

  it.each(["single", "bulk"] as const)(
    "keeps an unanswered free-case question pending after a %s category choice",
    (mode) => {
      const { state, floor } = groupedFixture();
      if (mode === "single")
        setInvoiceLineCategory(
          state.invoice.lines[1],
          "grocery_taxable",
          state.config,
        );
      else setNewInvoiceLineCategories(state, floor, request(state, floor));
      const line = state.invoice.lines[1];
      expect(line.free_case_group!.answer).toBeUndefined();
      expect(line.free_case_group!.decision).toBeUndefined();
      expect(line.low_confidence_fields).toContain("free_case_decision");
      expect(validFreeCaseGroup(line)).toBe(false);
      expect(() => confirmInvoiceLineChecks(state, floor, 1)).toThrow(
        /free-case/,
      );
      expect(invoiceLineAmount(line)).toBe("2.00");
    },
  );

  for (const mode of ["single", "bulk"] as const)
    it.each(["qty", "cost", "lot"] as const)(
      `never revives a previously stale %s answer through a ${mode} category change`,
      (field) => {
        const { state, floor } = groupedFixture("bonus");
        const line = state.invoice.lines[1];
        const answer = structuredClone(line.free_case_group!.answer);
        if (field === "qty") line.qty_invoiced++;
        if (field === "cost") line.unit_cost_before_tax = "9.1234";
        if (field === "lot") line.lot_number = "fictional-changed-lot";
        expect(validFreeCaseGroup(line)).toBe(false);
        if (mode === "single")
          setInvoiceLineCategory(line, "grocery_taxable", state.config);
        else setNewInvoiceLineCategories(state, floor, request(state, floor));
        const result = state.invoice.lines[1];
        expect(result.pricing_category).toBe("grocery_taxable");
        expect(result.free_case_group!.answer).toEqual(answer);
        expect(validFreeCaseGroup(result)).toBe(false);
        expect(() => confirmInvoiceLineChecks(state, floor, 1)).toThrow(
          /free-case/,
        );
      },
    );

  it("retains valid group evidence on a saved target without changing the active workspace, and real Undo restores the exact target", () => {
    const { state, floor } = groupedFixture("two_for_one");
    const target = structuredClone(state.invoice);
    state.invoices = [target];
    state.invoice = createInvoice(state, floor, "Branch 1");
    const active = structuredClone(state.invoice);
    const read = invoiceWorkspaceRead(
      state,
      floor,
      target.id,
    ).newProductCategories!;
    const before = cloneWithAuthority(state);
    const input = {
      invoice_id: target.id,
      expected_token: read.token,
      line_ids: read.line_ids,
      category: "grocery_taxable",
    };
    setNewInvoiceLineCategories(state, floor, input);
    expect(state.invoice).toEqual(active);
    expect(validFreeCaseGroup(state.invoices[0].lines[1])).toBe(true);
    expect(state.invoices[0].lines[1].free_case_group!.answer).toMatchObject({
      by_user_id: target.lines[1].free_case_group!.answer!.by_user_id,
      at: target.lines[1].free_case_group!.answer!.at,
    });
    expect(invoiceLineAmount(state.invoices[0].lines[1])).toBe("2.00");
    const action = attachReversals(before, state, floor).find(
      (entry) => entry.action === "Set category for new invoice products",
    )!;
    reverseActivity(state, floor, action.id, "undo");
    expect(state.invoice).toEqual(active);
    expect(state.invoices[0]).toEqual(target);
    const restored = structuredClone(state);
    expect(() => setNewInvoiceLineCategories(state, floor, input)).toThrow();
    expect(state).toEqual(restored);
  });

  it("requires a fresh category review after a genuine free-case answer changes its canonical group", () => {
    const { state, floor } = groupedFixture();
    const pendingInput = request(state, floor);
    answerInvoiceFreeCases(
      state,
      floor,
      1,
      "bonus",
      freeCaseActionQuote(state, floor, 1),
    );
    const answered = structuredClone(state);
    expect(() =>
      setNewInvoiceLineCategories(state, floor, pendingInput),
    ).toThrow();
    expect(state).toEqual(answered);
    setNewInvoiceLineCategories(state, floor, request(state, floor));
    expect(validFreeCaseGroup(state.invoice.lines[1])).toBe(true);
  });
});
