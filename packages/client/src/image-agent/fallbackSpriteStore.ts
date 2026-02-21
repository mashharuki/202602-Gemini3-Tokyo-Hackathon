import { DEFAULT_FALLBACK_SPRITE_PATH, MINIMAL_INLINE_FALLBACK_SVG } from "./fallbackSpriteAssets";

export interface FallbackSpriteStoreInterface {
  preload(): Promise<void>;
  getFallbackSprite(entityType: string): string;
  isReady(): boolean;
}

const PRELOAD_TIMEOUT_MS = 1000;

export class FallbackSpriteStore implements FallbackSpriteStoreInterface {
  private ready = false;
  private preloadPromise: Promise<void> | null = null;
  private fallbackSpriteUrl = DEFAULT_FALLBACK_SPRITE_PATH;

  async preload(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = this.loadWithTimeout();
    await this.preloadPromise;
  }

  getFallbackSprite(_entityType: string): string {
    if (!this.ready) {
      return MINIMAL_INLINE_FALLBACK_SVG;
    }

    return this.fallbackSpriteUrl;
  }

  isReady(): boolean {
    return this.ready;
  }

  private async loadWithTimeout(): Promise<void> {
    if (typeof Image === "undefined") {
      this.ready = true;
      this.fallbackSpriteUrl = DEFAULT_FALLBACK_SPRITE_PATH;
      return;
    }

    const preloadImage = new Promise<void>((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        this.fallbackSpriteUrl = DEFAULT_FALLBACK_SPRITE_PATH;
        resolve();
      };

      image.onerror = () => {
        reject(new Error("Failed to preload fallback sprite"));
      };

      image.src = DEFAULT_FALLBACK_SPRITE_PATH;
    });

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Fallback sprite preload timed out"));
      }, PRELOAD_TIMEOUT_MS);
    });

    try {
      await Promise.race([preloadImage, timeout]);
    } catch {
      this.fallbackSpriteUrl = MINIMAL_INLINE_FALLBACK_SVG;
    } finally {
      this.ready = true;
    }
  }
}

export const fallbackSpriteStore = new FallbackSpriteStore();
