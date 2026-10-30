"""Configuration-driven behavioral reference, not an application pricing service.

Run ``python seed/pricing_reference.py`` to verify every pricing fixture. Phase 1 will
implement the application engine, while this file remains its independent reference.
"""

import json
import runpy
from decimal import ROUND_FLOOR, ROUND_HALF_UP
from decimal import Decimal as D
from pathlib import Path


def load_configuration():
    config = json.loads(Path(__file__).with_name("arzon-config.json").read_text(encoding="utf-8"))
    if "bands" not in config["rounding_bands"]:
        root = Path(__file__).resolve().parent.parent
        adapter = runpy.run_path(str(root / "scripts/prepare-local-seed.py"))
        retained = json.loads((root / "prototype/src/compat/configuration.json").read_text())
        config = adapter["prepare_configuration"](config, retained)
    return config


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
    adjustment = config["rounding_bands"].get(
        "final_ending_adjustment",
        load_configuration()["rounding_bands"].get("final_ending_adjustment"),
    )
    rounded_up_from = None
    if adjustment:
        target = D(adjustment["target_ending"])
        sources = [D(value) for value in adjustment["source_endings"]]
        if (
            not target.is_finite()
            or target < 0
            or target >= 1
            or to_cents(target) != target
            or len(set(sources)) != len(sources)
            or any(
                not value.is_finite() or value < 0 or value >= target or to_cents(value) != value
                for value in sources
            )
        ):
            raise ValueError("Invalid final price ending adjustment.")
        dollars = price.to_integral_value(rounding=ROUND_FLOOR)
        if price - dollars in sources:
            rounded_up_from = price
            price = dollars + target
        elif correction_applied and after_bands is not None:
            band_dollars = after_bands.to_integral_value(rounding=ROUND_FLOOR)
            if after_bands - band_dollars in sources and price == band_dollars + target:
                rounded_up_from = after_bands
    return {
        "rounded_up_from": rounded_up_from,
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
            print(
                "FAIL",
                case["name"],
                "expected",
                case["expected_selling_price"],
                "got",
                got,
            )
    print(f"{len(cases) - failed} of {len(cases)} cases passed")
    raise SystemExit(1 if failed else 0)
