import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import seedConfig from "../../seed/arzon-config.json";
import fixtures from "../../seed/pricing-test-cases.json";
import {
  calculatePrice,
  PricingValidationError,
  type PricingConfig,
  validatePricingConfig,
} from "./pricing";

function configuration(): PricingConfig {
  return structuredClone(seedConfig);
}

describe("the shared pricing fixtures", () => {
  it.each(fixtures.cases)("$name", (fixture) => {
    const result = calculatePrice(fixture.cost_before_tax, fixture.category);
    expect(result.selling_price).toBe(fixture.expected_selling_price);
    expect(result.rounded_raw).toBe(fixture.raw_price);
    expect(result.after_band_rounding).toBe(fixture.after_band_rounding);
    expect(result.special_correction_applied).toBe(
      fixture.special_2_49_3_49_correction_applied,
    );
  });
});

describe("precision and boundaries", () => {
  it("rounds half-up only before selecting a band", () => {
    const config = configuration();
    config.pricing_categories.find(
      (c) => c.key === "kitchenware",
    )!.cost_divisor = "1";
    expect(calculatePrice("1.2249", "kitchenware", config).selling_price).toBe(
      "0.99",
    );
    expect(calculatePrice("1.2250", "kitchenware", config).selling_price).toBe(
      "1.49",
    );
    expect(calculatePrice("1.7249", "kitchenware", config).selling_price).toBe(
      "1.49",
    );
    expect(calculatePrice("1.7250", "kitchenware", config).selling_price).toBe(
      "1.99",
    );
  });

  it("keeps Rice exact and immediately-above endings distinct", () => {
    const exact = calculatePrice("3.1920", "rice");
    const above = calculatePrice("3.1921", "rice");
    expect(exact.rounded_raw).toBe(above.rounded_raw);
    expect(exact.selling_price).toBe("3.99");
    expect(above.selling_price).toBe("4.99");
    expect(above.raw_price).toBe("3.990125");
    expect(above.after_band_rounding).toBeNull();
  });

  it("uses the configured minimum for low and zero band costs", () => {
    expect(calculatePrice("0", "grocery").selling_price).toBe("0.49");
    const config = configuration();
    config.rounding_bands.minimum_result_when_previous_dollar_does_not_exist =
      "0.29";
    expect(calculatePrice("0", "grocery", config).selling_price).toBe("0.29");
  });

  it("applies a correction once rather than chaining mappings", () => {
    const config = configuration();
    config.special_corrections.push({ from: "2.99", to: "9.99" });
    expect(calculatePrice("1.60", "grocery", config).selling_price).toBe(
      "2.99",
    );
    expect(calculatePrice("1.50", "kitchenware", config).selling_price).toBe(
      "2.49",
    );
    expect(
      calculatePrice("1.60", "rice", config).special_correction_applied,
    ).toBe(false);
  });

  it("does not add sales tax into the selling price", () => {
    expect(calculatePrice("3.20", "grocery_taxable").selling_price).toBe(
      calculatePrice("3.20", "grocery").selling_price,
    );
  });
});

