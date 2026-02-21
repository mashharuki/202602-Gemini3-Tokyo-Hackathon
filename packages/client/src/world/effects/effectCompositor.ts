import { BlendFunction } from "postprocessing";
import type { WorldEffectData } from "../../hooks/useWorldEffects";

type ComposerBase = {
  bloomIntensity: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  scanlineDensity: number;
  scanlineOpacity: number;
};

const BASE: ComposerBase = {
  bloomIntensity: 0.9,
  bloomThreshold: 0.28,
  bloomSmoothing: 0.75,
  scanlineDensity: 1.35,
  scanlineOpacity: 0.26,
};

const PRIORITY: Record<WorldEffectData["effect"], number> = {
  resonance: 0,
  ripple: 1,
  neon: 2,
  scanline: 3,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const prioritizeActiveEffects = (
  activeEffects: WorldEffectData[],
  maxVisible: number,
): WorldEffectData[] => {
  return [...activeEffects]
    .sort((a, b) => PRIORITY[a.effect] - PRIORITY[b.effect])
    .slice(0, Math.max(0, maxVisible));
};

export type MatrixComposerState = {
  bloomIntensity: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  scanlineDensity: number;
  scanlineOpacity: number;
  scanlineBlendFunction: BlendFunction;
};

export const computeMatrixComposerState = (activeEffects: WorldEffectData[]): MatrixComposerState => {
  const total = Math.max(1, activeEffects.length);
  const loadScale = clamp(1 / Math.sqrt(total), 0.55, 1);
  const resonanceCount = activeEffects.filter((effect) => effect.effect === "resonance").length;
  const rippleCount = activeEffects.filter((effect) => effect.effect === "ripple").length;

  const dominantBlend =
    resonanceCount >= rippleCount && resonanceCount > 0
      ? BlendFunction.ADD
      : rippleCount > 0
        ? BlendFunction.SCREEN
        : BlendFunction.OVERLAY;

  return {
    bloomIntensity: clamp(BASE.bloomIntensity * loadScale, 0.35, 0.9),
    bloomThreshold: clamp(BASE.bloomThreshold + (1 - loadScale) * 0.22, 0.2, 0.5),
    bloomSmoothing: BASE.bloomSmoothing,
    scanlineDensity: BASE.scanlineDensity,
    scanlineOpacity: clamp(BASE.scanlineOpacity * loadScale, 0.12, 0.3),
    scanlineBlendFunction: dominantBlend,
  };
};

export type ShaderTarget = {
  key: string;
  position: [number, number, number];
  color: string;
  intensity: number;
};

export type ShaderTargets = {
  ripple: ShaderTarget[];
  resonance: ShaderTarget[];
};

export const buildShaderTargets = (effects: WorldEffectData[]): ShaderTargets => {
  const ripple: ShaderTarget[] = [];
  const resonance: ShaderTarget[] = [];

  for (const effect of effects) {
    if (effect.effect === "ripple") {
      ripple.push({
        key: effect.zoneId,
        position: [effect.x, 0.12, effect.y],
        color: effect.color,
        intensity: effect.intensity,
      });
    }
    if (effect.effect === "resonance") {
      resonance.push({
        key: effect.zoneId,
        position: [effect.x, 0.6, effect.y],
        color: effect.color,
        intensity: effect.intensity,
      });
    }
  }

  return { ripple, resonance };
};
