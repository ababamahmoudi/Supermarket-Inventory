# Pricing engine

E1 role wording uses Owner/Manager for former Supervisor company authority. Branch Supervisor may only propose an own-store regular price; the central capability/approval boundary executes it after Owner/Manager decision. R3c adds the configured final-ending adjustment below; historical approved/manual prices remain unchanged.

This is the most important rule set in the product. It must be implemented **once** (a pure function with no database access), driven by configuration, and covered by tests. The backend and the prototype use the same algorithm; the prototype has a TypeScript port that must pass the same test file.

Test file: `seed/pricing-test-cases.json` (every case must pass, in both languages).
Configuration: `seed/arzon-config.json` → `pricing_categories`, `rounding_bands`, `special_corrections`.

## Inputs and outputs

- Input: `unit_cost_before_tax` (Decimal, 4 places), `pricing_category`, configuration. Each products use their per-unit cost unchanged. Weight products retain source cost per kg/lb and normalize the cost to a canonical per-lb basis before this same pure function (see Weighed items).
- Output: `selling_price` (Decimal, 2 places, displayed before tax), plus the intermediate values (`raw_price`, `after_band_rounding`, whether the special correction applied, and `rounded_up_from` when a configured rule raises the actual selling amount) so the UI can explain the result.
- **Never use floating point.** Use Decimal (Python `decimal`, or a decimal library in TypeScript).

## Algorithm

```
raw = unit_cost_before_tax / category.cost_divisor
```

### Rounding mode "bands" (Grocery, Grocery (Taxable), Kitchenware)

1. Round `raw` **half-up to the cent**.
2. Split into whole dollars `D` and cents fraction `f` (0.00–0.99).
3. Apply:
   - `f < 0.23` → `(D − 1) + 0.99` ("previous .99"). If `D = 0` there is no previous dollar → use the configured minimum **0.49**.
   - `0.23 ≤ f < 0.73` → `D + 0.49`
   - `f ≥ 0.73` → `D + 0.99`
4. **Special correction** (only for categories with `apply_2_49_3_49_correction = true`, i.e. **Grocery and Grocery (Taxable)** only): if the result is exactly `2.49` → `2.99`; exactly `3.49` → `3.99`. Applied once, after step 3.

5. **Configured final ending adjustment (R3c):** after the existing category rounding and correction, apply `rounding_bands.final_ending_adjustment` once. The configured default is `source_endings: ["0.49"], target_ending: "0.99"`, so `1.49 → 1.99`, `2.49 → 2.99`, `52.49 → 52.99` and the base minimum `0.49 → 0.99`. The target must be a cent ending below 1 and strictly higher than every distinct source ending. `null` or an empty source list disables this rule for another company's configuration. It also applies after weighed bands-Off cent rounding and package calculations. It does not alter existing stored prices or Sale quick picks.

The genuine pre-adjustment selling amount is retained as `rounded_up_from`; it is not the raw cost/divisor quotient. Existing Grocery 2.49/3.49 corrections already reach the configured .99 target, so their original .49 remains available for the same explanation and Use lower action without chaining corrections. Other custom correction targets remain unchanged unless their own final ending is configured as a source.

Missing legacy final-ending settings inherit the current configured seed default through a pure resolver. Explicit null/empty/custom values survive, no stored record or historical price is migrated, and pricing quotes/fingerprints include this effective default. Settings → Catalog → Pricing categories → Rounding rules can change or disable the adjustment; the ordinary audited settings command validates it.

A whole-dollar raw price such as `10.00` has `f = 0.00`, so it becomes `9.99` through the "previous .99" band. No separate rule is needed.

### Rounding mode "always_up_to_next_99" (Rice)

Result = the smallest value of the form `X.99` that is **greater than or equal to** the unrounded `raw`.

- `3.75 → 3.99`, `3.99 → 3.99`, `4.00 → 4.99` **(assumed for exact whole dollars; see open-questions)**.
- Rice never gets the 2.49/3.49 correction and never uses bands.

### Reference implementation (Python)

`seed/pricing_reference.py` and the setup compatibility reference in `scripts/pricing_reference_compat.py` read the actual configuration. Run `python seed/pricing_reference.py` to verify every shared case. Both retain raw/band/special-correction evidence and apply the same final adjustment. The prototype's TypeScript Decimal engine executes the same JSON fixtures; numeric money is never accepted as a float.

## Worked examples (all verified)

