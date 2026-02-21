import { describe, expect, it } from "bun:test";
import { decodeBase64ToArrayBuffer, floatTo16BitPCM, parsePcmRate } from "./pcm-utils";

describe("floatTo16BitPCM", () => {
  it("converts and clamps float samples to 16-bit PCM", () => {
    const input = new Float32Array([-2.0, -1.0, 0.0, 1.0, 2.0]);
    const result = floatTo16BitPCM(input);

    expect(result).toBeInstanceOf(Int16Array);
    expect(Array.from(result)).toEqual([-32768, -32768, 0, 32767, 32767]);
  });
});

describe("parsePcmRate", () => {
  it("extracts rate from pcm mime type", () => {
    expect(parsePcmRate("audio/pcm;rate=24000", 16000)).toBe(24000);
  });

  it("returns fallback for invalid mime type", () => {
    expect(parsePcmRate("audio/wav", 16000)).toBe(16000);
    expect(parsePcmRate("audio/pcm;rate=abc", 22050)).toBe(22050);
  });
});

describe("decodeBase64ToArrayBuffer", () => {
  it("decodes base64 string into ArrayBuffer", () => {
    const buffer = decodeBase64ToArrayBuffer("AQID");
    const view = new Uint8Array(buffer);
    expect(Array.from(view)).toEqual([1, 2, 3]);
  });
});
