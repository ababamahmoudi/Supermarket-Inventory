import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { mapReadingLine } from "./invoice-readings";
import { splitInvoiceProductDescription } from "./invoice-reading-products";

describe("R2e B7 readable names retain supplier evidence", () => {
  it.each(["(Promotion)", "(Promotion", "(Promo)", "Promotion"])(
    "separates %s from the proposed name and shows its provenance",
    (marker) => {
      const state = initialState();
      const description = `Fictional Maple Dressing ${marker}`;
      const before = structuredClone(state.products);
      const line = mapReadingLine(
        state,
        undefined,
        {
          description,
          unit: "each",
          quantity: "1",
          unit_cost_before_tax: "2.0000",
          line_total: "2.00",
          taxable: false,
        },
        0,
      );
      expect(line.new_name_en).toBe("Fictional Maple Dressing");
      expect(line.reading_supplier_promotion).toBe(true);
      expect(line.description).toBe(description);
      expect(state.products).toEqual(before);
    },
  );
  it.each([
    [
      "Box of 48 Pcs Fictional Meadow Wafer",
      "Fictional Meadow Wafer",
      "48 units",
      48,
    ],
    [
      "Box of 24 x Fictional Meadow Wafer",
      "Fictional Meadow Wafer",
      "24 units",
      24,
    ],
    [
      "Fictional Roasted Seed - Cumin - 5lb / Bag",
      "Fictional Roasted Seed - Cumin 5 lb",
      "1 × 5 lb",
      1,
    ],
    ["Fictional Rice - 5LB/CASE", "Fictional Rice", "1 × 5 lb", 1],
  ])("moves the pack out of %s", (description, name, pack, count) => {
    expect(splitInvoiceProductDescription({ description })).toMatchObject({
      name,
      pack_size: pack,
      units_per_case: count,
    });
  });
  it.each([
    ["Fictional Tea (Decaf", "Fictional Tea Decaf"],
    ["Fictional Tea ] Green", "Fictional Tea Green"],
    ["Fictional Tea [Green]", "Fictional Tea [Green]"],
    ["Fictional Tea (Decaf)", "Fictional Tea (Decaf)"],
  ])("never displays an unmatched bracket in %s", (description, name) => {
    expect(splitInvoiceProductDescription({ description }).name).toBe(name);
  });
});
