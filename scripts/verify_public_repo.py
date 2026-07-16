#!/usr/bin/env python3
"""Public-repository hygiene check with tracked/staged/worktree scan modes.

Usage:
    python scripts/verify_public_repo.py             # scan git-tracked files only (default)
    python scripts/verify_public_repo.py --staged     # scan staged (cached) files
    python scripts/verify_public_repo.py --worktree   # scan entire working tree (incl. gitignored)
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import re
import subprocess
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

# Patterns that are always forbidden in the public tree.
FORBIDDEN_PATH_PATTERNS = [
    ".env",
    ".env.*",
    "config/*.local.*",
    "backups/private/*",
    "backups/private/**",
    "reports/private/*",
    "reports/private/**",
]

# In --worktree mode, these gitignored private paths are expected to exist
# locally. They should be reported as LOCAL_PRIVATE_PRESENT, not as errors.
LOCAL_PRIVATE_PATTERNS = [
    "config/*.local.*",
    "backups/private/**",
    "reports/private/**",
    ".env*",
]

TEXT_SUFFIXES = {".md", ".json", ".py", ".js", ".ts", ".tsx", ".yml", ".yaml", ".txt", ".toml"}

# --- Severity classification ---
# S0: Credentials (secrets, tokens, private keys)
# S1: Privacy (record IDs, customer names, phone numbers, WeChat IDs)
# S2: Internal resource identifiers (Base tokens, Table IDs, Field IDs, Workflow IDs)
# S3: Publicable technical identifiers (aliases, schema names, commit SHAs)

SECRET_PATTERNS: list[tuple[str, str, re.Pattern]] = [
    ("private_key", "S0", re.compile(r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY")),
    ("generic_secret_assignment", "S0", re.compile(
        r"(?i)(app_secret|client_secret|api_key|access_token)\s*[:=]\s*['\"][^'\"]{8,}")),
    ("feishu_app_token", "S0", re.compile(
        r"\bapp_token\s*[:=]\s*['\"]?(?!SOURCE_BASE_ALIAS|TARGET_V2_BASE_ALIAS)[A-Za-z0-9_-]{12,}")),
]

# S2: Internal Feishu resource identifiers
# Real Feishu IDs contain mixed case and/or digits, not all-same-char placeholders
INTERNAL_ID_PATTERNS: list[tuple[str, str, re.Pattern]] = [
    ("base_token_assignment", "S2", re.compile(
        r"(?i)\b(?:base_token|baseId|app_token)\s*[:=]\s*['\"]?(?!SOURCE_BASE_ALIAS|TARGET_V2_BASE_ALIAS|<)[A-Za-z0-9]{20,}")),
    ("table_id", "S2", re.compile(r"\btbl(?=[A-Za-z0-9]*[a-z0-9])(?![A-Za-z0-9]*([A-Za-z0-9])\1{5,})[A-Za-z0-9]{8,}")),
    ("field_id", "S2", re.compile(r"\bfld(?=[A-Za-z0-9]*[a-z0-9])(?![A-Za-z0-9]*([A-Za-z0-9])\1{5,})[A-Za-z0-9]{8,}")),
    ("workflow_id", "S2", re.compile(r"\bwkf(?=[A-Za-z0-9]*[a-z0-9])(?![A-Za-z0-9]*([A-Za-z0-9])\1{5,})[A-Za-z0-9]{8,}")),
    ("view_id", "S2", re.compile(r"\bviw(?=[A-Za-z0-9]*[a-z0-9])(?![A-Za-z0-9]*([A-Za-z0-9])\1{5,})[A-Za-z0-9]{8,}")),
]

# S1: Privacy - record IDs and personal data
# Real Feishu record IDs contain at least one uppercase letter or digit
PRIVACY_PATTERNS: list[tuple[str, str, re.Pattern]] = [
    ("record_id", "S1", re.compile(r"\brec(?=[A-Za-z0-9]*[A-Z0-9])[A-Za-z0-9]{10,}")),
    ("phone_number", "S1", re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")),
    ("wechat_id_assignment", "S1", re.compile(
        r"(?i)(?:微信|wechat|wx)\s*[:：]\s*([a-zA-Z][a-zA-Z0-9_-]{5,19})")),
]

# Known alias patterns - these are S3 (safe to publish)
ALIAS_PATTERNS = re.compile(
    r"(?:SOURCE_BASE_ALIAS|TARGET_V2_BASE_ALIAS|"
    r"V1_\w+_TABLE_ALIAS|V2_\w+_TABLE_ALIAS|"
    r"V1_WF_\w+_ALIAS|"
    r"REC_ALIAS_\d+|"
    r"CUSTOMER_ALIAS_\d+|MAKEUP_ALIAS_\d+|MODEL_ALIAS_\d+|"
    r"PROJECT_ALIAS_\d+|ENTITY_ALIAS_\d+|"
    r"<[A-Z_]+>)"
)


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def is_forbidden_path(rel: str) -> bool:
    return any(fnmatch.fnmatch(rel, pattern) for pattern in FORBIDDEN_PATH_PATTERNS)


def is_local_private(rel: str) -> bool:
    return any(fnmatch.fnmatch(rel, pattern) for pattern in LOCAL_PRIVATE_PATTERNS)


def get_tracked_files() -> list[str]:
    """Return git-tracked files via `git ls-files`."""
    result = subprocess.run(
        ["git", "ls-files"], capture_output=True, text=True, cwd=ROOT
    )
    if result.returncode != 0:
        print(f"ERROR: git ls-files failed: {result.stderr}")
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def get_staged_files() -> list[str]:
    """Return staged files via `git diff --cached --name-only`."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only"], capture_output=True, text=True, cwd=ROOT
    )
    if result.returncode != 0:
        print(f"ERROR: git diff --cached failed: {result.stderr}")
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def get_worktree_files() -> list[str]:
    """Return all files in the working tree, including gitignored ones."""
    files: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if ".git" in path.parts:
            continue
        if "node_modules" in path.parts:
            continue
        files.append(relative(path))
    return files


