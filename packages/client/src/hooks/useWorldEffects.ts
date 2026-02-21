import { useEntityQuery } from "@latticexyz/react";
import { getComponentValueStrict, Has } from "@latticexyz/recs";
import { useMUD } from "../context/MUDContext";

export type WorldEffectData = {
    zoneId: string;
    effect: string;
    color: string;
    intensity: number;
};

export const useWorldEffects = (): WorldEffectData[] => {
  const {
    components: { WorldEffect },
  } = useMUD();

  const effectEntities = useEntityQuery([Has(WorldEffect)]);

  return effectEntities.map((entity) => {
    const value = getComponentValueStrict(WorldEffect, entity);
    // zoneId is not part of WorldEffect value; use entity id as stable key.
    return {
      zoneId: String(entity),
      effect: value.effect,
      color: value.color,
      intensity: value.intensity,
    };
  });
};
