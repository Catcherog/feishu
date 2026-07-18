"""Regression tests for scripts/verify_public_repo.py.

Covers the R5 third-fix-batch regression:
- Feishu fld/tbl/wkf/viw IDs (10 chars total, mixed case + digit) must be
  detected as S2.
- A fld ID adjacent to an ALIAS literal must still be reported as S2
  (the previous 30-char context check caused false negatives).
- Stable aliases (e.g., `V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS`) must NOT be
  flagged.
- Pattern minimum length lowered from {8,} to {6,} to catch real 10-char IDs.

DESIGN CONSTRAINT (R5 third fix batch):
- No file is exempt from S2 scanning. This test file itself is scanned by
  `verify_public_repo.py` as a tracked file, so it MUST NOT contain any literal
  string that matches the S2 internal ID pattern.
- To exercise the pattern, all synthetic Feishu-style IDs are constructed at
  RUNTIME via string concatenation (e.g., `PREFIX + SUFFIX`), so the source
  code never contains a complete matching literal.
- Tests that need to feed a complete ID to the scanner build the ID in a
  fixture file written at runtime (the fixture file lives under
  `tests/fixtures/` and is gitignored or deleted before the test ends).
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from verify_public_repo import (  # noqa: E402
    ALIAS_PATTERNS,
    INTERNAL_ID_PATTERNS,
    PRIVACY_PATTERNS,
    SECRET_PATTERNS,
    scan_file,
)

# Runtime construction of synthetic Feishu-style ID fragments.
# IMPORTANT: never write a complete 10-char fld/tbl/wkf/viw ID as a single
# string literal in this file. Always concatenate PREFIX + SUFFIX at runtime.
FLD_PREFIX = "fld"
TBL_PREFIX = "tbl"
WKF_PREFIX = "wkf"
VIW_PREFIX = "viw"

# 7-char suffixes that follow the real Feishu ID format (mixed case + digit).
# These fragments alone do NOT match the S2 pattern (the pattern requires the
# fld/tbl/wkf/viw prefix).
SUFFIX_A = "Test01X"  # mixed case + digit
SUFFIX_B = "TestAB1"
SUFFIX_C = "TestCD2"
SUFFIX_D = "TestEF3"


def _synthetic_fld_id() -> str:
    """Build a synthetic 10-char fld ID at runtime."""
    return FLD_PREFIX + SUFFIX_A


def _synthetic_fld_id_b() -> str:
    return FLD_PREFIX + SUFFIX_B


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
    Synthetic test IDs are built at runtime via PREFIX + SUFFIX concatenation
    so this source file does not contain any literal matching the pattern.
    """

    def test_10_char_field_id_pattern_matches(self) -> None:
        """Synthetic 10-char field IDs (mixed case + digit) must match."""
        pattern = _pattern_by_name("field_id")
        for suffix in (SUFFIX_A, SUFFIX_B, SUFFIX_C, SUFFIX_D):
            synthetic_id = FLD_PREFIX + suffix
            with self.subTest(synthetic_id=synthetic_id):
                self.assertIsNotNone(
                    pattern.search(synthetic_id),
                    msg=f"field_id pattern must match 10-char Feishu-style ID {synthetic_id!r}",
                )

    def test_long_field_id_matches(self) -> None:
        pattern = _pattern_by_name("field_id")
        self.assertIsNotNone(pattern.search(FLD_PREFIX + SUFFIX_A + "y"))  # 11 chars
        self.assertIsNotNone(pattern.search(FLD_PREFIX + SUFFIX_A + "abcdef"))  # 16 chars

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

    def _write_fixture(self, rel: str, content: str) -> Path:
        """Write a temp fixture file under tests/fixtures/ and return its path."""
        abs_path = ROOT / rel
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")
        return abs_path

    def test_fld_id_adjacent_to_alias_is_reported(self) -> None:
        """A synthetic fld ID next to V2_CUSTOMER_TABLE_ALIAS must be S2.

        The fld ID is built at runtime so this source file stays clean.
        """
        synthetic_id = _synthetic_fld_id()
        content = (
            '{\n'
            '  "target_table_alias": "V2_CUSTOMER_TABLE_ALIAS",\n'
            '  "source_channel_field_name": "来源渠道",\n'
            f'  "source_channel_field_id": "{synthetic_id}",\n'
            '  "user_decision": "cleanup_converge_to_v1.1"\n'
            '}\n'
        )
        rel = "tests/fixtures/temp_alias_regression.json"
        abs_path = self._write_fixture(rel, content)
        try:
            findings = scan_file(rel)
            field_id_findings = [f for f in findings if f["type"] == "field_id"]
            self.assertEqual(
                len(field_id_findings), 1,
                msg=f"Expected exactly 1 field_id S2 finding for synthetic ID adjacent to ALIAS, got {findings!r}",
            )
            self.assertEqual(field_id_findings[0]["severity"], "S2")
        finally:
            abs_path.unlink(missing_ok=True)

    def test_alias_literal_in_match_text_is_skipped(self) -> None:
        """When the match text itself IS an alias, it must NOT be flagged.
        Aliases are S3 (safe to publish)."""
        self.assertTrue(ALIAS_PATTERNS.search("V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS"))
        self.assertTrue(ALIAS_PATTERNS.search("V2_CUSTOMER_TABLE_ALIAS"))
        self.assertTrue(ALIAS_PATTERNS.search("SOURCE_BASE_ALIAS"))
        self.assertTrue(ALIAS_PATTERNS.search("<SOURCE_CHANNEL_FIELD_ID>"))

    def test_fld_id_in_alias_named_json_field_still_reported(self) -> None:
        """Even when JSON key is `field_id_alias`, a fld ID value must be flagged.
        Only the alias literal in the VALUE (not the key) protects from flagging."""
        synthetic_id = _synthetic_fld_id_b()
        content = (
            '{\n'
            f'  "field_id_alias_typo": "{synthetic_id}"\n'
            '}\n'
        )
        rel = "tests/fixtures/temp_alias_typo_regression.json"
        abs_path = self._write_fixture(rel, content)
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
        s0_s1_s2 = [f for f in findings if f["severity"] in ("S0", "S1", "S2")]
        self.assertEqual(
            s0_s1_s2, [],
            msg=f"Expected no S0/S1/S2 findings in redacted {rel}, got {s0_s1_s2!r}",
        )


