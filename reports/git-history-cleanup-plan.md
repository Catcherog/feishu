# Git History Cleanup Plan

> **Status: NOT APPROVED — NOT EXECUTED**
> This document is a planning artifact only. No Git history rewrite has been performed or authorized.
> Any execution requires explicit user approval.

## Executive Summary

A full scan of the `Catcherog/feishu` public repository identified that **all 15 commits** in history contain real Feishu Base identifiers (Table IDs, Workflow IDs, Record IDs) and/or Base tokens. While the current HEAD (`e4e4b60`) has been sanitized, every historical commit remains exposed in the public repository.

This plan documents the scope of exposure, compares available cleanup options, lists mandatory prerequisites, and records a recommendation. **It does not authorize any action.**

### Key Repository Facts

| Attribute | Value |
|---|---|
| Repository | `Catcherog/feishu` (public) |
| Branch | `master` (only branch) |
| Tags | none |
| Total commits | 15 |
| Current HEAD | `e4e4b60` |
| Commits affected by exposure | 15 / 15 (100%) |

## History Scan Results

All 15 commits were scanned for four categories of sensitive identifiers: Base tokens, Table IDs, Workflow IDs, and Record IDs.

| Commit | Base Tokens | Table IDs | Workflow IDs | Record IDs | Total |
|--------|-------------|-----------|--------------|------------|-------|
| e4e4b60 | 5 | 74 | 48 | 1031 | 1158 |
| 754b6c4 | 5 | 74 | 48 | 1029 | 1156 |
| 7210333 | 5 | 74 | 48 | 1029 | 1156 |
| 2dbc136 | 3 | 74 | 48 | 336 | 461 |
| f655d95 | 3 | 74 | 48 | 336 | 461 |
| bb87d63 | 1 | 74 | 48 | 11 | 134 |
| a6c419a | 1 | 74 | 48 | 0 | 123 |
| 312354f | 1 | 74 | 48 | 0 | 123 |
| 8e139eb | 1 | 74 | 48 | 0 | 123 |
| 010487f | 0 | 74 | 48 | 0 | 122 |
| 10a12ed | 0 | 74 | 48 | 0 | 122 |
| 54ef95c | 0 | 74 | 48 | 0 | 122 |
| 3f9346b | 0 | 74 | 48 | 0 | 122 |
| 596d5dd | 0 | 68 | 36 | 0 | 104 |
| 93919da | 0 | 68 | 36 | 0 | 104 |

**Totals across history:** 25 base-token occurrences, 1074 table-ID occurrences, 696 workflow-ID occurrences, 3471 record-ID occurrences.

## Exposure Timeline

The introduction of each identifier category into version history:

| Identifier Category | Introduced In | Commit Count | Status |
|---|---|---|---|
| Table IDs | `93919da` (first commit) | 15 / 15 | Present in ALL commits |
| Workflow IDs | `93919da` (first commit) | 15 / 15 | Present in ALL commits |
| V2 Base token | `8e139eb` | 8 / 15 | Active from `8e139eb` through `e4e4b60` |
| V1 Base token | `f655d95` | 5 / 15 | Active from `f655d95` through `e4e4b60` |
| Record IDs | `bb87d63` | 4 / 15 | Introduced in `bb87d63`, expanded in `f655d95` and `7210333` |

## Affected Files

The following files carry real identifiers in their historical content. Each file is listed with the commit where exposure began and the identifier categories present.

| File | Identifier Categories | Introduced In |
|---|---|---|
| `config/resource-map.example.json` | Table IDs + Workflow IDs | `93919da` |
| `docs/current-state-audit.md` | Table IDs + Workflow IDs | `93919da` |
| `docs/current-automation-audit.md` | Table IDs + Workflow IDs | `93919da` |
| `docs/current-base-schema-export.json` | Table IDs | `93919da` |
| `docs/current-data-usage-report.md` | Table IDs | `93919da` |
| `docs/phase05-execution-report.md` | Table IDs + Workflow IDs | `93919da` |
| `DECISION_LOG.md` | V2 Base token | `8e139eb` |
| `reports/phase1b-write-path-test-report.md` | V2 Base token + Record IDs | `bb87d63` |
| `reports/phase1b2-migration-review-gate.md` | Both Base tokens + Record IDs | `f655d95` |
| `reports/phase1b3-migration-review-gate.md` | Both Base tokens + Record IDs | `7210333` |

## Cleanup Options (Comparison)

> None of the following options have been executed or approved.

### Option 1: `git filter-repo` with `--replace-text` (Recommended)

