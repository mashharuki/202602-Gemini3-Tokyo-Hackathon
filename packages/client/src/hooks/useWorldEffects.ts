import { useEntityQuery } from "@latticexyz/react";
import { getComponentValue, Has } from "@latticexyz/recs";
import { useEffect, useMemo, useRef } from "react";
import { useMUD } from "../context/MUDContext";
import { recordWorldLifecycleEvent } from "../world/effects/worldLifecycleLog";

export type WorldEffectData = {
  zoneId: string;
  effect: "ripple" | "resonance" | "neon" | "scanline";
  color: string;
  intensity: number;
  x: number;
  y: number;
};

type RawWorldEffectEntry = {
  zoneId: string;
  value: unknown;
};

const EFFECT_SET = new Set<WorldEffectData["effect"]>(["ripple", "resonance", "neon", "scanline"]);

const normalizeEffect = (value: unknown): WorldEffectData["effect"] | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/^0x/i, "").toLowerCase().replace(/\0/g, "").trim();
  if (EFFECT_SET.has(normalized as WorldEffectData["effect"])) return normalized as WorldEffectData["effect"];
  return null;
};

const normalizeColor = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  if (/^0x[0-9a-fA-F]{6}$/.test(value)) return `#${value.slice(2).toLowerCase()}`;
  return null;
};

const normalizeIntensity = (value: unknown): number | null => {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(Number(value));
  if (rounded < 0 || rounded > 100) return null;
  return rounded;
};

const hashZone = (zoneId: string): number => {
  let hash = 0;
  for (let i = 0; i < zoneId.length; i += 1) {
    hash = (hash * 31 + zoneId.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const defaultPositionFromZone = (zoneId: string): { x: number; y: number } => {
  const hash = hashZone(zoneId);
  return {
    x: ((hash & 0xff) % 21) - 10,
    y: (((hash >> 8) & 0xff) % 21) - 10,
  };
};

const normalizeCoordinate = (value: unknown): number | null => {
  if (!Number.isFinite(value)) return null;
  return Number(value);
};

export const sanitizeWorldEffects = (
  entries: RawWorldEffectEntry[],
  previous: WorldEffectData[],
): WorldEffectData[] => {
  if (entries.length === 0) return previous;

  const previousByZone = new Map(previous.map((item) => [item.zoneId, item]));
  const result: WorldEffectData[] = [];

  for (const entry of entries) {
    const fallback = previousByZone.get(entry.zoneId);
    const raw = typeof entry.value === "object" && entry.value !== null ? (entry.value as Record<string, unknown>) : null;
    if (!raw) {
      if (fallback) result.push(fallback);
      continue;
    }

    const effect = normalizeEffect(raw.effect);
    const color = normalizeColor(raw.color);
    const intensity = normalizeIntensity(raw.intensity);

    if (!effect || !color || intensity === null) {
      if (fallback) result.push(fallback);
      continue;
    }

    const defaultPosition = defaultPositionFromZone(entry.zoneId);
    const x = normalizeCoordinate(raw.x) ?? defaultPosition.x;
    const y = normalizeCoordinate(raw.y) ?? defaultPosition.y;

    result.push({
      zoneId: entry.zoneId,
      effect,
      color,
      intensity,
      x,
      y,
    });
  }

  return result.length > 0 ? result : previous;
};

export const useWorldEffects = (): WorldEffectData[] => {
  const {
    components: { WorldEffect },
  } = useMUD();

  const effectEntities = useEntityQuery([Has(WorldEffect)]);
  const previousRef = useRef<WorldEffectData[]>([]);

  const entries = useMemo(
    () =>
      effectEntities.map((entity) => ({
        zoneId: String(entity),
        value: getComponentValue(WorldEffect, entity),
      })),
    [WorldEffect, effectEntities],
  );

  const normalized = useMemo(() => sanitizeWorldEffects(entries, previousRef.current), [entries]);

  useEffect(() => {
    previousRef.current = normalized;
  }, [normalized]);

  useEffect(() => {
    recordWorldLifecycleEvent("update_received", { effects: normalized.length });
  }, [normalized]);

  return normalized;
};
