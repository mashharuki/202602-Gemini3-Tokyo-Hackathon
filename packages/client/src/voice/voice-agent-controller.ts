import type { SystemCalls } from "../mud/createSystemCalls";
import {
  createAudioPlayback,
  interruptPlayback,
  playPcmChunk,
  stopPlayback,
  type AudioPlaybackDependencies,
} from "../audio/playback";
import {
  startAudioCapture,
  stopAudioCapture,
  type AudioCaptureDependencies,
} from "../audio/capture";
import {
  createWebSocketManager,
  type WebSocketManager,
} from "../connection/websocket-manager";
import { applyWorldPatchFromAgent, handleDownstreamMessage } from "./world-patch-handler";
import type { AudioCaptureHandle, AudioPlaybackHandle, ConnectionState, ConversationMessage } from "./types";

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

export const createVoiceAgentController = (deps: VoiceAgentControllerDeps): VoiceAgentController => {
  const wsManager = (deps.createWebSocketManager ?? createWebSocketManager)();
  const playbackHandle = (deps.createAudioPlayback ?? createAudioPlayback)();

  const startCapture = deps.startAudioCapture ?? startAudioCapture;
  const stopCapture = deps.stopAudioCapture ?? stopAudioCapture;
  const doPlayPcm = deps.playPcmChunk ?? playPcmChunk;
  const doInterruptPlayback = deps.interruptPlayback ?? interruptPlayback;
  const doStopPlayback = deps.stopPlayback ?? stopPlayback;
  const createMessageId =
    deps.createMessageId ??
    (() => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

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
      setState((prev) => ({ ...prev, connectionState: next }));
    },
    onMessage: (text) => {
      const parsed = handleDownstreamMessage(text);

      if (parsed.type === "worldPatch") {
        void applyWorldPatchFromAgent(parsed.patch, deps.systemCalls).then((result) => {
          setState((prev) => ({
            ...prev,
            lastPatchResult: result.ok ? { success: true } : { success: false, error: result.error },
          }));
        });
        return;
      }

      if (parsed.type === "error") {
        appendConversation("system", parsed.message, "error");
        return;
      }

      const payload = parsed.payload;
      const parts = payload.content?.parts ?? [];
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
      wsManager.connect(deps.host, deps.userId, deps.sessionId);
    },
    disconnect: () => {
      wsManager.disconnect();
      if (captureHandle) {
        void stopCapture(captureHandle);
        captureHandle = null;
      }
      doInterruptPlayback(playbackHandle);
      void doStopPlayback(playbackHandle);
      setState((prev) => ({ ...prev, isVoiceActive: false }));
    },
    toggleVoice: async () => {
      if (captureHandle) {
        await stopCapture(captureHandle);
        captureHandle = null;
        setState((prev) => ({ ...prev, isVoiceActive: false }));
        return;
      }

      captureHandle = await startCapture((chunk) => wsManager.sendBinary(chunk));
      setState((prev) => ({ ...prev, isVoiceActive: true }));
    },
    sendText: (text: string) => {
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

