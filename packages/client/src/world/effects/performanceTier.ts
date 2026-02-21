export type PerformanceTier = "High" | "Medium" | "Low";

export type PerformanceTierState = {
  tier: PerformanceTier;
  enabledPasses: {
    bloom: boolean;
    scanline: boolean;
    noise: boolean;
    vignette: boolean;
    ripple: boolean;
    resonance: boolean;
  };
  maxActiveEffects: number;
};

const downgradeTier = (tier: PerformanceTier): PerformanceTier => {
  if (tier === "High") return "Medium";
  if (tier === "Medium") return "Low";
  return "Low";
};

export const derivePerformanceTier = (avgFps: number, activeEffects: number): PerformanceTierState => {
  let tier: PerformanceTier = avgFps >= 50 ? "High" : avgFps >= 30 ? "Medium" : "Low";

  if (activeEffects >= 10) {
    tier = downgradeTier(tier);
  }

  if (tier === "High") {
    return {
      tier,
      enabledPasses: {
        bloom: true,
        scanline: true,
        noise: true,
        vignette: true,
        ripple: true,
        resonance: true,
      },
      maxActiveEffects: 8,
    };
  }

  if (tier === "Medium") {
    return {
      tier,
      enabledPasses: {
        bloom: true,
        scanline: true,
        noise: false,
        vignette: true,
        ripple: true,
        resonance: true,
      },
      maxActiveEffects: 5,
    };
  }

  return {
    tier,
    enabledPasses: {
      bloom: false,
      scanline: true,
      noise: false,
      vignette: false,
      ripple: false,
      resonance: false,
    },
    maxActiveEffects: 3,
  };
};

export const shouldEnterSafeMode = (params: {
  avgFps: number;
  consecutiveSlowFrames: number;
  fatalShaderError: boolean;
}): boolean => {
  if (params.fatalShaderError) return true;
  return params.avgFps < 12 && params.consecutiveSlowFrames >= 30;
};