- **Mechanism:** Create a replacements file mapping each real identifier to an alias (e.g. `tblXXXXXXXX` → `tbl_REDACTED_01`), then run `git filter-repo --replace-text replacements.txt`.
- **Pros:**
  - Handles all commits, blobs, and refs in a single pass.
  - Actively maintained tool, the officially recommended replacement for `git filter-branch`.
  - Supports precise per-string replacement with aliases (preserves structural readability).
- **Cons:**
  - Rewrites ALL commit SHAs — every commit hash changes.
  - Requires force-push to remote (`git push --force`).
  - All collaborators must re-clone.
- **Prerequisite:** Local mirror backup of the repository before execution.

### Option 2: BFG Repo-Cleaner

- **Mechanism:** Use `bfg --replace-text mappings.txt` against a mirror clone.
- **Pros:**
  - Simpler invocation than `git filter-repo`.
  - Well-documented for this exact use case.
- **Cons:**
  - Less flexible — cannot express conditional logic.
  - Also rewrites history (same SHA impact as Option 1).
  - Requires Java runtime.
  - BFG is no longer actively developed.

### Option 3: No History Rewrite (Current Status)

- **Mechanism:** Take no action on historical commits.
- **Current state:**
  - HEAD (`e4e4b60`) is sanitized — current checkout contains no real identifiers.
  - Historical commits still contain real identifiers in the public repository.
- **Risk:** Anyone with read access to the repository can browse historical commits and extract Table IDs, Workflow IDs, Record IDs, and Base tokens.
- **Mitigation gap:** No mitigation exists for already-exposed history under this option.

### Comparison Summary

| Criterion | Option 1 (filter-repo) | Option 2 (BFG) | Option 3 (No rewrite) |
|---|---|---|---|
| Cleans all historical commits | Yes | Yes | No |
| Preserves commit SHAs | No | No | Yes |
| Requires force-push | Yes | Yes | No |
| Collaborator re-clone required | Yes | Yes | No |
| Tool actively maintained | Yes | No | n/a |
| Precision of replacement | High (aliases) | Medium | n/a |
| Current exposure risk remaining | None | None | Full |

## Prerequisites (Required Before Any Rewrite)

The following must be completed before executing Option 1 or Option 2. **None of these have been performed.**

1. **Local backup**
   - Command: `git clone --mirror <repo-url> backup.git`
   - Purpose: Preserve a complete pre-rewrite copy for recovery.

2. **Collaborator coordination**
   - Notify all collaborators that history will be rewritten.
   - All must re-clone after the force-push completes.
   - Any open branches or PRs must be reconciled (current repo has only `master`, no tags).

3. **Credential rotation assessment**
   - Base tokens are internal identifiers, not authentication credentials, but should be treated as exposed given the public repository.
   - Decision required: rotate Feishu Base tokens or accept the exposure.
   - Table IDs, Workflow IDs, and Record IDs cannot be rotated — they are structural references. History rewrite is the only remediation.

4. **Force-push plan**
   - Document the exact sequence: backup → rewrite → verify → force-push → notify.
   - Confirm the user has push access to `Catcherog/feishu`.
   - Confirm no protected-branch rules block force-push to `master`.

5. **Post-rewrite verification**
   - Re-run `verify_public_repo.py` (or equivalent scanner) against ALL commits in the rewritten history.
   - Confirm zero real identifiers remain in any commit, blob, or ref.
   - Confirm the rewritten HEAD produces a working checkout.

## Recommendation

**Option 1 (`git filter-repo` with `--replace-text`)** is recommended if the user decides to proceed with a history rewrite, because:

- It is the only option that fully eliminates exposure across all 15 commits.
- `git filter-repo` is actively maintained and purpose-built for this task.
- Alias-based replacement preserves document readability while removing real identifiers.

However, **execution is NOT authorized by this document**. The decision to rewrite history carries irreversible consequences (SHA changes, force-push, collaborator disruption) and must be made explicitly by the user.

If the user declines history rewrite, **Option 3** is the default state — exposure remains, and the only available mitigation is credential/token rotation where applicable.

## Explicit Status

| Item | Status |
|---|---|
| History scan performed | Yes — all 15 commits scanned |
| History rewrite executed | **NO** |
| History rewrite approved | **NO** |
| Force-push performed | **NO** |
| Local backup created | **NO** |
| Collaborators notified | **NO** |
| Credential rotation performed | **NO** (not assessed) |
| Current HEAD sanitized | Yes (`e4e4b60`) |
| Historical commits sanitized | **NO** — all 15 commits still contain real identifiers |

**This plan does NOT authorize execution. History rewrite requires explicit user approval.**
