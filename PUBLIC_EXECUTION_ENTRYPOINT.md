# Trae Public Repository Execution Entrypoint

> Repository: `https://github.com/Catcherog/feishu`
> Branch: `master`
> Current execution state: `PHASE_1B3_REMEDIATION`
> Current gate: `R2`
> R2 audit status: `R2_REVIEW_PENDING`
> Migration pilot: `NOT_APPROVED`
> This file is the phase-specific execution entrypoint. It overrides stale phase instructions in older prompts or chat history.

## 1. Bootstrap

At the beginning of every new Trae session, run:

```bash
git fetch origin --prune
git checkout master
git pull --ff-only origin master
git status --short
git rev-parse HEAD
```

If the working tree is not clean, do not reset or delete changes. Report the differences and stop.

Then read these files in order:

1. `PUBLIC_EXECUTION_ENTRYPOINT.md`
2. `config/public-execution-manifest.json`
3. `PROJECT_GUIDE.md`
4. `DECISION_LOG.md`
5. `docs/audit/PUBLIC_AUDIT_POLICY.md`
6. `docs/audit/phase1b3-independent-audit.md`
7. `docs/audit/phase1b3-remediation-plan.md`
8. `.trae/rules/_public_repo_execution.md`
9. `.trae/rules/_gpt_audit.md`

Do not use remembered instructions from a previous Trae conversation when they conflict with the current repository files.

## 2. Source-of-truth order

When information conflicts, use this priority:

1. Current real Feishu structure and local private configuration
2. Tested code at the current Git commit
3. `config/public-execution-manifest.json`
4. Approved entries in `DECISION_LOG.md`
5. `PROJECT_GUIDE.md`
6. Latest acceptance and audit reports
7. Historical README files, old prompts, old screenshots and chat memory

No public file may contain real Base identifiers, table identifiers, field identifiers, record identifiers, credentials, customer data or raw backups.

## 3. Current gate decision

The latest gate decisions are:

```text
GATE_R1 = INDEPENDENTLY_VERIFIED_PASS
GATE_R2 = R2_REVIEW_PENDING
GATE_R3 = NOT_STARTED
GATE_R4 = NOT_STARTED
GATE_R5 = NOT_STARTED
GATE_R6 = NOT_STARTED
MIGRATION_PILOT_001 = NOT_APPROVED
```

R1 was independently verified on 2026-07-17 (see `docs/audit/phaseR1-independent-verification-2026-07-17.md` and `reports/phaseR1-final-gpt-audit-package.md`). The public tree (113 files) and reachable history (20 commits) both scan as `S0=0 S1=0 S2=0`. The 17 pre-rewrite commits are unreachable; their content is preserved only in the local private mirror backup.

R2 technical work is complete (Plan B, user-approved on 2026-07-17). The deterministic Schema v1.0 → v1.1 machine diff (`schemas/schema-diff-v1.0-to-v1.1.json`) and the reproducible generator (`scripts/generate_schema_diff.py`) are committed with three passing tests. The final machine facts are `added_fields=35, removed_fields=0, changed_fields=0, enum_changes=1, required_changes=0, view_changes=4, state_machine_changes=2, global_enum_changes=1`.

R2 resolved the previously detected `SCHEMA_VIEW_DRIFT` by applying Plan B (user-approved):

- Added the four new views from `docs/v2-view-inventory.md` to `schemas/v2-schema-v1.1.json` (Customer 迁移记录, Project 迁移记录, Project 按付款状态分组, Resource 迁移记录). Customer now has 10 views, Project 12 views, Resource 13 views — counts match the inventory.
- Regenerated `schemas/v2-schema-v1.1.sha256` under the LF-normalized SHA256 caliber (matching v1.0). Earlier "v1.0 sha256 drift" reports were a false positive caused by mixing `Get-FileHash` raw bytes with LF-normalized file content; v1.0.sha256 was already correct.
- Regenerated `schemas/schema-diff-v1.0-to-v1.1.json` with `view_changes=4`; SHA256 stable across two consecutive runs (`791b501eed5b2368e13cbc62f0a3dfe5c97cf0a682ebf4f1ecd36d0fe3ef8d69`).
- Updated `tests/test_generate_schema_diff.py` so `test_public_v1_0_to_v1_1_machine_facts` locks in `view_changes=4`. Future silent drift will fail the test.
- Added `__pycache__/` and `*.pyc` to `.gitignore` so Python bytecode caches do not pollute the public repo.
- Rewrote `reports/phaseR2-schema-evidence-gpt-audit-package.md` (v2) to reflect the new machine facts and Plan B execution.

