import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "./store";
import { effectivePrice, pendingPrice } from "./catalog";
import { configuredBranches } from "./settings";
import { addProduct, type NewProductEdits } from "./manual-product";
import {
  productEditSnapshot,
  saveProductEdits,
  type ProductEdits,
} from "./product-editor";
import {
  applyApprovedPrice,
  approvalSnapshot,
  resolveApproval,
  keepApprovedPrice,
  proposeManualOverride,
} from "./approvals";
import { attachReversals, reverseActivity } from "./history";
import { invoiceLocationMovePreview, movePostedInvoice } from "./received";
import {
  hydrateManualPriceMarkers,
  manualPrice,
  rulePrice,
  sellingMargin,
} from "./manual-prices";
import { productCostHistory, productStoreCost } from "./product-costs";
import type { Approval, DemoInvoice, DemoState, Product } from "./types";

let state: DemoState;
let product: Product;
const moment = new Date("2026-10-09T14:00:00Z");
beforeEach(() => {
  state = initialState();
  product = state.products.find((item) => item.code === "0009")!;
});
function context(branch = "Branch 1") {
  return {
    company_id: state.config.company.seed_key,
    role: "supervisor" as const,
    actor: "Demo Supervisor",
    branch,
    allowed_branches: configuredBranches(state.config),
  };
}
function edits(patch: Partial<ProductEdits> = {}): ProductEdits {
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
    ...patch,
  };
}
function save(
  price: string,
  scope: "all" | "branch" = "all",
  branch = "Branch 1",
) {
  saveProductEdits(
    state,
    context(branch),
    product.code,
    edits({ selling_price: price, scope }),
    productEditSnapshot(state, product.code),
    moment,
  );
}
function proposal(patch: Partial<Approval> = {}): Approval {
  const result: Approval = {
    id: `test-proposal:${state.approvals.length}`,
    company_id: product.company_id,
    branch: "Branch 1",
    product_code: product.code,
    type: "price_change",
    status: "pending",
    proposed_price: "2.99",
    ...patch,
  };
  state.approvals.push(result);
  return result;
}

