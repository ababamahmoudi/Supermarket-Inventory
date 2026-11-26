# R2c receiving import changes

## 0.7 Handwritten delivery time

Unqualified handwritten hours 1–6 use the afternoon when it falls in the configured invoice delivery window (06:00–20:00 by default). A retained alternative supports one-click correction; handwriting remains a check. Explicit AM/PM and 13–23 are used as written. Opening hours do not infer delivery time. North York's seeded opening hours are Open 24 hours. Both clocks display 24-hour time.

To test: import an invented reading with `Aug 11 2:15`, open Invoice details and see 14:15 with Use 02:15 instead; click it and verify the Received time changes and its check clears. Explicit `2:15 am` stays 02:15.

## 0.8 Pack conversion and costs

CTN24/CTN16/Cs15, count-per-box, Pieces in Carton, star/multiplication measured packs and single measured units per case are recognized. Unresolved packs use one unit plus Units per case isn't printed, never a zero pack. Rounded fractional cases within 0.01 of a whole converted unit are accepted; other fractions keep their actual paper quantity visible and remain blocked. Printed line amount divided by actual units gives the four-place unit cost. A retained exact amount/units basis prevents a later recalculation multiplying a rounded cost and changing paper cents. A meaningful cost/pack change invalidates that retained basis.

To test: import fictional `CTN24`, quantity 2, line total 48.00 → 48 units, cost 1.0000. Import 2.8333 cases × 12, line total 47.00 → 34 units, cost 1.3824, retained total 47.00. Unknown pack shows 1 plus its amber question. A non-whole conversion still requires correction.

## 0.9 Product names

Common measured/boxed packs, Pieces in Carton labels, parenthesized packs, attached sizes, trailing UA and printed date codes are removed from editable names while the printed description remains exact. ALL-CAPS names become Title Case; mixed-case brand spelling remains. Pack-only names automatically use a name-like printed supplier code and retain the prior name/code for Undo. Ambiguous partly named descriptions still offer a suggestion. Generated supplier codes use the clean name. The summary metadata shows pack, distinct code and category without repeating the name.

To test: a fictional `CEDAR JAM (12x640 gr)` becomes Cedar Jam with pack 12 × 640 g and its exact printed description in More details. `Box of 20 x 1kg` with code `CEDAR DRY BEANS` starts as Cedar Dry Beans; open the line and click Undo to restore the printed name/code.

## 0.10 Genuine checks and quiet provenance

Derived totals, default company currency, name-filled codes, computed due dates and invoice-date Received keep muted provenance rather than invented amber questions. Handwriting, explicitly reading-flagged values (including empty optional evidence), unresolved values and genuine matching/pack ambiguities remain checks. Legacy calculated fields migrate to quiet provenance without fabricating who checked them. The line status icon is a plain !; its count is in metadata text. Internal branch hints are used only to suggest location and never create an unresolvable field check or substitute for an address.

The independent twelve-line Cedar Path fixture has one explicit barcode check, under one highlighted check per line. It is intentionally a typical import, while the earlier R2b fixture continues to test many deliberately flagged and unresolved edge cases.

## 0.11 Totals from complete lines

When all paper totals are absent, complete item totals plus signed other charges/credits derive subtotal; tax and total remain unresolved until a second paper amount or a person supplies tax, following R2b 1.3, with quiet Calculated from the lines provenance. Any unresolved line/charge amount keeps the totals unresolved. Supplied paper totals and differences are preserved. Import preview, imported draft and reopened receiving use the same Decimal helper.

To test: an invented invoice with lines 13.17 and 2.49, fee 1.25 and credit 0.34, and no totals shows subtotal 16.57 with Tax/Total needing review; entering tax 2.15 calculates total 18.72. An unread amount keeps named missing totals instead.
