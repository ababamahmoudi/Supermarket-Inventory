# R2e B7–B8 — names from invoice readings

## What changed

**B7:** New product suggestions separate `(Promotion)`, unclosed `(Promotion`, `(Promo)` and standalone Promotion into a quiet **Supplier promotion** note. Leading counted-box text and terminal measured bag/case text become pack evidence. Unmatched brackets disappear; balanced descriptive brackets remain. Original descriptions and existing product names are unchanged.

**B8:** A newly created supplier whose printed name is entirely capitalized receives a readable title-case name. Legal suffixes normalize to Inc./Ltd./Co./Corp.; words containing digits retain their spelling. Existing suppliers keep their editable names. The original image and `reading_record.supplier_name_as_printed` retain the printed form.

## How to test

1. Use Invoices → New invoice → JSON file with the existing, entirely fictional [`r2b-fictional-readings-export.json`](../prototype/tests/fixtures/r2b-fictional-readings-export.json).
2. Open the imported Bluefinch invoice. Its newly created supplier is **Bluefinch Pantry Inc.**, while the original retains the printed capitalized name.
3. Open the supplier, choose Edit and change its spelling deliberately. Importing a subsequent reading will match and retain the existing supplier rather than automatically rename it.
4. B7's unit fixtures use invented **Fictional Maple Dressing (Promotion**, **Box of 48 Pcs Fictional Meadow Wafer**, and **Fictional Roasted Seed - Cumin - 5lb / Bag**. Their proposed names are clean; the promotion note and pack remain separate from the unchanged printed description.

The existing browser compatibility test still checks supplier contacts, manual name editing, previous-name retention and invoice history. It now expects automatic normalization only at creation. The weight compatibility test separately requires explicit mass for an unknown case before entering kg, preserving the paper amount rather than asserting the former count/cost reinterpretation bug.
