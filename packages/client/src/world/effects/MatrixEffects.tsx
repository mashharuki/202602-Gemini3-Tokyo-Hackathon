import { Bloom, EffectComposer, Noise, Scanline, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import type { WorldEffectData } from "../../hooks/useWorldEffects";
import { computeMatrixComposerState, prioritizeActiveEffects } from "./effectCompositor";
import type { PerformanceTierState } from "./performanceTier";

export const matrixEffectsConfig = {
  bloom: {
    enabled: true,
    intensity: 0.9,
    luminanceThreshold: 0.28,
    luminanceSmoothing: 0.75,
    mipmapBlur: true,
  },
  scanline: {
    enabled: true,
    blendFunction: BlendFunction.OVERLAY,
    density: 1.35,
    opacity: 0.26,
  },
  noise: {
    opacity: 0.05,
    premultiply: true,
    blendFunction: BlendFunction.SOFT_LIGHT,
  },
  vignette: {
    eskil: false,
    offset: 0.1,
    darkness: 1.1,
  },
};

type MatrixEffectsProps = {
  activeEffects: WorldEffectData[];
  tierState: PerformanceTierState;
};

export const MatrixEffects = ({ activeEffects, tierState }: MatrixEffectsProps) => {
  if (!Array.isArray(activeEffects) || !tierState?.enabledPasses) {
    return null;
  }

  const hasAnyEnabledPass = Object.values(tierState.enabledPasses).some(Boolean);
  if (!hasAnyEnabledPass) {
    return null;
  }

  const prioritizedEffects = prioritizeActiveEffects(activeEffects, tierState.maxActiveEffects);
  const composerState = computeMatrixComposerState(prioritizedEffects);

  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        intensity={tierState.enabledPasses.bloom ? composerState.bloomIntensity : 0}
        luminanceThreshold={tierState.enabledPasses.bloom ? composerState.bloomThreshold : 1}
        luminanceSmoothing={composerState.bloomSmoothing}
        mipmapBlur={matrixEffectsConfig.bloom.mipmapBlur}
      />
      <Scanline
        blendFunction={composerState.scanlineBlendFunction}
        density={composerState.scanlineDensity}
        opacity={composerState.scanlineOpacity}
      />
      <Noise
        opacity={tierState.enabledPasses.noise ? matrixEffectsConfig.noise.opacity : 0}
        premultiply={matrixEffectsConfig.noise.premultiply}
        blendFunction={matrixEffectsConfig.noise.blendFunction}
      />
      <Vignette
        eskil={matrixEffectsConfig.vignette.eskil}
        offset={matrixEffectsConfig.vignette.offset}
        darkness={tierState.enabledPasses.vignette ? matrixEffectsConfig.vignette.darkness : 0}
      />
    </EffectComposer>
  );
};
