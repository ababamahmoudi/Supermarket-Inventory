import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  actorAtLocation,
  authoritySnapshot,
  bindAuthoritySnapshot,
} from "./authority";
import {
  approvalProductEditRead,
  editAndApproveProduct,
  type ApprovalProductEdits,
} from "./approval-product-editor";
import { regularPrice } from "./catalog";
import { calculatePrice } from "./pricing";
import { productStoreCost } from "./product-costs";
import { setManualPriceMarker } from "./manual-prices";
import { capturePriceUpdateChanges } from "./price-updates";
import type { Approval, DemoState } from "./types";
const now = new Date("2026-10-26T16:30:00Z");
function fixture(role: "owner" | "manager" = "manager") {
  const state = initialState();
  const actor = authenticatedTestActor(state, role, {
    selection: { kind: "location", location_id: "Branch 1" },
  });
  const product = state.products.find((entry) => entry.code === "0009")!;
  state.approvals = state.approvals.filter(
    (entry) => entry.product_code !== product.code,
  );
  state.offers = state.offers.filter(
    (entry) => entry.product_code !== product.code,
  );
  state.sales = state.sales?.filter(
    (entry) => entry.product_code !== product.code,
  );
  product.name_en = "Silvercliff Test Crackers";
  product.name_fa = "کراکر آزمایشی";
  product.main_supplier = "Silvercliff Test Supply";
  product.pricing_category = "grocery";
  product.date_tracking = false;
  product.sold_by = "each";
  product.selling_price = "2.49";
  product.branch_prices = {};
  product.status = "pending_approval";
  product.pending_price = "1.99";
  state.suppliers ??= [];
  state.suppliers.push({
    id: "r2c-test-supplier",
    company_id: actor.company_id,
    name: product.main_supplier,
    phone: "",
    email: "",
    sales_rep_name: "",
    sales_rep_phone: "",
    payment_terms: "",
    active: true,
    status: "confirmed",
    created_at: now.toISOString(),
    created_by: actor.actor,
  });
  state.supplier_items ??= [];
  state.supplier_items.push({
    id: "r2c-test-item",
    company_id: actor.company_id,
    supplier_id: "r2c-test-supplier",
    supplier_name: product.main_supplier,
    product_code: product.code,
    supplier_item_code: "SC-ORIGINAL",
    units_per_case: 12,
    created_at: now.toISOString(),
    created_by: actor.actor,
  });
  const approval: Approval = {
    id: "r2c-edit-approval",
    company_id: actor.company_id,
    branch: "Branch 1",
    product_code: product.code,
    type: "new_product",
    status: "pending",
    unit_cost: "1.2500",
    proposed_price: "1.99",
    pricing_category: "grocery",
    created_at: now.toISOString(),
  };
  state.approvals.push(approval);
  const read = () => approvalProductEditRead(state, actor, approval.id);
  const edits = (
    patch: Partial<ApprovalProductEdits> = {},
  ): ApprovalProductEdits => ({
    name_en: product.name_en,
    name_fa: product.name_fa,
    description_en: "",
    description_fa: "",
    unit_size: product.unit_size,
    ai_category: product.ai_category,
    pricing_category: "grocery",
    barcode: product.barcode,
    main_supplier: product.main_supplier,
    date_tracking: false,
    date_tracking_stop: "keep",
    sold_by: "each",
    scope: "all",
    taxable: false,
    supplier_item_code: "SC-ORIGINAL",
    selling_price: "1.99",
    reason: "",
    minimum_margin_confirmed: false,
    ...patch,
  });
  const save = (
    patch: Partial<ApprovalProductEdits> = {},
    scope: "all" | "branch" = "all",
    target = "Branch 1",
  ) =>
    editAndApproveProduct(
      state,
      actor,
      approval.id,
      edits(patch),
      read().expectedSnapshot,
      scope,
      target,
      now,
    );
  return { state, actor, product, approval, read, edits, save };
}
function immutable(state: DemoState) {
  return structuredClone({
    invoices: state.invoices,
    invoice: state.invoice,
    ledger: state.ledger,
    stock: state.stock,
    stock_movements: state.stock_movements,
    invoice_content_corrections: state.invoice_content_corrections,
    invoice_location_corrections: state.invoice_location_corrections,
  });
}

