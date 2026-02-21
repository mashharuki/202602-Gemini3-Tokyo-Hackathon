import { describe, expect, it } from "bun:test";
import type { WorldPatchJSON } from "./types";
import { applyWorldPatchFromAgent, handleDownstreamMessage, validateWorldPatch } from "./world-patch-handler";

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

  it("keeps adk text response as chat payload even when it includes JSON block", () => {
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
    expect(parsed.type).toBe("adkEvent");
    if (parsed.type === "adkEvent") {
      const joinedText = (parsed.payload.content?.parts ?? [])
        .map((part) => part.text)
        .filter((value): value is string => typeof value === "string")
        .join("\n");
      expect(joinedText).toContain("storm incoming");
    }
  });

  it("parses wrapped adkEvent payload and preserves text/audio parts", () => {
    const wrappedEvent = JSON.stringify({
      type: "adkEvent",
      payload: {
        finished: true,
        content: {
          parts: [
            { text: "こんにちは" },
            {
              inline_data: {
                mime_type: "audio/pcm;rate=24000",
                data: "AQACAA==",
              },
            },
          ],
        },
      },
    });

    const parsed = handleDownstreamMessage(wrappedEvent);
    expect(parsed.type).toBe("adkEvent");
    if (parsed.type === "adkEvent") {
      expect(parsed.payload.turnComplete).toBeTrue();
      expect(parsed.payload.content?.parts?.[0]?.text).toBe("こんにちは");
      expect(parsed.payload.content?.parts?.[1]?.inlineData?.mimeType).toBe("audio/pcm;rate=24000");
      expect(parsed.payload.content?.parts?.[1]?.inlineData?.data).toBe("AQACAA==");
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

  it("adds output transcription text when payload contains only audio parts", () => {
    const event = JSON.stringify({
      type: "adkEvent",
      payload: {
        content: {
          parts: [
            {
              inlineData: {
                mimeType: "audio/pcm;rate=24000",
                data: "AQACAA==",
              },
            },
          ],
        },
        output_transcription: {
          text: "音声の文字起こしです",
        },
      },
    });

    const parsed = handleDownstreamMessage(event);
    expect(parsed.type).toBe("adkEvent");
    if (parsed.type === "adkEvent") {
      const textParts = parsed.payload.content?.parts?.filter((part) => typeof part.text === "string") ?? [];
      expect(textParts.length).toBe(1);
      expect(textParts[0]?.text).toBe("音声の文字起こしです");
    }
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
