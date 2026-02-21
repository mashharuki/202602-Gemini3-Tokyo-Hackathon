import { startAudioCapture, stopAudioCapture, type AudioCaptureDependencies } from "../audio/capture";
import {
  createAudioPlayback,
  interruptPlayback,
  playPcmChunk,
  stopPlayback,
  type AudioPlaybackDependencies,
} from "../audio/playback";
import { createWebSocketManager, type WebSocketManager } from "../connection/websocket-manager";
import type { SystemCalls } from "../mud/createSystemCalls";
import type { AudioCaptureHandle, AudioPlaybackHandle, ConnectionState, ConversationMessage } from "./types";
import { applyWorldPatchFromAgent, handleDownstreamMessage } from "./world-patch-handler";

type PatchResult = { success: boolean; error?: string };

export type VoiceAgentControllerState = {
  connectionState: ConnectionState;
  isVoiceActive: boolean;
  conversation: ConversationMessage[];
  lastPatchResult: PatchResult | null;
};

type VoiceAgentControllerDeps = {
  systemCalls: SystemCalls;
  host: string;
  userId: string;
  sessionId: string;
  createWebSocketManager?: () => WebSocketManager;
  startAudioCapture?: (
    onPcmChunk: (chunk: Int16Array) => void,
    deps?: AudioCaptureDependencies,
  ) => Promise<AudioCaptureHandle>;
  stopAudioCapture?: (handle: AudioCaptureHandle) => Promise<void>;
  createAudioPlayback?: (deps?: AudioPlaybackDependencies) => AudioPlaybackHandle;
  playPcmChunk?: (handle: AudioPlaybackHandle, base64Data: string, mimeType?: string) => void;
  interruptPlayback?: (handle: AudioPlaybackHandle) => void;
  stopPlayback?: (handle: AudioPlaybackHandle) => Promise<void>;
  createMessageId?: () => string;
};

export type VoiceAgentController = {
  connect: () => void;
  disconnect: () => void;
  toggleVoice: () => Promise<void>;
  sendText: (text: string) => void;
  getState: () => VoiceAgentControllerState;
  subscribe: (listener: (state: VoiceAgentControllerState) => void) => () => void;
};

const isVoiceDebugEnabled = (): boolean => {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("VOICE_DEBUG") === "1";
};

