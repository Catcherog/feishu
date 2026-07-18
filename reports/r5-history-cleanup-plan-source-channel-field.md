# R5 Second Fix Batch — History Cleanup Plan for the Redacted Source Channel Field ID

> **Status: NOT APPROVED — NOT EXECUTED**
> This document is a planning artifact only. No Git history rewrite has been performed or authorized for the Field ID exposure documented here.
> The actual Field ID string has been redacted from this document and replaced with `<REDACTED_FIELD_ID>`. For cleanup execution, retrieve the real 10-char string from commit `82d9886` `reports/r5-enum-cleanup-summary.json` line 7 (pre-redaction blob `bcd0f4dfe1c00f84b5fc4d7a2868e39c2ffd957c`).
> Any execution requires explicit user approval.

## Executive Summary

R5 first fix batch commit `82d9886` introduced a real Feishu Field ID `<REDACTED_FIELD_ID>` (10 chars total: 3 prefix + 7 suffix) in `reports/r5-enum-cleanup-summary.json`. R5 second fix batch sanitized the public HEAD by replacing the real Field ID with the stable alias `V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS`, but historical commits `82d9886` and `672ed78` (R5 first fix backfill) still contain the exposed blob in reachable history.

This plan documents the scope of the `<REDACTED_FIELD_ID>` exposure, compares available cleanup options, lists mandatory prerequisites, and records a recommendation. **It does not authorize any action.**

### Key Repository Facts

| Attribute | Value |
|---|---|
| Repository | `Catcherog/feishu` (public) |
| Branch | `master` (only branch) |
| Affected identifier | `<REDACTED_FIELD_ID>` (Feishu Field ID, customer.source_channel, aliased as `V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS`) |
| Identifier category | S2 (internal resource identifier) |
| HEAD after R5 second fix batch | (sanitized, will be filled via SHA backfill) |
| Commits introducing the identifier | 1 (`82d9886` — R5 first fix main commit) |
| Commits containing the identifier in reachable history | 2 (`82d9886`, `672ed78`) |
| Files affected | 1 (`reports/r5-enum-cleanup-summary.json`) |
| Distinct blob SHAs containing the identifier | 1 (`bcd0f4dfe1c00f84b5fc4d7a2868e39c2ffd957c`) |
| Pre-redaction blob retrieval | `git show 82d9886:reports/r5-enum-cleanup-summary.json` (line 7 contains the real Field ID) |

## History Scan Results

Scan performed via `git log --all -S "<REDACTED_FIELD_ID>" --oneline` (pickaxe) and `git grep -l "<REDACTED_FIELD_ID>" <commit>` per commit. (Note: the actual pickaxe query uses the real 10-char Field ID string, redacted here for document hygiene.)

### Pickaxe Results

Only commit `82d9886` introduced the string (61 insertions in `reports/r5-enum-cleanup-summary.json`). The backfill commit `672ed78` did not modify this file, so it inherits the same blob.

### Per-Commit Exposure

| Commit | Commit Message | File Contains `<REDACTED_FIELD_ID>` | Blob SHA |
|---|---|---|---|
| `82d9886` | R5 fix: P0-1 enum cleanup + P0-2 audit package rewrite + P0-3 entrypoint sync | Yes — `reports/r5-enum-cleanup-summary.json` line 7 | `bcd0f4dfe1c00f84b5fc4d7a2868e39c2ffd957c` |
| `672ed78` | R5 fix backfill: fill in R5 fix main commit SHA references | Yes — same file, same blob (backfill did not modify) | `bcd0f4dfe1c00f84b5fc4d7a2868e39c2ffd957c` |
| HEAD (after R5 second fix batch) | (R5 second fix commits) | **No** — sanitized to `V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS` | (new blob, no real identifier) |

### Current HEAD State (Post-R5 Second Fix Batch)

After R5 second fix batch is committed, `git grep "<REDACTED_FIELD_ID>" HEAD` will return no results. The exposure is purely historical — present in commits `82d9886` and `672ed78` but not in HEAD.

## Cleanup Options (Comparison)

> None of the following options have been executed or approved.

### Option 1: `git filter-repo` with `--replace-text` (Recommended)

- **Mechanism:** Create a replacements file mapping `<REDACTED_FIELD_ID>` → `V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS` (retrieve the real 10-char Field ID from `git show 82d9886:reports/r5-enum-cleanup-summary.json` line 7 to populate the replacements file), then run `git filter-repo --replace-text replacements.txt`.
- **Pros:**
  - Handles all commits, blobs, and refs in a single pass.
  - Actively maintained tool, the officially recommended replacement for `git filter-branch`.
  - Supports precise per-string replacement with aliases (preserves structural readability).
  - Aligns with the replacement already applied at HEAD.
- **Cons:**
  - Rewrites ALL commit SHAs from `82d9886` onward — every commit hash changes.
  - Requires force-push to remote (`git push --force`).
  - All collaborators must re-clone.
  - Will invalidate R5 first fix batch audit package SHA references (commit SHAs `82d9886` and `672ed78` will no longer exist in history).
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

### Option 3: No History Rewrite (Current Status After R5 Second Fix Batch)

- **Mechanism:** Take no action on historical commits.
- **Current state:**
  - HEAD is sanitized — current checkout contains no real `<REDACTED_FIELD_ID>` identifier.
  - Historical commits `82d9886` and `672ed78` still contain the exposed blob in the public repository.
- **Risk:** Anyone with read access to the repository can browse commits `82d9886` or `672ed78` and extract the Field ID `<REDACTED_FIELD_ID>`.
- **Mitigation gap:** No mitigation exists for already-exposed history under this option.
- **Note:** This is the default state after R5 second fix batch. The exposure is limited to a single Field ID in a single file, introduced in a single commit. Severity is S2 (internal resource identifier), not S0 (secret) or S1 (privacy).

