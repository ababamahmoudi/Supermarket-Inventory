import { describe, expect, it } from "vitest";
import { configSeed } from "./config";
import {
  calculatePackagePrice,
  packageSizeInLb,
  type PackageUnit,
} from "./package-pricing";
import {
  ean13CheckDigit,
  inStorePackageBarcode,
  validatePackageBarcode,
} from "./package-barcodes";
import fixtures from "../../seed/pricing-test-cases.json";

describe("R2e D package Decimal pricing", () => {
  it.each([
    ["100", "g", "2.99", "2.99"],
    ["250", "g", "5.49", "5.99"],
    ["500", "g", "10.49", "10.99"],
    ["1", "lb", "9.49", "9.99"],
    ["2", "kg", "39.99", "40.99"],
  ] as const)(
    "%s %s uses the actual parent category rounding",
    (size, unit, grocery, rice) => {
      expect(
        calculatePackagePrice(size, unit, "8.99", "4.1000", "grocery")
          .selling_price,
      ).toBe(grocery);
      expect(
        calculatePackagePrice(size, unit, "8.99", "4.1000", "rice")
          .selling_price,
      ).toBe(rice);
    },
  );
  it("retains the exact size and formula, with the same fee at every size", () => {
    const result = calculatePackagePrice(
      "250",
      "g",
      "8.99",
      "4.1000",
      "grocery",
    );
    expect(result.size_lb).toBe("0.551155");
    expect(result.raw_price).toBe("5.44488345");
    expect(result.cost_before_tax).toBe("2.2597");
    expect(result.container_fee).toBe("0.49");
    expect(result.formula).toContain("0.551155 lb × 8.99/lb + 0.49");
    expect(packageSizeInLb("16", "oz")).toBe("1");
    expect(packageSizeInLb("1000", "g")).toBe(packageSizeInLb("1", "kg"));
  });
  it("configured fee, cost, conversion and bands change output without source edits", () => {
    const config = structuredClone(configSeed);
    config.weighed_items.package_container_fee = "1.49";
    config.weighed_items.package_container_cost = "0.20";
    config.weighed_items.conversion_factor = "3";
    config.weighed_items.ounces_per_lb = "20";
    const result = calculatePackagePrice(
      "100",
      "g",
      "8.99",
      "4.1000",
      "grocery",
      config,
    );
    expect(result.size_lb).toBe("0.3");
    expect(result.selling_price).toBe("3.99");
    expect(result.cost_before_tax).toBe("1.4300");
    expect(packageSizeInLb("20", "oz", config)).toBe("1");
    config.special_corrections = [];
    config.weighed_items.package_container_fee = "0.49";
    config.weighed_items.conversion_factor = "2.20462";
    expect(
      calculatePackagePrice("100", "g", "8.99", "4.1000", "grocery", config)
        .selling_price,
    ).toBe("2.49");
  });
  it.each(["0", "-1", "1e2", "NaN", "Infinity", "0.0000001"])(
    "rejects invalid size %s",
    (size) => {
      expect(() => packageSizeInLb(size, "g")).toThrow();
    },
  );
  it("rejects invalid units and settings rather than guessing", () => {
    expect(() => packageSizeInLb("1", "case" as PackageUnit)).toThrow();
    const config = structuredClone(configSeed);
    config.weighed_items.package_container_fee = "0.499";
    expect(() =>
      calculatePackagePrice("1", "lb", "8.99", "4.1000", "grocery", config),
    ).toThrow();
  });
  it.each(fixtures.package_cases)(
    "shared package fixture: $name",
    (fixture) => {
      const result = calculatePackagePrice(
        fixture.size,
        fixture.unit as PackageUnit,
        fixture.parent_price_per_lb,
        fixture.parent_cost_per_lb,
        fixture.category,
      );
      expect(result.selling_price).toBe(fixture.expected_selling_price);
      expect(result.size_lb).toBe(fixture.expected_size_lb);
    },
  );
});
describe("R2e D fixed-size EAN-13", () => {
  it("checks invented manufacturer GTIN formats and rejects an incorrect check digit", () => {
    expect(validatePackageBarcode("9916847256306")).toBe("9916847256306");
    expect(ean13CheckDigit("991684725630")).toBe("6");
    expect(validatePackageBarcode("092835716409")).toBe("092835716409");
    expect(validatePackageBarcode("96385203")).toBe("96385203");
    expect(validatePackageBarcode("19916847256303")).toBe("19916847256303");
    expect(() => validatePackageBarcode("092835716408")).toThrow();
    expect(() => validatePackageBarcode("9916847256307")).toThrow();
    expect(() => validatePackageBarcode("DEMO-9916847256306")).toThrow();
  });
  it("assigns distinct checked identifiers without price data and supports configured prefixes", () => {
    const barcodes = new Set(
      Array.from({ length: 500 }, (_, i) =>
        inStorePackageBarcode(String(i + 1)),
      ),
    );
    expect(barcodes.size).toBe(500);
    for (const barcode of barcodes)
      expect(validatePackageBarcode(barcode)).toBe(barcode);
    expect(inStorePackageBarcode("0001", "29")).toMatch(/^29\d{11}$/);
    expect(inStorePackageBarcode("0001")).not.toBe(
      inStorePackageBarcode("0001", "29"),
    );
    expect(() => inStorePackageBarcode("1", "30")).toThrow();
    expect(() => inStorePackageBarcode("10000000000")).toThrow();
  });
});
