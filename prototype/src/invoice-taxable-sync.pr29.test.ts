import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import {
  invoiceLineTaxableMismatch,
  setInvoiceLineCategory,
  setInvoiceLineTaxable,
  syncInvoiceLineTaxableToCategory,
} from "./invoice-checks";
import { countedWord } from "./screens/invoice-review/counted-word";

function line() {
  const state = initialState();
  const item = structuredClone(state.invoice.lines[0] ?? {}) as Parameters<
    typeof setInvoiceLineCategory
  >[0];
  Object.assign(item, {
    pricing_category: "grocery",
    taxable: false,
    taxable_inferred: false,
    tax_profile: "non_taxable",
    line_total: "10.00",
  });
  return { config: state.config, item };
}

describe("PR 29 pricing category and Taxable stay in sync", () => {
  it("choosing a taxable category switches Taxable on, and back off", () => {
    const { config, item } = line();
    setInvoiceLineCategory(item, "grocery_taxable", config);
    syncInvoiceLineTaxableToCategory(item, config);
    expect(item.taxable).toBe(true);
    expect(item.tax_profile).not.toBe("non_taxable");
    setInvoiceLineCategory(item, "grocery", config);
    syncInvoiceLineTaxableToCategory(item, config);
    expect(item.taxable).toBe(false);
    expect(item.tax_profile).toBe("non_taxable");
  });

  it("switching Taxable moves to the configured twin both ways", () => {
    const { config, item } = line();
    expect(setInvoiceLineTaxable(item, true, config)).toBe(true);
    expect(item.pricing_category).toBe("grocery_taxable");
    expect(item.taxable).toBe(true);
    expect(setInvoiceLineTaxable(item, false, config)).toBe(true);
    expect(item.pricing_category).toBe("grocery");
    expect(item.taxable).toBe(false);
    expect(invoiceLineTaxableMismatch(item, config)).toBe(false);
  });

  it("keeps the category and reports a mismatch when no twin is configured", () => {
    const { config, item } = line();
    item.pricing_category = "rice";
    expect(setInvoiceLineTaxable(item, true, config)).toBe(false);
    expect(item.pricing_category).toBe("rice");
    expect(item.taxable).toBe(true);
    expect(invoiceLineTaxableMismatch(item, config)).toBe(true);
  });

  it("reads twins from configuration, not from names", () => {
    const { config, item } = line();
    for (const category of config.pricing_categories)
      delete (category as { taxable_twin?: string }).taxable_twin;
    expect(setInvoiceLineTaxable(item, true, config)).toBe(false);
    expect(item.pricing_category).toBe("grocery");
  });
});

it("PR 29 uses singular and plural case wording", () => {
  expect(countedWord(1, "case", "cases")).toBe("case");
  expect(countedWord("1", "case", "cases")).toBe("case");
  expect(countedWord(2, "case", "cases")).toBe("cases");
  expect(countedWord("0.5", "case", "cases")).toBe("cases");
});
