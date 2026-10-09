"""Prepare ignored, compatible development seed files without editing owner inputs.

Recent owner uploads restored the original placeholder schema. The foundation
needs the confirmed identity/currency/timezone and configured reference retained
by the working prototype. Explicit current settings always take priority. This
adapter only supplies omitted metadata for that same configured company.
"""

import json
import os
import shutil
import sys
from pathlib import Path
from zoneinfo import ZoneInfo


def merge_missing(previous, current):
    result = dict(previous)
    for key, value in current.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge_missing(result[key], value)
        else:
            result[key] = value
    return result


def prepare_configuration(source, retained, overrides=None):
    overrides = overrides or {}
    info = source["company"]
    previous = retained.get("company", {})
    current_identity = overrides.get("seed_key") or info.get("seed_key")
    if current_identity and "PLACEHOLDER" not in current_identity:
        same_company = current_identity == previous.get("seed_key")
    else:
        same_company = info.get("name") == previous.get("name")
    result = merge_missing(retained if same_company else {}, source)
    company = result["company"]
    for key in ("seed_key", "currency", "timezone"):
        value = overrides.get(key) or info.get(key)
        if not value or "PLACEHOLDER" in value:
            value = previous.get(key) if same_company else None
        if not value:
            raise ValueError(
                f"Configure company.{key} or DEV_COMPANY_{key.upper()} before setup; "
                "another company's retained metadata will not be used."
            )
        company[key] = value
    currency = company["currency"]
    if len(currency) != 3 or not currency.isalpha() or currency != currency.upper():
        raise ValueError("company.currency must be a three-letter uppercase currency code.")
    ZoneInfo(company["timezone"])
    # Current names and codes win; restore translated metadata only for matching
    # branches. Do not add omitted branches to a new owner upload.
    company["name_en"] = info.get("name_en") or info["name"]
    previous_branches = {item["code"]: item for item in retained.get("branches", [])}
    result["branches"] = [
        merge_missing(previous_branches.get(branch["code"], {}) if same_company else {}, branch)
        for branch in source["branches"]
    ]
    previous_categories = (
        {item["key"]: item for item in retained.get("pricing_categories", [])}
        if same_company
        else {}
    )
    result["pricing_categories"] = []
    for category in source["pricing_categories"]:
        merged = merge_missing(previous_categories.get(category["key"], {}), category)
        if "apply_special_correction" not in category:
            merged["apply_special_correction"] = category.get("apply_2_49_3_49_correction", False)
        if "minimum_margin" not in category:
            merged["minimum_margin"] = (
                source.get("approvals", {}).get("minimum_margin", {}).get("value")
            )
        result["pricing_categories"].append(merged)
    if same_company and "PLACEHOLDER" in str(source.get("tax", {}).get("rate", "")):
        result["tax"]["rate"] = retained["tax"]["rate"]
    return result


def main():
    root = Path(__file__).resolve().parent.parent
    seed = root / "seed"
    retained_path = root / "prototype/src/compat/configuration.json"
    retained = json.loads(retained_path.read_text()) if retained_path.exists() else {}
    source = json.loads((seed / "arzon-config.json").read_text())
    overrides = {
        key: os.environ.get(f"DEV_COMPANY_{key.upper()}")
        for key in ("seed_key", "currency", "timezone")
    }
    configuration = prepare_configuration(source, retained, overrides)
    output = root / ".local/setup-seed"
    output.mkdir(parents=True, exist_ok=True)
    for path in seed.iterdir():
        if path.is_file():
            shutil.copyfile(path, output / path.name)
    (output / "arzon-config.json").write_text(
        json.dumps(configuration, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    reference = (seed / "pricing_reference.py").read_text()
    if "def pricing_details(" not in reference or "def load_configuration(" not in reference:
        shutil.copyfile(
            root / "scripts/pricing_reference_compat.py",
            output / "pricing_reference.py",
        )
    override = root / ".local/compose.setup-seed.json"
    override.write_text(
        json.dumps(
            {
                "services": {
                    service: {
                        "volumes": [
                            {
                                "type": "bind",
                                "source": str(output),
                                "target": "/app/seed",
                                "read_only": True,
                            }
                        ]
                    }
                    for service in ("api", "worker", "web")
                }
            },
            indent=2,
        )
        + "\n"
    )
    print(override)


if __name__ == "__main__":
    try:
        main()
    except (OSError, KeyError, TypeError, ValueError) as exc:
        print(f"Local seed preparation failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
