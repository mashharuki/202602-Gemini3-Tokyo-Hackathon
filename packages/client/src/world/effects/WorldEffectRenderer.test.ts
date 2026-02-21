import { describe, expect, it } from "bun:test";
import { toEffectRenderItems } from "./WorldEffectRenderer";
import type { WorldEffectData } from "../../hooks/useWorldEffects";

const createEffect = (zoneId: string, overrides: Partial<WorldEffectData> = {}): WorldEffectData => ({
  zoneId,
  effect: "neon",
  color: "#00ff41",
  intensity: 60,
  x: 2,
  y: 4,
  ...overrides,
});

describe("toEffectRenderItems", () => {
  it("maps world effects to render positions", () => {
    const items = toEffectRenderItems([createEffect("zone-a", { x: 7, y: -3 })]);

    expect(items).toHaveLength(1);
    expect(items[0].position).toEqual([7, 0.6, -3]);
  });

  it("keeps latest value for duplicated zone ids", () => {
    const items = toEffectRenderItems([
      createEffect("zone-a", { intensity: 10 }),
      createEffect("zone-a", { intensity: 95 }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].intensity).toBe(95);
  });
});
