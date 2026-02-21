# Implementation Gap Analysis: feature-threejs-world

## Analysis Summary
- **Current State**: Phase 1 (Core World) and basic Phase 2 (MUD Integration) are implemented. Matrix visuals and basic on-chain effect triggers are functional.
- **Major Gaps**:
  - **Requirement 2 (Specific Effects)**: `pointLight` and `mesh` are generic. Need specific filters for Ripple, Resonance, etc.
  - **Requirement 3 (Compositing)**: Multiple effects currently overlay without intelligent blending or visibility thresholding.
  - **Requirement 5 (Reliability)**: Frame rate monitoring and LOD (Level of Detail) scaling are missing.
- **Recommendations**: Use a **Hybrid Approach**. Extend `WorldEffectRenderer` for specialized effects and introduce an `EffectCompositor` for multi-effect management.

## Requirement-to-Asset Map

| Requirement | Asset | Status | Gap/Constraint |
| :--- | :--- | :--- | :--- |
| **R1: Matrix World Rendering** | `WorldScene.tsx`, `MatrixEffects.tsx` | **Implemented** | Visual tone is established. |
| **R2: Immediate Effect Reflection** | `useWorldEffects.ts`, `WorldEffectRenderer.tsx` | **Partial** | Basic light/sphere reflection works. Missing specific "Ripple/Resonance" visuals. |
| **R3: Effect Compositing** | `WorldEffectRenderer.tsx` | **Missing** | No logic for blending or "visibility threshold" as required. |
| **R4: MUD Integration** | `App.tsx`, `useWorldEffects.ts` | **Implemented** | Successfully integrated with MUD `WorldEffect` component. |
| **R5: Demo Reliability/Perf** | N/A | **Missing** | Need quality scaling (LOD) for high-load demo scenarios. |
| **R6: Traceability** | `task.md`, `walkthrough.md` | **Implemented** | Documentation tracks requirement fulfillment. |

## Implementation Approach Options

### Option A: Extend WorldEffectRenderer (Low Effort)
- **Rationale**: Add `switch` logic for effect types within the existing renderer.
- **Trade-offs**: ✅ Fast, no new files. ❌ Likely to become a "God Component" as effect variety increases.

### Option B: Specialized Effect Components (Recommended)
- **Rationale**: Create `RippleEffect.tsx`, `ResonanceEffect.tsx`, etc., managed by a central `WorldEffectRenderer`.
- **Trade-offs**: ✅ Modular, easier to test. ❌ More files to manage.

## Effort & Risk
- **Effort**: **M (3-5 days)**
  - Core visuals are done, but specialized shaders (Requirement 2) and compositing logic (Requirement 3) require significant effort.
- **Risk**: **Medium**
  - R3F post-processing can have performance overhead; "visibility threshold" logic needs careful design to avoid flickering.

## Next Steps for Design Phase
1. **Shaders Research**: Research custom shaders for "Digital Rain" and "Resonance" effects.
2. **Compositing Strategy**: Define how to sort and blend concurrent effects in `EffectComposer`.
3. **LOD implementation**: Plan a simple quality tiers system (High/Medium/Low) based on frame time.
