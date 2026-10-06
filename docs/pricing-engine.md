# Pricing engine

This is the most important rule set in the product. It must be implemented **once** (a pure function with no database access), driven by configuration, and covered by tests. The backend and the prototype use the same algorithm; the prototype has a TypeScript port that must pass the same test file.

Test file: `seed/pricing-test-cases.json` (every case must pass, in both languages).
Configuration: `seed/arzon-config.json` → `pricing_categories`, `rounding_bands`, `special_corrections`.

## Inputs and outputs
- Input: `unit_cost_before_tax` (Decimal, 4 places), `pricing_category`, configuration.
- Output: `selling_price` (Decimal, 2 places, displayed before tax), plus the intermediate values (unrounded `raw_price`, cent-rounded raw for explanation, `after_band_rounding`, whether the special correction applied) so the UI can explain the result. The test fixture's `raw_price` is the cent-rounded display value; Rice must not use it to select an ending.
- **Never use floating point.** Use Decimal (Python `decimal`, or a decimal library in TypeScript).

## Algorithm
```
raw = unit_cost_before_tax / category.cost_divisor
```

### Rounding mode "bands" (Grocery, Grocery (Taxable), Kitchenware)
1. Round `raw` **half-up to the cent**.
2. Split into whole dollars `D` and cents fraction `f` (0.00–0.99).
3. Apply:
   - `f < 0.23`  → `(D − 1) + 0.99`  ("previous .99"). If `D = 0` there is no previous dollar → use the configured minimum **0.49**.
   - `0.23 ≤ f < 0.73` → `D + 0.49`
   - `f ≥ 0.73` → `D + 0.99`
4. **Special correction** (only for categories with `apply_special_correction = true`, currently **Grocery and Grocery (Taxable)**): look up the band result in `special_corrections`. Current mappings are `2.49` → `2.99`, `3.49` → `3.99`. Apply at most once, after step 3; do not chain correction mappings.

These numbers describe the Super Arzon seed, not application constants. `rounding_bands.bands` contains ordered Decimal-string `lower_inclusive`, `upper_exclusive`, and `ending` values plus an integer `dollar_offset`. Bands must cover `[0.00, 1.00)` exactly with no gaps/overlap; offsets/endings produce the chosen price. A negative-dollar result uses `minimum_result_when_previous_dollar_does_not_exist`. Validate divisors as positive, costs as nonnegative and at most four decimals, and output/corrections as nonnegative cent amounts.

A whole-dollar raw price such as `10.00` has `f = 0.00`, so it becomes `9.99` through the "previous .99" band. No separate rule is needed.

### Rounding mode "always_up_to_next_99" (Rice)
Result = the smallest value of the form `X.99` that is **greater than or equal to** the unrounded `raw`.
- `3.75 → 3.99`, `3.99 → 3.99`, `4.00 → 4.99` (accepted default, 2026-10-06).
- Rice never gets the 2.49/3.49 correction and never uses bands.
- The category's `rounding_ending` supplies `0.99`. Compare candidates with **unrounded** raw: `3.1921 / 0.80 = 3.990125`, so the result is `4.99`, even though the displayed raw rounds to `3.99`.

### Reference implementation (Python)
The executable reference is `seed/pricing_reference.py`. Run `python3.12 seed/pricing_reference.py` from the repository root; it loads `seed/arzon-config.json` and checks every fixture. Production and prototype implementations must preserve this behavior and read divisors, numeric bands, minimums, endings, and correction pairs from configuration. Phase 0.1 validates the reference; the production catalog/pricing API and TypeScript port belong to their later slices.

