import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { catalogTestActor } from "./catalog-authority-test-fixture";
import {
  productEditSnapshot,
  saveProductEdits,
  type ProductEdits,
} from "./product-editor";
import { addProduct, type NewProductEdits } from "./manual-product";
import type { Product } from "./types";

const edit = (product: Product): ProductEdits => ({
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
  sold_by: product.sold_by,
  scope: "all",
});
const newWeight = (): NewProductEdits => ({
  name_en: "Fictional Juniper Kernels",
  name_fa: "دانه سرو کوهی خیالی",
  description_en: "",
  description_fa: "",
  unit_size: "",
  ai_category: "Grocery",
  pricing_category: "grocery",
  barcode: "FICTIONAL-R2G-WEIGHT",
  main_supplier: "Fresh Valley Foods",
  date_tracking: false,
  scope: "all",
  sold_by: "weight",
  last_cost_before_tax: "4.7312",
  last_cost_unit: "lb",
});

describe("R2g C1 weight products have package sizes, not a required unit size", () => {
  it.each(["weight", undefined] as const)(
    "saves an existing weight product with an empty unit size and sold_by=%s",
    (soldBy) => {
      const state = initialState();
      const actor = catalogTestActor(state, "manager");
      const product = state.products[0];
      Object.assign(product, { sold_by: "weight", unit_size: "" });
      const invoices = structuredClone(state.invoices);
      const ledger = structuredClone(state.ledger);
      const originalCost = product.last_cost_before_tax;
      saveProductEdits(
        state,
        actor,
        product.code,
        {
          ...edit(product),
          sold_by: soldBy,
          name_en: "Fictional Updated Nuts",
        },
        productEditSnapshot(state, actor, product.code),
      );
      expect(product.name_en).toBe("Fictional Updated Nuts");
      expect(product.sold_by).toBe("weight");
      expect(product.unit_size).toBe("");
      expect(product.last_cost_before_tax).toBe(originalCost);
      expect(state.invoices).toEqual(invoices);
      expect(state.ledger).toEqual(ledger);
      expect(state.activity.at(-1)).toMatchObject({
        action: "Save product",
        by: actor.actor,
        product_code: product.code,
      });
    },
  );

  it("creates a weight product without inventing a unit size and retains its four-place cost", () => {
    const state = initialState();
    const actor = catalogTestActor(state, "manager");
    const created = addProduct(state, actor, newWeight());
    expect(created.sold_by).toBe("weight");
    expect(created.unit_size).toBe("");
    expect(created.last_cost_before_tax).toBe("4.7312");
    expect(
      state.products.find((entry) => entry.code === created.code),
    ).toMatchObject({
      sold_by: "weight",
      unit_size: "",
      last_cost_before_tax: "4.7312",
    });
  });

  it("still requires a real unit size for Each products and conversion back to Each", () => {
    const state = initialState();
    const actor = catalogTestActor(state, "manager");
    const product = state.products[0];
    const before = structuredClone(state);
    expect(() =>
      addProduct(state, actor, { ...newWeight(), sold_by: "each" }),
    ).toThrow("unit_size");
    expect(state).toEqual(before);
    Object.assign(product, { sold_by: "weight", unit_size: "" });
    const weightBefore = structuredClone(state);
    expect(() =>
      saveProductEdits(
        state,
        actor,
        product.code,
        { ...edit(product), sold_by: "each" },
        productEditSnapshot(state, actor, product.code),
      ),
    ).toThrow("unit_size");
    expect(state).toEqual(weightBefore);
  });
});
