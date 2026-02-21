import { describe, expect, it } from "bun:test";
import { MINIMAL_INLINE_FALLBACK_SVG } from "./fallbackSpriteAssets";
import { FallbackSpriteStore } from "./fallbackSpriteStore";

describe("FallbackSpriteStore", () => {
  it("returns inline fallback before preload", () => {
    const store = new FallbackSpriteStore();
    expect(store.isReady()).toBeFalse();
    expect(store.getFallbackSprite("tree")).toBe(MINIMAL_INLINE_FALLBACK_SVG);
  });

  it("marks ready and serves default sprite after successful preload", async () => {
    const originalImage = globalThis.Image;

    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    try {
      // @ts-expect-error test-only override
      globalThis.Image = MockImage;
      const store = new FallbackSpriteStore();
      await store.preload();

      expect(store.isReady()).toBeTrue();
      expect(store.getFallbackSprite("tree")).toBe("/fallback-sprites/default-fallback.png");
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it("falls back to inline svg when preload fails", async () => {
    const originalImage = globalThis.Image;

    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onerror?.();
        });
      }
    }

    try {
      // @ts-expect-error test-only override
      globalThis.Image = MockImage;
      const store = new FallbackSpriteStore();
      await store.preload();

      expect(store.isReady()).toBeTrue();
      expect(store.getFallbackSprite("tree")).toBe(MINIMAL_INLINE_FALLBACK_SVG);
    } finally {
      globalThis.Image = originalImage;
    }
  });
});
