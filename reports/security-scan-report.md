# Feishu V2 Migration — Gate R1 Public Security Scan Report

> **Classification**: PUBLIC (sanitized)
> **Scan Date**: 2026-07-16
> **Scan Commit**: `e4e4b60` (pre-sanitization snapshot)
> **Scan Mode**: tracked files only (`git ls-files`)
> **Files Scanned**: 36
> **Finding Matrix SHA256**: `27360abc25361fce3e1edc7cc80e18aa9afdbb99dda1c703872df3be6a07088f`
> *(finding matrix file is gitignored / private — not committed to public repo)*

---

## 1. Executive Summary

A full sensitive-content scan was executed against the tracked files of the `feishu-v2` migration workspace at commit `e4e4b60`, prior to the Gate R1 sanitization pass. The scan identifies findings across four severity tiers (S0–S3) covering credentials, privacy data, internal resource identifiers, and publishable content.

- **Total findings**: 523
- **S0 (Credentials)**: 0 — no hardcoded secrets, tokens, or passwords detected.
- **S1 (Privacy)**: 504 — the dominant category, driven by Feishu record IDs, personal names, phone numbers, and WeChat IDs embedded in audit and review documents.
- **S2 (Internal resource identifiers)**: 31 — V1 base tokens, table IDs, and workflow IDs that should not be exposed in a public repo.
- **S3 (Publishable)**: 0.

After sanitization, an independent verification script (`scripts/verify_public_repo.py`) was run and returned **PASS** with zero residual S0/S1/S2 findings and zero warnings. The repository is cleared for public release at Gate R1.

---

## 2. Scan Configuration

| Parameter | Value |
|---|---|
| Scan target | `feishu-v2/` tracked files |
| File selection | `git ls-files` (only version-controlled files) |
| Files scanned | 36 |
| Scan commit | `e4e4b60` (pre-sanitization) |
| Scan date | 2026-07-16 |
| Severity tiers | S0 / S1 / S2 / S3 |
| Finding matrix SHA256 | `27360abc25361fce3e1edc7cc80e18aa9afdbb99dda1c703872df3be6a07088f` |
| Finding matrix visibility | PRIVATE (gitignored, not committed) |
| Worktree mode | `LOCAL_PRIVATE_PRESENT` (gitignored private files retained locally — expected) |

---

## 3. Severity Classification

| Tier | Label | Scope |
|---|---|---|
| **S0** | Credentials | API keys, app secrets, passwords, bearer tokens, refresh tokens |
| **S1** | Privacy | Feishu record IDs, personal names (customer / makeup / model), phone numbers, WeChat IDs |
| **S2** | Internal resource identifiers | `base_token`, `table_id`, `workflow_id` (V1 internal handles) |
| **S3** | Publishable | Content explicitly cleared for public release |

---

## 4. Findings Summary (by Severity)

### S0 — Credentials: **0 findings**

No hardcoded credentials, secrets, or authentication tokens were detected in any tracked file.

### S1 — Privacy: **504 findings**

| Sub-type | Unique Entities | Total Occurrences | Notes |
|---|---|---|---|
| `record_id` | 316 | ~1031 | Distributed across audit and review-gate reports |
| `personal_name` | 176 | — | Customer names, makeup artist names, model names |
| `phone_number` | — | 5 | Concentrated in `reports/phase1b-write-path-test-report.md` |
| `wechat_id` | — | 7 | Concentrated in reports |

### S2 — Internal Resource Identifiers: **31 findings**

| Sub-type | Unique Count | Alias / Notes |
|---|---|---|
| `base_token` | 2 | `SOURCE_BASE_ALIAS`, `TARGET_V2_BASE_ALIAS` |
| `table_id` | 17 unique | V1 table IDs (pre-migration handles) |
| `workflow_id` | 12 unique | V1 workflow IDs (pre-migration handles) |

### S3 — Publishable: **0 findings**

No content was pre-classified as S3 in this scan.

---

## 5. Affected Files

13 tracked files contained at least one finding. Counts below represent total findings per file (a single line may carry multiple findings).