| Category          | Cost  | Raw   | After bands | Final     | Why                                             |
| ----------------- | ----- | ----- | ----------- | --------- | ----------------------------------------------- |
| Grocery           | 1.30  | 2.00  | 1.99        | **1.99**  | below .23 → previous .99                        |
| Grocery           | 1.00  | 1.54  | 1.49        | **1.99**  | middle band, then final ending adjustment       |
| Grocery           | 2.50  | 3.85  | 3.99        | **3.99**  | .73 or above                                    |
| Grocery           | 6.50  | 10.00 | 9.99        | **9.99**  | whole dollar becomes x.99 below                 |
| Grocery           | 1.60  | 2.46  | 2.49        | **2.99**  | special correction                              |
| Grocery           | 2.40  | 3.69  | 3.49        | **3.99**  | special correction                              |
| Grocery           | 2.10  | 3.23  | 3.49        | **3.99**  | .23 is in the middle band, then corrected       |
| Grocery (Taxable) | 3.20  | 4.92  | 4.99        | **4.99**  | same rules as Grocery                           |
| Rice              | 3.00  | 3.75  | n/a         | **3.99**  | up to next .99                                  |
| Rice              | 3.20  | 4.00  | n/a         | **4.99**  | exact whole dollar goes up (assumed)            |
| Rice              | 18.40 | 23.00 | n/a         | **23.99** |                                                 |
| Kitchenware       | 5.40  | 9.00  | 8.99        | **8.99**  | divisor 0.60                                    |
| Kitchenware       | 1.50  | 2.50  | 2.49        | **2.99**  | final ending adjustment; no category correction |
| Kitchenware       | 31.50 | 52.50 | 52.49       | **52.99** | final ending adjustment                         |

The shared fixture retains all earlier 21 cases, both kg/lb cases and adds a high-dollar final-ending case; all three package cases and retained four-decimal boundary cases remain required. Intermediate band values remain .49 where applicable, while final expected prices follow the configured adjustment. Note: with a 0.65 divisor and costs in whole cents, a raw price ending exactly in .73 cannot occur; do not write a test that expects it.

## Margin check

`margin = (selling_price − unit_cost) / selling_price`. If a minimum margin is configured and the margin is lower, the proposal needs Owner/Manager approval (reason: "Below minimum margin"). The seeded value `0.25` is a **placeholder**; the owner must confirm it. If the setting is empty, the rule is inactive.

## When a price proposal is created

On posting an invoice (and on manual cost edits), for each line: compute the new selling price from the new unit cost. Then:

- Price equals the current approved price → no proposal (supplier cost change only: no approval).
- Price differs → create a `pending` price proposal (Owner/Manager approval required).
- New product → pending product with a pending price.
- A manual override of the price → proposal flagged "manual override" (always approval).
  See `workflows.md` for the state machine and display rules.

**Owner/Manager direct product entry (B, item 45)** uses this exact engine for the entered last unit cost/category, but the Owner/Manager's save is the creation/price decision: the product is Active immediately without a separate pending approval. A different selling price records a manual override; a below-minimum-margin saved price requires explicit confirmation. This is a role-specific creation exception, not a change to the decimal algorithm or worker invoice proposal rules.

## Price scope

- Company default price per product, optional per-branch override.
- The cost basis is the cost on the **location's** invoice, so selling locations can calculate different prices. A new proposal retains the receiving source location; approval chooses **all selling locations** (default) or **this selling location only**. Exclude non-selling locations from price/offer effects unless Sells to customers is enabled.

## Display rules

- Selling price is shown **before tax**. Taxable products show a **Taxable** tag. Do not add tax into any displayed price.
- A pending proposal is shown beside the approved price with a "Pending" tag; see `design-language.md` for the badge style.

## Testing requirements

1. Load `seed/pricing-test-cases.json` and assert every `expected_selling_price`.
2. Property tests: with the enabled default final adjustment, band results end in .99; explicit disabled/custom-rule configurations retain their own endings; the result is never negative; rice results are never below the raw price.
3. Configuration tests: change a divisor or band in the database and prove the output changes without code edits.
4. The prototype's TypeScript engine must run the same JSON test file in its test suite.

## C manual provenance and exceptional receipts (2026-10-09)

Historical C behavior below retains its quantity/provenance rules; new calculations additionally apply the R3c final-ending setting above. Each selling prices remain per unit: case-entry quantities normalize with the retained positive pack, unit-entry quantities do not multiply again. C4 Weight products instead use explicit kg/lb source quantities and canonical per-lb approved pricing.

For an already manual-priced product, regular new invoices retain the approved manual price and expose new rule price beside it. Reviewer must choose **Keep manual price / Use rule price**. Keep preserves manual provenance and evaluates any configured minimum-margin review using actual manual price/new regular cost; Use creates normal posting-time Owner/Manager approval even if rule/manual amounts equal so explicit approval can clear provenance. Before approval and after rejection, Cashier still charges the manual approved price. Source-linked proposals retain exact new costs/latest invoice basis and company/location scope.

