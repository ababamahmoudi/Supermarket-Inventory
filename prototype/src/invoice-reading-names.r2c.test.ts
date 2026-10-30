import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { mapReadingLine } from "./invoice-readings";
import { splitInvoiceProductDescription } from "./invoice-reading-products";

describe("R2c 0.9 clean product names with printed evidence", () => {
  it.each([
    ["CEDAR JAM 24x500 gr", "Cedar Jam 500 g"],
    ["CEDAR JAM X 12", "Cedar Jam"],
    ["CEDAR JAM 20 X 300gr", "Cedar Jam 300 g"],
    ["CEDAR JAM Pieces in Carton: 32", "Cedar Jam"],
    ["CEDAR OIL Box of 6*2 lit Bottles", "Cedar Oil 2 l"],
    ["CEDAR JAM (12x640 gr)", "Cedar Jam 640 g"],
    ["CEDAR JAM 700g-RiverBrand UA", "CEDAR JAM RiverBrand 700 g"],
    ["CEDAR JAM 01-08-1405", "Cedar Jam"],
  ])("cleans %s", (description, name) => {
    const line = mapReadingLine(
      initialState(),
      undefined,
      {
        description,
        unit: "CS",
        quantity: "2",
        line_total: "48.00",
        taxable: false,
      },
      0,
    );
    expect(line.new_name_en).toBe(name);
    expect(line.description).toBe(description);
    expect(line.supplier_item_code).toBe(name);
    expect(line.supplier_item_code_inferred).toBe(true);
  });
  it("automatically swaps a pack-only name with a real name code and retains both undo values", () => {
    const line = mapReadingLine(
      initialState(),
      undefined,
      {
        description: "Box of 20 x 1kg",
        supplier_sku: "CEDAR DRY BEANS",
        unit: "CS",
        quantity: "2",
        line_total: "40.00",
        taxable: false,
      },
      0,
    );
    expect(line).toMatchObject({
      new_name_en: "Cedar Dry Beans 1 kg",
      supplier_item_code: "Box of 20 x 1kg",
      new_name_swap: {
        name: "Box of 20 x 1kg",
        supplier_item_code: "CEDAR DRY BEANS",
      },
      description: "Box of 20 x 1kg",
    });
    expect(line.low_confidence_fields).toContain("description");
  });
  it("keeps unknown brand spelling and an ambiguous partly named pack as a suggestion", () => {
    expect(
      splitInvoiceProductDescription({
        description: "RiverBrand Jam 12x640 gr",
      }).name,
    ).toBe("RiverBrand Jam 640 g");
    const line = mapReadingLine(
      initialState(),
      undefined,
      {
        description: "12 × Assorted Sachets",
        supplier_sku: "CEDAR TEA",
        unit: "CS",
        quantity: "2",
        line_total: "40.00",
        taxable: false,
      },
      0,
    );
    expect(line.new_name_swap).toBeUndefined();
    expect(line.new_name_suggestion).toBe("Cedar Tea");
    expect(line.description).toBe("12 × Assorted Sachets");
  });
});
