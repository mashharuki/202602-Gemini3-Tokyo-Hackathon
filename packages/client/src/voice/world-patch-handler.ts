import type { DownstreamMessage, WorldPatchJSON } from "./types";

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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
  return (
    "effect" in value &&
    "color" in value &&
    "intensity" in value &&
    "spawn" in value &&
    "caption" in value
  );
};

const extractPatchFromText = (text: string): WorldPatchJSON | null => {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidates = [fencedMatch?.[1], text];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (isWorldPatchJSON(parsed)) {
        return parsed;
      }
    } catch {
      // continue next candidate
    }
  }

  return null;
};

export const handleDownstreamMessage = (messageText: string): DownstreamMessage => {
  let payload: unknown;
  try {
    payload = JSON.parse(messageText);
  } catch {
    return { type: "error", message: "Invalid downstream JSON" };
  }

  if (!isObject(payload)) {
    return { type: "error", message: "Invalid downstream payload" };
  }

  if (payload.type === "worldPatch" && isWorldPatchJSON(payload.patch)) {
    return { type: "worldPatch", patch: payload.patch };
  }

  const content = payload.content;
  if (isObject(content) && Array.isArray(content.parts)) {
    for (const part of content.parts) {
      if (!isObject(part) || typeof part.text !== "string") continue;
      const patch = extractPatchFromText(part.text);
      if (patch) {
        return { type: "worldPatch", patch };
      }
    }
  }

  return { type: "adkEvent", payload };
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

