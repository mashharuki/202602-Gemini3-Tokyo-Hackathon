import { describe, expect, it } from "bun:test";
import { matrixEffectsConfig } from "./MatrixEffects";

describe("matrixEffectsConfig", () => {
  it("enables scanline and bloom for matrix-style look", () => {
    expect(matrixEffectsConfig.scanline.enabled).toBeTrue();
    expect(matrixEffectsConfig.bloom.enabled).toBeTrue();
  });

  it("keeps bloom tuning readable without over-saturation", () => {
    expect(matrixEffectsConfig.bloom.intensity).toBeLessThanOrEqual(1);
    expect(matrixEffectsConfig.bloom.luminanceThreshold).toBeGreaterThanOrEqual(0.2);
  });
});