A separate conflict remains open for R6 (out of scope for R2): `reports/phase1b3-gpt-audit-package.md` line 132 states "新增 19 个字段", which is inconsistent with the machine fact `added_fields=35`. This is a stale human count in a superseded audit package and will be reconciled when R6 produces a new audit package; it is not a blocker for R2.

R2 did not modify Schema v1.0, any real Feishu Base, the APP, or production automations. The next authorized gate is R3, but R3 must not start until an independent reviewer (GPT or human) reviews the R2 audit package and explicitly approves continuation. Trae must not auto-continue to R3.

## 4. Approved work

Trae is approved to execute only the remediation work listed below:

1. Sanitize public reports and Git history of internal Feishu resource identifiers.
2. Produce a machine-generated Schema v1.0 to v1.1 diff.
3. Move stable migration classification logic into version control.
4. Add synthetic, anonymized fixtures and expected classification outputs.
5. Add mutually exclusive primary reason codes and optional secondary reason codes.
6. Apply the v1.1 Schema delta to the existing V2 test Base after a dry-run patch plan is reviewed.
7. Perform field-level write/read/default/enum validation for v1.1 additions.
8. Produce a new read-only Dry Run and a new GPT audit package.
9. Stop at the next audit gate.

## 5. Prohibited work

Trae must not:

- Start `MIGRATION_PILOT_001`.
- Write Pilot records from `NEEDS_REVIEW` or `BLOCKED` classifications.
- Delete or modify old Base records.
- Switch the APP to V2.
- Enable production automations.
- Commit private backups, record-level private matrices or real Feishu identifiers.
- Rewrite Git history without first creating a local backup and reporting the exact command and impact.
- Claim that a result is independently verified when it only comes from a self-reported execution log.

## 6. Required execution order

Execute the remediation as six gates. Stop after each gate if its acceptance criteria are not met.

### Gate R1 — Public repository security

Required outputs:

- `reports/security-scan-report.md`
- sanitized public reports
- private local identifier inventory, not committed
- Git-history cleanup plan or completed cleanup report

Acceptance:

- Public branch contains no real Base, Table, Field or record identifiers.
- Public branch contains no secrets or personal records.
- Historical exposure is either cleaned or explicitly documented as pending with the repository considered blocked.

### Gate R2 — Schema evidence

Required outputs:

- `schemas/schema-diff-v1.0-to-v1.1.json`
- updated field dictionary and view inventory
- a script that regenerates the diff

Acceptance:

- Added, removed and changed field counts are generated by code.
- The audit package does not manually state contradictory field counts.

### Gate R3 — Reproducible classifier

Required outputs:

- stable code under `src/migration/classifier/`
- anonymized fixtures under `tests/fixtures/migration/`
- expected outputs
- tests for every reason-code branch

Acceptance:

- A reviewer can run classification tests without access to private data.
- Tests cover status, source, budget, duplicate, orphan and missing-identity rules.

### Gate R4 — Record classification accounting

Required outputs:

- `reports/classification-reason-summary.json`
- a public anonymized aggregate report
- `backups/private/classification-record-matrix.private.json`, local only

Acceptance:

- Every record has exactly one `primary_reason_code`.
- Secondary reasons may overlap.
- Category totals reconcile exactly to total record counts.

### Gate R5 — V2 v1.1 field validation

Required outputs:

- v1.1 delta patch plan
- `reports/v1.1-field-write-path-report.md`
- rollback plan for the schema patch

Acceptance:

- All v1.1 new fields exist in the V2 test Base.
- Type, enum, default, read and write behavior are verified.
- No real migration records are created.

### Gate R6 — New Dry Run and audit package

Required outputs:

- new read-only Dry Run report
- new GPT audit package
- updated execution manifest

Acceptance:

- Customer and Project counts are accurately classified.
- Gate decision is automatically calculated.
- Audit evidence identifies commit SHA, blob SHA, commands, exit codes and verification status.
- Execution stops for external audit.

## 7. Audit terminology

Every evidence statement must be labeled as one of:

- `INDEPENDENTLY_VERIFIED`
- `REPRODUCIBLE_FROM_PUBLIC_REPO`
- `SELF_REPORTED`
- `PRIVATE_EVIDENCE_NOT_PUBLIC`
- `NOT_VERIFIED`

Do not use `PASS` for an item that is only self-reported.

## 8. End-of-task response format

At the end of each gate, report:

1. Gate executed
2. Current commit before and after
3. Files created or modified
4. Commands and exit codes
5. Evidence classification
6. Security scan result
7. Acceptance criteria result
8. Unresolved blockers
9. Explicit statement that prohibited work was not executed
10. Recommendation for the next gate, without automatically starting it

