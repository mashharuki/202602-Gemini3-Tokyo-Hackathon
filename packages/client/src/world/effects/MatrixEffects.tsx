import { Bloom, EffectComposer, Noise, Scanline, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export const MatrixEffects = () => {
  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom intensity={1.2} luminanceThreshold={0.1} luminanceSmoothing={0.9} mipmapBlur />
      <Scanline blendFunction={BlendFunction.OVERLAY} density={1.5} opacity={0.3} />
      <Noise opacity={0.05} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
      <Vignette eskil={false} offset={0.1} darkness={1.1} />
    </EffectComposer>
  );
};