A **Short-dated (expiry discount)** lot requires actual expiry/Date tracking and records its real discounted receipt/payable, but never updates regular cost or selling price and creates no price-change proposal. Regular pricing basis is distinct from latest actual bought cost/history. Refused extras enter neither payable/receipt nor pricing approvals. Order expected totals are Decimal before-tax estimates, never supplier liabilities.

## Weighed items (C4, 2026-10-09)

Products declare **Sold by: Each / Weight** (Each for compatible existing records). For Weight invoices retain source quantity, quantity unit (kg/lb), source before-tax cost, cost unit (kg/lb), and optional case weight/unit. Quantity accepts up to three decimals. Invoice amount uses exact source-unit conversion, not a rounded displayed per-lb cost; retain source evidence and original totals/tax. All arithmetic is Decimal.

Pricing normalization is a separate pure step before the existing category algorithm:

1. Company conversion factor is **2.20462 lb per kg**.
2. If source cost is per kg: canonical cost per lb = source cost ÷ factor, **half-up to four decimals**. If per lb: retain four-decimal source cost unchanged.
3. Feed canonical cost into the same configured divisor, cent half-up, category rounding mode, special corrections and final-ending adjustment. Default **Use rounding bands for weighed items** = Yes. When explicitly Off for a bands category, use half-up cents instead of the band/special-correction step, followed by the configured final-ending adjustment; Rice's distinct configured upward-ending rule remains unchanged. Each products and historical approved prices are unaffected by this setting.
4. Store the approved price per lb at two decimals with source/canonical units and provenance. A display choice never overwrites/recalculates that stored approved amount. Config **Main display unit** defaults lb (kg allowed); **Show second unit** defaults Yes.
5. Display kg price = approved lb selling price × factor, half-up to cents. The displayed secondary kg price is not a new approval or pricing-engine input. Margin uses canonical cost and approved price in the same unit; preserve tax/manual-price/below-margin rules.

| Source      | Canonical cost/lb | Divisor | Raw price rounded cents | Final/lb  | Display/kg |
| ----------- | ----------------- | ------- | ----------------------- | --------- | ---------- |
| $11.0000/kg | $4.9895           | 0.65    | $7.68                   | **$7.99** | **$17.61** |
| $4.9895/lb  | $4.9895           | 0.65    | $7.68                   | **$7.99** | **$17.61** |

Add both source-unit cases to seed/pricing-test-cases.json and test conversion precision, source quantities, display conversions and configuration without dropping all existing seed/boundary tests. Labels, Lookup, Products and product editor explicitly label per lb/per kg/per unit; the secondary display follows the company settings. Existing band-property tests apply to bands-enabled categories; the explicit bands-Off setting has its own cent-result tests.

## C8 display and temporary-price boundary (2026-10-12)

The current configured algorithm includes the R3c final-ending setting; historical stored prices remain unchanged. A sale is a separate effective-price overlay; regular receipt comparisons and proposals still use the regular approved price/cost. On a different regular cost, manual-price review defaults to Use the new calculated price; the reviewer confirms that decision before posting. Same cost and short-dated receipts do not replace manual price.

Currency displays use at least two and at most four decimals, trimming only zeros after the second:18.4000 → 18.40 and 1.5525 → 1.5525. This applies to read-only costs and printed invoice/order/supplier amounts, without changing four-decimal storage or cent allocations. Weighed sale entry retains exact current-main-unit cents; full-precision conversion handles comparisons and secondary display without changing canonical regular prices. Sale quick picks round down to configured .49/.99 endings, independently of the normal category rounding/special-correction engine.

### C9 presentation clarification

The shared read-only product unit-cost display shows cents, including $4.99/lb; underlying source/canonical cost, editable inputs, calculations and retained financial/printed evidence keep their existing precision. Selling-price rendering is shared and atomic: struck regular before bold current only for a genuine lower sale; main/secondary weight units remain separate end-aligned lines. Frozen Price update snapshots do not adopt later live prices. This historical presentation clarification does not reprice stored records; the R3c rule above governs new calculations.

## R2e A — case-bought weight invoice costs

A weight case has an explicit mass and mass unit. Canonical per-lb purchase cost derives from case cost ÷ case mass, retaining four decimal places. The invoice amount uses the exact case cost and equivalent number of cases, rounded once to cents; it must not multiply rounded per-lb cost by mass when that would change paper cents. A change between Cases, Units, lb and kg converts quantity and cost together. Display kg/lb changes retain original source arithmetic and the configured conversion factor, so repeated switches do not reprice the paper. Unknown mass stays unresolved. A composite `4 × 10 lb` remains four units per case until weight is selected, then establishes a 40 lb case. The original paper line total is independent, with a greater-than-one-cent mismatch blocking confirmation/posting until repaired or explicitly acknowledged as a wrong paper total.

