# Style and Conventions
- Language/tooling: TypeScript + React (client), Solidity + MUD (contracts).
- Node/pnpm requirements from `tutorial/package.json`: Node >= 20, pnpm >= 9.
- Solidity formatting/linting pipeline exists in `packages/contracts` using Prettier + solhint (+ MUD plugins).
- General repo guidance lives in `AGENTS.md` and emphasizes spec-driven development, quality, testing, and security.
- Keep changes small and consistent with existing scripts and package boundaries (`client` vs `contracts`).