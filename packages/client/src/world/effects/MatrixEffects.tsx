import { Bloom, EffectComposer, Noise, Scanline, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

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

export const MatrixEffects = () => {
  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        intensity={matrixEffectsConfig.bloom.intensity}
        luminanceThreshold={matrixEffectsConfig.bloom.luminanceThreshold}
        luminanceSmoothing={matrixEffectsConfig.bloom.luminanceSmoothing}
        mipmapBlur={matrixEffectsConfig.bloom.mipmapBlur}
      />
      <Scanline
        blendFunction={matrixEffectsConfig.scanline.blendFunction}
        density={matrixEffectsConfig.scanline.density}
        opacity={matrixEffectsConfig.scanline.opacity}
      />
      <Noise
        opacity={matrixEffectsConfig.noise.opacity}
        premultiply={matrixEffectsConfig.noise.premultiply}
        blendFunction={matrixEffectsConfig.noise.blendFunction}
      />
      <Vignette
        eskil={matrixEffectsConfig.vignette.eskil}
        offset={matrixEffectsConfig.vignette.offset}
        darkness={matrixEffectsConfig.vignette.darkness}
      />
    </EffectComposer>
  );
};