## Worked examples (all verified)
| Category | Cost | Raw | After bands | Final | Why |
|---|---|---|---|---|---|
| Grocery | 1.30 | 2.00 | 1.99 | **1.99** | below .23 → previous .99 |
| Grocery | 1.00 | 1.54 | 1.49 | **1.49** | middle band |
| Grocery | 2.50 | 3.85 | 3.99 | **3.99** | .73 or above |
| Grocery | 6.50 | 10.00 | 9.99 | **9.99** | whole dollar becomes x.99 below |
| Grocery | 1.60 | 2.46 | 2.49 | **2.99** | special correction |
| Grocery | 2.40 | 3.69 | 3.49 | **3.99** | special correction |
| Grocery | 2.10 | 3.23 | 3.49 | **3.99** | .23 is in the middle band, then corrected |
| Grocery (Taxable) | 3.20 | 4.92 | 4.99 | **4.99** | same rules as Grocery |
| Rice | 3.00 | 3.75 | n/a | **3.99** | up to next .99 |
| Rice | 3.20 | 4.00 | n/a | **4.99** | exact whole dollar goes up |
| Rice | 18.40 | 23.00 | n/a | **23.99** | |
| Kitchenware | 5.40 | 9.00 | 8.99 | **8.99** | divisor 0.60 |
| Kitchenware | 1.50 | 2.50 | 2.49 | **2.49** | **no** special correction |
| Kitchenware | 31.50 | 52.50 | 52.49 | **52.49** | |

The JSON file has 24 cases including boundaries (.00, .22, .23, .72, exact .73) and Rice's exact/just-above .99 behavior. Four-decimal costs are allowed: `0.4745 / 0.65 = 0.73` exactly, so the .73 boundary is required coverage.

## Margin check
`margin = (selling_price − unit_cost) / selling_price`. Compare the exact Decimal ratio with `pricing_categories[].minimum_margin`; format percentages only for display. A lower margin always requires **Below minimum margin** Supervisor review, including when the calculated selling price equals the currently approved price. Combine this reason with a changed-price proposal; for an unchanged price, create a margin-review record showing current price, received cost, calculated margin, threshold, branch, and invoice links. It does not block invoice posting or silently alter the price; cashiers continue charging the approved price. Supervisor can **Keep approved price** with a reason, **Propose manual override** through the normal approval workflow, or leave the review pending.

Deduplicate the review by company, branch, product, approved price, received unit cost, and pricing-configuration version. Repeated posting/retries and later receipts with that same context attach evidence to the existing pending or acknowledged review instead of creating another. A changed cost, price, or pricing rule requires a fresh review if the result remains below the threshold. Defaults accepted under Ali's delegation on 2026-10-06: Grocery/Grocery (Taxable) `0.25`, Rice `0.20`, Kitchenware `0.25`. A null category threshold disables the extra flag. A zero selling price cannot have a computed margin and always requires a manual-override review; default rounding never produces zero.

## When a price proposal is created
On posting an invoice (and on manual cost edits), for each line: compute the new selling price from the new unit cost. Then:
- Price equals the current approved price and has no minimum-margin breach (threshold met or inactive) → no proposal/review (ordinary supplier cost change only: no approval).
- Price equals the current approved price but is below its category margin threshold → deduplicated **Below minimum margin** review; invoice posting and approved cashier price continue unchanged.
- Price differs → create a `pending` price proposal (Supervisor approval required).
- New product → pending product with a pending price.
- A manual override of the price → proposal flagged "manual override" (always approval).

Example: Grocery cost rises to `1.12` while its approved/calculated price remains `1.49`. Margin is `(1.49 − 1.12) / 1.49 ≈ 24.83%`, below 25%, so this cost change requires margin review even though no new selling price is proposed.
See `workflows.md` for the state machine and display rules.

## Price scope
- Company default price per product, optional per-branch override.
- The cost basis is the cost on the **branch's** invoice, so branches can calculate different prices. A new proposal records which branch triggered it; approval chooses **all branches** (default) or **this branch only**.

## Display rules
- Selling Price is shown **before tax**. Taxable products show a **Taxable** tag. Do not add tax into any displayed price.
- A pending proposal is shown beside the approved price with a "Pending" tag; see `design-language.md` for the badge style.

## Testing requirements
1. Load `seed/pricing-test-cases.json` and assert every `expected_selling_price`.
2. Property tests: the result always ends in .49 or .99; the result is never negative; rice results are never below the raw price.
3. Configuration tests: change a divisor or band in the database and prove the output changes without code edits.
4. The prototype's TypeScript engine must run the same JSON test file in its test suite.

The .49/.99 property applies to the default seed. For customized endings/corrections, assert that results obey the configured bands/corrections, not hardcoded endings.
