# Public Repository Execution Rule

## Trigger

Apply this rule to every task performed in the `Catcherog/feishu` repository.

## Mandatory startup

Before editing files or invoking Feishu APIs:

1. Run `git status --short`.
2. Record `git rev-parse HEAD`.
3. Read `PUBLIC_EXECUTION_ENTRYPOINT.md`.
4. Read `config/public-execution-manifest.json`.
5. Confirm the requested action appears in `approved_actions`.
6. Confirm it does not appear in `prohibited_actions`.

If any file is missing, malformed or contradictory, stop and report `EXECUTION_MANIFEST_INVALID`.

## Public/private boundary

Public repository may contain:

- schemas and generated schema diffs
- source code
- synthetic fixtures
- aggregate statistics
- test commands and exit codes
- sanitized audit reports
- file hashes and Git commit/blob hashes
- aliases such as `SOURCE_BASE_ALIAS`

Public repository must not contain:

- real Feishu app/base/table/field/record identifiers
- credentials, access tokens, app secrets or API keys
- customer names, phone numbers, WeChat identifiers or raw conversations
- customer images, attachments or private planning documents
- private resource maps
- raw Base exports
- record-level classification matrices derived from real data

Private-only paths include:

- `config/*.local.*`
- `backups/private/**`
- `reports/private/**`
- `.env*`
- local credential stores

## Execution behavior

- Use aliases in public logs.
- Use dry-run by default.
- Require explicit user approval for real writes.
- Generate idempotency keys for all write operations.
- Never delete old Base data during remediation.
- Do not continue automatically across a gate.

## Completion

Every gate completion must generate a public audit package according to `.trae/rules/_gpt_audit.md` and run `scripts/verify_public_repo.py`.
