import { describe, expect, it } from "bun:test";
import { ImageAgentService } from "./imageAgentService";

describe("ImageAgentService task 3.1", () => {
  it("rejects invalid spawn input", () => {
    const service = new ImageAgentService();

    expect(() =>
      service.acceptSpawnRequest(
        {
          type: "",
          x: 1,
          y: 2,
        },
        { effect: "aurora" },
      ),
    ).toThrow("Invalid spawn input");
  });

  it("generates unique request ids and stores accepted state", () => {
    let seq = 0;
    const service = new ImageAgentService({
      createRequestId: () => `req-${++seq}`,
      now: () => 1700000000000,
    });

    const first = service.acceptSpawnRequest({ type: "tree", x: 1, y: 2 }, { id: "patch-1" });
    const second = service.acceptSpawnRequest({ type: "tree", x: 1, y: 2 }, { id: "patch-2" });

    expect(first.requestId).toBe("req-1");
    expect(second.requestId).toBe("req-2");
    expect(first.requestId).not.toBe(second.requestId);
    expect(service.getRequestState(first.requestId)).toBe("ACCEPTED");
  });

  it("keeps relation between request and source patch", () => {
    const service = new ImageAgentService({ createRequestId: () => "req-1" });
    const sourcePatch = {
      effect: "aurora",
      color: "#112233",
      intensity: 80,
      spawn: { type: "tree", x: 1, y: 2 },
      caption: "hello",
    };

    const accepted = service.acceptSpawnRequest(sourcePatch.spawn, sourcePatch);

    expect(service.getAssetRecord(accepted.requestId)?.spawnInput.type).toBe("tree");
    expect(service.getSourcePatch(accepted.requestId)).toEqual(sourcePatch);
  });
});

describe("ImageAgentService task 3.2", () => {
  it("calls /api/generate-image and stores generated asset record", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input, init) => {
        expect(input).toBe("/api/generate-image");
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual({ "content-type": "application/json" });
        expect(init?.body).toBe(JSON.stringify({ entity_type: "tree" }));
        return new Response(JSON.stringify({ image_base64: "QUJDRA==", mime_type: "image/png" }), {
          status: 200,
        });
      };

      const service = new ImageAgentService({
        createRequestId: () => "req-1",
        now: () => 1700000000000,
      });

      const record = await service.resolveAsset(
        { type: "tree", x: 2, y: 3 },
        { id: "patch-1", spawn: { type: "tree", x: 2, y: 3 } },
      );

      expect(record.state).toBe("GENERATED");
      expect(record.textureDataUrl).toBe("data:image/png;base64,QUJDRA==");
      expect(record.resolvedAt).toBe(1700000000000);
      expect(service.getAssetRecord("req-1")?.spawnInput).toEqual({ type: "tree", x: 2, y: 3 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back when image payload is invalid", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ image_base64: "", mime_type: "text/plain" }), {
          status: 200,
        });

      const service = new ImageAgentService({ createRequestId: () => "req-1" });
      const record = await service.resolveAsset(
        { type: "tree", x: 2, y: 3 },
        { id: "patch-1", spawn: { type: "tree", x: 2, y: 3 } },
      );
      expect(record.fallbackUsed).toBeTrue();
      expect(record.fallbackReason).toBe("INVALID_IMAGE");
      expect(record.textureDataUrl).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("ImageAgentService task 3.3", () => {
  it("falls back with API_ERROR when API request fails", async () => {
    const service = new ImageAgentService({
      createRequestId: () => "req-1",
      fetchImpl: async () => {
        throw new Error("network down");
      },
      fallbackSpriteProvider: () => "/fallback-sprites/default-fallback.png",
    });

    const record = await service.resolveAsset(
      { type: "tree", x: 2, y: 3 },
      { id: "patch-1", spawn: { type: "tree", x: 2, y: 3 } },
    );

    expect(record.fallbackUsed).toBeTrue();
    expect(record.fallbackReason).toBe("API_ERROR");
    expect(record.textureDataUrl).toBe("/fallback-sprites/default-fallback.png");
    expect(record.state).toBe("GENERATION_FAILED");
  });

  it("falls back with TIMEOUT when request exceeds timeout", async () => {
    const service = new ImageAgentService({
      createRequestId: () => "req-1",
      fetchImpl: async () => {
        await new Promise<void>(() => undefined);
        return new Response();
      },
      timeoutMs: 5,
      fallbackSpriteProvider: () => "/fallback-sprites/default-fallback.png",
    });

    const record = await service.resolveAsset(
      { type: "tree", x: 2, y: 3 },
      { id: "patch-1", spawn: { type: "tree", x: 2, y: 3 } },
    );

    expect(record.fallbackUsed).toBeTrue();
    expect(record.fallbackReason).toBe("TIMEOUT");
    expect(record.textureDataUrl).toBe("/fallback-sprites/default-fallback.png");
    expect(record.state).toBe("TIMEOUT_FALLBACK");
  });
});

describe("ImageAgentService task 3.4", () => {
  it("records state transitions for each request", async () => {
    const service = new ImageAgentService({
      createRequestId: () => "req-1",
      fetchImpl: async () =>
        new Response(JSON.stringify({ image_base64: "QUJDRA==", mime_type: "image/png" }), {
          status: 200,
        }),
    });

    await service.resolveAsset({ type: "tree", x: 2, y: 3 }, { id: "patch-1" });
    service.markPlaced("req-1");

    const transitions = service.getTransitionLogs("req-1");
    expect(transitions.map((entry) => entry.to)).toEqual([
      "ACCEPTED",
      "GENERATING",
      "GENERATED",
      "PLACED",
    ]);
  });

  it("emits warning event when fallback rate exceeds threshold", async () => {
    const warns: string[] = [];
    let index = 0;
    const service = new ImageAgentService({
      createRequestId: () => `req-${++index}`,
      fallbackWarningThreshold: 0.5,
      logger: {
        info: () => undefined,
        warn: (message: string) => warns.push(message),
      },
      fetchImpl: async () => {
        throw new Error("network down");
      },
      fallbackSpriteProvider: () => "/fallback-sprites/default-fallback.png",
    });

    await service.resolveAsset({ type: "tree", x: 1, y: 2 }, { id: "patch-1" });
    await service.resolveAsset({ type: "tree", x: 3, y: 4 }, { id: "patch-2" });

    expect(service.getFallbackRate()).toBe(1);
    expect(warns.length).toBeGreaterThan(0);
    expect(warns[0]).toContain("fallback rate");
  });

  it("detects duplicate spawn requests and keeps aggregation reference", async () => {
    let index = 0;
    const service = new ImageAgentService({
      createRequestId: () => `req-${++index}`,
      fetchImpl: async () =>
        new Response(JSON.stringify({ image_base64: "QUJDRA==", mime_type: "image/png" }), {
          status: 200,
        }),
      dedupeWindowMs: 10_000,
    });

    const first = await service.resolveAsset({ type: "tree", x: 7, y: 8 }, { id: "patch-1" });
    const second = await service.resolveAsset({ type: "tree", x: 7, y: 8 }, { id: "patch-2" });

    expect(first.requestId).not.toBe(second.requestId);
    expect(second.duplicateOf).toBe(first.requestId);
    expect(service.getDuplicateGroup(first.requestId)).toEqual([first.requestId, second.requestId]);
  });
});
