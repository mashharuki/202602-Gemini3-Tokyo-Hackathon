import { describe, expect, it } from "bun:test";
import type { WorldEffectData } from "../../hooks/useWorldEffects";
import { buildShaderTargets, computeMatrixComposerState, prioritizeActiveEffects } from "./effectCompositor";
import { BlendFunction } from "postprocessing";

const effect = (
  kind: WorldEffectData["effect"],
  overrides: Partial<WorldEffectData> = {},
): WorldEffectData => ({
  zoneId: `${kind}-${Math.random()}`,
  effect: kind,
  color: "#00ff41",
  intensity: 60,
  x: 1,
  y: 2,
  ...overrides,
});

describe("prioritizeActiveEffects", () => {
  it("keeps highest-priority effects when overload happens", () => {
    const prioritized = prioritizeActiveEffects(
      [
        effect("scanline", { zoneId: "s-1" }),
        effect("neon", { zoneId: "n-1" }),
        effect("resonance", { zoneId: "r-1" }),
        effect("ripple", { zoneId: "rp-1" }),
      ],
      2,
    );

    expect(prioritized.map((item) => item.zoneId)).toEqual(["r-1", "rp-1"]);
  });
});

describe("computeMatrixComposerState", () => {
  it("reduces bloom/scanline intensity as active effects increase", () => {
    const lowLoad = computeMatrixComposerState([effect("neon")]);
    const highLoad = computeMatrixComposerState([
      effect("neon"),
      effect("scanline"),
      effect("ripple"),
      effect("resonance"),
    ]);

    expect(highLoad.bloomIntensity).toBeLessThan(lowLoad.bloomIntensity);
    expect(highLoad.scanlineOpacity).toBeLessThan(lowLoad.scanlineOpacity);
  });

  it("switches blend function by dominant effect category", () => {
    const resonanceHeavy = computeMatrixComposerState([effect("resonance"), effect("resonance"), effect("neon")]);
    const rippleHeavy = computeMatrixComposerState([effect("ripple"), effect("ripple"), effect("neon")]);

    expect(resonanceHeavy.scanlineBlendFunction).toBe(BlendFunction.ADD);
    expect(rippleHeavy.scanlineBlendFunction).toBe(BlendFunction.SCREEN);
  });
});

describe("buildShaderTargets", () => {
  it("creates ripple/resonance targets from world effects", () => {
    const targets = buildShaderTargets([
      effect("ripple", { zoneId: "ripple-1", x: 10, y: -4, intensity: 70 }),
      effect("resonance", { zoneId: "res-1", x: -3, y: 8, intensity: 45 }),
      effect("neon", { zoneId: "n-1" }),
    ]);

    expect(targets.ripple).toHaveLength(1);
    expect(targets.resonance).toHaveLength(1);
    expect(targets.ripple[0].position).toEqual([10, 0.12, -4]);
    expect(targets.resonance[0].position).toEqual([-3, 0.6, 8]);
  });
});