def fingerprint(text: str) -> str:
    """Return SHA256 fingerprint of text (first 16 chars)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def scan_file(rel: str) -> list[dict]:
    """Scan a single file and return findings list."""
    path = ROOT / rel
    findings: list[dict] = []

    if not path.exists():
        return findings

    if path.suffix.lower() not in TEXT_SUFFIXES:
        return findings

    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return [{"type": "non_utf8", "severity": "S3", "file": rel, "line": 0,
                 "match": "<non-UTF8>", "fingerprint": "N/A"}]

    # Check all pattern categories
    all_patterns = SECRET_PATTERNS + INTERNAL_ID_PATTERNS + PRIVACY_PATTERNS

    for name, severity, pattern in all_patterns:
        for match in pattern.finditer(text):
            match_text = match.group()
            # Skip if it's a known alias
            if ALIAS_PATTERNS.search(match_text):
                continue
            # Skip if the surrounding text contains alias indicators
            start = max(0, match.start() - 30)
            context = text[start:match.end() + 30]
            if "ALIAS" in context or ("<" in context and ">" in context):
                continue

            line_num = text[:match.start()].count("\n") + 1
            findings.append({
                "type": name,
                "severity": severity,
                "file": rel,
                "line": line_num,
                "fingerprint": fingerprint(match_text),
            })

    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Public repository verification")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--staged", action="store_true",
                            help="scan staged (cached) files only")
    mode_group.add_argument("--worktree", action="store_true",
                            help="scan entire working tree including gitignored files")
    parser.add_argument("--json", action="store_true",
                        help="output findings as JSON")
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []
    local_private_notes: list[str] = []
    all_findings: list[dict] = []

    # Check required files
    for rel in REQUIRED:
        if not (ROOT / rel).exists():
            errors.append(f"missing required file: {rel}")

    # Determine scan scope
    if args.staged:
        scan_files = get_staged_files()
        mode_label = "staged"
    elif args.worktree:
        scan_files = get_worktree_files()
        mode_label = "worktree"
    else:
        scan_files = get_tracked_files()
        mode_label = "tracked"

    if not scan_files:
        errors.append("no files found to scan")

    # Scan files
    for rel in scan_files:
        # Check for forbidden paths
        if is_forbidden_path(rel):
            if args.worktree and is_local_private(rel):
                # In worktree mode, local private files are expected
                local_private_notes.append(f"LOCAL_PRIVATE_PRESENT: {rel}")
                continue
            errors.append(f"private-only path present in public tree: {rel}")
            continue

        # Skip non-text files early
        path = ROOT / rel
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue

        file_findings = scan_file(rel)
        for f in file_findings:
            if f["type"] == "non_utf8":
                warnings.append(f"skipped non-UTF8 file: {rel}")
                continue
            all_findings.append(f)
            if f["severity"] in ("S0", "S1"):
                errors.append(
                    f"{f['severity']} {f['type']} in {rel}:{f['line']} "
                    f"(fp:{f['fingerprint']})"
                )
            elif f["severity"] == "S2":
                warnings.append(
                    f"review {f['type']} in {rel}:{f['line']} "
                    f"(fp:{f['fingerprint']})"
                )

    # Output
    if args.json:
        output = {
            "mode": mode_label,
            "findings": all_findings,
            "errors": sorted(set(errors)),
            "warnings": sorted(set(warnings)),
            "local_private": sorted(set(local_private_notes)),
        }
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        print("PUBLIC REPOSITORY VERIFICATION")
        print(f"root: {ROOT}")
        print(f"mode: {mode_label} ({len(scan_files)} files)")

        for note in sorted(set(local_private_notes)):
            print(f"INFO: {note}")

        for warning in sorted(set(warnings)):
            print(f"WARNING: {warning}")

        for error in sorted(set(errors)):
            print(f"ERROR: {error}")

        s0_count = sum(1 for f in all_findings if f["severity"] == "S0")
        s1_count = sum(1 for f in all_findings if f["severity"] == "S1")
        s2_count = sum(1 for f in all_findings if f["severity"] == "S2")

        print(f"\nFindings: S0={s0_count} S1={s1_count} S2={s2_count}")

        if errors:
            print(f"RESULT: FAIL ({len(set(errors))} errors)")
            return 1
        print(f"RESULT: PASS ({len(set(warnings))} warnings require review)")
        return 0


if __name__ == "__main__":
    sys.exit(main())