describe("configuration changes need no code changes", () => {
  it("changes the selling price immediately after a divisor changes", () => {
    const config = configuration();
    const before = calculatePrice("1.00", "grocery", config);
    config.pricing_categories.find((c) => c.key === "grocery")!.cost_divisor =
      "0.50";
    expect(before.selling_price).toBe("1.49");
    expect(calculatePrice("1.00", "grocery", config).selling_price).toBe(
      "1.99",
    );
  });

  it("reads configured thresholds, endings, offsets, Rice endings, and corrections", () => {
    const config = configuration();
    config.rounding_bands.bands[0].upper_exclusive = "0.40";
    config.rounding_bands.bands[1].lower_inclusive = "0.40";
    expect(calculatePrice("1.50", "kitchenware", config).selling_price).toBe(
      "2.49",
    );
    expect(calculatePrice("1.35", "kitchenware", config).selling_price).toBe(
      "1.99",
    );
    config.rounding_bands.bands[0].ending = "0.89";
    config.rounding_bands.bands[0].dollar_offset = 0;
    expect(calculatePrice("1.35", "kitchenware", config).selling_price).toBe(
      "2.89",
    );
    config.pricing_categories.find((c) => c.key === "rice")!.rounding_ending =
      "0.79";
    expect(calculatePrice("3.00", "rice", config).selling_price).toBe("3.79");
    config.special_corrections[0].to = "2.79";
    expect(calculatePrice("1.60", "grocery", config).selling_price).toBe(
      "2.79",
    );
  });

  it("never mutates the supplied configuration", () => {
    const config = configuration();
    const saved = JSON.stringify(config);
    calculatePrice("1.60", "grocery", config);
    expect(JSON.stringify(config)).toBe(saved);
  });

  it("accepts a company-defined category key rather than relying on seed category names", () => {
    const config = configuration();
    config.pricing_categories[0].key = "fresh_produce";
    config.pricing_categories[0].label = "Fresh produce";
    expect(calculatePrice("1.00", "fresh_produce", config).selling_price).toBe(
      "1.49",
    );
    expect(() => calculatePrice("1.00", "grocery", config)).toThrowError(
      "unknown_category",
    );
  });
});

describe("minimum margin", () => {
  it("flags the unchanged-price 1.12 / 1.49 example without altering the price", () => {
    const result = calculatePrice("1.12", "grocery");
    expect(result.selling_price).toBe("1.49");
    expect(result.below_minimum_margin).toBe(true);
    expect(new Decimal(result.margin!).times("100").toFixed(2)).toBe("24.83");
  });

  it("compares the exact ratio at the threshold rather than a formatted percent", () => {
    const config = configuration();
    config.pricing_categories.find((c) => c.key === "grocery")!.minimum_margin =
      "0.24833";
    expect(calculatePrice("1.12", "grocery", config).below_minimum_margin).toBe(
      true,
    );
    config.pricing_categories.find((c) => c.key === "grocery")!.minimum_margin =
      "0.24831";
    expect(calculatePrice("1.12", "grocery", config).below_minimum_margin).toBe(
      false,
    );
    config.pricing_categories.find((c) => c.key === "grocery")!.minimum_margin =
      null;
    expect(calculatePrice("1.12", "grocery", config).below_minimum_margin).toBe(
      false,
    );
  });

  it("accepts an exact threshold and always flags an undefined zero-price margin", () => {
    const config = configuration();
    config.pricing_categories.find((c) => c.key === "grocery")!.cost_divisor =
      "1";
    config.pricing_categories.find((c) => c.key === "grocery")!.minimum_margin =
      "1";
    expect(calculatePrice("0", "grocery", config).below_minimum_margin).toBe(
      false,
    );
    config.rounding_bands.minimum_result_when_previous_dollar_does_not_exist =
      "0.00";
    config.pricing_categories.find((c) => c.key === "grocery")!.minimum_margin =
      null;
    const zero = calculatePrice("0", "grocery", config);
    expect(zero.margin).toBeNull();
    expect(zero.below_minimum_margin).toBe(true);
  });
});

