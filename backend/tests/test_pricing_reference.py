"""Regression coverage for the seed reference; the Phase 1 pricing service is not built yet."""

import importlib.util
import json
from copy import deepcopy
from decimal import Decimal
from pathlib import Path

import pytest

SEED_DIR = Path(__file__).resolve().parents[2] / "seed"
SPEC = importlib.util.spec_from_file_location(
    "pricing_reference", SEED_DIR / "pricing_reference.py"
)
REFERENCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REFERENCE)
CASES = json.loads((SEED_DIR / "pricing-test-cases.json").read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["name"])
def test_every_seed_pricing_case_and_its_intermediate_results(case):
    details = REFERENCE.pricing_details(case["cost_before_tax"], case["category"])
    assert details["selling_price"] == Decimal(case["expected_selling_price"])
    assert details["raw_price"] == Decimal(case["raw_price"])
    expected_band = (
        Decimal(case["after_band_rounding"]) if case["after_band_rounding"] is not None else None
    )
    assert details["after_band_rounding"] == expected_band
    assert details["special_correction_applied"] == case["special_2_49_3_49_correction_applied"]


def test_reference_uses_numeric_configured_divisors_bands_and_corrections():
    config = deepcopy(REFERENCE.load_configuration())
    category = next(item for item in config["pricing_categories"] if item["key"] == "grocery")
    category["cost_divisor"] = "0.50"
    assert REFERENCE.selling_price("1.00", "grocery", config) == Decimal("1.99")
    config["rounding_bands"]["bands"][0]["ending"] = "0.95"
    assert REFERENCE.selling_price("1.00", "grocery", config) == Decimal("1.95")
    config["special_corrections"] = [{"from": "1.95", "to": "2.05"}]
    assert REFERENCE.selling_price("1.00", "grocery", config) == Decimal("2.05")


def test_reference_reads_numeric_band_thresholds_and_rice_ending():
    config = deepcopy(REFERENCE.load_configuration())
    config["rounding_bands"]["bands"][0]["upper_exclusive"] = "0.30"
    config["rounding_bands"]["bands"][1]["lower_inclusive"] = "0.30"
    assert REFERENCE.selling_price("0.80", "grocery", config) == Decimal("0.99")
    rice = next(item for item in config["pricing_categories"] if item["key"] == "rice")
    rice["rounding_ending"] = "0.95"
    assert REFERENCE.selling_price("3.00", "rice", config) == Decimal("3.95")


def test_money_does_not_enter_reference_as_float():
    with pytest.raises(TypeError, match="never a float"):
        REFERENCE.selling_price(1.30, "grocery")


@pytest.mark.parametrize("cost", ["-1.00", "NaN", "Infinity"])
def test_reference_rejects_invalid_cost(cost):
    with pytest.raises(ValueError, match="finite and nonnegative"):
        REFERENCE.selling_price(cost, "grocery")
