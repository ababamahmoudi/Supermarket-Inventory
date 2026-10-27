# R2e A — weight items bought by the case

## What changed

- **A1:** Weight products entered in Cases expose Cases invoiced, Weight per case with lb/kg, Delivered (cases), Case cost, and a read-only calculated cost per weight unit. The equation retains the actual case arithmetic.
- **A2:** Cases, Units, lb and kg changes convert quantity and cost together. The original source weight/cost arithmetic remains intact; switching display units does not compound rounding. Invoice weight inputs display up to three decimals; per-weight costs display four. Delivered retains its explicit source-weight unit when the display changes, so a partial receipt never becomes a rounded or guessed physical quantity. Cases still show Delivered in cases. Unknown case weights remain empty and block confirmation until entered.
- **A3:** Imported paper line totals remain independent of calculated totals. Differences greater than one cent show arithmetic and fixes, and block both Confirm and posting. “Paper total is wrong” is a separate authorized, actor/time-recorded History decision. Its acknowledgment applies only to the exact paper/calculated amounts; another amount change requires review again. A corrected cost does not rename the product or alter the original reading.
- **A4:** Explicit measured case packs are stored at import. A composite `4 × 10 lb` means four individual units; choosing weight converts it to 40 lb per case. The importer retains the original printed description and original image.
- **A5:** Added unit regressions and a fictional import → convert → confirm → post → genuine first-price approval browser check in English/Persian on desktop/phone.

## How to test

1. Sign in as Owner or Manager and choose a branch.
2. Invoices → New invoice → JSON file. Select [`r2e-weight-cases.json`](../prototype/tests/fixtures/r2e-weight-cases.json). The entire file, original image and supplier are fictional.
3. Import one invoice and open its only line, **Fictional Alder Spice**. Choose **Grocery** as pricing category.
4. Unit → **Weight (lb)**. Expect **40 lb**, **2.5000 per lb**, **100.00** line total, and the **4 cases × 10 lb** equation.
5. Unit → **Weight (kg)**. Expect displayed **18.144 kg** and **5.5116 per kg**, with the exact original **100.00** line total. Delivered is explicitly labelled in its retained source unit, **lb**.
6. Unit → **Cases**. Expect **4** cases, **10 lb** per case, **4** delivered cases, **25.0000** case cost and read-only **2.5000** calculated cost per lb.
7. Return to Weight (lb). Enter **25.0000** as per-lb cost to reproduce an intentional bad edit. The amber check says calculated **1,000.00**, paper **100.00**. Confirm is blocked. Choose **Use 2.50/lb** to repair it.
8. Confirm line, review Invoice details and Totals if requested, then Post invoice. Open Approvals: its actual new-product proposal is **3.99/lb**, based on **2.5000/lb** purchase cost, not the case cost.

## Defaults and limits

The configured kg-to-lb factor applies as before. A unit change is a representation change, not a new paper amount. Unknown mass is never inferred from a count. A fixed measured pack can establish mass, including one-weight packs such as `2 kg` or `500 g`; nested or conflicting measurements remain unresolved. The browser prototype keeps protected, browser-local records and simulated AI/authentication. No production service or physical printer check is claimed.

The older order-review regression now proves **12 Units → 1 Case of 12 → 12 Units** with the exact retained line amount, while keeping the invalid-pack, missing-cost and order-review checks. The earlier import regression now requires explicit case mass before kg entry instead of asserting the former count/cost reinterpretation bug.

An unknown-mass weight choice can be cancelled back to its original Cases/Units with the original counts, cost and partial receipt intact. A native weight line with a subsequently entered case mass derives its case quote from its retained per-weight price; if its delivered-case equivalence is unresolved, the invoice facts stay visible and Delivered still requires a real entry.