describe("invalid input cannot create prices", () => {
  it.each([
    "-1",
    "-0.0001",
    "NaN",
    "Infinity",
    "1e3",
    "",
    "1.12345",
    "1.00000",
    "1,50",
  ])("rejects cost %j", (cost) => {
    expect(() => calculatePrice(cost, "grocery")).toThrowError(
      PricingValidationError,
    );
  });

  it("accepts positive signed decimal costs without float conversion", () => {
    expect(calculatePrice("+1.0000", "grocery").selling_price).toBe("1.49");
    expect(calculatePrice("-0.0000", "grocery").selling_price).toBe("0.49");
  });

  it("rejects numeric money rather than accepting a floating-point value", () => {
    expect(() =>
      calculatePrice(1.1 as unknown as string, "grocery"),
    ).toThrowError("invalid_cost");
  });

  it("rejects an unknown category", () => {
    expect(() => calculatePrice("1", "missing")).toThrowError(
      "unknown_category",
    );
  });

  it.each(["0", "-0.65", "NaN", "Infinity", ""])(
    "rejects divisor %j",
    (divisor) => {
      const config = configuration();
      config.pricing_categories[0].cost_divisor = divisor;
      expect(() => validatePricingConfig(config)).toThrowError(
        "invalid_divisor",
      );
    },
  );

  it.each([
    "gap",
    "overlap",
    "incomplete",
    "reversed",
    "offset",
    "ending",
  ] as const)("rejects %s bands", (problem) => {
    const config = configuration();
    if (problem === "gap")
      config.rounding_bands.bands[1].lower_inclusive = "0.24";
    if (problem === "overlap")
      config.rounding_bands.bands[1].lower_inclusive = "0.22";
    if (problem === "incomplete")
      config.rounding_bands.bands[2].upper_exclusive = "0.99";
    if (problem === "reversed") config.rounding_bands.bands.reverse();
    if (problem === "offset")
      config.rounding_bands.bands[0].dollar_offset = 0.5;
    if (problem === "ending") config.rounding_bands.bands[0].ending = "0.999";
    expect(() => validatePricingConfig(config)).toThrowError(
      PricingValidationError,
    );
  });

  it.each(["-1.00", "2.001", "NaN"])(
    "rejects correction amount %j",
    (amount) => {
      const config = configuration();
      config.special_corrections[0].to = amount;
      expect(() => validatePricingConfig(config)).toThrowError(
        "invalid_correction",
      );
    },
  );

  it("rejects duplicate correction sources and invalid minimums", () => {
    const config = configuration();
    config.special_corrections.push({ from: "2.490", to: "4.99" });
    expect(() => validatePricingConfig(config)).toThrowError(
      "invalid_correction",
    );
    config.special_corrections.pop();
    config.rounding_bands.minimum_result_when_previous_dollar_does_not_exist =
      "-0.49";
    expect(() => validatePricingConfig(config)).toThrowError("invalid_minimum");
  });

  it("rejects invalid Rice endings and invalid margins", () => {
    const config = configuration();
    config.pricing_categories.find((c) => c.key === "rice")!.rounding_ending =
      "1.00";
    expect(() => validatePricingConfig(config)).toThrowError("invalid_ending");
    config.pricing_categories.find((c) => c.key === "rice")!.rounding_ending =
      "0.99";
    config.pricing_categories[0].minimum_margin = "1.01";
    expect(() => validatePricingConfig(config)).toThrowError("invalid_margin");
  });
});

describe("properties over a deterministic range of four-decimal costs", () => {
  it("default outputs are nonnegative cent prices with the seed endings", () => {
    for (const category of seedConfig.pricing_categories) {
      for (let i = 0; i <= 1000; i += 1) {
        const cost = new Decimal(i).times("0.0731").toFixed(4);
        const result = calculatePrice(cost, category.key);
        expect(new Decimal(result.selling_price).gte("0")).toBe(true);
        expect(result.selling_price).toMatch(/\.(49|99)$/);
        if (category.rounding === "always_up_to_next_99") {
          const price = new Decimal(result.selling_price);
          expect(price.gte(result.raw_price)).toBe(true);
          expect(price.minus("1").lt(result.raw_price)).toBe(true);
        }
      }
    }
  });

  it("customized rules produce configured endings, including correction targets", () => {
    const config = configuration();
    config.rounding_bands.bands[0].ending = "0.89";
    config.rounding_bands.bands[1].ending = "0.39";
    config.rounding_bands.bands[2].ending = "0.89";
    config.rounding_bands.minimum_result_when_previous_dollar_does_not_exist =
      "0.29";
    config.special_corrections = [{ from: "2.39", to: "2.79" }];
    for (let i = 0; i <= 500; i += 1) {
      const result = calculatePrice(
        new Decimal(i).times("0.0157").toFixed(4),
        "grocery",
        config,
      );
      expect(result.selling_price).toMatch(/\.(29|39|79|89)$/);
    }
  });
});
