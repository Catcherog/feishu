# Phase 1B-3 Remediation Plan

Status: `APPROVED_FOR_REMEDIATION_ONLY`

## Audit disposition

The migration Pilot remains blocked. The read-only Dry Run direction is accepted, but the evidence package requires remediation before another external audit.

## Work packages

### WP-1 Public repository hygiene

- Replace real Feishu resource identifiers in public reports with aliases.
- Scan the current tree and Git history.
- Create a backup before any history rewrite.
- If history rewrite is required, report exact affected commits and coordinate force-push impact.
- Rotate credentials only if credentials, not merely identifiers, were exposed.

Deliverable: `reports/security-scan-report.md`.

### WP-2 Machine-generated Schema diff

Create a deterministic script that compares v1.0 and v1.1 and writes:

`schemas/schema-diff-v1.0-to-v1.1.json`

The output must include added, removed and changed fields, enum changes, required changes and view changes.

### WP-3 Stable classifier

Move the reusable classifier from temporary scripts into:

`src/migration/classifier/`

Separate pure classification rules from private Feishu data access.

### WP-4 Synthetic test fixtures

Create anonymized synthetic fixtures for:

- customer status mapping
- project delivery evidence
- source-channel mapping
- budget parsing
- orphan customers
- orphan projects
- duplicate candidates
- missing identities
- conflicting primary and secondary reasons

No fixture may be copied from a real record.

### WP-5 Classification accounting

Every classified record must have:

```json
{
  "classification": "MIGRATABLE | NEEDS_REVIEW | BLOCKED",
  "primary_reason_code": "one mutually exclusive code",
  "secondary_reason_codes": ["zero or more overlapping codes"]
}
```

Generate aggregate public output. Keep the real record matrix private.

### WP-6 v1.1 field patch and verification

The existing V2 test Base is treated as already created under v1.0. Apply only the v1.1 delta after producing a dry-run patch plan.

Verify:

- field existence
- field type
- enum values
- default behavior
- write/read behavior
- invalid value rejection
- rollback procedure

Do not migrate real business records.

### WP-7 New Dry Run

Run the classifier against the private export. Publish only aggregate results and sanitized examples.

Automatically compute:

```text
Customer MIGRATABLE >= 5
Project MIGRATABLE >= 5
Model MIGRATABLE >= 10
Makeup MIGRATABLE >= 10
```

Even when the threshold is met, do not start the Pilot. Stop for external audit and user approval.

## Required final package

- `reports/security-scan-report.md`
- `schemas/schema-diff-v1.0-to-v1.1.json`
- `reports/classification-reason-summary.json`
- `reports/classifier-test-report.md`
- `reports/v1.1-field-write-path-report.md`
- new migration review report
- new GPT audit package
- updated `config/public-execution-manifest.json`
