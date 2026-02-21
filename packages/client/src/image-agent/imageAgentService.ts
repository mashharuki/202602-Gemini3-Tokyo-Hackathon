import { fallbackSpriteStore } from "./fallbackSpriteStore";

export type RequestId = string;

export type RequestState =
  | "ACCEPTED"
  | "GENERATING"
  | "GENERATED"
  | "GENERATION_FAILED"
  | "TIMEOUT_FALLBACK"
  | "PLACED";

export interface SpawnInput {
  type: string;
  x: number;
  y: number;
}

export interface AssetRecord {
  requestId: RequestId;
  spawnInput: SpawnInput;
  textureDataUrl: string | null;
  fallbackUsed: boolean;
  fallbackReason: "API_ERROR" | "TIMEOUT" | "INVALID_IMAGE" | null;
  state: RequestState;
  createdAt: number;
  resolvedAt: number | null;
}

type ValidationResult =
  | { valid: true; value: SpawnInput }
  | { valid: false; errors: string[] };

type ImageAgentServiceOptions = {
  now?: () => number;
  createRequestId?: () => RequestId;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  fallbackSpriteProvider?: (entityType: string) => string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export class ImageAgentService {
  private readonly requestStore = new Map<RequestId, AssetRecord>();
  private readonly sourcePatchStore = new Map<RequestId, unknown>();
  private readonly now: () => number;
  private readonly createRequestId: () => RequestId;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly fallbackSpriteProvider: (entityType: string) => string;
  private sequence = 0;

  constructor(options: ImageAgentServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.fallbackSpriteProvider =
      options.fallbackSpriteProvider ?? ((entityType) => fallbackSpriteStore.getFallbackSprite(entityType));
    this.createRequestId =
      options.createRequestId ??
      (() => {
        this.sequence += 1;
        return `img-${this.now()}-${this.sequence}`;
      });
  }

  validateSpawnInput(input: unknown): ValidationResult {
    if (!isRecord(input)) {
      return { valid: false, errors: ["spawn must be an object"] };
    }

    const errors: string[] = [];
    const rawType = input.type;
    const x = input.x;
    const y = input.y;
    const normalizedType = typeof rawType === "string" ? rawType.trim() : "";

    if (normalizedType.length === 0) {
      errors.push("spawn.type must be a non-empty string");
    }
    if (!Number.isInteger(x)) {
      errors.push("spawn.x must be an integer");
    }
    if (!Number.isInteger(y)) {
      errors.push("spawn.y must be an integer");
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      value: {
        type: normalizedType,
        x: x as number,
        y: y as number,
      },
    };
  }

  acceptSpawnRequest(spawnInput: unknown, sourcePatch: unknown): AssetRecord {
    const validation = this.validateSpawnInput(spawnInput);
    if (!validation.valid) {
      throw new Error(`Invalid spawn input: ${validation.errors.join("; ")}`);
    }

    const requestId = this.createRequestId();
    const createdAt = this.now();
    const record: AssetRecord = {
      requestId,
      spawnInput: validation.value,
      textureDataUrl: null,
      fallbackUsed: false,
      fallbackReason: null,
      state: "ACCEPTED",
      createdAt,
      resolvedAt: null,
    };

    this.requestStore.set(requestId, record);
    this.sourcePatchStore.set(requestId, sourcePatch);

    return record;
  }

  async resolveAsset(spawnInput: unknown, sourcePatch: unknown): Promise<AssetRecord> {
    const accepted = this.acceptSpawnRequest(spawnInput, sourcePatch);
    this.updateRecord(accepted.requestId, { state: "GENERATING" });

    try {
      const response = await this.withTimeout(
        this.fetchImpl("/api/generate-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entity_type: accepted.spawnInput.type }),
        }),
      );

      if (!response.ok) {
        throw new Error(`Image API request failed: ${response.status}`);
      }

      const payload = await response.json();
      const validated = this.validateGeneratedImagePayload(payload);
      if (!validated.valid) {
        throw new InvalidImagePayloadError(validated.errors.join("; "));
      }

      const resolvedAt = this.now();
      const updated = this.updateRecord(accepted.requestId, {
        textureDataUrl: `data:${validated.value.mimeType};base64,${validated.value.imageBase64}`,
        state: "GENERATED",
        resolvedAt,
      });
      return updated;
    } catch (error) {
      if (error instanceof TimeoutError) {
        return this.applyFallback(accepted.requestId, accepted.spawnInput.type, "TIMEOUT", "TIMEOUT_FALLBACK");
      }
      if (error instanceof InvalidImagePayloadError) {
        return this.applyFallback(
          accepted.requestId,
          accepted.spawnInput.type,
          "INVALID_IMAGE",
          "GENERATION_FAILED",
        );
      }
      return this.applyFallback(accepted.requestId, accepted.spawnInput.type, "API_ERROR", "GENERATION_FAILED");
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new TimeoutError()), this.timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  private applyFallback(
    requestId: RequestId,
    entityType: string,
    reason: AssetRecord["fallbackReason"],
    state: RequestState,
  ): AssetRecord {
    const fallbackUrl = this.fallbackSpriteProvider(entityType);
    const resolvedAt = this.now();
    return this.updateRecord(requestId, {
      textureDataUrl: fallbackUrl,
      fallbackUsed: true,
      fallbackReason: reason,
      state,
      resolvedAt,
    });
  }

  private validateGeneratedImagePayload(input: unknown):
    | { valid: true; value: { imageBase64: string; mimeType: string } }
    | { valid: false; errors: string[] } {
    if (!isRecord(input)) {
      return { valid: false, errors: ["payload must be an object"] };
    }

    const imageBase64 =
      typeof input.image_base64 === "string"
        ? input.image_base64.trim()
        : typeof input.imageBase64 === "string"
          ? input.imageBase64.trim()
          : "";
    const mimeType = typeof input.mime_type === "string" ? input.mime_type.trim() : "";

    const errors: string[] = [];
    if (imageBase64.length === 0) {
      errors.push("image_base64 must be a non-empty string");
    } else if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
      errors.push("image_base64 must be a valid base64 string");
    }

    if (mimeType.length === 0 || !mimeType.startsWith("image/")) {
      errors.push("mime_type must be an image MIME type");
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, value: { imageBase64, mimeType } };
  }

  private updateRecord(
    requestId: RequestId,
    patch: Partial<Omit<AssetRecord, "requestId" | "spawnInput" | "createdAt">>,
  ): AssetRecord {
    const current = this.requestStore.get(requestId);
    if (!current) {
      throw new Error(`Missing request record: ${requestId}`);
    }
    const next: AssetRecord = { ...current, ...patch };
    this.requestStore.set(requestId, next);
    return next;
  }

  getRequestState(requestId: RequestId): RequestState | null {
    return this.requestStore.get(requestId)?.state ?? null;
  }

  getAssetRecord(requestId: RequestId): AssetRecord | null {
    return this.requestStore.get(requestId) ?? null;
  }

  getSourcePatch(requestId: RequestId): unknown | null {
    return this.sourcePatchStore.get(requestId) ?? null;
  }
}

class TimeoutError extends Error {
  constructor() {
    super("Image request timed out");
  }
}

class InvalidImagePayloadError extends Error {
  constructor(message: string) {
    super(`Invalid generated image payload: ${message}`);
  }
}