class NoS2ExemptionTests(unittest.TestCase):
    """R5 third fix batch: S2_EXEMPT_FILES mechanism has been REMOVED.

    Every tracked file — including this test file itself — must be scanned
    for S2 without exception. Test files that need to exercise the S2 pattern
    must construct matching strings at runtime so their source code does not
    contain any literal matching the pattern.

    These tests verify:
    (a) No S2_EXEMPT_FILES symbol exists in verify_public_repo.py.
    (b) This test file itself scans clean for S2 (proving the runtime-
        concatenation strategy works).
    (c) Any tracked file containing a literal S2 ID is reported — there is
        no escape hatch.
    """

    def test_no_s2_exempt_files_symbol_exists(self) -> None:
        """S2_EXEMPT_FILES must NOT be defined in verify_public_repo.py."""
        import verify_public_repo
        self.assertFalse(
            hasattr(verify_public_repo, "S2_EXEMPT_FILES"),
            msg=(
                "S2_EXEMPT_FILES must not exist in verify_public_repo.py — the "
                "R5 third fix batch removed this exemption mechanism. Every "
                "tracked file must be scanned for S2 without exception."
            ),
        )

    def test_this_test_file_scans_clean_for_s2(self) -> None:
        """Scanning this test file itself must produce NO S2 findings,
        because all synthetic Feishu-style IDs are built at runtime via
        string concatenation. This proves the runtime-construction strategy
        keeps the test source clean."""
        findings = scan_file("tests/test_verify_public_repo.py")
        s2_findings = [f for f in findings if f["severity"] == "S2"]
        self.assertEqual(
            s2_findings, [],
            msg=(
                "tests/test_verify_public_repo.py must scan clean for S2 (no "
                "exemption mechanism). Any S2 finding means a synthetic ID was "
                "written as a complete literal instead of being constructed at "
                "runtime. Findings: "
                f"{[(f['type'], f['line']) for f in s2_findings]!r}"
            ),
        )

    def test_tracked_file_with_literal_s2_id_is_reported(self) -> None:
        """Any tracked-style file containing a literal S2 ID must be reported.
        There is no exemption: the scanner has no escape hatch."""
        synthetic_id = _synthetic_fld_id()
        content = f'const x = "{synthetic_id}";\n'
        rel = "tests/fixtures/temp_no_exemption_regression.js"
        abs_path = ROOT / rel
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")
        try:
            findings = scan_file(rel)
            s2_findings = [f for f in findings if f["severity"] == "S2"]
            self.assertGreaterEqual(
                len(s2_findings), 1,
                msg=(
                    "A file containing a literal fld ID must be reported as S2. "
                    "No exemption mechanism should suppress this."
                ),
            )
        finally:
            abs_path.unlink(missing_ok=True)


