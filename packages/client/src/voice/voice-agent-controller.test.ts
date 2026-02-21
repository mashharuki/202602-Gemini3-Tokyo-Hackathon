import { describe, expect, it } from "bun:test";
import type { WorldPatchJSON } from "./types";
import { createVoiceAgentController } from "./voice-agent-controller";

const createHarness = () => {
  const sentBinary: ArrayBuffer[] = [];
  const sentText: string[] = [];
  const applyCalls: WorldPatchJSON[] = [];
  const playbackCalls: Array<{ base64: string; mimeType?: string }> = [];
  let state: "disconnected" | "connecting" | "connected" | "reconnecting" | "error" = "disconnected";
  let onStateChange: ((s: typeof state) => void) | null = null;
  let onMessage: ((text: string) => void) | null = null;

  const wsManager = {
    setHandlers: (handlers: { onStateChange?: (next: typeof state) => void; onMessage?: (text: string) => void }) => {
      onStateChange = handlers.onStateChange ?? null;
      onMessage = handlers.onMessage ?? null;
    },
    connect: () => {
      state = "connected";
      onStateChange?.(state);
    },
    disconnect: () => {
      state = "disconnected";
      onStateChange?.(state);
    },
    sendBinary: (payload: Int16Array | ArrayBuffer) => {
      sentBinary.push(payload instanceof Int16Array ? payload.buffer : payload);
    },
    sendText: (payload: { type: "text"; text: string }) => {
      sentText.push(payload.text);
    },
    getState: () => state,
  };

  const captureHandle = {} as any;
  const playbackHandle = {} as any;
  let captureActive = false;

  const controller = createVoiceAgentController({
    systemCalls: {
      applyWorldPatch: async (patch: WorldPatchJSON) => {
        applyCalls.push(patch);
      },
    } as any,
    host: "localhost:5173",
    userId: "u1",
    sessionId: "s1",
    createWebSocketManager: () => wsManager as any,
    startAudioCapture: async (onChunk) => {
      captureActive = true;
      onChunk(new Int16Array([1, 2, 3]));
      return captureHandle;
    },
    stopAudioCapture: async () => {
      captureActive = false;
    },
    createAudioPlayback: () => playbackHandle,
    playPcmChunk: (_handle, base64, mimeType) => {
      playbackCalls.push({ base64, mimeType });
    },
    interruptPlayback: () => undefined,
    stopPlayback: async () => undefined,
    createMessageId: (() => {
      let i = 0;
      return () => `m-${++i}`;
    })(),
  });

  return {
    controller,
    emitMessage: (text: string) => onMessage?.(text),
    sentBinary,
    sentText,
    applyCalls,
    playbackCalls,
    isCaptureActive: () => captureActive,
  };
};

describe("createVoiceAgentController", () => {
  it("connect/disconnect and sendText update state", () => {
    const h = createHarness();
    h.controller.connect();
    expect(h.controller.getState().connectionState).toBe("connected");

    h.controller.sendText("hello");
    expect(h.sentText).toEqual(["hello"]);
    expect(h.controller.getState().conversation.at(-1)?.role).toBe("user");

    h.controller.disconnect();
    expect(h.controller.getState().connectionState).toBe("disconnected");
  });

  it("toggleVoice starts and stops capture and sends PCM binary", async () => {
    const h = createHarness();
    h.controller.connect();
    await h.controller.toggleVoice();
    expect(h.isCaptureActive()).toBeTrue();
    expect(h.sentBinary.length).toBe(1);
    expect(h.controller.getState().isVoiceActive).toBeTrue();

    await h.controller.toggleVoice();
    expect(h.isCaptureActive()).toBeFalse();
    expect(h.controller.getState().isVoiceActive).toBeFalse();
  });

  it("does not start voice capture while disconnected", async () => {
    const h = createHarness();
    await h.controller.toggleVoice();

    expect(h.isCaptureActive()).toBeFalse();
    expect(h.sentBinary.length).toBe(0);
    expect(h.controller.getState().isVoiceActive).toBeFalse();
    expect(h.controller.getState().conversation.at(-1)?.role).toBe("system");
  });

  it("auto stops voice capture when connection is lost", async () => {
    const h = createHarness();
    h.controller.connect();
    await h.controller.toggleVoice();
    expect(h.isCaptureActive()).toBeTrue();

    h.controller.disconnect();
    await Promise.resolve();

    expect(h.isCaptureActive()).toBeFalse();
    expect(h.controller.getState().isVoiceActive).toBeFalse();
  });

  it("applies world patch from downstream and stores result", async () => {
    const h = createHarness();
    h.emitMessage(
      JSON.stringify({
        type: "worldPatch",
        patch: {
          effect: "aurora",
          color: "#112233",
          intensity: 80,
          spawn: null,
          caption: "ok",
        },
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.applyCalls.length).toBe(1);
    expect(h.controller.getState().lastPatchResult?.success).toBeTrue();
  });

  it("handles adk text/audio and finalizes on turnComplete", async () => {
    const h = createHarness();
    h.emitMessage(
      JSON.stringify({
        turnComplete: true,
        content: {
          parts: [{ text: "agent says hi" }, { inlineData: { mimeType: "audio/pcm;rate=24000", data: "AQACAA==" } }],
        },
      }),
    );
    await Promise.resolve();

    const last = h.controller.getState().conversation.at(-1);
    expect(last?.role).toBe("agent");
    expect(last?.status).toBe("final");
    expect(h.playbackCalls.length).toBe(1);
  });
});
