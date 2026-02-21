import { describe, expect, it } from "bun:test";
import { derivePerformanceTier, shouldEnterSafeMode } from "./performanceTier";

describe("derivePerformanceTier", () => {
  it("returns High tier with all passes on healthy fps", () => {
    const tier = derivePerformanceTier(58, 3);
    expect(tier.tier).toBe("High");
    expect(tier.enabledPasses.bloom).toBeTrue();
    expect(tier.enabledPasses.resonance).toBeTrue();
  });

  it("drops to Medium tier under moderate load", () => {
    const tier = derivePerformanceTier(34, 4);
    expect(tier.tier).toBe("Medium");
    expect(tier.enabledPasses.noise).toBeFalse();
    expect(tier.enabledPasses.bloom).toBeTrue();
  });

  it("drops to Low tier and disables expensive passes on low fps", () => {
    const tier = derivePerformanceTier(18, 6);
    expect(tier.tier).toBe("Low");
    expect(tier.enabledPasses.bloom).toBeFalse();
    expect(tier.enabledPasses.ripple).toBeFalse();
  });

  it("downgrades one extra step when effect count is excessive", () => {
    const tier = derivePerformanceTier(52, 12);
    expect(tier.tier).toBe("Medium");
  });
});

describe("shouldEnterSafeMode", () => {
  it("enters safe mode when fatal shader error occurs", () => {
    expect(shouldEnterSafeMode({ avgFps: 60, consecutiveSlowFrames: 0, fatalShaderError: true })).toBeTrue();
  });

  it("enters safe mode when fps remains critically low", () => {
    expect(shouldEnterSafeMode({ avgFps: 10, consecutiveSlowFrames: 35, fatalShaderError: false })).toBeTrue();
  });

  it("does not enter safe mode for transient slowdown", () => {
    expect(shouldEnterSafeMode({ avgFps: 20, consecutiveSlowFrames: 8, fatalShaderError: false })).toBeFalse();
  });
});
