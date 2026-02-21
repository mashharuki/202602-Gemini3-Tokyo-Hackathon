import { describe, expect, it } from "bun:test";
import { matrixWorldSceneConfig } from "./WorldScene";

describe("matrixWorldSceneConfig", () => {
  it("uses night environment and dark-tone foundation", () => {
    expect(matrixWorldSceneConfig.environmentPreset).toBe("night");
    expect(matrixWorldSceneConfig.basePlane.color).toBe("#000000");
    expect(matrixWorldSceneConfig.basePlane.size).toEqual([100, 100]);
  });

  it("configures neon grid and explorable camera controls", () => {
    expect(matrixWorldSceneConfig.grid.sectionColor).toBe("#003b00");
    expect(matrixWorldSceneConfig.grid.cellColor).toBe("#008f11");
    expect(matrixWorldSceneConfig.controls.minDistance).toBe(5);
    expect(matrixWorldSceneConfig.controls.maxDistance).toBe(50);
  });
});
