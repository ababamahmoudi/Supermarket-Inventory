import { describe, expect, it } from "vitest";
import {
  readingProductUnitSize,
  splitInvoiceProductDescription,
  suggestInvoiceEnglishName,
} from "./invoice-reading-products";

describe("R2b product names and printed pack evidence", () => {
  it.each([
    [
      "Box of 8 x 375G Orchard Preserve",
      "Orchard Preserve 375 g",
      "8 × 375 g",
      8,
    ],
    ["MEADOW PICKLES X 10", "Meadow Pickles", "10 units", 10],
    ["Meadow Pickles X 10 / Case", "Meadow Pickles", "10 units", 10],
    [
      "42190-Blueberry Preserve X 12",
      "Blueberry Preserve",
      "12 units",
      12,
      "42190",
    ],
    [
      "40127 Sunfield Rice - 6 x 5 LB / Case",
      "Sunfield Rice 5 lb",
      "6 × 5 lb",
      6,
      "40127",
    ],
    ["TEA LEAVES 24X250ML", "Tea Leaves 250 ml", "24 × 250 ml", 24],
    ["BOX OF 20 × 1 KG PINE NUTS", "Pine Nuts 1 kg", "20 × 1 kg", 20],
    ["GentleSoap 4 x 12 OZ", "GentleSoap 12 oz", "4 × 12 oz", 4],
    ["Apple Drink 6 x 1.5 L", "Apple Drink 1.5 l", "6 × 1.5 l", 6],
  ])(
    "splits %s into a clean name and pack",
    (description, name, pack, count, supplierCode?: string) => {
      expect(
        splitInvoiceProductDescription({ description, supplierCode }),
      ).toEqual({
        name,
        pack_size: pack,
        units_per_case: count,
        uncertain: false,
      });
    },
  );

  it("strips only a known textual supplier prefix and retains unknown brand words", () => {
    expect(
      splitInvoiceProductDescription({
        description: "FG Forest Berry Jam X 8",
        supplierCode: "FG",
      }),
    ).toMatchObject({ name: "Forest Berry Jam", units_per_case: 8 });
    expect(
      splitInvoiceProductDescription({
        description: "FG FOREST BERRY JAM X 8",
      }),
    ).toMatchObject({ name: "Fg Forest Berry Jam", units_per_case: 8 });
    expect(
      splitInvoiceProductDescription({
        description: "AB+7 Lemon Preserve 4 x 200g",
        supplierCode: "AB+7",
      }),
    ).toMatchObject({ name: "Lemon Preserve 200 g" });
  });

  it("does not mistake ordinary name numbers or partial SKU prefixes for supplier codes", () => {
    for (const description of [
      "24 Carrot Honey",
      "100% Pure Syrup",
      "7UP Drink",
    ])
      expect(splitInvoiceProductDescription({ description }).name).toBe(
        description,
      );
    expect(
      splitInvoiceProductDescription({
        description: "FGH Blueberry Jam",
        supplierCode: "FG",
      }).name,
    ).toBe("FGH Blueberry Jam");
    expect(
      splitInvoiceProductDescription({
        description: "24 Carrot Honey",
        supplierCode: "24",
      }).name,
    ).toBe("Carrot Honey");
  });

  it("retains explicit pack counts and flags conflicting printed evidence", () => {
    expect(
      splitInvoiceProductDescription({
        description: "Box of 12 x 250g Apricot Spread",
        unitsPerCase: "6",
      }),
    ).toEqual({
      name: "Apricot Spread 250 g",
      pack_size: "12 × 250 g",
      units_per_case: 6,
      uncertain: true,
    });
    expect(
      splitInvoiceProductDescription({
        description: "Apricot Spread 12 x 250g",
        packSize: "6 units",
      }),
    ).toMatchObject({
      pack_size: "6 units",
      units_per_case: 6,
      uncertain: true,
    });
    expect(
      splitInvoiceProductDescription({
        description: "Apricot Spread 12 x 250g",
        packSize: "12 x 300g",
      }).uncertain,
    ).toBe(true);
    expect(
      splitInvoiceProductDescription({
        description: "Apricot Spread 12 x 250g",
        packSize: "Box of 6 X 250G",
      }),
    ).toEqual({
      name: "Apricot Spread 250 g",
      pack_size: "6 × 250 g",
      units_per_case: 6,
      uncertain: true,
    });
  });

  it.each([0, -1, 1.5, "0", "2.25", "NaN", "9007199254740992"])(
    "does not replace invalid explicit pack %s with an inferred count",
    (unitsPerCase) => {
      const result = splitInvoiceProductDescription({
        description: "Maple Syrup 12 x 250ml",
        unitsPerCase,
      });
      expect(result.units_per_case).toBeUndefined();
      expect(result.uncertain).toBe(true);
    },
  );

  it("requires review for pack-only or nested packs and offers a name-like SKU", () => {
    expect(
      splitInvoiceProductDescription({
        description: "Box of 8 x 400g",
        supplierCode: "ORCHARD APPLE JAM",
      }),
    ).toEqual({
      name: "",
      pack_size: "8 × 400 g",
      units_per_case: 8,
      uncertain: true,
      suggested_name: "Orchard Apple Jam 400 g",
    });
    expect(
      splitInvoiceProductDescription({
        description: "Box of 8 x 400g",
        supplierCode: "P-88",
      }).suggested_name,
    ).toBeUndefined();
    expect(
      splitInvoiceProductDescription({ description: "12 x 6 x 100g Snack" }),
    ).toMatchObject({ name: "Snack 100 g", uncertain: true });
    expect(
      splitInvoiceProductDescription({ description: "12 x 6 x 100g Snack" })
        .units_per_case,
    ).toBeUndefined();
    expect(
      splitInvoiceProductDescription({ description: "12x6x100g Snack" }),
    ).toMatchObject({ name: "Snack 100 g", uncertain: true });
    expect(
      splitInvoiceProductDescription({ description: "12x6x100g Snack" })
        .units_per_case,
    ).toBeUndefined();
    expect(
      splitInvoiceProductDescription({
        description: "12 × Assorted Sachets",
        supplierCode: "MEADOW TEA",
      }),
    ).toMatchObject({
      name: "12 × Assorted Sachets",
      uncertain: true,
      suggested_name: "Meadow Tea",
    });
  });

  it("flags an uncorroborated numeric prefix while trusting a matching printed SKU", () => {
    expect(
      splitInvoiceProductDescription({ description: "4826 Orchard Biscuit" }),
    ).toMatchObject({ name: "Orchard Biscuit", uncertain: true });
    expect(
      splitInvoiceProductDescription({
        description: "4826 Orchard Biscuit",
        supplierCode: "4826",
      }),
    ).toMatchObject({ name: "Orchard Biscuit", uncertain: false });
    expect(
      splitInvoiceProductDescription({ description: "42 Orchard Biscuit" }),
    ).toMatchObject({ name: "42 Orchard Biscuit", uncertain: false });
  });

  it.each([
    ["Orchard Tea", "3 x 4 x 500 g"],
    ["3 x 4 x 500 g Orchard Tea", "3 x 4 x 500 g"],
    ["12 x 500 g Orchard Tea", "Box of 3 × 4 × 500G"],
  ])(
    "does not infer an inner count from nested supplied pack text",
    (description, packSize) => {
      const result = splitInvoiceProductDescription({ description, packSize });
      expect(result.units_per_case).toBeUndefined();
      expect(result.uncertain).toBe(true);
      expect(result.pack_size).toContain("3 × 4 × 500 g");
    },
  );

  it.each([12, "12"])(
    "retains an explicit printed count %s while a nested pack still needs review",
    (unitsPerCase) => {
      expect(
        splitInvoiceProductDescription({
          description: "3 x 4 x 500 g Orchard Tea",
          packSize: "3 x 4 x 500 g",
          unitsPerCase,
        }),
      ).toMatchObject({ units_per_case: 12, uncertain: true });
    },
  );

  it("still infers a positive count from an ordinary supplied measured pack", () => {
    expect(
      splitInvoiceProductDescription({
        description: "Orchard Tea",
        packSize: "4 x 500 g",
      }),
    ).toEqual({
      name: "Orchard Tea 500 g",
      pack_size: "4 × 500 g",
      units_per_case: 4,
      uncertain: false,
    });
  });

  it("normalizes supplied pack text and leaves printed input untouched", () => {
    const source = Object.freeze({
      description: "  Valley oats X 8  ",
      packSize: "500G",
      unitsPerCase: 8,
    });
    expect(splitInvoiceProductDescription(source)).toEqual({
      name: "Valley oats 500 g",
      pack_size: "500 g",
      units_per_case: 8,
      uncertain: false,
    });
    expect(source.description).toBe("  Valley oats X 8  ");
    expect(
      splitInvoiceProductDescription({ description: "Pack Mule Granola" }),
    ).toEqual({
      name: "Pack Mule Granola",
      pack_size: "",
      uncertain: false,
    });
    expect(
      splitInvoiceProductDescription({
        description: "Orchard Apples",
        packSize: "Box of 8",
      }),
    ).toMatchObject({ pack_size: "Box of 8", units_per_case: 8 });
    expect(
      splitInvoiceProductDescription({
        description: "Orchard Preserve",
        packSize: "Box of 8 X 250G assorted flavours",
      }),
    ).toMatchObject({
      pack_size: "Box of 8 × 250 g assorted flavours",
      units_per_case: 8,
    });
  });
});

