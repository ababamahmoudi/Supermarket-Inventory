"""Configuration-driven behavioral reference, not an application pricing service.

Run ``python seed/pricing_reference.py`` to verify every pricing fixture. Phase 1 will
implement the application engine, while this file remains its independent reference.
"""

import json
from decimal import ROUND_FLOOR, ROUND_HALF_UP
from decimal import Decimal as D
from pathlib import Path


def load_configuration():
    return json.loads(Path(__file__).with_name("arzon-config.json").read_text(encoding="utf-8"))


def to_cents(value):
    return value.quantize(D("0.01"), rounding=ROUND_HALF_UP)


def band_price(raw, configuration=None):
    config = configuration if configuration is not None else load_configuration()
    raw = to_cents(raw)
    dollars = raw.to_integral_value(rounding=ROUND_FLOOR)
    fraction = raw - dollars
    settings = config["rounding_bands"]
    for band in settings["bands"]:
        if D(band["lower_inclusive"]) <= fraction < D(band["upper_exclusive"]):
            target_dollars = dollars + D(str(band["dollar_offset"]))
            if target_dollars < 0:
                return D(settings["minimum_result_when_previous_dollar_does_not_exist"])
            return target_dollars + D(band["ending"])
    raise ValueError("No configured rounding band matches the raw price.")


def rice_price(raw, ending):
    dollars = raw.to_integral_value(rounding=ROUND_FLOOR)
    candidate = dollars + ending
    return candidate if candidate >= raw else candidate + 1


def pricing_details(unit_cost_before_tax, category_key, configuration=None):
    config = configuration if configuration is not None else load_configuration()
    categories = {category["key"]: category for category in config["pricing_categories"]}
    category = categories[category_key]
    if isinstance(unit_cost_before_tax, float):
        raise TypeError("Supply money as a Decimal or decimal string, never a float.")
    cost = D(unit_cost_before_tax)
    divisor = D(category["cost_divisor"])
    if not cost.is_finite() or cost < 0 or not divisor.is_finite() or divisor <= 0:
        raise ValueError(
            "Cost must be finite and nonnegative; divisor must be finite and positive."
        )
    raw = cost / divisor
    after_bands = None
    correction_applied = False
    if category["rounding"] == "always_up_to_next_99":
        price = rice_price(raw, D(category["rounding_ending"]))
    elif category["rounding"] == "bands":
        after_bands = band_price(raw, config)
        price = after_bands
        if category["apply_special_correction"]:
            for correction in config["special_corrections"]:
                if price == D(correction["from"]):
                    price = D(correction["to"])
                    correction_applied = True
                    break
    else:
        raise ValueError("Unknown configured rounding mode.")
    return {
        "raw_price": to_cents(raw),
        "after_band_rounding": after_bands,
        "special_correction_applied": correction_applied,
        "selling_price": to_cents(price),
    }


def selling_price(unit_cost_before_tax, category, configuration=None):
    return pricing_details(unit_cost_before_tax, category, configuration)["selling_price"]


if __name__ == "__main__":
    path = Path(__file__).with_name("pricing-test-cases.json")
    cases = json.loads(path.read_text(encoding="utf-8"))["cases"]
    failed = 0
    for case in cases:
        got = selling_price(case["cost_before_tax"], case["category"])
        if str(got) != case["expected_selling_price"]:
            failed += 1
            print("FAIL", case["name"], "expected", case["expected_selling_price"], "got", got)
    print(f"{len(cases) - failed} of {len(cases)} cases passed")
    raise SystemExit(1 if failed else 0)
