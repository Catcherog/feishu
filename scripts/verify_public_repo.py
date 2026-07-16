#!/usr/bin/env python3
"""Lightweight public-repository hygiene check. No external dependencies."""

from __future__ import annotations

import fnmatch
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    "PUBLIC_EXECUTION_ENTRYPOINT.md",
    "PROJECT_GUIDE.md",
    "DECISION_LOG.md",
    "config/public-execution-manifest.json",
    "docs/audit/PUBLIC_AUDIT_POLICY.md",
    "docs/audit/phase1b3-independent-audit.md",
    "docs/audit/phase1b3-remediation-plan.md",
    ".trae/rules/_public_repo_execution.md",
    ".trae/rules/_gpt_audit.md",
]

FORBIDDEN_PATH_PATTERNS = [
    ".env",
    ".env.*",
    "config/*.local.*",
    "backups/private/*",
    "backups/private/**",
    "reports/private/*",
    "reports/private/**",
]

TEXT_SUFFIXES = {".md", ".json", ".py", ".js", ".ts", ".tsx", ".yml", ".yaml", ".txt", ".toml"}

SECRET_PATTERNS = [
    ("private_key", re.compile(r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY")),
    ("generic_secret_assignment", re.compile(r"(?i)(app_secret|client_secret|api_key|access_token)\s*[:=]\s*['\"][^'\"]{8,}")),
    ("feishu_app_token", re.compile(r"\bapp_token\s*[:=]\s*['\"]?(?!SOURCE_BASE_ALIAS|TARGET_V2_BASE_ALIAS)[A-Za-z0-9_-]{12,}")),
]

# These tokens should be aliases in public reports. This deliberately focuses on
# labelled assignments to reduce false positives in source code documentation.
INTERNAL_ID_PATTERNS = [
    ("table_id_assignment", re.compile(r"(?i)\btable_id\s*[:=]\s*['\"]?[A-Za-z0-9_-]{8,}")),
    ("field_id_assignment", re.compile(r"(?i)\bfield_id\s*[:=]\s*['\"]?[A-Za-z0-9_-]{8,}")),
    ("record_id_assignment", re.compile(r"(?i)\brecord_id\s*[:=]\s*['\"]?[A-Za-z0-9_-]{8,}")),
]


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def is_forbidden_path(rel: str) -> bool:
    return any(fnmatch.fnmatch(rel, pattern) for pattern in FORBIDDEN_PATH_PATTERNS)


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    for rel in REQUIRED:
        if not (ROOT / rel).exists():
            errors.append(f"missing required file: {rel}")

    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        rel = relative(path)
        if is_forbidden_path(rel):
            errors.append(f"private-only path present in public tree: {rel}")
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            warnings.append(f"skipped non-UTF8 file: {rel}")
            continue
        for name, pattern in SECRET_PATTERNS:
            if pattern.search(text):
                errors.append(f"{name} candidate in {rel}")
        for name, pattern in INTERNAL_ID_PATTERNS:
            if pattern.search(text) and "_ALIAS" not in text:
                warnings.append(f"review {name} in {rel}")

    print("PUBLIC REPOSITORY VERIFICATION")
    print(f"root: {ROOT}")
    for warning in sorted(set(warnings)):
        print(f"WARNING: {warning}")
    for error in sorted(set(errors)):
        print(f"ERROR: {error}")

    if errors:
        print(f"RESULT: FAIL ({len(set(errors))} errors)")
        return 1
    print(f"RESULT: PASS ({len(set(warnings))} warnings require review)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
