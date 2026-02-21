# Suggested Commands
- `npm install` or `pnpm install` at root to install dependencies.
- `npm run dev` or `pnpm dev` at root to run the development server.
- `npm run build` or `pnpm build` at root for recursive builds.
- `npm run test` or `pnpm test` at root for recursive tests.
- Uses `mprocs` for running concurrent dev scripts (`pnpm dev`).
- `pnpm --filter 'client' run dev` (client dev) and `pnpm --filter 'contracts' dev` (contracts dev).
- Exploration commands: `ls -la`, `find . -maxdepth N -type f`, `rg --files`, `rg "pattern"`.