## R2e D3: fixed-size packages of a weight product

`packageSizeInLb` converts g/kg with the company's lb-per-kg factor and oz with configurable `weighed_items.ounces_per_lb` (default 16). It retains the full Decimal result; no float or rounded display conversion enters the formula. Package selling amount is `size_lb × parent approved price/lb + package_container_fee` (default 0.49), then the parent's category rounding, including configured bands/corrections or Rice's upward ending. This amount is already a selling amount: never divide by the cost divisor again. `roundCategoryPrice` is the shared rounding function used by regular pricing and packages, including the R3c final-ending rule. Existing package cases remain present with intentionally updated new-calculation results (for example 5.49→5.99).

Package cost is `size_lb × parent canonical current cost/lb + package_container_cost` (default 0.00), stored at four places, with margin calculated against the derived price. Prices are before tax and stored at two places. No independent package approval is created. A pending parent price produces a pending derived package price at its actual location while the approved price remains chargeable.

## R2f D3 — staged weight-cost decisions and branch costs

The weight Product editor shows the canonical approved price per lb prominently, its per-kg equivalent, and the actual configured category calculation. Changing an existing cost stages a four-place canonical cost decision. Save records it with the real actor, time, company/location and a private fingerprint of the exact accepted regular receipt basis (source line, effective corrected cost, units, posting time and any later-delivery identity/time). Source invoices, purchase history, physical movements and payables remain unchanged. A subsequent genuine regular receipt, same-line cost correction or later Short delivery supersedes that manual marker; a short-dated receipt does not become the regular-cost basis.

A changed cost normally creates the existing Owner/Manager pending rule-price approval. The current approved charge and derived approved package prices stay in effect; the new parent/package proposals are labelled Pending. Retained manual regular prices use the existing explicit Keep/Use rule review. A separate, explicit Owner/Manager Change price decision staged in this form is already authorized: outer Save applies that actual regular-price decision with its minimum-margin/below-cost acknowledgments and normal active-Sale conflicts, without creating a redundant approval. Its preview uses the newly typed cost and category. Final Save rechecks fresh actor authority, source/pricing/package snapshots and all existing money guards.

Each package's private cost is derived at each location from the parent's current `productStoreCost` at that location, including a valid manual marker. Another branch's receipt cost is never replaced by a global last-cost fallback when actual branch evidence exists. Financial maps and receipt fingerprints remain absent from public Product/package/History projections. Public package prices still derive only from genuine approved parent prices at the selected location.

An All locations manual cost decision retains one attributed all-scope cost marker, then creates ordinary pending rule-price reviews separately at each fresh, permitted selling location. Exclude Warehouse, inactive and non-selling locations and recheck actual pricing authority. Capture each branch's prior `productStoreCost` before applying the marker, retain that branch's own manual regular price/provenance, and suppress a review only where an explicit staged regular-price decision covers that location. Unknown prior cost stays null; never replace it with an invented amount. A branch without an actual approved price gets a new-product price proposal rather than a company-default comparison. Existing overlapping all-scope pending reviews remain blocking when they cannot be partially replaced safely.

Existing-parent package previews use the protected canonical package engine on an authority-bound read-only candidate. Apply any staged price through the genuine guarded price/Sale command in that candidate: an active Sale retained by the decision stays the package basis; an actual staged Change or End uses its resulting effective amount. The formula box uses that same amount and labels an active Sale basis, while the regular-price card remains regular. No query persists costs, decisions, notifications, codes or price changes. Save rechecks a fingerprint that includes current effective approved prices, so an intervening Sale boundary cannot silently change a previously quoted draft's basis.

## R3c receiving manual-price proposal

The line editor explains `Rounded up from $X (store rule)` and offers Use $X when a final-ending adjustment applies. The action uses a fresh invoice-authorized command, retains the actual receiver/time and an opaque quote for exact source/cost/category/pricing facts, and invalidates line confirmation. It does not change any approved price, cost, paper amount or receipt. Changed quote facts or an invalid/zero price block posting until reviewed again; Use calculated price removes only this manual proposal.

Posting recomputes the rule price independently, retains requested and calculated prices in an individual pending manual-override approval, and preserves the actual receiving editor even when a different person posts. Owner/Manager approval is required for every explicit receiving override, including one equal to the previous price. Below-cost/minimum proposals require the ordinary reason at approval. The current approved price remains charged before approval and after rejection. Short-dated/refused receipts and derived package prices retain their existing restrictions. Internal quote serialization and margin thresholds are absent from public invoice/audit views.
