import { describe, expect, it } from "vitest";
import {
  matchesSelectOption,
  matchingSelectTerms,
  normalizeSelectSearch,
  productSelectOption,
  selectMatchParts,
  supplierSelectOption,
} from "./select-search";

describe("R2c 2.1 public picker search", () => {
  const product = {
    code: "PX-12",
    name_en: "Blueberry Preserve",
    name_fa: "مربای بلوبری",
    barcode: "8712345678901",
  };
  it.each([
    "blueberry",
    "PRESERVE",
    "مربای",
    "PX-12",
    "8712345678901",
    "مربای PX-12",
    "Preserve 871234",
  ])("matches names and identifiers: %s", (query) => {
    expect(matchesSelectOption(productSelectOption(product, "en"), query)).toBe(
      true,
    );
    expect(matchesSelectOption(productSelectOption(product, "fa"), query)).toBe(
      true,
    );
  });
  it.each(["pear", "PX-13", "preserve 99999"])(
    "rejects missing query terms: %s",
    (query) => {
      expect(
        matchesSelectOption(productSelectOption(product, "en"), query),
      ).toBe(false);
    },
  );
  it("normalizes Arabic/Persian letters, digits and Unicode compatibility forms", () => {
    expect(normalizeSelectSearch("  كيك ۱۲٣  ")).toBe("کیک 123");
    expect(
      matchesSelectOption({ value: "A12", label: "کیک ۱۲۳" }, "كيك 123"),
    ).toBe(true);
    expect(
      matchesSelectOption({ value: "A12", label: "Ｆｏｏｄ" }, "food"),
    ).toBe(true);
  });
  it("shows the matching alternative name or barcode without repeating the main label", () => {
    expect(
      matchingSelectTerms(productSelectOption(product, "en"), "مربای"),
    ).toEqual([product.name_fa]);
    expect(
      matchingSelectTerms(productSelectOption(product, "en"), "871234"),
    ).toEqual([product.barcode]);
    expect(
      matchingSelectTerms(productSelectOption(product, "en"), "blueberry"),
    ).toEqual([]);
  });
  it.each([
    ["Blueberry Preserve", "berry preserve", ["berry", "Preserve"]],
    ["کیک ۱۲۳", "كيك 123", ["کیک", "۱۲۳"]],
    ["Jam (2+1)", "(2+1)", ["(2+1)"]],
    ["<img src=x>", "<img", ["<img"]],
  ])(
    "highlights exact original text without interpreting query syntax: %s",
    (value, query, expected) => {
      const parts = selectMatchParts(value, query);
      expect(parts.map((part) => part.text).join("")).toBe(value);
      expect(
        parts.filter((part) => part.match).map((part) => part.text),
      ).toEqual(expected);
    },
  );
  it("copies only public product fields and keeps supplier aliases searchable", () => {
    const privateProduct = {
      ...product,
      last_cost_before_tax: "999.8765",
      margin: "0.42",
      private_invoice_id: "not-public",
    };
    const option = productSelectOption(privateProduct, "en");
    expect(Object.keys(option).sort()).toEqual([
      "label",
      "searchTerms",
      "value",
    ]);
    expect(JSON.stringify(option)).not.toMatch(
      /999\.8765|0\.42|not-public|cost|margin|invoice/,
    );
    expect(
      matchesSelectOption(
        supplierSelectOption({
          name: "Cedarbridge Supply",
          previous_names: ["Elmstone Supply"],
        }),
        "Elmstone",
      ),
    ).toBe(true);
  });
});
