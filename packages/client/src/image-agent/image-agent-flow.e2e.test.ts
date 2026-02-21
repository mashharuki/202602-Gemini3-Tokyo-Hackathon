import { describe, expect, it } from "bun:test";
import { createSpawnPlacements } from "../world/SpawnedEntityRenderer";
import { ImageAgentService } from "./imageAgentService";
import { createImageAgentCoordinator, type ResolvedSpawnedAsset } from "./useImageAgent";

describe("image agent end-to-end flow", () => {
  it("resolves spawned entities and converts them to sprite placements", async () => {
    let seq = 0;
    const service = new ImageAgentService({
      createRequestId: () => `req-${++seq}`,
      fetchImpl: async () =>
        new Response(JSON.stringify({ image_base64: "QUJDRA==", mime_type: "image/png" }), {
          status: 200,
        }),
    });

    const resolvedAssets: ResolvedSpawnedAsset[] = [];
    const coordinator = createImageAgentCoordinator({
      imageAgentService: service,
      onAssetResolved: (asset) => resolvedAssets.push(asset),
      onProcessingChange: () => undefined,
      onFallbackRateChange: () => undefined,
    });

    await coordinator.sync([
      { spawnRecordId: "s1", type: "tree", x: 2, y: 3 },
      { spawnRecordId: "s2", type: "rock", x: 4, y: 5 },
      { spawnRecordId: "s1", type: "tree", x: 2, y: 3 },
    ]);

    const placements = createSpawnPlacements(resolvedAssets);
    expect(placements.length).toBe(2);
    expect(placements.map((p) => p.requestId)).toEqual(["req-1", "req-2"]);

    const first = placements.find((placement) => placement.requestId === "req-1");
    expect(first?.position).toEqual([2, 0.5, 3]);

    service.markPlaced("req-1");
    const transitionStates = service.getTransitionLogs("req-1").map((entry) => entry.to);
    expect(transitionStates).toEqual(["ACCEPTED", "GENERATING", "GENERATED", "PLACED"]);
  });

  it("falls back within 1 second on timeout and still yields placement", async () => {
    const service = new ImageAgentService({
      createRequestId: () => "req-1",
      timeoutMs: 10,
      fetchImpl: async () => {
        await new Promise<void>(() => undefined);
        return new Response();
      },
      fallbackSpriteProvider: () => "/fallback-sprites/default-fallback.png",
    });

    const start = Date.now();
    const resolved = await service.resolveAsset(
      { type: "tree", x: 9, y: 11 },
      { id: "patch-timeout", spawn: { type: "tree", x: 9, y: 11 } },
    );
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(resolved.fallbackUsed).toBeTrue();
    expect(resolved.fallbackReason).toBe("TIMEOUT");

    const placements = createSpawnPlacements([
      {
        ...resolved,
        spawnRecordId: "s-timeout",
      },
    ]);
    expect(placements.length).toBe(1);
    expect(placements[0].textureDataUrl).toBe("/fallback-sprites/default-fallback.png");
  });
});
