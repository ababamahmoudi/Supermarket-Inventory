import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "./store";
import { effectiveOffer, effectivePrice } from "./catalog";
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
const context: ProductEditorContext = {
  company_id: "",
  role: "supervisor",
  actor: "Demo Supervisor",
  branch: "Branch 1",
  allowed_branches: ["Branch 1", "Branch 2", "Branch 3"],
};
beforeEach(() => {
  state = initialState();
  context.company_id = state.config.company.seed_key;
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
    scope: "all",
  };
}
function save(
  patch: Partial<ProductEdits> = {},
  actor = context,
  code = "0009",
  expected = productEditSnapshot(state, code),
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
describe("shared Supervisor product editor", () => {
  it("rejects direct worker/cashier calls without changing business records", () => {
    const before = structuredClone(state);
    for (const role of ["floor_worker", "cashier"] as const)
      expect(() => save({ name_en: "Changed" }, { ...context, role })).toThrow(
        "permission",
      );
    expect(state).toEqual(before);
  });
  it("enforces company, selected branch and full company-price scope", () => {
    expect(() => save({}, { ...context, company_id: "foreign" })).toThrow(
      "company",
    );
    expect(() =>
      save(
        {},
        { ...context, branch: "Branch 2", allowed_branches: ["Branch 1"] },
      ),
    ).toThrow("branch");
    expect(() =>
      save(
        { selling_price: "3.29" },
        { ...context, allowed_branches: ["Branch 1"] },
      ),
    ).toThrow("branch");
    expect(() =>
      save(
        { selling_price: "3.29", scope: "branch" },
        { ...context, branch: "all" },
      ),
    ).toThrow("branch");
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
    const product = state.products.find((item) => item.code === "0009")!;
    product.last_cost_before_tax = "1.6000";
    product.price_provenance = {
      "Branch 1": { invoice_number: "FV-20417", calculated_price: "2.99" },
    };
    save({ selling_price: "3.29", scope: "branch", name_en: "Potato Chips" });
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
    expect(state.approvals.at(-1)).toMatchObject({
      manual_override: true,
      status: "approved",
      scope: "branch",
      branch: "Branch 1",
      triggered_by: context.actor,
    });
    expect(state.activity.at(-1)).toMatchObject({
      action: "Save product",
      by: context.actor,
      reversible: true,
      scope: "branch",
    });
    expect(state.activity.at(-1)!.before).toHaveProperty("product.name_en");
    expect(state.activity.at(-1)!.after).toHaveProperty(
      "product.branch_prices.Branch 1",
      "3.29",
    );
  });
  it("applies All branches, removes overrides and preserves each branch's invoice provenance", () => {
    const product = state.products.find((item) => item.code === "0004")!;
    product.price_provenance = {
      "Branch 1": { invoice_number: "INV-A", calculated_price: "6.49" },
      "Branch 2": { invoice_number: "INV-B", calculated_price: "6.99" },
    };
    save(
      { selling_price: "7.29" },
      { ...context, branch: "all" },
      product.code,
    );
    for (const branch of context.allowed_branches)
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
      { name_fa: "" },
      { unit_size: "" },
      { ai_category: "" },
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
    const oldSnapshot = productEditSnapshot(state, "0009");
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
      { ...context, role: "cashier" },
      product.code,
      existing.barcode,
    ),
  ).toThrow("permission");
});

it("scopes barcode-conflict reports by company and allowed branch", () => {
  const product = state.products.find((item) => item.code === "0009")!;
  const existing = state.products[0];
  const report = (actor: ProductEditorContext, barcode = existing.barcode) =>
    recordProductBarcodeConflict(state, actor, product.code, barcode);
  const before = structuredClone(state);
  expect(() => report({ ...context, company_id: "foreign" })).toThrow(
    "company",
  );
  expect(() =>
    report({
      ...context,
      branch: "Branch 2",
      allowed_branches: ["Branch 1"],
    }),
  ).toThrow("branch");
  expect(() =>
    report({
      ...context,
      branch: "all",
      allowed_branches: ["Branch 1"],
    }),
  ).toThrow("branch");
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
  report({ ...context, branch: "Branch 2" });
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
    resolveApproval(state, approval.id, decision, "all", "all");
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
