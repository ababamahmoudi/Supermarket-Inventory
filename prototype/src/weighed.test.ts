import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import fixtures from "../../seed/pricing-test-cases.json";
import { initialState } from "./e1-bootstrap";
import { calculatePrice } from "./pricing";
import { addProduct } from "./manual-product";
import { savePriceChange } from "./sales";
import { rulePrice } from "./manual-prices";
import { savePricingSettings } from "./settings";
import { attachReversals, reverseActivity } from "./history";
import {
  productEditSnapshot,
  saveProductEdits,
  type ProductEdits,
} from "./product-editor";
import {
  catalogTestActor,
  foreignCatalogManager,
} from "./catalog-authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import {
  approvedWeightPricePerLb,
  calculateWeighedPrice,
  DEFAULT_WEIGHED_SETTINGS,
  validateWeightQuantity,
  weightConversionFactor,
  weightCostPerLb,
  weightLineAmount,
  weightPriceDisplay,
  weightQuantityFromLb,
  weightQuantityPerLb,
} from "./weighed";

describe("weighed pricing preserves the existing pricing foundation", () => {
  it.each(fixtures.cases.filter((fixture) => "source_cost_unit" in fixture))(
    "$name",
    (fixture) => {
      if (
        typeof fixture.source_cost_before_tax !== "string" ||
        typeof fixture.source_cost_unit !== "string"
      )
        throw new Error("Missing source evidence");
      const state = initialState();
      const result = calculateWeighedPrice(
        fixture.source_cost_before_tax,
        fixture.source_cost_unit as "kg" | "lb",
        fixture.category,
        state.config,
      );
      expect(result.canonical_cost_per_lb).toBe("4.9895");
      expect(result.selling_price).toBe(fixture.expected_selling_price);
      expect(result.rounded_raw).toBe(fixture.raw_price);
      expect(result.after_band_rounding).toBe(fixture.after_band_rounding);
      expect(result.special_correction_applied).toBe(
        fixture.special_2_49_3_49_correction_applied,
      );
      expect(weightPriceDisplay(result.selling_price, state.config)).toEqual({
        main: { amount: "7.99", unit: "lb" },
        secondary: { amount: "17.61", unit: "kg" },
      });
    },
  );
  it("bands Off changes only weighed band categories; Rice and Each retain their rules", () => {
    const state = initialState();
    state.config.weighed_items = {
      ...DEFAULT_WEIGHED_SETTINGS,
      use_rounding_bands: false,
    };
    expect(
      calculateWeighedPrice("11.0000", "kg", "grocery", state.config),
    ).toMatchObject({
      selling_price: "7.68",
      after_band_rounding: null,
      special_correction_applied: false,
    });
    expect(
      calculateWeighedPrice("1.6000", "lb", "grocery", state.config)
        .selling_price,
    ).toBe("2.46");
    expect(
      calculateWeighedPrice("3.1921", "lb", "rice", state.config).selling_price,
    ).toBe("4.99");
    expect(
      calculatePrice("1.6000", "grocery", state.config).selling_price,
    ).toBe("2.99");
  });
  it("display choices and explicit kg edits keep approved prices canonical per lb", () => {
    const state = initialState();
    state.config.weighed_items = {
      ...DEFAULT_WEIGHED_SETTINGS,
      main_display_unit: "kg",
    };
    expect(weightPriceDisplay("7.49", state.config)).toEqual({
      main: { amount: "16.51", unit: "kg" },
      secondary: { amount: "7.49", unit: "lb" },
    });
    expect(approvedWeightPricePerLb("16.51", "kg", state.config)).toBe("7.49");
    state.config.weighed_items.show_second_unit = false;
    expect(weightPriceDisplay("7.49", state.config).secondary).toBeNull();
  });
});
describe("original weight evidence and Decimal totals", () => {
  it("uses exact source totals rather than rounded canonical cost", () => {
    expect(weightLineAmount("900.123", "kg", "11.0000", "kg", "2.20462")).toBe(
      "9901.35",
    );
    const roundedCanonicalTotal = new Decimal(
      weightQuantityPerLb("900.123", "kg", "2.20462"),
    )
      .times(weightCostPerLb("11.0000", "kg", "2.20462"))
      .toFixed(2);
    expect(roundedCanonicalTotal).toBe("9901.31");
    expect(weightLineAmount("10.000", "kg", "11.0000", "kg")).toBe("110.00");
    expect(weightLineAmount("22.046", "lb", "11.0000", "kg")).toBe("110.00");
    expect(weightLineAmount("10", "kg", "4.9895", "lb")).toBe("110.00");
  });
  it("keeps retained factors exact and validates entered precision separately", () => {
    expect(weightQuantityPerLb("1.123", "kg", "2.20462")).toBe("2.47578826");
    expect(weightQuantityFromLb("2.47578826", "kg", "2.20462")).toBe("1.123");
    expect(weightCostPerLb("11", "kg", "2.20462")).toBe("4.9895");
    expect(weightCostPerLb("11", "kg", "2")).toBe("5.5000");
    expect(weightConversionFactor("2.204620")).toBe("2.20462");
    expect(validateWeightQuantity("1.123")).toBe("1.123");
    expect(validateWeightQuantity("0", { allowZero: true })).toBe("0");
    for (const invalid of ["0", "-1", "1.1234", "Infinity", "NaN"])
      expect(() => validateWeightQuantity(invalid)).toThrow();
    expect(() => weightCostPerLb("1.00001", "lb")).toThrow();
    expect(() => weightConversionFactor("0")).toThrow();
  });
});
describe("weighed product and settings decisions", () => {
  it("global manual prices target active selling stores and preserve inactive/Warehouse override evidence", () => {
    const state = initialState();
    state.config.branches.find((branch) => branch.id === "Branch 2")!.active =
      false;
    let product = state.products.find((item) => item.code === "0009")!;
    const marker = {
      price: "8.29",
      rule_price: "7.49",
      set_by: "Recorded Supervisor",
      set_at: "2026-10-01T12:00:00Z",
    };
    const inactiveMarker = { ...marker, price: "9.29" };
    product.branch_prices = {
      "Branch 1": "6.29",
      "Branch 2": "9.29",
      Warehouse: "8.29",
    };
    product.manual_prices = { Warehouse: marker, "Branch 2": inactiveMarker };
    product.price_provenance = {
      Warehouse: {
        invoice_number: "Warehouse recorded receipt",
        calculated_price: "7.49",
        changed_price: "8.29",
      },
    };
    const provenance = structuredClone(product.price_provenance.Warehouse);
    const invoices = structuredClone(state.invoices),
      ledger = structuredClone(state.ledger);
    savePriceChange(state, catalogTestActor(state, "manager"), {
      product_code: product.code,
      mode: "regular",
      scope: "all",
      price: "3.29",
      price_unit: "each",
      branches: ["Branch 1", "Branch 3"],
      starts_on: new Date().toISOString().slice(0, 10),
      last_day: null,
      accept_below_margin: true,
      below_cost_reason: "Reviewed retail price",
      add_labels: false,
    });
    product = state.products.find((item) => item.code === product.code)!;
    expect(product.selling_price).toBe("3.29");
    expect(product.branch_prices).toEqual({
      "Branch 2": "9.29",
      Warehouse: "8.29",
    });
    expect(product.manual_prices?.Warehouse).toEqual(marker);
    expect(product.manual_prices?.["Branch 2"]).toEqual(inactiveMarker);
    expect(product.price_provenance?.Warehouse).toEqual(provenance);
    expect(state.invoices).toEqual(invoices);
    expect(state.ledger).toEqual(ledger);
  });
  it("a Warehouse-only manual retail price fails atomically while Warehouse metadata edits remain available", () => {
    const state = initialState();
    const product = state.products[0];
    const edits: ProductEdits = {
      name_en: product.name_en,
      name_fa: product.name_fa,
      description_en: product.description_en ?? "",
      description_fa: product.description_fa ?? "",
      unit_size: product.unit_size,
      ai_category: product.ai_category,
      pricing_category: product.pricing_category,
      barcode: product.barcode,
      main_supplier: product.main_supplier,
      date_tracking: product.date_tracking,
      scope: "branch",
      selling_price: "7.49",
    };
    const context = catalogTestActor(state, "manager", "Warehouse");
    const before = cloneWithAuthority(state);
    expect(() =>
      savePriceChange(state, context, {
        product_code: product.code,
        mode: "regular",
        scope: "current",
        price: "7.49",
        price_unit: "each",
        branches: ["Warehouse"],
        starts_on: new Date().toISOString().slice(0, 10),
        last_day: null,
        accept_below_margin: false,
        below_cost_reason: "",
        add_labels: false,
      }),
    ).toThrow("stores");
    expect(state).toEqual(before);
    saveProductEdits(
      state,
      context,
      product.code,
      {
        ...edits,
        selling_price: undefined,
        description_en: "Recorded warehouse product description",
      },
      productEditSnapshot(state, context, product.code),
    );
    expect(product.description_en).toBe(
      "Recorded warehouse product description",
    );
    expect(product.selling_price).toBe(before.products[0].selling_price);
  });
  it("Undo restores weighed settings and keeps the original decision history", () => {
    const state = initialState();
    const context = catalogTestActor(state, "manager", "all");
    const before = cloneWithAuthority(state);
    const productPrices = state.products.map(
      (product) => product.selling_price,
    );
    savePricingSettings(
      state,
      {
        ...state.config,
        weighed_items: { ...DEFAULT_WEIGHED_SETTINGS, main_display_unit: "kg" },
      },
      context,
    );
    const [entry] = attachReversals(before, state, context);
    expect(entry.reversible).toBe(true);
    reverseActivity(state, context, entry.id, "undo");
    expect(state.config.weighed_items).toEqual(before.config.weighed_items);
    expect(state.products.map((product) => product.selling_price)).toEqual(
      productPrices,
    );
    expect(state.activity.find((item) => item.id === entry.id)).toBeDefined();
    expect(
      state.activity.some(
        (item) =>
          item.reversed_activity_id === entry.id &&
          item.reversal_kind === "undo",
      ),
    ).toBe(true);
  });
  it("manual creation stores cost per lb and respects the weighed rule without touching Each", () => {
    const state = initialState();
    const product = addProduct(state, catalogTestActor(state, "manager"), {
      name_en: "Fresh weighed test item",
      name_fa: "محصول آزمایشی وزنی",
      description_en: "",
      description_fa: "",
      unit_size: "1 lb",
      ai_category: state.products[0].ai_category,
      pricing_category: "grocery",
      barcode: "",
      main_supplier: state.products[0].main_supplier,
      date_tracking: false,
      sold_by: "weight",
      scope: "all",
      last_cost_before_tax: "11.0000",
      last_cost_unit: "kg",
    });
    expect(product).toMatchObject({
      sold_by: "weight",
      last_cost_before_tax: "4.9895",
      selling_price: "7.99",
    });
    expect(rulePrice(state, product)).toBe("7.99");
    state.config.weighed_items = {
      ...DEFAULT_WEIGHED_SETTINGS,
      use_rounding_bands: false,
    };
    expect(rulePrice(state, product)).toBe("7.68");
    expect(product.selling_price).toBe("7.99");
  });
  it("saves reversible settings without repricing products and denies unauthorized or invalid saves atomically", () => {
    const state = initialState();
    const products = structuredClone(state.products);
    const candidate = structuredClone(state.config);
    candidate.weighed_items = {
      ...DEFAULT_WEIGHED_SETTINGS,
      main_display_unit: "kg",
      show_second_unit: false,
    };
    const actor = catalogTestActor(state, "manager");
    savePricingSettings(state, candidate, actor);
    expect(state.products).toEqual(products);
    expect(state.activity[0]).toMatchObject({
      reversible: true,
      entity_type: "settings",
      before: { weighed_items: { main_display_unit: "lb" } },
      after: { weighed_items: { main_display_unit: "kg" } },
    });
    const saved = structuredClone(state.config);
    expect(() =>
      savePricingSettings(
        state,
        candidate,
        catalogTestActor(state, "floor_worker"),
      ),
    ).toThrow();
    expect(() =>
      savePricingSettings(state, candidate, foreignCatalogManager(state)),
    ).toThrow();
    candidate.weighed_items.conversion_factor = "0";
    expect(() => savePricingSettings(state, candidate, actor)).toThrow();
    expect(state.config).toEqual(saved);
  });
});
