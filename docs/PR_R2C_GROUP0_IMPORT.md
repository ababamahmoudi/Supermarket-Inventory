# R2c receiving import changes

## 0.7 Handwritten delivery time

Unqualified handwritten hours 1–6 use the afternoon when it falls in the configured invoice delivery window (06:00–20:00 by default). A retained alternative supports one-click correction; handwriting remains a check. Explicit AM/PM and 13–23 are used as written. Opening hours do not infer delivery time. North York's seeded opening hours are Open 24 hours. Both clocks display 24-hour time.

To test: import an invented reading with `Aug 11 2:15`, open Invoice details and see 14:15 with Use 02:15 instead; click it and verify the Received time changes and its check clears. Explicit `2:15 am` stays 02:15.

## 0.8 Pack conversion and costs

CTN24/CTN16/Cs15, count-per-box, Pieces in Carton, star/multiplication measured packs and single measured units per case are recognized. Unresolved packs use one unit plus Units per case isn't printed, never a zero pack. Rounded fractional cases within 0.01 of a whole converted unit are accepted; other fractions keep their actual paper quantity visible and remain blocked. Printed line amount divided by actual units gives the four-place unit cost. A retained exact amount/units basis prevents a later recalculation multiplying a rounded cost and changing paper cents. A meaningful cost/pack change invalidates that retained basis.

To test: import fictional `CTN24`, quantity 2, line total 48.00 → 48 units, cost 1.0000. Import 2.8333 cases × 12, line total 47.00 → 34 units, cost 1.3824, retained total 47.00. Unknown pack shows 1 plus its amber question. A non-whole conversion still requires correction.