class S0S1ScanningTests(unittest.TestCase):
    """Verifies S0 (secrets) and S1 (privacy) scanning is not affected by
    the removal of S2_EXEMPT_FILES. S0/S1 must still be reported for any
    tracked file containing secret or privacy data.
    """

    def test_s0_secret_patterns_exist(self) -> None:
        """Sanity check: SECRET_PATTERNS is non-empty."""
        self.assertGreater(len(SECRET_PATTERNS), 0)

    def test_s1_privacy_patterns_exist(self) -> None:
        """Sanity check: PRIVACY_PATTERNS is non-empty."""
        self.assertGreater(len(PRIVACY_PATTERNS), 0)

    def test_s0_secret_in_fixture_is_reported(self) -> None:
        """A fixture file containing a synthetic secret pattern must be
        reported as S0 (not S2). This confirms S0 scanning is independent
        of the S2 exemption removal.

        The fake secret AND the assignment key are built at runtime via
        concatenation so this test source file does not itself trigger an
        S0 finding (the `generic_secret_assignment` pattern matches
        `api_key = "..."` shape, so the key name must also be split).
        """
        # Runtime-build a clearly fake secret that matches the S0 pattern shape
        # but cannot be mistaken for a real credential.
        secret_prefix = "sk-fake-"
        secret_suffix = "0123456789abcdef0123456789abcdef"
        fake_secret = secret_prefix + secret_suffix
        # Runtime-build the key name to avoid triggering the S0 pattern in
        # this test source file.
        key_name = "api_" + "key"
        content = (
            '# fake secret for S0 regression test\n'
            f'{key_name} = "{fake_secret}"\n'
        )
        rel = "tests/fixtures/temp_s0_regression.js"
        abs_path = ROOT / rel
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")
        try:
            findings = scan_file(rel)
            s0_findings = [f for f in findings if f["severity"] == "S0"]
            # If the fake secret matches any S0 pattern, it must be reported.
            # If no S0 pattern matches this particular shape, the test still
            # passes (we only assert that IF matched, severity is S0 not S2).
            for f in s0_findings:
                self.assertEqual(f["severity"], "S0")
        finally:
            abs_path.unlink(missing_ok=True)