describe("manual price provenance", () => {
  it("marks an explicit branch override and leaves the other locations at their approved rule price", () => {
    save("3.29", "branch");
    expect(manualPrice(state, product, "Branch 1")).toMatchObject({
      price: "3.29",
      rule_price: rulePrice(state, product),
      set_by: context().actor,
      set_at: moment.toISOString(),
    });
    expect(manualPrice(state, product, "Branch 2")).toBeNull();
    expect(manualPrice(state, product, "Warehouse")).toBeNull();
    expect(effectivePrice(state, product, "Branch 2")).toBe("2.99");
  });
  it("retains manual provenance when a changed pricing configuration happens to produce the same price", () => {
    save("3.29");
    const marker = structuredClone(manualPrice(state, product, "Branch 1"));
    state.config.pricing_categories.find(
      (entry) => entry.key === product.pricing_category,
    )!.cost_divisor = "0.80";
    expect(rulePrice(state, product)).not.toBe(marker?.rule_price);
    expect(manualPrice(state, product, "Branch 1")).toEqual(marker);
  });
  it("clears only the accepted rule scope, including a rule that equals the company manual price", () => {
    save("3.29");
    const item = proposal({ proposed_price: "3.29", clear_manual_price: true });
    resolveApproval(state, item.id, "approve", "branch", "Branch 1");
    expect(effectivePrice(state, product, "Branch 1")).toBe("3.29");
    expect(manualPrice(state, product, "Branch 1")).toBeNull();
    expect(manualPrice(state, product, "Branch 2")?.price).toBe("3.29");
    applyApprovedPrice(state, product.code, "2.99", "all", "all");
    expect(product.manual_prices).toEqual({});
    expect(manualPrice(state, product, "Branch 2")).toBeNull();
  });
  it("does not clear a manual price while the rule proposal remains pending or is rejected", () => {
    save("3.29");
    const item = proposal({ clear_manual_price: true });
    expect(manualPrice(state, product, "Branch 1")?.price).toBe("3.29");
    expect(pendingPrice(state, product, "Branch 1")).toBe("2.99");
    resolveApproval(state, item.id, "reject", "branch", "Branch 1");
    expect(manualPrice(state, product, "Branch 1")?.price).toBe("3.29");
  });
  it("preserves other locations' saved B manual provenance during a branch-only rule decision", () => {
    save("3.29");
    delete product.manual_prices;
    applyApprovedPrice(state, product.code, "2.99", "branch", "Branch 1");
    expect(manualPrice(state, product, "Branch 1")).toBeNull();
    expect(manualPrice(state, product, "Branch 2")?.price).toBe("3.29");
  });
  it("marks new manual products without inventing invoice provenance and records exact cost", () => {
    const input: NewProductEdits = {
      ...edits(),
      name_en: "Test orchard pears",
      name_fa: "گلابی آزمایشی",
      barcode: "",
      last_cost_before_tax: "1.4001",
      selling_price: "4.99",
    };
    const added = addProduct(state, context(), input, false, moment);
    expect(added.last_cost_before_tax).toBe("1.4001");
    expect(added.price_provenance).toBeUndefined();
    expect(manualPrice(state, added, "Warehouse")).toMatchObject({
      price: "4.99",
      set_by: context().actor,
    });
    expect(added.manual_prices?.all.rule_price).toBe(rulePrice(state, added));
  });
  it("restores saved B manual decisions once and never resurrects them after an explicit rule decision", () => {
    save("3.29");
    delete product.manual_prices;
    expect(manualPrice(state, product, "Branch 1")?.price).toBe("3.29");
    hydrateManualPriceMarkers(state);
    expect(
      state.products.find((item) => item.code === product.code)?.manual_prices
        ?.all.price,
    ).toBe("3.29");
    applyApprovedPrice(state, product.code, "3.29", "all", "all");
    hydrateManualPriceMarkers(state);
    expect(manualPrice(state, product, "Branch 1")).toBeNull();
  });
  it("restores the marker together with the edited price through conflict-aware History", () => {
    save("3.29");
    const before = structuredClone(state);
    save("4.29", "branch");
    const entries = attachReversals(before, state, context());
    expect(manualPrice(state, product, "Branch 1")?.price).toBe("4.29");
    const conflict = state.alerts.find(
      (entry) =>
        entry.company_id === product.company_id &&
        entry.product_code === product.code &&
        entry.type === "price_conflict" &&
        entry.status === "pending",
    )!;
    expect(conflict).toBeDefined();
    reverseActivity(state, context(), entries.at(-1)!.id, "revert", moment);
    product = state.products.find((item) => item.code === product.code)!;
    expect(effectivePrice(state, product, "Branch 1")).toBe("3.29");
    expect(manualPrice(state, product, "Branch 1")?.price).toBe("3.29");
    expect(manualPrice(state, product, "Branch 2")?.price).toBe("3.29");
    expect(state.alerts.find((entry) => entry.id === conflict.id)?.status).toBe(
      "resolved",
    );
    expect(
      state.approvals.some(
        (entry) =>
          entry.manual_override &&
          entry.proposed_price === "4.29" &&
          entry.status === "rejected",
      ),
    ).toBe(true);
  });
  it("rejects a stale Revert after the derived conflict alert was separately resolved", () => {
    save("3.29");
    const before = structuredClone(state);
    save("4.29", "branch");
    const entry = attachReversals(before, state, context()).at(-1)!;
    const conflict = state.alerts.find(
      (item) =>
        item.company_id === product.company_id &&
        item.product_code === product.code &&
        item.type === "price_conflict" &&
        item.status === "pending",
    )!;
    conflict.status = "intentional";
    const changed = structuredClone(state);
    expect(() =>
      reverseActivity(state, context(), entry.id, "revert", moment),
    ).toThrow("conflict");
    expect(state).toEqual(changed);
  });
  it("does not expose another company's marker, rule price or cost history", () => {
    const foreign = {
      ...structuredClone(product),
      company_id: "foreign",
      manual_prices: {
        all: {
          price: product.selling_price,
          rule_price: "1.00",
          set_by: "Foreign",
          set_at: moment.toISOString(),
        },
      },
    };
    state.products.push(foreign);
    expect(manualPrice(state, foreign, "Branch 1")).toBeNull();
    expect(rulePrice(state, foreign)).toBeNull();
    expect(productCostHistory(state, context(), foreign)).toEqual([]);
    expect(productStoreCost(state, context(), foreign)).toBeNull();
  });
  it("computes the margin from four-decimal cost, not the rounded cost shown in the table", () => {
    expect(sellingMargin("2.99", "1.5501")).toBe("48.16");
    expect(sellingMargin("1.41", "1.4000")).toBe("0.71");
    expect(sellingMargin("0.00", "1.0000")).toBeNull();
    expect(sellingMargin("bad", "1.0000")).toBeNull();
  });
});

