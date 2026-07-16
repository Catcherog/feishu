# Trae Execution Prompt

This file intentionally contains no phase-specific implementation details.

For every new session:

1. Synchronize the local repository with `origin/master` using a fast-forward-only pull.
2. Read and follow `PUBLIC_EXECUTION_ENTRYPOINT.md`.
3. Read `config/public-execution-manifest.json` before taking any action.
4. Treat older conversation memory and older phase prompts as non-authoritative.
5. Stop whenever the current gate acceptance conditions are not met.

The currently authorized phase is defined only in the public execution manifest.
