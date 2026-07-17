from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from generate_schema_diff import build_diff, load_json, render_diff  # noqa: E402


class SchemaDiffTests(unittest.TestCase):
    def test_synthetic_fixture_covers_every_change_category(self) -> None:
        before = load_json(ROOT / "tests/fixtures/schema-diff/v1.0.json")
        after = load_json(ROOT / "tests/fixtures/schema-diff/v1.1.json")
        result = build_diff(before, after)

        self.assertEqual(result["summary"], {
            "added_fields": 1,
            "removed_fields": 1,
            "changed_fields": 1,
            "enum_changes": 1,
            "required_changes": 1,
            "view_changes": 3,
            "state_machine_changes": 1,
            "global_enum_changes": 1,
        })
        self.assertEqual(result["added_fields"][0]["field_key"], "add_me")
        self.assertEqual(result["removed_fields"][0]["field_key"], "remove_me")

    def test_render_is_byte_deterministic(self) -> None:
        before = load_json(ROOT / "tests/fixtures/schema-diff/v1.0.json")
        after = load_json(ROOT / "tests/fixtures/schema-diff/v1.1.json")
        first = render_diff(build_diff(before, after)).encode("utf-8")
        second = render_diff(build_diff(before, after)).encode("utf-8")
        self.assertEqual(first, second)
        self.assertEqual(hashlib.sha256(first).hexdigest(), hashlib.sha256(second).hexdigest())

    def test_public_v1_0_to_v1_1_machine_facts(self) -> None:
        before = load_json(ROOT / "schemas/v2-schema-v1.0.json")
        after = load_json(ROOT / "schemas/v2-schema-v1.1.json")
        result = build_diff(before, after)
        self.assertEqual(result["summary"], {
            "added_fields": 35,
            "removed_fields": 0,
            "changed_fields": 0,
            "enum_changes": 1,
            "required_changes": 0,
            "view_changes": 0,
            "state_machine_changes": 2,
            "global_enum_changes": 1,
        })


if __name__ == "__main__":
    unittest.main()