export const createVoiceAgentController = (deps: VoiceAgentControllerDeps): VoiceAgentController => {
  const debug = (...args: unknown[]) => {
    if (isVoiceDebugEnabled()) {
      console.log("[VoiceAgentDebug]", ...args);
    }
  };

  const debugError = (...args: unknown[]) => {
    if (isVoiceDebugEnabled()) {
      console.error("[VoiceAgentDebug]", ...args);
    }
  };

  const wsManager = (deps.createWebSocketManager ?? createWebSocketManager)();
  const playbackHandle = (deps.createAudioPlayback ?? createAudioPlayback)();

  const startCapture = deps.startAudioCapture ?? startAudioCapture;
  const stopCapture = deps.stopAudioCapture ?? stopAudioCapture;
  const doPlayPcm = deps.playPcmChunk ?? playPcmChunk;
  const doInterruptPlayback = deps.interruptPlayback ?? interruptPlayback;
  const doStopPlayback = deps.stopPlayback ?? stopPlayback;
  const createMessageId = deps.createMessageId ?? (() => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  let captureHandle: AudioCaptureHandle | null = null;
  let listeners: Array<(state: VoiceAgentControllerState) => void> = [];

  let state: VoiceAgentControllerState = {
    connectionState: wsManager.getState(),
    isVoiceActive: false,
    conversation: [],
    lastPatchResult: null,
  };

  const emit = () => {
    listeners.forEach((listener) => listener(state));
  };

  const setState = (updater: (prev: VoiceAgentControllerState) => VoiceAgentControllerState) => {
    state = updater(state);
    emit();
  };

  const appendConversation = (
    role: ConversationMessage["role"],
    content: string,
    status: ConversationMessage["status"],
  ) => {
    if (!content.trim()) return;
    setState((prev) => ({
      ...prev,
      conversation: [
        ...prev.conversation,
        {
          id: createMessageId(),
          role,
          content,
          status,
        },
      ],
    }));
  };

  const stopVoiceCapture = async () => {
    if (!captureHandle) return;
    const handle = captureHandle;
    captureHandle = null;
    try {
      await stopCapture(handle);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debugError("failed to stop voice capture", { error: message });
    }
    setState((prev) => ({ ...prev, isVoiceActive: false }));
  };

  const finalizeLatestAgentMessage = () => {
    setState((prev) => {
      const nextConversation = [...prev.conversation];
      for (let i = nextConversation.length - 1; i >= 0; i -= 1) {
        const message = nextConversation[i];
        if (message.role === "agent") {
          nextConversation[i] = { ...message, status: "final" };
          break;
        }
      }
      return { ...prev, conversation: nextConversation };
    });
  };

  wsManager.setHandlers({
    onStateChange: (next) => {
      debug("connection state changed", { next });
      setState((prev) => ({ ...prev, connectionState: next }));
      if (next !== "connected" && captureHandle) {
        void stopVoiceCapture();
      }
    },
    onMessage: (text) => {
      debug("downstream message received", { length: text.length, preview: text.slice(0, 200) });
      const parsed = handleDownstreamMessage(text);
      debug("downstream message parsed", { type: parsed.type });

      if (parsed.type === "worldPatch") {
        debug("worldPatch detected", parsed.patch);
        void applyWorldPatchFromAgent(parsed.patch, deps.systemCalls)
          .then((result) => {
            if (result.ok) {
              debug("worldPatch applied successfully");
            } else {
              debugError("worldPatch rejected", { error: result.error, patch: parsed.patch });
            }
            setState((prev) => ({
              ...prev,
              lastPatchResult: result.ok ? { success: true } : { success: false, error: result.error },
            }));
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            debugError("worldPatch apply threw exception", { error: message, patch: parsed.patch });
            setState((prev) => ({
              ...prev,
              lastPatchResult: { success: false, error: message },
            }));
          });
        return;
      }

      if (parsed.type === "error") {
        debugError("downstream parse error", parsed.message);
        appendConversation("system", parsed.message, "error");
        return;
      }

      const payload = parsed.payload;
      const parts = payload.content?.parts ?? [];
      debug("adk event payload", {
        turnComplete: Boolean(payload.turnComplete),
        interrupted: Boolean(payload.interrupted),
        partsCount: parts.length,
      });
      for (const part of parts) {
        if (part.text) {
          appendConversation("agent", part.text, payload.turnComplete ? "final" : "streaming");
        }
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("audio/pcm")) {
          doPlayPcm(playbackHandle, part.inlineData.data, part.inlineData.mimeType);
        }
      }

      if (payload.turnComplete) {
        finalizeLatestAgentMessage();
      }
      if (payload.interrupted) {
        doInterruptPlayback(playbackHandle);
      }
    },
  });

  return {
    connect: () => {
      debug("connect called", { host: deps.host, userId: deps.userId, sessionId: deps.sessionId });
      wsManager.connect(deps.host, deps.userId, deps.sessionId);
    },
    disconnect: () => {
      debug("disconnect called");
      wsManager.disconnect();
      void stopVoiceCapture();
      doInterruptPlayback(playbackHandle);
      void doStopPlayback(playbackHandle);
      setState((prev) => ({ ...prev, isVoiceActive: false }));
    },
    toggleVoice: async () => {
      if (captureHandle) {
        debug("voice capture stopping");
        await stopVoiceCapture();
        return;
      }

      if (wsManager.getState() !== "connected") {
        appendConversation("system", "Voice streaming unavailable: establish link first.", "error");
        return;
      }

      debug("voice capture starting");
      captureHandle = await startCapture((chunk) => wsManager.sendBinary(chunk));
      setState((prev) => ({ ...prev, isVoiceActive: true }));
    },
    sendText: (text: string) => {
      debug("text message sending", { text });
      wsManager.sendText({ type: "text", text });
      appendConversation("user", text, "final");
    },
    getState: () => state,
    subscribe: (listener: (snapshot: VoiceAgentControllerState) => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((current) => current !== listener);
      };
    },
  };
};
