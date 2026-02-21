import { describe, expect, it } from "bun:test";
import {
  applyWorldPatchFromAgent,
  handleDownstreamMessage,
  validateWorldPatch,
} from "./world-patch-handler";
import type { WorldPatchJSON } from "./types";

describe("handleDownstreamMessage", () => {
  it("parses explicit worldPatch message", () => {
    const text = JSON.stringify({
      type: "worldPatch",
      patch: {
        effect: "aurora",
        color: "#11AA33",
        intensity: 80,
        spawn: null,
        caption: "sky shift",
      },
    });

    const parsed = handleDownstreamMessage(text);
    expect(parsed.type).toBe("worldPatch");
    if (parsed.type === "worldPatch") {
      expect(parsed.patch.effect).toBe("aurora");
    }
  });

  it("extracts world patch JSON block from adk text response", () => {
    const adkEvent = JSON.stringify({
      turnComplete: true,
      content: {
        parts: [
          {
            text: `了解です。
\`\`\`json
{"effect":"storm","color":"#123456","intensity":55,"spawn":{"type":"wolf","x":2,"y":3},"caption":"storm incoming"}
\`\`\``,
          },
        ],
      },
    });

    const parsed = handleDownstreamMessage(adkEvent);
    expect(parsed.type).toBe("worldPatch");
    if (parsed.type === "worldPatch") {
      expect(parsed.patch.spawn?.type).toBe("wolf");
      expect(parsed.patch.intensity).toBe(55);
    }
  });

  it("does not extract patch from normal text response", () => {
    const normalEvent = JSON.stringify({
      content: {
        parts: [{ text: "こんにちは、今日は何をしますか？" }],
      },
    });

    const parsed = handleDownstreamMessage(normalEvent);
    expect(parsed.type).toBe("adkEvent");
  });
});

describe("applyWorldPatchFromAgent", () => {
  it("returns validation error and does not send transaction", async () => {
    let calls = 0;
    const invalidPatch = {
      effect: "",
      color: "#GG0000",
      intensity: 200,
      spawn: { type: "", x: 1.5, y: 2 },
      caption: "bad",
    } as unknown as WorldPatchJSON;

    const result = await applyWorldPatchFromAgent(invalidPatch, {
      applyWorldPatch: async () => {
        calls += 1;
      },
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error).toContain("Invalid world patch");
    }
    expect(calls).toBe(0);
  });
});

describe("validateWorldPatch", () => {
  it("accepts valid patch", () => {
    const patch: WorldPatchJSON = {
      effect: "aurora",
      color: "#AABBCC",
      intensity: 70,
      spawn: null,
      caption: "ok",
    };
    const result = validateWorldPatch(patch);
    expect(result.valid).toBeTrue();
  });
});