### Comparison Summary

| Criterion | Option 1 (filter-repo) | Option 2 (BFG) | Option 3 (No rewrite) |
|---|---|---|---|
| Cleans all historical commits | Yes | Yes | No |
| Preserves commit SHAs | No | No | Yes |
| Requires force-push | Yes | Yes | No |
| Collaborator re-clone required | Yes | Yes | No |
| Tool actively maintained | Yes | No | n/a |
| Precision of replacement | High (aliases) | Medium | n/a |
| Current exposure risk remaining | None | None | Limited (1 Field ID, 2 commits) |
| Invalidates R5 first fix batch SHA references | Yes | Yes | No |

## Prerequisites (Required Before Any Rewrite)

The following must be completed before executing Option 1 or 2. **None of these have been performed.**

1. **Local backup**
   - Command: `git clone --mirror <repo-url> backup.git`
   - Purpose: Preserve a complete pre-rewrite copy for recovery.

2. **Collaborator coordination**
   - Notify all collaborators that history will be rewritten.
   - All must re-clone after the force-push completes.
   - Any open branches or PRs must be reconciled (current repo has only `master`, no tags).

3. **Credential rotation assessment**
   - Field IDs are internal structural identifiers, not authentication credentials, and cannot be rotated.
   - The Field ID `<REDACTED_FIELD_ID>` references the `source_channel` field on the V2 Customer table.
   - Risk assessment: exposing a Field ID allows targeted API calls to that specific field, but does not by itself grant access to data (still requires Base token authorization).

4. **Force-push plan**
   - Document the exact sequence: backup → rewrite → verify → force-push → notify.
   - Confirm the user has push access to `Catcherog/feishu`.
   - Confirm no protected-branch rules block force-push to `master`.

5. **Post-rewrite verification**
   - Re-run `python scripts/verify_public_repo.py` against ALL commits in the rewritten history.
   - Confirm `<REDACTED_FIELD_ID>` does not appear in any commit, blob, or ref.
   - Confirm the rewritten HEAD produces a working checkout.
   - Update audit package SHA references to new commit SHAs (R5 first fix batch commit `82d9886` → new SHA; R5 first fix backfill `672ed78` → new SHA).

6. **Audit package impact assessment**
   - R5 first fix batch audit package references commits `82d9886` and `672ed78` by SHA. After rewrite, these SHAs no longer exist.
   - R5 second fix batch audit package also references these SHAs as historical context.
   - Decision required: (a) update audit packages with new SHAs (requires additional backfill commit), or (b) leave audit packages with a note that historical SHAs refer to pre-rewrite commits preserved in local mirror backup.

## Recommendation

**Option 1 (`git filter-repo` with `--replace-text`)** is recommended if the user decides to proceed with a history rewrite for this specific Field ID, because:

- It is the only option that fully eliminates `<REDACTED_FIELD_ID>` exposure across the 2 affected commits.
- `git filter-repo` is actively maintained and purpose-built for this task.
- Alias-based replacement (`V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS`) preserves document readability while removing the real identifier, and aligns with the replacement already applied at HEAD.

However, **execution is NOT authorized by this document**. The decision to rewrite history carries irreversible consequences (SHA changes, force-push, collaborator disruption, audit package SHA invalidation) and must be made explicitly by the user.

**Severity context for the decision**:

- `<REDACTED_FIELD_ID>` is an S2 (internal resource identifier), not S0 (secret) or S1 (privacy).
- The exposure is limited to 2 commits and 1 file.
- The Field ID is for `customer.source_channel`, a field already documented in the public Schema v1.1 with all its options. The Field ID itself does not reveal customer data.
- Risk of targeted API abuse is low because Base token authorization is still required.
- Option 3 (no rewrite) is a defensible choice given the limited scope and S2 severity.

If the user declines history rewrite, **Option 3** is the default state — exposure remains in historical commits `82d9886` and `672ed78`, and the only available mitigation is the HEAD sanitization already performed by R5 second fix batch.

## Relationship to `reports/git-history-cleanup-plan.md`

`reports/git-history-cleanup-plan.md` documents a separate, larger history cleanup effort covering 340 pre-existing S2 exposures in V1 audit artifacts (`docs/current-base-schema-export.json`, `reports/phase1b-write-path-test-report.md`, `docs/current-automation-audit.md`) introduced since the first commit. That plan also remains NOT APPROVED, NOT EXECUTED.

If the user decides to approve history rewrite, it may be more efficient to execute both cleanups (V1 pre-existing exposures + R5 `<REDACTED_FIELD_ID>`) in a single `git filter-repo` pass, since both require force-push and SHA invalidation. The combined replacements file would map all real identifiers to their stable aliases.

## Explicit Status

| Item | Status |
|---|---|
| History scan performed for `<REDACTED_FIELD_ID>` | Yes — all commits in `3df9fc5..HEAD` and HEAD scanned |
| History rewrite executed for `<REDACTED_FIELD_ID>` | **NO** |
| History rewrite approved for `<REDACTED_FIELD_ID>` | **NO** |
| Force-push performed | **NO** |
| Local backup created | **NO** |
| Collaborators notified | **NO** |
| HEAD sanitized (R5 second fix batch) | Yes — `reports/r5-enum-cleanup-summary.json` uses `V2_CUSTOMER_SOURCE_CHANNEL_FIELD_ALIAS` |
| Historical commits sanitized | **NO** — commits `82d9886` and `672ed78` still contain the exposed blob `bcd0f4dfe1c00f84b5fc4d7a2868e39c2ffd957c` |

**This plan does NOT authorize execution. History rewrite requires explicit user approval.**
