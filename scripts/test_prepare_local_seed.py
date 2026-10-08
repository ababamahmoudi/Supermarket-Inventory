"""Regression checks for owner-upload compatibility and unchanged source inputs."""

import importlib.util
import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("prepare-local-seed.py")
SPEC = importlib.util.spec_from_file_location("prepare_local_seed", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class LocalSeedTests(unittest.TestCase):
    def setUp(self):
        self.retained = {
            "company": {
                "name": "Example market",
                "seed_key": "example-market",
                "currency": "CAD",
                "timezone": "America/Toronto",
            },
            "branches": [{"code": "1", "name": "Branch 1", "name_fa": "شعبه ۱"}],
            "pricing_categories": [
                {
                    "key": "grocery",
                    "cost_divisor": "0.65",
                    "apply_special_correction": True,
                }
            ],
            "tax": {"rate": "0.13"},
        }
        self.source = deepcopy(self.retained)
        self.source["company"].pop("seed_key")
        self.source["company"].update(currency="PLACEHOLDER", timezone="PLACEHOLDER")
        self.source["pricing_categories"][0].update(
            apply_2_49_3_49_correction=True, cost_divisor="0.70"
        )
        self.source["pricing_categories"][0].pop("apply_special_correction")

    def test_placeholder_metadata_is_restored_without_changing_input(self):
        original = deepcopy(self.source)
        prepared = MODULE.prepare_configuration(self.source, self.retained)
        self.assertEqual(prepared["company"]["seed_key"], "example-market")
        self.assertEqual(prepared["company"]["currency"], "CAD")
        self.assertEqual(prepared["company"]["timezone"], "America/Toronto")
        self.assertEqual(prepared["pricing_categories"][0]["cost_divisor"], "0.70")
        self.assertEqual(self.source, original)

    def test_explicit_owner_company_and_category_values_win(self):
        self.source["company"].update(seed_key="current-key", currency="USD", timezone="UTC")
        self.source["pricing_categories"][0]["apply_2_49_3_49_correction"] = False
        prepared = MODULE.prepare_configuration(self.source, self.retained)
        self.assertEqual(prepared["company"]["seed_key"], "current-key")
        self.assertEqual(prepared["company"]["currency"], "USD")
        self.assertEqual(prepared["company"]["timezone"], "UTC")
        self.assertFalse(prepared["pricing_categories"][0]["apply_special_correction"])

    def test_another_company_never_receives_retained_identity(self):
        self.source["company"]["name"] = "Other market"
        self.source["branches"] = [{"code": "1", "name": "Other branch"}]
        with self.assertRaisesRegex(ValueError, "another company's"):
            MODULE.prepare_configuration(self.source, self.retained)
        prepared = MODULE.prepare_configuration(
            self.source,
            self.retained,
            {"seed_key": "other", "currency": "EUR", "timezone": "UTC"},
        )
        self.assertEqual(prepared["company"]["seed_key"], "other")
        self.assertNotIn("name_fa", prepared["branches"][0])

    def test_explicit_other_identity_never_borrows_metadata_from_same_name(self):
        self.source["company"]["seed_key"] = "another-example-market"
        with self.assertRaisesRegex(ValueError, "another company's"):
            MODULE.prepare_configuration(self.source, self.retained)

    def test_confirmed_identity_survives_company_rename(self):
        self.source["company"].update(seed_key="example-market", name="Renamed market")
        prepared = MODULE.prepare_configuration(self.source, self.retained)
        self.assertEqual(prepared["company"]["name"], "Renamed market")
        self.assertEqual(prepared["company"]["currency"], "CAD")

    def test_generated_adapter_retains_every_seed_source_byte(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts").mkdir()
            (root / "seed").mkdir()
            (root / "prototype/src/compat").mkdir(parents=True)
            (root / "scripts/prepare-local-seed.py").write_bytes(SCRIPT.read_bytes())
            (root / "scripts/pricing_reference_compat.py").write_text("# retained reference\n")
            (root / "prototype/src/compat/configuration.json").write_text(json.dumps(self.retained))
            (root / "seed/arzon-config.json").write_text(json.dumps(self.source))
            (root / "seed/pricing_reference.py").write_text("# old owner reference\n")
            before = {p.name: p.read_bytes() for p in (root / "seed").iterdir()}
            with patch.object(MODULE, "__file__", str(root / "scripts/prepare-local-seed.py")):
                MODULE.main()
            after = {p.name: p.read_bytes() for p in (root / "seed").iterdir()}
            self.assertEqual(after, before)
            prepared = json.loads((root / ".local/setup-seed/arzon-config.json").read_text())
            self.assertEqual(prepared["company"]["currency"], "CAD")
            override = json.loads((root / ".local/compose.setup-seed.json").read_text())
            self.assertTrue(override["services"]["api"]["volumes"][0]["read_only"])


if __name__ == "__main__":
    unittest.main()