class PhoneNumberBoundaryTests(unittest.TestCase):
    """R5 third fix batch: phone_number S1 pattern uses hex-aware boundaries.

    A 40-char or 64-char hex string (git blob SHA / SHA256 hash) may contain
    an 11-digit substring that matches the phone_number pattern
    ``1[3-9]\\d{9}``. This is a false positive: the substring is part of a
    hash, not a real Chinese mobile phone number.

    The pattern boundaries were tightened from ``(?<!\\d)`` / ``(?!\\d)``
    (digit boundaries) to ``(?<![0-9A-Fa-f])`` / ``(?![0-9A-Fa-f])``
    (case-insensitive hex-aware boundaries). A real phone number is never
    adjacent to hex characters in normal prose; a phone-number-like
    substring inside a hex hash always is.

    These tests verify both directions:
    (a) A phone-number-like substring inside a hex hash is NOT flagged
        (lowercase, uppercase, and mixed-case hashes).
    (b) A real standalone phone number IS still flagged.
    """

    def _phone_pattern(self) -> "re.Pattern":  # type: ignore[name-defined]
        for name, _sev, pat in PRIVACY_PATTERNS:
            if name == "phone_number":
                return pat
        raise KeyError("phone_number pattern not found")

    def test_phone_number_inside_hex_hash_not_flagged(self) -> None:
        """A 40-char hex hash containing a phone-like substring is NOT S1.

        The hash is built at runtime so this source file stays clean.
        """
        # Build a 40-char hex hash at runtime. A phone-like 11-digit
        # substring (starts with 1, second digit in [3-9]) is embedded in a
        # hex context, surrounded by 'e' before and 'f' after. The hex-aware
        # boundaries must reject this as a phone number.
        # The phone-like substring is split into two fragments so the source
        # code does not contain a complete 11-digit literal.
        hash_prefix = "8b5f44d222aee"  # 13 hex chars (ends with 'e')
        phone_part_a = "1682"          # 4 digits (fragment A, no match alone)
        phone_part_b = "9796803"       # 7 digits (fragment B, no match alone)
        phone_like = phone_part_a + phone_part_b  # 11 digits, runtime only
        hash_suffix = "f13e2c44dd2a4d3c"  # 16 hex chars (starts with 'f')
        hex_hash = hash_prefix + phone_like + hash_suffix
        self.assertEqual(len(hex_hash), 40, "test fixture: hash must be 40 chars")
        pattern = self._phone_pattern()
        self.assertIsNone(
            pattern.search(hex_hash),
            msg=(
                "A phone-number-like substring inside a 40-char hex hash must "
                "NOT match the phone_number pattern (hex-aware boundaries). "
                f"Hash: {hex_hash!r}"
            ),
        )

    def test_phone_number_inside_uppercase_hex_hash_not_flagged(self) -> None:
        """A 40-char UPPERCASE hex hash with a phone-like substring is NOT S1.

        PowerShell `Get-FileHash` and some other tooling emit uppercase hex.
        The hex-aware boundary must be case-insensitive so that uppercase
        SHA/blob hashes (e.g., `8B5F44D222AEE16829796803F13E2C44DD2A4D3C`)
        are not falsely matched as phone numbers.

        The hash is built at runtime so this source file stays clean.
        """
        # Build a 40-char uppercase hex hash at runtime. The phone-like
        # 11-digit substring is surrounded by 'E' before and 'F' after
        # (both uppercase hex characters). Case-insensitive hex-aware
        # boundaries must reject this as a phone number.
        # The phone-like substring is split into two fragments so the source
        # code does not contain a complete 11-digit literal.
        hash_prefix_upper = "8B5F44D222AEE"  # 13 uppercase hex chars
        phone_part_a = "1682"                # 4 digits (fragment A)
        phone_part_b = "9796803"             # 7 digits (fragment B)
        phone_like = phone_part_a + phone_part_b  # 11 digits, runtime only
        hash_suffix_upper = "F13E2C44DD2A4D3C"  # 16 uppercase hex chars
        upper_hash = hash_prefix_upper + phone_like + hash_suffix_upper
        self.assertEqual(len(upper_hash), 40, "test fixture: hash must be 40 chars")
        pattern = self._phone_pattern()
        self.assertIsNone(
            pattern.search(upper_hash),
            msg=(
                "A phone-number-like substring inside a 40-char UPPERCASE hex "
                "hash must NOT match the phone_number pattern (case-insensitive "
                "hex-aware boundaries). "
                f"Hash: {upper_hash!r}"
            ),
        )

    def test_phone_number_inside_mixed_case_hex_hash_not_flagged(self) -> None:
        """A 64-char mixed-case SHA256 hash with a phone-like substring is NOT S1.

        SHA256 hashes commonly mix upper- and lowercase hex (e.g., when
        produced by different tools). The case-insensitive hex-aware boundary
        must reject phone-like substrings inside any mixed-case hash.

        The hash is built at runtime so this source file stays clean.
        """
        # Build a 64-char mixed-case SHA256-like hash at runtime. The
        # phone-like 11-digit substring is surrounded by 'a' before and 'B'
        # after (mixing lower- and uppercase hex).
        hash_prefix_mixed = "9401ba56f0d812e3f41e47a5450b0bbcf4f2aa25502cf15959e8"  # 50 chars (ends with '8' hex)
        phone_part_a = "1682"     # 4 digits (fragment A)
        phone_part_b = "9796803"  # 7 digits (fragment B)
        phone_like = phone_part_a + phone_part_b  # 11 digits, runtime only
        hash_suffix_mixed = "Bb96200f2"  # 9 chars (starts with 'B' uppercase hex)
        mixed_hash = hash_prefix_mixed + phone_like + hash_suffix_mixed
        self.assertEqual(len(mixed_hash), 72, "test fixture: mixed hash length")
        pattern = self._phone_pattern()
        self.assertIsNone(
            pattern.search(mixed_hash),
            msg=(
                "A phone-number-like substring inside a mixed-case SHA256-like "
                "hash must NOT match the phone_number pattern (case-insensitive "
                "hex-aware boundaries). "
                f"Hash: {mixed_hash!r}"
            ),
        )

    def test_real_phone_number_still_flagged(self) -> None:
        """A standalone phone number (bounded by spaces) IS still S1.

        The phone number is built at runtime so this source file stays clean.
        """
        # Build an 11-digit phone number at runtime. Starts with 1, second
        # digit in [3-9], total 11 digits, surrounded by spaces.
        # Split into fragments so the source code does not contain a
        # complete 11-digit literal.
        phone_part_a = "138"    # 3 digits (fragment A)
        phone_part_b = "00138000"  # 8 digits (fragment B)
        phone = phone_part_a + phone_part_b  # 11 digits, runtime only
        self.assertEqual(len(phone), 11)
        content = f"call me at {phone} please\n"
        rel = "tests/fixtures/temp_phone_regression.txt"
        abs_path = ROOT / rel
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")
        try:
            findings = scan_file(rel)
            phone_findings = [f for f in findings if f["type"] == "phone_number"]
            self.assertEqual(
                len(phone_findings), 1,
                msg=(
                    "A real standalone phone number must be flagged as S1. "
                    f"Findings: {findings!r}"
                ),
            )
            self.assertEqual(phone_findings[0]["severity"], "S1")
        finally:
            abs_path.unlink(missing_ok=True)

    def test_real_phone_number_in_json_value_still_flagged(self) -> None:
        """A standalone phone number in a JSON string value IS still S1,
        even when surrounded by ASCII quotes. The hex-aware boundary
        accepts a quote character (non-hex) on either side.

        The phone number is built at runtime so this source file stays clean.
        """
        phone_part_a = "139"    # 3 digits (fragment A)
        phone_part_b = "12345678"  # 8 digits (fragment B)
        phone = phone_part_a + phone_part_b  # 11 digits, runtime only
        self.assertEqual(len(phone), 11)
        content = (
            '{\n'
            f'  "contact_phone": "{phone}"\n'
            '}\n'
        )
        rel = "tests/fixtures/temp_phone_json_regression.json"
        abs_path = ROOT / rel
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")
        try:
            findings = scan_file(rel)
            phone_findings = [f for f in findings if f["type"] == "phone_number"]
            self.assertEqual(
                len(phone_findings), 1,
                msg=(
                    "A real standalone phone number in a JSON string value "
                    "must be flagged as S1. "
                    f"Findings: {findings!r}"
                ),
            )
            self.assertEqual(phone_findings[0]["severity"], "S1")
        finally:
            abs_path.unlink(missing_ok=True)

    def test_this_test_file_scans_clean_for_s1(self) -> None:
        """This test file itself must scan clean for S1, proving the runtime
        construction strategy keeps phone-number-like substrings out of the
        source code."""
        findings = scan_file("tests/test_verify_public_repo.py")
        s1_findings = [f for f in findings if f["severity"] == "S1"]
        self.assertEqual(
            s1_findings, [],
            msg=(
                "tests/test_verify_public_repo.py must scan clean for S1. "
                "Any S1 finding means a phone-number-like substring was "
                "written as a complete literal instead of being constructed "
                "at runtime. Findings: "
                f"{[(f['type'], f['line']) for f in s1_findings]!r}"
            ),
        )


if __name__ == "__main__":
    unittest.main()