| # | File | Findings | Primary Finding Types |
|---|---|---|---|
| 1 | `reports/phase1b3-migration-review-gate.md` | 385 | record_id, personal_name |
| 2 | `reports/phase1b2-migration-review-gate.md` | 313 | record_id, personal_name |
| 3 | `docs/current-state-audit.md` | 50 | record_id, table_id |
| 4 | `config/resource-map.example.json` | 29 | table_id, workflow_id, base_token (aliased) |
| 5 | `docs/current-automation-audit.md` | 25 | workflow_id, record_id |
| 6 | `docs/phase05-execution-report.md` | 24 | record_id, personal_name |
| 7 | `docs/current-base-schema-export.json` | 17 | table_id, record_id |
| 8 | `docs/current-data-usage-report.md` | 17 | record_id, personal_name |
| 9 | `reports/phase1b-write-path-test-report.md` | 12 | phone_number, record_id |
| 10 | `DECISION_LOG.md` | 1 | record_id (reference) |
| 11 | `.trae/rules/_gpt_audit.md` | 1 | pattern description (not real data) |
| 12 | `templates/PUBLIC_AUDIT_PACKAGE_TEMPLATE.md` | 1 | pattern description (not real data) |
| 13 | `docs/v2-base-schema.md` | 1 | table_id (reference) |

> **Note**: Files #11 and #12 contain pattern/descriptor text that matched scanner rules but do not carry real identifier values. They are retained as-is because they describe the scanning methodology rather than embodying sensitive data.

---

## 6. Sanitization Results

A sanitization pass was applied to all 13 affected files. The transformations performed:

- **record_id**: replaced with aliased form (e.g., `rec_<seq>`).
- **personal_name**: replaced with role-tagged aliases (e.g., `customer_<seq>`, `makeup_<seq>`, `model_<seq>`).
- **phone_number**: masked to `138****<last4>` form or replaced with `<phone_redacted>`.
- **wechat_id**: replaced with `<wechat_redacted>`.
- **base_token**: replaced with `SOURCE_BASE_ALIAS` / `TARGET_V2_BASE_ALIAS`.
- **table_id**: replaced with `v1_tbl_<seq>` aliases.
- **workflow_id**: replaced with `v1_wf_<seq>` aliases.
- **Pattern-description hits** in `_gpt_audit.md` and `PUBLIC_AUDIT_PACKAGE_TEMPLATE.md`: left unchanged (descriptive, non-real).

No real Feishu identifiers, customer names, phone numbers, WeChat IDs, base tokens, table IDs, or workflow IDs remain in the public-facing tracked files after sanitization.

---

## 7. Verification

Post-sanitization verification was performed using the dedicated verifier script.

| Check | Command | Result |
|---|---|---|
| Public repo scan | `python scripts/verify_public_repo.py` | **PASS** |
| Residual S0 | — | 0 |
| Residual S1 | — | 0 |
| Residual S2 | — | 0 |
| Warnings | — | 0 |
| Worktree mode | — | `LOCAL_PRIVATE_PRESENT` (gitignored private files retained locally; expected behavior, not a leak) |

**Conclusion**: The public repository state satisfies Gate R1 sanitization requirements. The finding matrix and any private pre-sanitization snapshots remain gitignored on the local worktree only and are not committed.

---

## 8. Private Evidence Reference

The following artifacts are retained **privately** (gitignored) for audit traceability and are intentionally excluded from the public repository:

| Artifact | Location | Purpose |
|---|---|---|
| Finding matrix (full) | gitignored, local worktree | Complete per-file, per-line finding records with real hit values |
| Finding matrix SHA256 | `27360abc25361fce3e1edc7cc80e18aa9afdbb99dda1c703872df3be6a07088f` | Integrity fingerprint for the private matrix |
| Pre-sanitization snapshot | commit `e4e4b60` (local history) | Reference state prior to sanitization pass |

These private artifacts may be shared out-of-band with authorized auditors but must not be committed to the public repository. The SHA256 fingerprint above allows an auditor to verify that the private matrix they receive matches the one referenced by this report.

---

*End of report.*
