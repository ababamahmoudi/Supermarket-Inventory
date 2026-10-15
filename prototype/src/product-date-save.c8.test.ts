import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { addProduct, type NewProductEdits } from "./manual-product";
import {
  productEditSnapshot,
  saveProductEdits,
  type ProductEdits,
} from "./product-editor";
import { catalogTestActor } from "./catalog-authority-test-fixture";
import { type ProductDateDraft } from "./date-tracking";
import type { DemoState, Product } from "./types";

const context = (state: DemoState) => catalogTestActor(state, "manager", "all");
const edits = (product: Product): ProductEdits => ({
  name_en: product.name_en,
  name_fa: product.name_fa,
  description_en: product.description_en ?? "",
  description_fa: product.description_fa ?? "",
  unit_size: product.unit_size,
  ai_category: product.ai_category,
  pricing_category: product.pricing_category,
  barcode: product.barcode,
  main_supplier: product.main_supplier,
  date_tracking: true,
  scope: "all",
});
function fixture() {
  const state = initialState();
  const product = state.products[0];
  state.expiry = state.expiry.filter(
    (row) => row.product_code !== product.code,
  );
  return { state, product };
}
const draft = (
  product: Product,
  patch: Partial<ProductDateDraft> = {},
): ProductDateDraft => ({
  product_code: product.code,
  branch: "Branch 2",
  date_type: "expiry",
  date: "2020-01-01",
  quantity: "",
  lot_number: "",
  note: "",
  ...patch,
});
describe("C8 whole-product date validation", () => {
  it("blocks tracking Yes before metadata, audit or product-code state changes", () => {
    const { state, product } = fixture();
    const before = structuredClone(state);
    expect(() =>
      saveProductEdits(
        state,
        context(state),
        product.code,
        { ...edits(product), name_en: "Unsaved name" },
        productEditSnapshot(state, context(state), product.code),
      ),
    ).toThrow("required_date");
    expect(state).toEqual(before);
    const add: NewProductEdits = {
      ...edits(product),
      name_en: "Unsaved new product",
      barcode: "",
      last_cost_before_tax: "1.5000",
      selling_price: "3.99",
    };
    expect(() => addProduct(state, context(state), add)).toThrow(
      "required_date",
    );
    expect(state).toEqual(before);
  });
  it("accepts an active past date at any company location, without moving its evidence", () => {
    const { state, product } = fixture();
    state.expiry.push({
      id: "past-other-store",
      company_id: product.company_id,
      product_code: product.code,
      branch: "Branch 2",
      date: "2020-01-01",
      expires_in_days: -2000,
      date_type: "expiry",
      status: "active",
    });
    const evidence = structuredClone(state.expiry);
    saveProductEdits(
      state,
      context(state),
      product.code,
      { ...edits(product), name_en: "Saved with company date" },
      productEditSnapshot(state, context(state), product.code),
    );
    expect(product.name_en).toBe("Saved with company date");
    expect(product.date_tracking).toBe(true);
    expect(state.expiry).toEqual(evidence);
  });
  it("foreign-company and removed dates never satisfy the required-date gate", () => {
    const { state, product } = fixture();
    state.expiry.push(
      {
        id: "foreign-date",
        company_id: "foreign",
        product_code: product.code,
        branch: "Branch 2",
        date: "2030-01-01",
        expires_in_days: 1200,
        status: "active",
      },
      {
        id: "removed-date",
        company_id: product.company_id,
        product_code: product.code,
        branch: "Branch 1",
        date: "2030-01-01",
        expires_in_days: 1200,
        status: "removed",
      },
    );
    const before = structuredClone(state);
    expect(() =>
      saveProductEdits(
        state,
        context(state),
        product.code,
        edits(product),
        productEditSnapshot(state, context(state), product.code),
      ),
    ).toThrow("required_date");
    expect(state).toEqual(before);
  });
  it("saves a submitted valid date atomically and blocks removing the final open date", () => {
    const { state, product } = fixture();
    saveProductEdits(
      state,
      context(state),
      product.code,
      { ...edits(product), dates: [draft(product)] },
      productEditSnapshot(state, context(state), product.code),
    );
    const entry = state.expiry.find(
      (row) => row.product_code === product.code,
    )!;
    expect(entry).toMatchObject({
      branch: "Branch 2",
      date: "2020-01-01",
      status: "active",
    });
    const before = structuredClone(state);
    expect(() =>
      saveProductEdits(
        state,
        context(state),
        product.code,
        {
          ...edits(product),
          dates: [
            draft(product, {
              id: entry.id,
              remove_reason: "entered_by_mistake",
            }),
          ],
        },
        productEditSnapshot(state, context(state), product.code),
      ),
    ).toThrow("required_date");
    expect(state).toEqual(before);
  });
  it("rejects direct existing-product price writes rather than creating a manual price silently", () => {
    const { state, product } = fixture();
    const before = structuredClone(state);
    expect(() =>
      saveProductEdits(
        state,
        context(state),
        product.code,
        { ...edits(product), date_tracking: false, selling_price: "5.99" },
        productEditSnapshot(state, context(state), product.code),
      ),
    ).toThrow("price");
    expect(state).toEqual(before);
  });
});
