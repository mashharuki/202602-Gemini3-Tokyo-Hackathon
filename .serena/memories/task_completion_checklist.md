# Task Completion Checklist
- Verify changes align with the EGO project concept (voice-driven world patching, stable JSON schema generation).
- Run targeted checks for the changed area (e.g., client or contracts).
- For AI/Gemini integration: verify the JSON output strictly adheres to the fixed schema (`effect`, `color`, `intensity`, `spawn`, `caption`).
- For UI/Three.js integration: ensure visual effects (neon/scanline/particles/bloom - matrix style) update properly based on the state.
- Ensure generated/codegen artifacts and formatting are consistent.
- Run workspace-level tests (`npm run test` / `pnpm test`) and builds before finalizing.
- Summarize modified files and state any residual risks or tests not run.