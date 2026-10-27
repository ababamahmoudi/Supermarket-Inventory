# R2e C8 — Return record and creation form

Returns → open a return. Header actions centre on the title block, and item locations display configured names. On phones, Show details exposes columns omitted from the compact item table.

Returns → New return → choose supplier and a received product. Quantity and the shared Unit select remain on one row, both 44px. The default follows retained receipt evidence. Units/Cases are available for each products when an actual pack is retained; weight products use lb/kg and known case/unit conversions. No case size is guessed. The preview shows the canonical units/lb recorded, while History retains the entered quantity and unit. Return money still uses frozen canonical receipt cost/currency; creating a return does not change stock, payables or approvals.

Conversions use configured weight factors and half-up lb rounding to the existing three-place pickup precision. No on-hand cap is inferred. See open-questions.md for this explicit default.

Proof: protected unit tests for case/kg conversions, missing/stale evidence, source cost and input rejection; original return creation guards; desktop/phone Quantity/Unit geometry and configured-location display.
