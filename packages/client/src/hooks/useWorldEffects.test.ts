import { describe, expect, it } from "bun:test";
import { sanitizeWorldEffects, type WorldEffectData } from "./useWorldEffects";

const previousState: WorldEffectData[] = [
  {
    zoneId: "zone-a",
    effect: "neon",
    color: "#00ff41",
    intensity: 50,
    x: 1,
    y: 2,
  },
];

describe("sanitizeWorldEffects", () => {
  it("normalizes valid entries and hex color formats", () => {
    const next = sanitizeWorldEffects(
      [
        {
          zoneId: "zone-a",
          value: { effect: "ripple", color: "0x22AA33", intensity: 72, x: 5, y: 6 },
        },
      ],
      previousState,
    );

    expect(next).toEqual([
      {
        zoneId: "zone-a",
        effect: "ripple",
        color: "#22aa33",
        intensity: 72,
        x: 5,
        y: 6,
      },
    ]);
  });

  it("keeps previous valid snapshot when feed is temporarily empty", () => {
    const next = sanitizeWorldEffects([], previousState);
    expect(next).toEqual(previousState);
  });

  it("falls back to previous zone snapshot when invalid payload is received", () => {
    const next = sanitizeWorldEffects(
      [
        {
          zoneId: "zone-a",
          value: { effect: "unknown", color: "#00ff41", intensity: 90 },
        },
      ],
      previousState,
    );

    expect(next).toEqual(previousState);
  });
});
