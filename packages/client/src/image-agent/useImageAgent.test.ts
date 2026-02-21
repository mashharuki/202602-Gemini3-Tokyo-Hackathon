import { describe, expect, it } from "bun:test";
import { createImageAgentCoordinator, type SpawnRecordSnapshot } from "./useImageAgent";
import type { AssetRecord } from "./imageAgentService";

const createAssetRecord = (requestId: string): AssetRecord => ({
  requestId,
  spawnInput: { type: "tree", x: 1, y: 2 },
  textureDataUrl: "data:image/png;base64,QUJDRA==",
  fallbackUsed: false,
  fallbackReason: null,
  duplicateOf: null,
  state: "GENERATED",
  createdAt: 1700000000000,
  resolvedAt: 1700000000100,
});

describe("createImageAgentCoordinator", () => {
  it("processes only new spawn records and resolves assets", async () => {
    const calls: SpawnRecordSnapshot[] = [];
    const resolved: Array<{ spawnRecordId: string; requestId: string }> = [];

    const coordinator = createImageAgentCoordinator({
      imageAgentService: {
        resolveAsset: async (spawnInput) => {
          calls.push({ spawnRecordId: `${spawnInput.type}-${spawnInput.x}-${spawnInput.y}`, ...spawnInput });
          return createAssetRecord(`req-${calls.length}`);
        },
        getFallbackRate: () => 0,
      },
      onAssetResolved: (asset) => {
        resolved.push({ spawnRecordId: asset.spawnRecordId, requestId: asset.requestId });
      },
      onProcessingChange: () => undefined,
      onFallbackRateChange: () => undefined,
    });

    await coordinator.sync([
      { spawnRecordId: "s1", type: "tree", x: 1, y: 2 },
      { spawnRecordId: "s2", type: "rock", x: 3, y: 4 },
    ]);

    expect(calls.length).toBe(2);
    expect(resolved.map((item) => item.spawnRecordId)).toEqual(["s1", "s2"]);
  });

  it("does not process duplicated spawnRecordId twice", async () => {
    let callCount = 0;
    const coordinator = createImageAgentCoordinator({
      imageAgentService: {
        resolveAsset: async () => {
          callCount += 1;
          return createAssetRecord(`req-${callCount}`);
        },
        getFallbackRate: () => 0,
      },
      onAssetResolved: () => undefined,
      onProcessingChange: () => undefined,
      onFallbackRateChange: () => undefined,
    });

    const same = { spawnRecordId: "s1", type: "tree", x: 1, y: 2 };
    await coordinator.sync([same]);
    await coordinator.sync([same]);

    expect(callCount).toBe(1);
    expect(coordinator.getProcessedSpawnIds()).toEqual(["s1"]);
  });

  it("publishes processing state and fallback rate", async () => {
    const processingStates: boolean[] = [];
    const fallbackRates: number[] = [];

    const coordinator = createImageAgentCoordinator({
      imageAgentService: {
        resolveAsset: async () => createAssetRecord("req-1"),
        getFallbackRate: () => 0.34,
      },
      onAssetResolved: () => undefined,
      onProcessingChange: (value) => processingStates.push(value),
      onFallbackRateChange: (value) => fallbackRates.push(value),
    });

    await coordinator.sync([{ spawnRecordId: "s1", type: "tree", x: 1, y: 2 }]);

    expect(processingStates[0]).toBeTrue();
    expect(processingStates.at(-1)).toBeFalse();
    expect(fallbackRates.at(-1)).toBe(0.34);
  });
});