describe("existing invoice English-name casing", () => {
  it("preserves mixed-case brand spelling and lowercases quantity-unit fragments", () => {
    expect(suggestInvoiceEnglishName("RiverBrand Dry Beans 500 G")).toBe(
      "RiverBrand Dry Beans 500 g",
    );
    expect(
      suggestInvoiceEnglishName("DUSK CRUNCH 12X454G 1KG 500ML 25LB"),
    ).toBe("Dusk Crunch 12x454g 1kg 500ml 25lb");
    expect(suggestInvoiceEnglishName("BOX OF 12 X 454G")).toBe(
      "Box Of 12 x 454g",
    );
  });
});

describe("R3c K2 individual size and carton identity", () => {
  it.each([
    ["24 ×330g", "330 g"],
    ["24x330g", "330 g"],
    ["3 × 4 × 0.500KG", "0.5 kg"],
    ["Box of 6*2 lit Bottles", "2 l"],
    ["6x2LTS", "2 l"],
    ["RiverBrand Jam 24 x 330 GR", "330 g"],
    ["1 × 5LBS", "5 lb"],
    ["10 LB", "10 lb"],
    ["10 LB / CASE", ""],
    ["Spice 10 lb per case", ""],
    ["10 kg/box", ""],
    ["10 kg per carton", ""],
    ["12 × 330g/case", "330 g"],
    ["3 × 4 × 500g per carton", "500 g"],
    ["4 x 12 OZ", "12 oz"],
    ["500ML", "500 ml"],
    ["330 g / 330gr", "330 g"],
    ["12 Per Carton", ""],
    ["24 units", ""],
    ["24 × 0 g", ""],
    ["-5g", ""],
    ["Tea 330g / 500g", ""],
  ])(
    "extracts the individual size from %s without multiplying carton mass",
    (description, size) => {
      expect(readingProductUnitSize(description)).toBe(size);
    },
  );

  it("keeps whole-case weight in the pack without adding it to a product name", () => {
    const input = Object.freeze({
      description: "Fictional Alder Spice",
      packSize: "10 LB / CASE",
      unitsPerCase: 1,
      unit: "case",
    });
    expect(splitInvoiceProductDescription(input)).toEqual({
      name: "Fictional Alder Spice",
      pack_size: "10 lb / CASE",
      units_per_case: 1,
      uncertain: false,
    });
    expect(input.packSize).toBe("10 LB / CASE");
    expect(
      splitInvoiceProductDescription({
        description: "Fictional Alder Spice 10 lb/case",
      }),
    ).toEqual({
      name: "Fictional Alder Spice",
      pack_size: "1 × 10 lb",
      units_per_case: 1,
      uncertain: false,
    });
  });

  it.each([
    ["RiverBrand Fig Jam 330G 12 Per Carton", "RiverBrand Fig Jam 330 g"],
    ["12 Per Carton RiverBrand Fig Jam 330g", "RiverBrand Fig Jam 330 g"],
    ["RiverBrand Fig Jam (330g) 12 Per Carton", "RiverBrand Fig Jam 330 g"],
  ])("keeps the name and size separate from %s", (description, name) => {
    const input = Object.freeze({ description });
    expect(splitInvoiceProductDescription(input)).toEqual({
      name,
      pack_size: "12 units",
      units_per_case: 12,
      uncertain: false,
    });
    expect(input.description).toBe(description);
  });

  it("accepts a separately printed carton count while retaining the source size", () => {
    expect(
      splitInvoiceProductDescription({
        description: "RiverBrand Fig Jam 330g",
        packSize: "12 Per Carton",
      }),
    ).toEqual({
      name: "RiverBrand Fig Jam 330 g",
      pack_size: "12 Per Carton",
      units_per_case: 12,
      uncertain: false,
    });
  });

  it("never makes an individual-size-only description a usable product name", () => {
    for (const description of [
      "400g",
      "(400 g)",
      "Box of 8 x 400g",
      "3 x 4 x 400g",
    ])
      expect(splitInvoiceProductDescription({ description })).toMatchObject({
        name: "",
        uncertain: true,
      });
    expect(
      splitInvoiceProductDescription({
        description: "400 g",
        supplierCode: "RIVER JAM",
      }),
    ).toMatchObject({
      name: "",
      uncertain: true,
      suggested_name: "River Jam 400 g",
    });
  });

  it("separates repeated carton labels without losing a measured individual size", () => {
    expect(
      splitInvoiceProductDescription({
        description: "RiverBrand Fig Jam 12x330g 12 Per Carton",
      }),
    ).toEqual({
      name: "RiverBrand Fig Jam 330 g",
      pack_size: "12 × 330 g",
      units_per_case: 12,
      uncertain: false,
    });
    expect(
      splitInvoiceProductDescription({
        description: "RiverBrand Fig Jam 12x330g 24 Per Carton",
      }),
    ).toMatchObject({
      name: "RiverBrand Fig Jam 330 g",
      units_per_case: 12,
      uncertain: true,
    });
    expect(
      splitInvoiceProductDescription({
        description: "RiverBrand Fig Jam 330g 12 Per Carton 24 Per Carton",
      }),
    ).toMatchObject({
      name: "RiverBrand Fig Jam 330 g",
      units_per_case: 12,
      uncertain: true,
    });
    expect(
      splitInvoiceProductDescription({
        description: "RiverBrand Fig Jam 330g",
        packSize: "12 Per Carton / 24 Per Carton",
      }).uncertain,
    ).toBe(true);
  });

  it("does not confuse a known size-like supplier code with the individual product size", () => {
    expect(
      splitInvoiceProductDescription({
        description: "5LB RiverBrand Jam 24x330g",
        supplierCode: "5LB",
      }),
    ).toEqual({
      name: "RiverBrand Jam 330 g",
      pack_size: "24 × 330 g",
      units_per_case: 24,
      uncertain: false,
    });
  });

  it("keeps conflicting sizes and pack counts as real review questions", () => {
    expect(
      splitInvoiceProductDescription({
        description: "RiverBrand Fig Jam 330g 12 Per Carton",
        unitsPerCase: 24,
      }),
    ).toMatchObject({
      name: "RiverBrand Fig Jam 330 g",
      units_per_case: 24,
      uncertain: true,
    });
    expect(
      splitInvoiceProductDescription({
        description: "RiverBrand Fig Jam 330g",
        packSize: "12 x 500g",
      }),
    ).toMatchObject({
      name: "RiverBrand Fig Jam 330 g",
      pack_size: "12 × 500 g",
      uncertain: true,
    });
    expect(
      splitInvoiceProductDescription({
        description: "RiverBrand Fig Jam 330g / 500g",
      }).uncertain,
    ).toBe(true);
  });
});
