# Task Completion Checklist
- Run targeted checks for changed area:
  - Client changes: `cd tutorial/packages/client && pnpm test`.
  - Contract changes: `cd tutorial/packages/contracts && pnpm test` and `pnpm lint` when Solidity changed.
- Run workspace-level verification when needed: `cd tutorial && pnpm test` and `pnpm build`.
- Ensure generated/codegen artifacts and formatting are consistent before finalizing.
- Summarize modified files and any residual risks/tests not run.