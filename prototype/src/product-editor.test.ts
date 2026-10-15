import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { effectiveOffer, effectivePrice } from "./catalog";
import { configuredBranches, branchSellsToCustomers } from "./settings";
import {
  catalogTestActor,
  foreignCatalogManager,
} from "./catalog-authority-test-fixture";
import { actorAtLocation } from "./authority";
import { savePriceChange } from "./sales";
import { resolveApproval } from "./approvals";
import {
  saveProductEdits,
  recordProductBarcodeConflict,
  productEditSnapshot,
  type ProductEditorContext,
  type ProductEdits,
} from "./product-editor";
import type { DemoState } from "./types";
let state: DemoState;
let context: ProductEditorContext;
beforeEach(() => {
  state = initialState();
  context = catalogTestActor(state, "manager");
});
function edits(code = "0009"): ProductEdits {
  const product = state.products.find((item) => item.code === code)!;
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
    date_tracking: false,
    date_tracking_stop: "keep",
    scope: "all",
  };
}
function save(
  patch: Partial<ProductEdits> = {},
  actor = context,
  code = "0009",
  expected = productEditSnapshot(state, context, code),
) {
  saveProductEdits(
    state,
    actor,
    code,
    { ...edits(code), ...patch },
    expected,
    new Date("2026-10-07T14:00:00Z"),
  );
}
function priceChange(
  price: string,
  scope: "all" | "branch",
  actor = context,
  code = "0009",
) {
  return savePriceChange(
    state,
    actor,
    {
      product_code: code,
      mode: "regular",
      scope: scope === "all" ? "all" : "current",
      price,
      price_unit: "each",
      branches:
        scope === "all"
          ? configuredBranches(state.config).filter(
              (branch) => branch !== "Warehouse",
            )
          : [actor.branch],
      starts_on: "2026-10-07",
      last_day: null,
      accept_below_margin: false,
      below_cost_reason: "",
      add_labels: false,
    },
    new Date("2026-10-07T14:00:00Z"),
  );
}
describe("shared Supervisor product editor", () => {
  it("rejects direct worker/cashier calls without changing business records", () => {
    const before = structuredClone(state);
    for (const role of ["floor_worker", "cashier"] as const)
      expect(() =>
        save({ name_en: "Changed" }, catalogTestActor(state, role)),
      ).toThrow("capability");
    expect(state).toEqual(before);
  });
  it("enforces company, selected branch and full company-price scope", () => {
    expect(() => save({}, foreignCatalogManager(state))).toThrow("company");
    expect(() =>
      save(
        {},
        actorAtLocation(
          state,
          catalogTestActor(state, "floor_worker"),
          "Branch 2",
        ),
      ),
    ).toThrow("location");
    expect(() =>
      save(
        {},
        catalogTestActor(state, "floor_worker", "all", {
          locations: ["Branch 1", "Branch 2"],
          user_id: "test-editor-worker",
          username: "test-editor-worker",
        }),
      ),
    ).toThrow("capability");
    expect(() =>
      priceChange("3.29", "branch", catalogTestActor(state, "manager", "all")),
    ).toThrow("stores");
    const foreign = {
      ...state.products[0],
      company_id: "foreign",
      code: "foreign-product",
    };
    state.products.push(foreign);
    expect(() => save({}, context, foreign.code, "ignored")).toThrow(
      "not_found",
    );
  });
  it("changes only the selected branch price and retains invoice calculation and four-decimal cost", () => {
    let product = state.products.find((item) => item.code === "0009")!;
    product.last_cost_before_tax = "1.6000";
    product.price_provenance = {
      "Branch 1": { invoice_number: "FV-20417", calculated_price: "2.99" },
    };
    save({ name_en: "Potato Chips" });
    priceChange("3.29", "branch");
    product = state.products.find((item) => item.code === product.code)!;
    expect(effectivePrice(state, "0009", "Branch 1")).toBe("3.29");
    expect(effectivePrice(state, "0009", "Branch 2")).toBe("2.99");
    expect(product.last_cost_before_tax).toBe("1.6000");
    expect(product.price_provenance!["Branch 1"]).toMatchObject({
      invoice_number: "FV-20417",
      calculated_price: "2.99",
      changed_price: "3.29",
      changed_by: context.actor,
      changed_at: "2026-10-07T14:00:00.000Z",
    });
    expect(effectiveOffer(state, product, "Branch 1")).toBeNull();
    expect(effectiveOffer(state, product, "Branch 2")?.status).toBe("active");
    expect(
      state.alerts.some(
        (item) =>
          item.product_code === product.code &&
          item.type === "price_conflict" &&
          item.status === "pending",
      ),
    ).toBe(true);
    expect(state.activity.at(-1)).toMatchObject({
      action: "Set regular price",
      branch: "Branch 1",
      entity_type: "product",
      entity_id: product.code,
    });
    expect(state.activity.at(-1)).toMatchObject({
      action: "Set regular price",
      by: context.actor,
      reversible: true,
    });
    expect(state.activity.at(-1)!.before).toHaveProperty(
      "name_en",
      "Potato Chips",
    );
    expect(state.activity.at(-1)!.after).toHaveProperty(
      "branch_prices.Branch 1",
      "3.29",
    );
  });
  it("applies All branches, removes overrides and preserves each branch's invoice provenance", () => {
    let product = state.products.find((item) => item.code === "0004")!;
    product.price_provenance = {
      "Branch 1": { invoice_number: "INV-A", calculated_price: "6.49" },
      "Branch 2": { invoice_number: "INV-B", calculated_price: "6.99" },
    };
    priceChange(
      "7.29",
      "all",
      catalogTestActor(state, "manager", "all"),
      product.code,
    );
    product = state.products.find((item) => item.code === product.code)!;
    for (const branch of context.allowed_branches.filter((branch) =>
      branchSellsToCustomers(state.config, branch),
    ))
      expect(effectivePrice(state, product, branch)).toBe("7.29");
    expect(product.branch_prices).toEqual({});
    expect(product.price_provenance!["Branch 2"]).toMatchObject({
      invoice_number: "INV-B",
      calculated_price: "6.99",
      changed_price: "7.29",
    });
    expect(product.price_provenance!.all).toBeUndefined();
    expect(product.price_provenance!["Branch 3"]).toBeUndefined();
  });
  it("updates catalog metadata without silently changing price or unrelated companies", () => {
    const product = state.products.find((item) => item.code === "0009")!;
    const foreign = {
      ...product,
      company_id: "foreign",
      barcode: "foreign-barcode",
    };
    state.products.push(foreign);
    const beforeForeign = structuredClone(foreign);
    const prices = {
      selling: product.selling_price,
      overrides: structuredClone(product.branch_prices),
    };
    save({
      name_en: "Chips",
      name_fa: "چیپس",
      description_en: "Crispy",
      description_fa: "ترد",
      unit_size: "200 g",
      barcode: "new-barcode",
      date_tracking: true,
      dates: [
        {
          product_code: product.code,
          branch: "Branch 1",
          date_type: "expiry",
          date: "2026-12-01",
          quantity: "",
          lot_number: "",
          note: "",
        },
      ],
    });
    expect(product.code).toBe("0009");
    expect(product.name_en).toBe("Chips");
    expect(product.date_tracking).toBe(true);
    expect({
      selling: product.selling_price,
      overrides: product.branch_prices,
    }).toEqual(prices);
    expect(foreign).toEqual(beforeForeign);
  });
  it("blocks invalid fields, duplicate own-company barcodes and unsafe prices before changing state", () => {
    const before = structuredClone(state);
    for (const patch of [
      { name_en: " " },
      { unit_size: "" },
      { pricing_category: "not-configured" },
      { main_supplier: "not-configured" },
      { barcode: state.products[0].barcode },
      { selling_price: "3.291" },
      { selling_price: "NaN" },
      { selling_price: "-2.99" },
      { selling_price: "0" },
    ])
      expect(() => save(patch)).toThrow();
    expect(state).toEqual(before);
  });
  it("rejects an intervening product or derived decision change without overwriting it", () => {
    const oldSnapshot = productEditSnapshot(state, context, "0009");
    state.products.find((item) => item.code === "0009")!.name_en =
      "Changed elsewhere";
    expect(() =>
      save({ name_en: "Stale name" }, context, "0009", oldSnapshot),
    ).toThrow("stale");
    expect(state.products.find((item) => item.code === "0009")!.name_en).toBe(
      "Changed elsewhere",
    );
  });
});