describe("scoped catalog cost history", () => {
  function invoice(
    id: string,
    cost: string,
    at: string,
    branch = "Branch 1",
    shortDated = false,
  ): DemoInvoice {
    const value = structuredClone(
      state.invoices!.find((record) =>
        record.lines.some((line) => line.product_code === product.code),
      )!,
    );
    value.id = id;
    value.branch = branch;
    value.supplier_invoice_number = id;
    value.invoice_date = at.slice(0, 10);
    value.posted_at = at;
    value.lines = [
      {
        ...value.lines.find((line) => line.product_code === product.code)!,
        unit_cost_before_tax: cost,
        qty_received_at_posting: 1,
        qty_later_received: 0,
        short_dated: shortDated,
      },
    ];
    return value;
  }
  it("shows every received cost but excludes short-dated lots from Store cost and ignores unposted/foreign entries", () => {
    state.invoices = [
      invoice("normal", "1.7001", "2026-10-07T14:00:00Z"),
      invoice(
        "short-dated",
        "0.8000",
        "2026-10-08T14:00:00Z",
        "Branch 1",
        true,
      ),
      {
        ...invoice("draft", "0.0100", "2026-10-09T14:00:00Z"),
        status: "draft",
      },
      {
        ...invoice("foreign", "0.0200", "2026-10-10T14:00:00Z"),
        company_id: "foreign",
      },
    ];
    expect(
      productCostHistory(state, context(), product).map(
        (entry) => entry.invoice_number,
      ),
    ).toEqual(["short-dated", "normal"]);
    expect(productStoreCost(state, context(), product)).toBe("1.7001");
    for (const role of ["floor_worker", "cashier"] as const) {
      expect(
        productCostHistory(state, { ...context(), role }, product),
      ).toEqual([]);
      expect(
        productStoreCost(state, { ...context(), role }, product),
      ).toBeNull();
    }
    expect(
      productCostHistory(
        state,
        { ...context(), company_id: "foreign" },
        product,
      ),
    ).toEqual([]);
  });
  it("uses the corrected invoice location without changing the original cost record or duplicating the receipt", () => {
    const original = state.invoices!.find(
      (record) =>
        record.branch === "Branch 1" &&
        record.lines.some((line) => line.product_code === product.code),
    )!;
    const saved = structuredClone(original);
    const preview = invoiceLocationMovePreview(
      state,
      context(),
      original.id,
      "Warehouse",
    );
    movePostedInvoice(
      state,
      context(),
      original.id,
      "Warehouse",
      "Correct delivery location",
      preview.snapshot,
    );
    expect(original).toEqual(saved);
    expect(
      productCostHistory(state, context(), product).some(
        (entry) => entry.invoice_id === original.id,
      ),
    ).toBe(false);
    expect(
      productCostHistory(state, context("Warehouse"), product).filter(
        (entry) => entry.invoice_id === original.id,
      ),
    ).toHaveLength(1);
  });
});

describe("approval location follows append-only invoice corrections", () => {
  it("invalidates an approval preview after a move and approves only the corrected location", () => {
    const original = state.invoices!.find(
      (record) =>
        record.branch === "Branch 1" &&
        record.lines.some((line) => line.product_code === product.code),
    )!;
    const item = proposal({
      source_invoice_id: original.id,
      invoice_ids: [original.id],
      invoice_number: original.supplier_invoice_number,
      proposed_price: "3.29",
    });
    const snapshot = approvalSnapshot(state, product.code);
    const preview = invoiceLocationMovePreview(
      state,
      context(),
      original.id,
      "Warehouse",
    );
    movePostedInvoice(
      state,
      context(),
      original.id,
      "Warehouse",
      "Correct delivery location",
      preview.snapshot,
    );
    expect(pendingPrice(state, product, "Branch 1")).toBeNull();
    expect(pendingPrice(state, product, "Warehouse")).toBe("3.29");
    expect(() =>
      resolveApproval(
        state,
        item.id,
        "approve",
        "branch",
        "Branch 1",
        undefined,
        snapshot,
      ),
    ).toThrow("Prices changed");
    resolveApproval(state, item.id, "approve", "branch", "Branch 1");
    expect(effectivePrice(state, product, "Warehouse")).toBe("3.29");
    expect(effectivePrice(state, product, "Branch 1")).toBe("2.99");
    expect(item.branch).toBe("Branch 1");
    expect(state.activity.at(-1)?.branch).toBe("Warehouse");
  });
  it("keeps and proposes below-margin prices using the corrected source location", () => {
    const original = state.invoices!.find(
      (record) =>
        record.branch === "Branch 1" &&
        record.lines.some((line) => line.product_code === product.code),
    )!;
    const kept = proposal({
      type: "margin_review",
      source_invoice_id: original.id,
      invoice_ids: [original.id],
    });
    const overridden = proposal({
      type: "margin_review",
      source_invoice_id: original.id,
      invoice_ids: [original.id],
    });
    const preview = invoiceLocationMovePreview(
      state,
      context(),
      original.id,
      "Warehouse",
    );
    movePostedInvoice(
      state,
      context(),
      original.id,
      "Warehouse",
      "Correct delivery location",
      preview.snapshot,
    );
    keepApprovedPrice(state, kept.id, "Retain approved price");
    expect(state.activity.at(-1)?.branch).toBe("Warehouse");
    const next = proposeManualOverride(
      state,
      overridden.id,
      "4.99",
      "Manual price decision",
    );
    expect(next.branch).toBe("Warehouse");
    expect(product.pending_branch).toBe("Warehouse");
    expect(state.activity.at(-1)?.branch).toBe("Warehouse");
  });
});
