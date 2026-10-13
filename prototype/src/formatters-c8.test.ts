import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { formatCasesAndUnits, formatMoney, formatOffer } from "./formatters";

describe("C8 retained monetary and pack presentation", () => {
  it.each([
    ["18.4000", "$18.40"],
    ["1.5525", "$1.5525"],
    ["1.5520", "$1.552"],
    ["0.0000", "$0.00"],
    ["-1.5525", "-$1.5525"],
    ["9007199254740993.005", "$9,007,199,254,740,993.005"],
  ])("retains source precision for %s", (source, expected) => {
    const amount = new Decimal(source);
    expect(formatMoney(amount, { currency: "CAD" })).toBe(expected);
    expect(amount.toString()).toBe(new Decimal(source).toString());
  });

  it("retains cents for compact offers and explicit selling-price precision", () => {
    expect(formatMoney("5", { currency: "CAD", compact: true })).toBe("$5.00");
    expect(formatMoney("1.5525", { currency: "CAD", decimals: 2 })).toBe(
      "$1.55",
    );
    expect(formatMoney("1.552567", { currency: "CAD", decimals: 8 })).toBe(
      "$1.5526",
    );
    expect(formatOffer("2 for $5", "en", "CAD")).toBe("2 for $5.00");
    expect(formatOffer("2 for $5", "fa", "CAD")).toContain("$5.00");
  });

  it.each([
    [40, 12, "3 cases + 4 units"],
    [16, 6, "2 cases + 4 units"],
    [30, 4, "7 cases + 2 units"],
    [13, 12, "1 case + 1 unit"],
    [12, 12, "1 case"],
    [4, 12, "4 units"],
    [0, 12, "0 units"],
    [6, 1, "6 units"],
  ])("decomposes %s actual units using pack %s", (units, pack, expected) => {
    expect(formatCasesAndUnits(units, pack, "en")).toBe(expected);
  });

  it("keeps huge integer quantities exact and uses Persian unit labels", () => {
    const units = new Decimal("9007199254740993");
    expect(formatCasesAndUnits(units, 12, "en")).toBe(
      "750599937895082 cases + 9 units",
    );
    expect(formatCasesAndUnits(13, 12, "fa")).toBe("1 کارتن + 1 واحد");
    expect(units.toString()).toBe("9007199254740993");
  });

  it("does not invent a pack or round non-whole normalized quantities", () => {
    expect(formatCasesAndUnits("2.5", 12, "en")).toBe("2.5 units");
    expect(formatCasesAndUnits(12, 0, "en")).toBe("12 units");
    expect(formatCasesAndUnits(12, "2.5", "en")).toBe("12 units");
  });
});