describe("R2c4.2 atomic full-product approval", () => {
  it.each(["owner", "manager"] as const)(
    "projects only an authorized product-sized editor for %s, with a current category calculation",
    (role) => {
      const { state, actor, read, approval } = fixture(role);
      const before = structuredClone(state),
        result = read();
      expect(result).toMatchObject({
        existingProduct: { name_en: "Silvercliff Test Crackers" },
        unitCost: "1.2500",
        proposedPrice: "1.99",
        supplierItemCode: "SC-ORIGINAL",
        branch: "Branch 1",
        approvalType: "new_product",
      });
      expect(result.expectedSnapshot).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(result.existingProduct).not.toHaveProperty("last_cost_before_tax");
      expect(result).not.toHaveProperty("activity");
      expect(result).not.toHaveProperty("authority");
      expect(
        approvalProductEditRead(state, actor, approval.id, "rice")
          .calculatedPrice,
      ).toBe(calculatePrice("1.2500", "rice", state.config).selling_price);
      expect(state).toEqual(before);
    },
  );
  it("saves every requested field, a date and the supplier code, and approves once with before/after audit", () => {
    const { state, actor, product, approval, save } = fixture();
    state.supplier_items!.find(
      (entry) => entry.id === "r2c-test-item",
    )!.supplier_item_code_inferred = true;
    const before = immutable(state),
      activity = state.activity.length;
    save({
      name_en: "Updated Test Crackers",
      name_fa: "کراکر تازه آزمایشی",
      description_en: "Invented English description",
      description_fa: "شرح خیالی",
      unit_size: "250 g",
      pricing_category: "grocery_taxable",
      taxable: true,
      barcode: "9988000011223",
      supplier_item_code: "SC-UPDATED",
      date_tracking: true,
      date_reminder_days: 21,
      dates: [
        {
          product_code: product.code,
          branch: "Branch 1",
          date_type: "expiry",
          date: "2026-12-20",
          quantity: "12",
          lot_number: "FICTIONAL-LOT",
        },
      ],
      selling_price: calculatePrice("1.2500", "grocery_taxable", state.config)
        .selling_price,
    });
    const saved = state.products.find((entry) => entry.code === product.code)!;
    expect(saved).toMatchObject({
      name_en: "Updated Test Crackers",
      name_fa: "کراکر تازه آزمایشی",
      description_en: "Invented English description",
      unit_size: "250 g",
      pricing_category: "grocery_taxable",
      taxable: true,
      barcode: "9988000011223",
      date_tracking: true,
      date_reminder_days: 21,
      status: "active",
      selling_price: "1.99",
    });
    expect(
      state.approvals.find((entry) => entry.id === approval.id),
    ).toMatchObject({ status: "approved", decided_by_user_id: actor.user_id });
    expect(
      state.supplier_items!.find((entry) => entry.id === "r2c-test-item"),
    ).toMatchObject({
      supplier_item_code: "SC-UPDATED",
      supplier_item_code_inferred: false,
      units_per_case: 12,
      source_keys: [
        { product_code: product.code, supplier_item_code: "SC-ORIGINAL" },
      ],
    });
    expect(
      state.expiry.some(
        (entry) =>
          entry.product_code === product.code && entry.date === "2026-12-20",
      ),
    ).toBe(true);
    expect(immutable(state)).toEqual(before);
    expect(state.activity.slice(activity)).toHaveLength(1);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Edit and approve product",
      actor_user_id: actor.user_id,
      at: now.toISOString(),
      entity_id: approval.id,
      before: { product: { name_en: "Silvercliff Test Crackers" } },
      after: {
        product: { name_en: "Updated Test Crackers" },
        approval: { status: "approved" },
      },
    });
  });
  it("uses a new configured category calculation, without changing any configured rounding or invoice cost", () => {
    const { state, product, save } = fixture();
    const before = immutable(state),
      expected = calculatePrice("1.2500", "rice", state.config).selling_price;
    save({ pricing_category: "rice", selling_price: expected });
    expect(
      state.products.find((entry) => entry.code === product.code),
    ).toMatchObject({ pricing_category: "rice", selling_price: expected });
    expect(
      state.approvals.find((entry) => entry.id === "r2c-edit-approval"),
    ).toMatchObject({
      proposed_price: expected,
      unit_cost: "1.2500",
      manual_override: false,
    });
    expect(immutable(state)).toEqual(before);
  });
  it("allows a reasoned manual selling price and retains its provenance", () => {
    const { state, product, save } = fixture();
    save({ selling_price: "3.49", reason: "Fictional manual price decision" });
    expect(
      regularPrice(
        state,
        state.products.find((entry) => entry.code === product.code)!,
        "Branch 1",
      ),
    ).toBe("3.49");
    expect(
      state.approvals.find((entry) => entry.id === "r2c-edit-approval"),
    ).toMatchObject({
      status: "approved",
      manual_override: true,
      acknowledgment_reason: "Fictional manual price decision",
    });
  });
  it.each([
    { patch: { selling_price: "1.30" }, error: "margin" },
    {
      patch: { selling_price: "1.30", minimum_margin_confirmed: true },
      error: "reason",
    },
    { patch: { selling_price: "3.49" }, error: "reason" },
    { patch: { selling_price: "1.999" }, error: "price" },
    { patch: { selling_price: "0" }, error: "price" },
    { patch: { pricing_category: "unconfigured" }, error: "pricing_category" },
    { patch: { name_en: "" }, error: "name_en" },
  ])(
    "rejects $error with no partial product, approval, supplier or financial writes",
    ({ patch, error }) => {
      const { state, save } = fixture();
      const before = structuredClone(state);
      expect(() => save(patch)).toThrow(error);
      expect(state).toEqual(before);
    },
  );
  it("requires both below-minimum acknowledgment and a reason, then records the exact margin", () => {
    const { state, save } = fixture();
    save({
      selling_price: "1.30",
      minimum_margin_confirmed: true,
      reason: "Fictional below-minimum decision",
    });
    expect(
      state.approvals.find((entry) => entry.id === "r2c-edit-approval"),
    ).toMatchObject({
      status: "approved",
      proposed_price: "1.30",
      margin: "0.03846154",
    });
    expect(state.activity.at(-1)?.after).toMatchObject({
      minimum_margin_confirmed: true,
      reason: "Fictional below-minimum decision",
    });
  });
  it.each(["floor_worker", "cashier", "branch_supervisor"] as const)(
    "denies %s read and edit, including direct calls for another branch",
    (role) => {
      const { state, approval, edits, read } = fixture();
      const expected = read().expectedSnapshot;
      const forbidden = authenticatedTestActor(state, role, {
        locations: ["Branch 2"],
        selection: { kind: "location", location_id: "Branch 2" },
      });
      const before = structuredClone(state);
      expect(() =>
        approvalProductEditRead(state, forbidden, approval.id),
      ).toThrow();
      expect(() =>
        editAndApproveProduct(state, forbidden, approval.id, edits(), expected),
      ).toThrow();
      expect(state).toEqual(before);
    },
  );
  it("never reads or edits a same-id approval from a different company", () => {
    const { state, actor, approval, edits, read } = fixture();
    const expected = read().expectedSnapshot;
    const foreign = structuredClone(state);
    foreign.config.company.seed_key = "foreign-fictional-market";
    const outsider = authenticatedTestActor(foreign, "manager");
    const before = structuredClone(state);
    expect(() =>
      approvalProductEditRead(state, outsider, approval.id),
    ).toThrow();
    expect(() =>
      editAndApproveProduct(state, outsider, approval.id, edits(), expected),
    ).toThrow();
    state.approvals.find((entry) => entry.id === approval.id)!.company_id =
      "foreign-fictional-market";
    const changed = structuredClone(state);
    expect(() => approvalProductEditRead(state, actor, approval.id)).toThrow();
    expect(() =>
      editAndApproveProduct(state, actor, approval.id, edits(), expected),
    ).toThrow();
    expect(state).toEqual(changed);
    state.approvals.find((entry) => entry.id === approval.id)!.company_id =
      actor.company_id;
    expect(state).toEqual(before);
  });
  it("rejects a stale product, supplier code, source cost or pricing configuration without publishing edits", () => {
    for (const mutate of [
      (state: DemoState) => {
        state.products.find((entry) => entry.code === "0009")!.name_en =
          "Concurrent change";
      },
      (state: DemoState) => {
        state.supplier_items!.find(
          (entry) => entry.id === "r2c-test-item",
        )!.supplier_item_code = "CONCURRENT";
      },
      (state: DemoState) => {
        state.approvals.find(
          (entry) => entry.id === "r2c-edit-approval",
        )!.unit_cost = "1.5000";
      },
      (state: DemoState) => {
        state.config.pricing_categories[0].cost_divisor = "0.70";
      },
    ]) {
      const { state, actor, approval, edits, read } = fixture(),
        expected = read().expectedSnapshot;
      mutate(state);
      const before = structuredClone(state);
      expect(() =>
        editAndApproveProduct(
          state,
          actor,
          approval.id,
          edits({ name_en: "Stale attempted edit" }),
          expected,
        ),
      ).toThrow("stale");
      expect(state).toEqual(before);
    }
  });
  it("rejects an already-decided approval and a revoked current actor", () => {
    const { state, actor, approval, edits, read } = fixture(),
      expected = read().expectedSnapshot;
    state.approvals.find((entry) => entry.id === approval.id)!.status =
      "approved";
    expect(() =>
      editAndApproveProduct(state, actor, approval.id, edits(), expected),
    ).toThrow("pending");
    state.approvals.find((entry) => entry.id === approval.id)!.status =
      "pending";
    const authority = structuredClone(authoritySnapshot(state));
    authority.people.find((person) => person.id === actor.user_id)!.status =
      "deactivated";
    bindAuthoritySnapshot(state, authority);
    const before = structuredClone(state);
    expect(() =>
      editAndApproveProduct(state, actor, approval.id, edits(), expected),
    ).toThrow();
    expect(state).toEqual(before);
  });
  it("does not partially publish metadata when a later supplier write fails", () => {
    const { state, save } = fixture();
    const before = structuredClone(state);
    expect(() =>
      save({
        name_en: "Must remain unsaved",
        main_supplier: "Missing fictional supplier",
        supplier_item_code: "UNKNOWN",
      }),
    ).toThrow("supplier");
    expect(state).toEqual(before);
  });
  it("does not create a separate barcode-conflict request or save anything after a duplicate barcode", () => {
    const { state, product, save } = fixture();
    const conflict = state.products.find(
      (entry) => entry.code !== product.code && entry.barcode,
    )!;
    const before = structuredClone(state);
    expect(() =>
      save({ name_en: "Must remain unsaved", barcode: conflict.barcode }),
    ).toThrow("barcode_conflict");
    expect(state).toEqual(before);
  });
  it("keeps concrete-branch approval prices scoped and rejects a non-selling target atomically", () => {
    const { state, product, save } = fixture();
    save(
      { selling_price: "3.49", reason: "Fictional one-location price" },
      "branch",
      "Branch 1",
    );
    const saved = state.products.find((entry) => entry.code === product.code)!;
    expect(saved.selling_price).toBe("2.49");
    expect(saved.branch_prices).toMatchObject({ "Branch 1": "3.49" });
    const second = fixture();
    second.approval.branch = "all";
    const before = structuredClone(second.state);
    expect(() => second.save({}, "branch", "Warehouse")).toThrow();
    expect(second.state).toEqual(before);
  });
  it("retains the original margin-review decision when keeping the current price", () => {
    const { state, actor, approval, product, save } = fixture();
    approval.type = "margin_review";
    approval.proposed_price = "2.49";
    save({ selling_price: "2.49", reason: "Fictional keep-current decision" });
    expect(
      state.approvals.find((entry) => entry.id === approval.id),
    ).toMatchObject({
      type: "margin_review",
      status: "approved",
      decided_by_user_id: actor.user_id,
    });
    expect(
      state.approvals.filter(
        (entry) =>
          entry.product_code === product.code && entry.status === "pending",
      ),
    ).toHaveLength(0);
    expect(
      regularPrice(
        state,
        state.products.find((entry) => entry.code === product.code)!,
        "Branch 1",
      ),
    ).toBe("2.49");
  });
  it("uses the existing reasoned override and approval path for a changed margin-review price", () => {
    const { state, approval, product, save } = fixture();
    approval.type = "margin_review";
    approval.proposed_price = "2.49";
    save({ selling_price: "3.49", reason: "Fictional margin correction" });
    expect(
      state.approvals.find((entry) => entry.id === approval.id),
    ).toMatchObject({ type: "margin_review", status: "approved" });
    expect(
      state.approvals.filter(
        (entry) =>
          entry.product_code === product.code &&
          entry.manual_override &&
          entry.status === "approved",
      ),
    ).toHaveLength(1);
    expect(
      state.approvals.filter(
        (entry) =>
          entry.product_code === product.code && entry.status === "pending",
      ),
    ).toHaveLength(0);
    expect(
      regularPrice(
        state,
        state.products.find((entry) => entry.code === product.code)!,
        "Branch 1",
      ),
    ).toBe("3.49");
  });
  it("keeps the explicit manual-price review and rejects an unreviewed custom target", () => {
    const { state, actor, product, approval, read, edits } = fixture();
    product.status = "active";
    const cost = productStoreCost(
      state,
      actorAtLocation(state, actor, "Branch 1"),
      product,
    )!;
    approval.unit_cost = cost;
    const calculated = calculatePrice(
      cost,
      "grocery",
      state.config,
    ).selling_price;
    product.branch_prices = { "Branch 1": "6.49" };
    approval.proposed_price = calculated;
    approval.type = "price_change";
    approval.manual_price_review = {
      kept_price: "6.49",
      calculated_price: calculated,
      prior_cost: "1.0000",
      received_cost: cost,
      receiver_recommendation: "rule",
    };
    setManualPriceMarker(state, actor, product, "Branch 1", "6.49", now, cost);
    const expected = read().expectedSnapshot,
      before = structuredClone(state);
    expect(() =>
      editAndApproveProduct(
        state,
        actor,
        approval.id,
        edits({ selling_price: "9.99", reason: "Unreviewed custom target" }),
        expected,
      ),
    ).toThrow("manual_price_choice");
    expect(state).toEqual(before);
    editAndApproveProduct(
      state,
      actor,
      approval.id,
      edits({
        selling_price: "6.49",
        manual_price_choice: "keep",
        minimum_margin_confirmed: true,
        reason: "Fictional keep-manual decision",
      }),
      expected,
      "branch",
      "Branch 1",
      now,
    );
    expect(
      state.approvals.find((entry) => entry.id === approval.id)
        ?.manual_price_review?.decision,
    ).toBe("keep");
    expect(
      regularPrice(
        state,
        state.products.find((entry) => entry.code === product.code)!,
        "Branch 1",
      ),
    ).toBe("6.49");
  });
  it("feeds normal per-store price-update tasks with the single genuine decision", () => {
    const { state, actor, product, save } = fixture();
    state.price_update_tasks = [];
    const before = structuredClone(state);
    save({ selling_price: "3.49", reason: "Fictional apply-to-all decision" });
    capturePriceUpdateChanges(before, state, actor, now);
    const tasks = state.price_update_tasks!.filter(
      (entry) =>
        entry.product_code === product.code && entry.status === "pending",
    );
    expect(tasks.map((entry) => entry.branch).sort()).toEqual([
      "Branch 1",
      "Branch 2",
      "Branch 3",
    ]);
    expect(
      tasks.every(
        (entry) =>
          entry.decided_by_user_id === actor.user_id &&
          entry.reason === "Edit and approve product",
      ),
    ).toBe(true);
  });
});
