import type { AdkEventPart, AdkEventPayload, DownstreamMessage, WorldPatchJSON } from "./types";

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  return value;
};

const normalizeAdkPart = (rawPart: unknown): AdkEventPart | null => {
  if (!isObject(rawPart)) return null;

  const text = toOptionalString(rawPart.text);
  const inlineSource =
    (isObject(rawPart.inlineData) && rawPart.inlineData) ||
    (isObject(rawPart.inline_data) && rawPart.inline_data) ||
    null;

  const mimeType = inlineSource ? toOptionalString(inlineSource.mimeType ?? inlineSource.mime_type) : undefined;
  const data = inlineSource ? toOptionalString(inlineSource.data) : undefined;

  const normalized: AdkEventPart = {};
  if (text) normalized.text = text;
  if (mimeType || data) {
    normalized.inlineData = {
      mimeType,
      data,
    };
  }

  if (!normalized.text && !normalized.inlineData) return null;
  return normalized;
};

const normalizeAdkPayload = (rawPayload: unknown): AdkEventPayload => {
  const payload = isObject(rawPayload) ? rawPayload : {};

  const contentObj = isObject(payload.content) ? payload.content : null;
  const rawParts = Array.isArray(contentObj?.parts) ? contentObj.parts : [];
  const parts = rawParts.map(normalizeAdkPart).filter((part): part is AdkEventPart => part !== null);

  const outputTranscriptionObj =
    (isObject(payload.outputTranscription) && payload.outputTranscription) ||
    (isObject(payload.output_transcription) && payload.output_transcription) ||
    null;
  const inputTranscriptionObj =
    (isObject(payload.inputTranscription) && payload.inputTranscription) ||
    (isObject(payload.input_transcription) && payload.input_transcription) ||
    null;

  const outputText = toOptionalString(outputTranscriptionObj?.text);
  const inputText = toOptionalString(inputTranscriptionObj?.text);

  if (outputText && !parts.some((part) => typeof part.text === "string" && part.text.trim() === outputText.trim())) {
    parts.push({ text: outputText });
  }

  const normalized: AdkEventPayload = {
    author: toOptionalString(payload.author),
    turnComplete:
      typeof payload.turnComplete === "boolean"
        ? payload.turnComplete
        : typeof payload.turn_complete === "boolean"
          ? payload.turn_complete
          : typeof payload.finished === "boolean"
            ? payload.finished
            : undefined,
    interrupted: typeof payload.interrupted === "boolean" ? payload.interrupted : undefined,
    content: { parts },
    inputTranscription: inputText ? { text: inputText } : undefined,
    outputTranscription: outputText ? { text: outputText } : undefined,
    error:
      typeof payload.error === "string" || isObject(payload.error)
        ? (payload.error as string | { message?: string })
        : undefined,
  };

  return normalized;
};

export const validateWorldPatch = (patch: WorldPatchJSON): ValidationResult => {
  const errors: string[] = [];

  if (!isObject(patch)) {
    return { valid: false, errors: ["patch must be an object"] };
  }
  if (typeof patch.effect !== "string" || patch.effect.trim().length === 0) {
    errors.push("effect must be a non-empty string");
  }
  if (typeof patch.color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(patch.color)) {
    errors.push("color must be a valid 6-character hex string");
  }
  if (!Number.isInteger(patch.intensity) || patch.intensity < 0 || patch.intensity > 100) {
    errors.push("intensity must be an integer between 0 and 100");
  }
  if (patch.spawn !== null) {
    if (typeof patch.spawn.type !== "string" || patch.spawn.type.trim().length === 0) {
      errors.push("spawn.type must be a non-empty string");
    }
    if (!Number.isInteger(patch.spawn.x) || !Number.isInteger(patch.spawn.y)) {
      errors.push("spawn.x and spawn.y must be integers");
    }
  }
  if (typeof patch.caption !== "string") {
    errors.push("caption must be a string");
  }

  return { valid: errors.length === 0, errors };
};

const isWorldPatchJSON = (value: unknown): value is WorldPatchJSON => {
  if (!isObject(value)) return false;
  return "effect" in value && "color" in value && "intensity" in value && "spawn" in value && "caption" in value;
};

export const handleDownstreamMessage = (messageText: string): DownstreamMessage => {
  let rawMessage: unknown;
  try {
    rawMessage = JSON.parse(messageText);
  } catch {
    return { type: "error", message: "Invalid downstream JSON" };
  }

  if (!isObject(rawMessage)) {
    return { type: "error", message: "Invalid downstream payload" };
  }

  if (rawMessage.type === "worldPatch" && isWorldPatchJSON(rawMessage.patch)) {
    return { type: "worldPatch", patch: rawMessage.patch };
  }

  const adkPayload =
    rawMessage.type === "adkEvent" && isObject(rawMessage.payload)
      ? normalizeAdkPayload(rawMessage.payload)
      : normalizeAdkPayload(rawMessage);

  return { type: "adkEvent", payload: adkPayload };
};

export const applyWorldPatchFromAgent = async (
  patch: WorldPatchJSON,
  systemCalls: { applyWorldPatch: (patch: WorldPatchJSON) => Promise<void> },
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const validation = validateWorldPatch(patch);
  if (!validation.valid) {
    return {
      ok: false,
      error: `Invalid world patch: ${validation.errors.join("; ")}`,
    };
  }

  await systemCalls.applyWorldPatch(patch);
  return { ok: true };
};
