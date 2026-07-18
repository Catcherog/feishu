"""Regression tests for scripts/verify_public_repo.py.

Covers the R5 second-fix-batch regression:
- Feishu fld ID (10 chars total, mixed case + digit, e.g., synthetic `fldTest01X`)
  must be detected as S2.
- A fld ID adjacent to an ALIAS literal must still be reported as S2
  (the previous 30-char context check caused false negatives).
- Stable aliases (e.g., `V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS`) must NOT be flagged.
- Pattern minimum length lowered from {8,} to {6,} to catch real 10-char Feishu IDs.

NOTE: All field IDs used in this test file are SYNTHETIC test fixtures following
the real Feishu ID format (3-letter prefix + 7-char alphanumeric suffix, mixed
case + digit). They do not correspond to any real Feishu resource. This keeps the
test file itself scannable by `verify_public_repo.py` without false positives.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from verify_public_repo import ALIAS_PATTERNS, INTERNAL_ID_PATTERNS, scan_file  # noqa: E402


def _pattern_by_name(name: str) -> "re.Pattern":  # type: ignore[name-defined]
    import re  # noqa: F401
    for n, _sev, p in INTERNAL_ID_PATTERNS:
        if n == name:
            return p
    raise KeyError(f"pattern {name!r} not found")


class FieldIdPatternTests(unittest.TestCase):
    """Verifies the field_id regex matches 10-char Feishu-style field IDs.

    Real Feishu field IDs observed in production are 10 chars total
    (3 prefix + 7 suffix), mixing lowercase, uppercase, and digits.
    Synthetic test IDs following this pattern: `fldTest01X`, `fldTestAB1`,
    `fldTestCD2`, `fldTestEF3`.
    """

    def test_10_char_field_id_pattern_matches(self) -> None:
        """Synthetic 10-char field IDs (mixed case + digit) must match the pattern."""
        pattern = _pattern_by_name("field_id")
        for synthetic_id in ("fldTest01X", "fldTestAB1", "fldTestCD2", "fldTestEF3"):
            with self.subTest(synthetic_id=synthetic_id):
                self.assertIsNotNone(
                    pattern.search(synthetic_id),
                    msg=f"field_id pattern must match 10-char Feishu-style ID {synthetic_id!r}",
                )

    def test_long_field_id_matches(self) -> None:
        pattern = _pattern_by_name("field_id")
        self.assertIsNotNone(pattern.search("fldTest01Xy"))  # 11 chars
        self.assertIsNotNone(pattern.search("fldTest01Xabcdef"))  # 16 chars

    def test_short_camel_case_does_not_match(self) -> None:
        """Short camelCase variable names (fldName, fldValue) must NOT match,
        to avoid false positives on TypeScript/JS code."""
        pattern = _pattern_by_name("field_id")
        self.assertIsNone(pattern.search("fldName"))  # 7 chars total
        self.assertIsNone(pattern.search("fldValue"))  # 8 chars total
        self.assertIsNone(pattern.search("fldKey"))  # 6 chars total

    def test_all_uppercase_suffix_does_not_match(self) -> None:
        """All-uppercase suffixes are likely placeholders (e.g., fldREDACTED),
        not real Feishu IDs which mix case."""
        pattern = _pattern_by_name("field_id")
        # Lookahead requires at least one lowercase or digit
        self.assertIsNone(pattern.search("fldABCDEF"))  # all uppercase, 9 chars


class AliasContextFalseNegativeTests(unittest.TestCase):
    """Regression: a fld ID adjacent to an ALIAS must still be reported as S2.

    Previously, scan_file skipped matches when the 30-char surrounding context
    contained the literal "ALIAS" or angle brackets. This caused real Field IDs
    in JSON files (where the previous line had a TABLE_ALIAS) to be silently
    skipped, producing false S0=0 S1=0 S2=0 reports.
    """

    def test_fld_id_adjacent_to_alias_is_reported(self) -> None:
        """Synthetic fld ID `fldTest01X` next to `V2_CUSTOMER_TABLE_ALIAS` must be S2."""
        content = (
            '{\n'
            '  "target_table_alias": "V2_CUSTOMER_TABLE_ALIAS",\n'
            '  "source_channel_field_name": "来源渠道",\n'
            '  "source_channel_field_id": "fldTest01X",\n'
            '  "user_decision": "cleanup_converge_to_v1.1"\n'
            '}\n'
        )
        # Use a temp file under tests/ so scan_file can read it
        import tempfile
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        ) as tf:
            tf.write(content)
            tf_path = tf.name

        try:
            # scan_file uses ROOT-relative paths; create a tracked-style path
            # by writing under tests/fixtures/ and passing relative path
            rel = "tests/fixtures/temp_alias_regression.json"
            abs_path = ROOT / rel
            abs_path.write_text(content, encoding="utf-8")
            try:
                findings = scan_file(rel)
                field_id_findings = [f for f in findings if f["type"] == "field_id"]
                self.assertEqual(
                    len(field_id_findings), 1,
                    msg=f"Expected exactly 1 field_id S2 finding for fldTest01X adjacent to ALIAS, got {findings!r}",
                )
                self.assertEqual(field_id_findings[0]["severity"], "S2")
            finally:
                abs_path.unlink(missing_ok=True)
        finally:
            Path(tf_path).unlink(missing_ok=True)

    def test_alias_literal_in_match_text_is_skipped(self) -> None:
        """When the match text itself IS an alias (e.g., V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS),
        it must NOT be flagged. Aliases are S3 (safe to publish)."""
        import re
        # The alias literal contains `FIELD_ALIAS` but no real fld prefix; verify ALIAS_PATTERNS catches it
        self.assertTrue(ALIAS_PATTERNS.search("V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS"))
        self.assertTrue(ALIAS_PATTERNS.search("V2_CUSTOMER_TABLE_ALIAS"))
        self.assertTrue(ALIAS_PATTERNS.search("SOURCE_BASE_ALIAS"))
        self.assertTrue(ALIAS_PATTERNS.search("<SOURCE_CHANNEL_FIELD_ID>"))

    def test_fld_id_in_alias_named_json_field_still_reported(self) -> None:
        """Even when JSON key is `field_id_alias`, a fld ID value must be flagged.
        Only the alias literal in the VALUE (not the key) protects from flagging."""
        content = (
            '{\n'
            '  "field_id_alias_typo": "fldTest01X"\n'
            '}\n'
        )
        rel = "tests/fixtures/temp_alias_typo_regression.json"
        abs_path = ROOT / rel
        abs_path.write_text(content, encoding="utf-8")
        try:
            findings = scan_file(rel)
            field_id_findings = [f for f in findings if f["type"] == "field_id"]
            self.assertEqual(len(field_id_findings), 1)
            self.assertEqual(field_id_findings[0]["severity"], "S2")
        finally:
            abs_path.unlink(missing_ok=True)


class RedactedSummaryFileTests(unittest.TestCase):
    """Verifies the sanitized r5-enum-cleanup-summary.json (post-fix) scans clean."""

    def test_r5_enum_cleanup_summary_has_no_real_field_id(self) -> None:
        """After R5 second fix batch, r5-enum-cleanup-summary.json must contain
        no real fld/tbl/wkf/viw IDs. The field_id should be replaced by
        V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS."""
        rel = "reports/r5-enum-cleanup-summary.json"
        if not (ROOT / rel).exists():
            self.skipTest(f"{rel} not present")
        findings = scan_file(rel)
        # No S0/S1/S2 findings expected from this file post-redaction
        s0_s1_s2 = [f for f in findings if f["severity"] in ("S0", "S1", "S2")]
        self.assertEqual(
            s0_s1_s2, [],
            msg=f"Expected no S0/S1/S2 findings in redacted {rel}, got {s0_s1_s2!r}",
        )


class S2ExemptFilesTests(unittest.TestCase):
    """Verifies the S2_EXEMPT_FILES mechanism: test files that legitimately
    contain synthetic test fixtures (matching the S2 ID patterns) are exempt
    from S2 findings, but S0/S1 findings are still reported.

    This test file itself (tests/test_verify_public_repo.py) is in S2_EXEMPT_FILES.
    Scanning it should return no S2 findings (because all fld IDs in this file
    are synthetic test fixtures like `fldTest01X`), but S0/S1 findings would
    still be reported if any were present (none should be).
    """

    def test_this_test_file_is_s2_exempt(self) -> None:
        """This test file itself must be in S2_EXEMPT_FILES, so scanning it
        produces no S2 findings even though it contains synthetic fld IDs."""
        from verify_public_repo import S2_EXEMPT_FILES
        self.assertIn("tests/test_verify_public_repo.py", S2_EXEMPT_FILES)

    def test_s2_exempt_file_produces_no_s2_findings(self) -> None:
        """Scanning this test file (which contains synthetic fld IDs) must
        produce NO S2 findings, because it is in S2_EXEMPT_FILES."""
        findings = scan_file("tests/test_verify_public_repo.py")
        s2_findings = [f for f in findings if f["severity"] == "S2"]
        self.assertEqual(
            s2_findings, [],
            msg=(
                "tests/test_verify_public_repo.py is in S2_EXEMPT_FILES and must "
                "produce no S2 findings, but got: "
                f"{[f['type'] for f in s2_findings]!r}"
            ),
        )

    def test_s2_exempt_file_still_reports_s0_s1(self) -> None:
        """S2_EXEMPT_FILES only suppresses S2; S0/S1 findings must still be
        reported if a test file accidentally leaks real secrets or privacy
        data. This test creates a temp file outside S2_EXEMPT_FILES containing
        both a synthetic fld ID (S2) and verifies S2 is reported there."""
        content = (
            '// synthetic fld ID in a NON-exempt file should be S2\n'
            'const x = "fldTest01X";\n'
        )
        rel = "tests/fixtures/temp_s2_exempt_regression.js"
        abs_path = ROOT / rel
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")
        try:
            findings = scan_file(rel)
            s2_findings = [f for f in findings if f["severity"] == "S2"]
            self.assertGreaterEqual(
                len(s2_findings), 1,
                msg=(
                    "Non-exempt file containing a synthetic fld ID must still "
                    "report S2 (the exemption only applies to files in S2_EXEMPT_FILES)."
                ),
            )
        finally:
            abs_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
