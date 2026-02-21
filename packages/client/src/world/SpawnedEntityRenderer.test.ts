import { describe, expect, it } from "bun:test";
import { DEFAULT_SPAWN_POSITION, createSpawnPlacements } from "./SpawnedEntityRenderer";
import type { ResolvedSpawnedAsset } from "../image-agent/useImageAgent";

const createAsset = (
  requestId: string,
  overrides: Partial<ResolvedSpawnedAsset> = {},
): ResolvedSpawnedAsset => ({
  requestId,
  spawnRecordId: `spawn-${requestId}`,
  spawnInput: { type: "tree", x: 4, y: 6 },
  textureDataUrl: "data:image/png;base64,QUJDRA==",
  fallbackUsed: false,
  fallbackReason: null,
  duplicateOf: null,
  state: "GENERATED",
  createdAt: 1,
  resolvedAt: 2,
  ...overrides,
});

describe("createSpawnPlacements", () => {
  it("creates sprite placements from resolved assets", () => {
    const placements = createSpawnPlacements([createAsset("req-1")]);

    expect(placements.length).toBe(1);
    expect(placements[0].requestId).toBe("req-1");
    expect(placements[0].position).toEqual([4, 0.5, 6]);
  });

  it("skips duplicated request ids", () => {
    const placements = createSpawnPlacements([createAsset("req-1"), createAsset("req-1")]);
    expect(placements.length).toBe(1);
  });

  it("uses safe default placement when coordinates are invalid", () => {
    const placements = createSpawnPlacements([
      createAsset("req-1", {
        spawnInput: { type: "tree", x: Number.NaN as never, y: Number.NaN as never },
      }),
    ]);

    expect(placements[0].position).toEqual(DEFAULT_SPAWN_POSITION);
  });
});
