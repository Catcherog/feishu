# Public Audit Policy

## Purpose

This repository is public so that architecture, migration rules, tests and engineering decisions can be reviewed. Public auditability must not expose operational identifiers or personal information.

## Two-tier evidence model

### Public evidence

Allowed:

- versioned schemas
- schema diffs
- source code
- synthetic fixtures
- aggregate statistics
- reason-code definitions
- test reports
- sanitized architecture diagrams
- Git and file hashes
- redacted audit conclusions

### Private evidence

Local only:

- Feishu Base, Table, Field and record identifiers
- App credentials
- raw exports
- record-level matrices based on real data
- customer and resource personal data
- raw chats, screenshots, images, audio and attachments
- private Feishu document URLs

Public reports may state that private evidence exists, its hash and its verification status, but may not reproduce it.

## Alias convention

Use:

- `SOURCE_BASE_ALIAS`
- `TARGET_V2_BASE_ALIAS`
- `CUSTOMER_TABLE_ALIAS`
- `PROJECT_TABLE_ALIAS`
- `RESOURCE_TABLE_ALIAS`

Do not partially mask real identifiers. Replace the entire identifier with an alias.

## Audit result levels

- `PASS`: all mandatory public and private checks are verified.
- `PASS_WITH_CONDITIONS`: no critical issue; limited documented conditions remain.
- `FAIL_REMEDIATION_REQUIRED`: material evidence, reproducibility or security issue.
- `HOLD`: work must not progress to the next gate.

## Publication checklist

Before every push:

1. Run `python scripts/verify_public_repo.py`.
2. Review `git diff --cached`.
3. Confirm no private files are staged.
4. Confirm all identifiers in reports are aliases.
5. Confirm fixtures are synthetic.
6. Confirm screenshots contain no personal data.
