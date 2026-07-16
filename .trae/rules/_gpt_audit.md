# GPT Audit Package Rule

## Trigger

Generate an audit package whenever a Phase or remediation gate is completed, or whenever Schema, migration classification, write paths, security policy or automation behavior changes.

## Required eight-part package

1. Work completed
2. Key facts discovered
3. Differences between documentation and real system
4. Unresolved issues and blockers
5. Files created or modified
6. Commands, tests and exit codes
7. Acceptance decision
8. Next-step recommendation without automatic execution

## Evidence metadata

For each evidence file include:

- repository-relative path
- Git commit SHA
- Git blob SHA where available
- generator command
- command exit code
- file SHA256
- evidence classification

Evidence classification must be one of:

- `INDEPENDENTLY_VERIFIED`
- `REPRODUCIBLE_FROM_PUBLIC_REPO`
- `SELF_REPORTED`
- `PRIVATE_EVIDENCE_NOT_PUBLIC`
- `NOT_VERIFIED`

## Audit package safety

The package must not include real Feishu identifiers, customer information, raw exports or secrets. Use stable aliases and aggregate counts.

## Gate behavior

If a mandatory item is missing, mark the relevant item `NOT_VERIFIED`. Do not infer success from the existence of a file or from a zero exit code alone.
