# Pricing engine

This is the most important rule set in the product. It must be implemented **once** (a pure function with no database access), driven by configuration, and covered by tests. The backend and the prototype use the same algorithm; the prototype has a TypeScript port that must pass the same test file.

Test file: `seed/pricing-test-cases.json` (every case must pass, in both languages).
Configuration: `seed/arzon-config.json` → `pricing_categories`, `rounding_bands`, `special_corrections`.

## Inputs and outputs

- Input: `unit_cost_before_tax` (Decimal, 4 places), `pricing_category`, configuration.
- Output: `selling_price` (Decimal, 2 places, displayed before tax), plus the intermediate values (`raw_price`, `after_band_rounding`, whether the special correction applied) so the UI can explain the result.
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

A whole-dollar raw price such as `10.00` has `f = 0.00`, so it becomes `9.99` through the "previous .99" band. No separate rule is needed.

### Rounding mode "always_up_to_next_99" (Rice)

Result = the smallest value of the form `X.99` that is **greater than or equal to** the unrounded `raw`.

- `3.75 → 3.99`, `3.99 → 3.99`, `4.00 → 4.99` **(assumed for exact whole dollars; see open-questions)**.
- Rice never gets the 2.49/3.49 correction and never uses bands.

### Reference implementation (Python, verified)

```python
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_FLOOR

def to_cents(x): return x.quantize(D("0.01"), rounding=ROUND_HALF_UP)

def band_price(raw):
    raw = to_cents(raw)
    dollars = raw.to_integral_value(rounding=ROUND_FLOOR)
    frac = raw - dollars
    if frac < D("0.23"):
        return (dollars - 1 + D("0.99")) if dollars >= 1 else D("0.49")
    if frac < D("0.73"):
        return dollars + D("0.49")
    return dollars + D("0.99")

def rice_price(raw):
    dollars = raw.to_integral_value(rounding=ROUND_FLOOR)
    cand = dollars + D("0.99")
    return cand if cand >= raw else cand + 1

def selling_price(cost, divisor, mode, special_correction):
    raw = cost / divisor
    if mode == "always_up_to_next_99":
        return rice_price(raw)
    p = band_price(raw)
    if special_correction and p in (D("2.49"), D("3.49")):
        p += D("0.50")
    return p
```

Treat this as the behavioral reference. Production code must read divisors, band thresholds, and corrections from configuration, not from constants.

## Worked examples (all verified)

| Category          | Cost  | Raw   | After bands | Final     | Why                                       |
| ----------------- | ----- | ----- | ----------- | --------- | ----------------------------------------- |
| Grocery           | 1.30  | 2.00  | 1.99        | **1.99**  | below .23 → previous .99                  |
| Grocery           | 1.00  | 1.54  | 1.49        | **1.49**  | middle band                               |
| Grocery           | 2.50  | 3.85  | 3.99        | **3.99**  | .73 or above                              |
| Grocery           | 6.50  | 10.00 | 9.99        | **9.99**  | whole dollar becomes x.99 below           |
| Grocery           | 1.60  | 2.46  | 2.49        | **2.99**  | special correction                        |
| Grocery           | 2.40  | 3.69  | 3.49        | **3.99**  | special correction                        |
| Grocery           | 2.10  | 3.23  | 3.49        | **3.99**  | .23 is in the middle band, then corrected |
| Grocery (Taxable) | 3.20  | 4.92  | 4.99        | **4.99**  | same rules as Grocery                     |
| Rice              | 3.00  | 3.75  | n/a         | **3.99**  | up to next .99                            |
| Rice              | 3.20  | 4.00  | n/a         | **4.99**  | exact whole dollar goes up (assumed)      |
| Rice              | 18.40 | 23.00 | n/a         | **23.99** |                                           |
| Kitchenware       | 5.40  | 9.00  | 8.99        | **8.99**  | divisor 0.60                              |
| Kitchenware       | 1.50  | 2.50  | 2.49        | **2.49**  | **no** special correction                 |
| Kitchenware       | 31.50 | 52.50 | 52.49       | **52.49** |                                           |

The JSON file has 21 cases including boundaries (.00, .22, .23, .72). Note: with a 0.65 divisor and costs in whole cents, a raw price ending exactly in .73 cannot occur; do not write a test that expects it.

## Margin check

`margin = (selling_price − unit_cost) / selling_price`. If a minimum margin is configured and the margin is lower, the proposal needs Supervisor approval (reason: "Below minimum margin"). The seeded value `0.25` is a **placeholder**; the owner must confirm it. If the setting is empty, the rule is inactive.

## When a price proposal is created

On posting an invoice (and on manual cost edits), for each line: compute the new selling price from the new unit cost. Then:

- Price equals the current approved price → no proposal (supplier cost change only: no approval).
- Price differs → create a `pending` price proposal (Supervisor approval required).
- New product → pending product with a pending price.
- A manual override of the price → proposal flagged "manual override" (always approval).
  See `workflows.md` for the state machine and display rules.

## Price scope

- Company default price per product, optional per-branch override.
- The cost basis is the cost on the **branch's** invoice, so branches can calculate different prices. A new proposal records which branch triggered it; approval chooses **all branches** (default) or **this branch only**.

## Display rules

- Selling price is shown **before tax**. Taxable products show a **Taxable** tag. Do not add tax into any displayed price.
- A pending proposal is shown beside the approved price with a "Pending" tag; see `design-language.md` for the badge style.

## Testing requirements

1. Load `seed/pricing-test-cases.json` and assert every `expected_selling_price`.
2. Property tests: the result always ends in .49 or .99; the result is never negative; rice results are never below the raw price.
3. Configuration tests: change a divisor or band in the database and prove the output changes without code edits.
4. The prototype's TypeScript engine must run the same JSON test file in its test suite.