it("records a duplicate-barcode queue once without transferring either mapping", () => {
  const product = state.products.find((item) => item.code === "0009")!;
  const existing = state.products[0];
  const original = product.barcode;
  const existingBarcode = existing.barcode;
  for (let attempt = 0; attempt < 2; attempt++)
    recordProductBarcodeConflict(
      state,
      context,
      product.code,
      existing.barcode,
    );
  expect(product.barcode).toBe(original);
  expect(existing.barcode).toBe(existingBarcode);
  const queue = state.approvals.filter(
    (item) =>
      item.type === "barcode_conflict" && item.product_code === product.code,
  );
  expect(queue).toHaveLength(1);
  expect(queue[0]).toMatchObject({
    status: "pending",
    barcode: existing.barcode,
    conflicting_product_code: existing.code,
    triggered_by: context.actor,
  });
  expect(state.activity.at(-1)).toMatchObject({
    action: "Report barcode conflict",
    reversible: false,
  });
  expect(() =>
    recordProductBarcodeConflict(
      state,
      catalogTestActor(state, "cashier"),
      product.code,
      existing.barcode,
    ),
  ).toThrow("capability");
});

it("scopes barcode-conflict reports by company and allowed branch", () => {
  const product = state.products.find((item) => item.code === "0009")!;
  const existing = state.products[0];
  const report = (actor: ProductEditorContext, barcode = existing.barcode) =>
    recordProductBarcodeConflict(state, actor, product.code, barcode);
  const before = structuredClone(state);
  expect(() => report(foreignCatalogManager(state))).toThrow("company");
  expect(() =>
    report(
      actorAtLocation(
        state,
        catalogTestActor(state, "floor_worker"),
        "Branch 2",
      ),
    ),
  ).toThrow("location");
  expect(() =>
    report(
      catalogTestActor(state, "floor_worker", "all", {
        locations: ["Branch 1", "Branch 2"],
        user_id: "test-editor-worker",
        username: "test-editor-worker",
      }),
    ),
  ).toThrow("capability");
  expect(state).toEqual(before);
  state.products.push({
    ...existing,
    company_id: "foreign",
    code: "foreign-product",
    barcode: "foreign-only-barcode",
  });
  report(context, "foreign-only-barcode");
  report(context, "");
  report(context, product.barcode);
  expect(state.approvals).toEqual(before.approvals);
  report(context);
  report(context);
  report(actorAtLocation(state, context, "Branch 2"));
  const reports = state.approvals.filter(
    (item) =>
      item.type === "barcode_conflict" && item.product_code === product.code,
  );
  expect(reports.map((item) => item.branch)).toEqual(["Branch 1", "Branch 2"]);
  expect(reports.every((item) => item.company_id === context.company_id)).toBe(
    true,
  );
});

it.each(["approve", "reject"] as const)(
  "%s a barcode conflict preserves both products' barcode and price mappings",
  (decision) => {
    const product = state.products.find((item) => item.code === "0009")!;
    recordProductBarcodeConflict(
      state,
      context,
      product.code,
      state.products[0].barcode,
    );
    const approval = state.approvals.at(-1)!;
    const before = structuredClone({
      products: state.products,
      offers: state.offers,
      alerts: state.alerts,
    });
    resolveApproval(state, context, approval.id, decision, "all", "all");
    expect(approval.status).toBe(
      decision === "approve" ? "approved" : "rejected",
    );
    expect({
      products: state.products,
      offers: state.offers,
      alerts: state.alerts,
    }).toEqual(before);
    expect(state.activity.at(-1)?.action).toBe(
      decision === "approve"
        ? "Keep barcode mappings"
        : "Reject barcode change",
    );
  },
);
