"""Reference pricing engine used to generate and verify seed/pricing-test-cases.json.
Behavioral reference only: production code must read divisors, bands and corrections from configuration.
Run:  python seed/pricing_reference.py   (checks every case in pricing-test-cases.json)
"""
import json, pathlib
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_FLOOR

CATEGORIES = {  # mirrors seed/arzon-config.json -> pricing_categories
    "grocery":         dict(divisor=D("0.65"), mode="bands", special=True),
    "grocery_taxable": dict(divisor=D("0.65"), mode="bands", special=True),
    "rice":            dict(divisor=D("0.80"), mode="always_up_to_next_99", special=False),
    "kitchenware":     dict(divisor=D("0.60"), mode="bands", special=False),
}

def to_cents(x):
    return x.quantize(D("0.01"), rounding=ROUND_HALF_UP)

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

def selling_price(unit_cost_before_tax, category):
    c = CATEGORIES[category]
    raw = D(str(unit_cost_before_tax)) / c["divisor"]
    if c["mode"] == "always_up_to_next_99":
        return rice_price(raw)
    p = band_price(raw)
    if c["special"] and p in (D("2.49"), D("3.49")):
        p += D("0.50")
    return p

if __name__ == "__main__":
    path = pathlib.Path(__file__).with_name("pricing-test-cases.json")
    cases = json.loads(path.read_text(encoding="utf-8"))["cases"]
    failed = 0
    for c in cases:
        got = selling_price(c["cost_before_tax"], c["category"])
        if str(got) != c["expected_selling_price"]:
            failed += 1
            print("FAIL", c["name"], "expected", c["expected_selling_price"], "got", got)
    print(f"{len(cases) - failed} of {len(cases)} cases passed")
    raise SystemExit(1 if failed else 0)
