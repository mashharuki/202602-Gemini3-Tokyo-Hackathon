import { type FormEvent, type JSX, useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  connectionStateMachine,
  getConnectionStateLabel,
  initialConnectionState
} from "./connection/connection-state-machine";

type LayoutMode = "desktop" | "tablet" | "mobile";
type ConversationMessage = {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  status: "partial" | "complete" | "interrupted";
  imageData?: string;
  imageMimeType?: string;
};
type EventLogCategory = "notification" | "conversation";
type EventLogKind = "standard" | "audio";
type RunConfigOptions = {
  proactivity: boolean;
  affectiveDialog: boolean;
};
type EventLogEntry = {
  id: string;
  timestamp: string;
  summary: string;
  category: EventLogCategory;
  kind: EventLogKind;
  detail: string;
};
type MockStreamEvent =
  | {
      kind: "text";
      role: "user" | "agent";
      text: string;
      partial: boolean;
    }
  | {
      kind: "imageOutput";
      role: "user" | "agent";
      data: string;
      mimeType: string;
    }
  | {
      kind: "audioOutput";
      chunkSize: number;
    }
  | {
      kind: "runConfigApplyResult";
      status: "applied" | "rejected" | "unsupported";
      effective: RunConfigOptions;
      reason?: string;
    }
  | {
      kind: "error";
      message: string;
    }
  | { kind: "turnComplete" }
  | { kind: "interrupted" };

type AdkEventPart = {
  text?: string;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  inline_data?: {
    mime_type?: string;
    data?: string;
  };
};

type AdkEventPayload = {
  author?: string;
  turnComplete?: boolean;
  interrupted?: boolean;
  error?: string | { message?: string };
  outputTranscription?: {
    text?: string;
  };
  output_transcription?: {
    text?: string;
  };
  content?: {
    parts?: AdkEventPart[];
  };
};

function detectLayoutMode(width: number): LayoutMode {
  if (width <= 767) {
    return "mobile";
  }
  if (width <= 1023) {
    return "tablet";
  }
  return "desktop";
}

function getInitialLayoutMode(): LayoutMode {
  if (typeof window === "undefined") {
    return "desktop";
  }
  return detectLayoutMode(window.innerWidth);
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isJsdomRuntime(): boolean {
  return typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
}

function buildWebSocketUrl(userId: string, sessionId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/${userId}/${sessionId}`;
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function parsePcmRate(mimeType: string | undefined, fallback = 24000): number {
  if (!mimeType) {
    return fallback;
  }
  const match = mimeType.match(/rate=(\d+)/);
  if (!match) {
    return fallback;
  }
  const rate = Number(match[1]);
  return Number.isFinite(rate) ? rate : fallback;
}

function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const pcm = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm;
}

export function App(): JSX.Element {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(getInitialLayoutMode);
  const [connectionState, dispatchConnectionEvent] = useReducer(
    connectionStateMachine,
    initialConnectionState
  );
  const [reconnectScheduled, setReconnectScheduled] = useState(false);
  const [systemNotices, setSystemNotices] = useState<string[]>([]);
  const [textInputValue, setTextInputValue] = useState("");
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false);
  const [audioUpstreamChunkCount, setAudioUpstreamChunkCount] = useState(0);
  const [audioDownstreamChunkCount, setAudioDownstreamChunkCount] = useState(0);
  const [audioPlaybackState, setAudioPlaybackState] = useState<"idle" | "playing" | "interrupted">("idle");
  const [imageUpstreamCount, setImageUpstreamCount] = useState(0);
  const [eventLogs, setEventLogs] = useState<EventLogEntry[]>([]);
  const [expandedEventLogIds, setExpandedEventLogIds] = useState<string[]>([]);
  const [showAudioEventLogs, setShowAudioEventLogs] = useState(true);
  const [desiredRunConfig, setDesiredRunConfig] = useState<RunConfigOptions>({
    proactivity: false,
    affectiveDialog: false
  });
  const [effectiveRunConfig, setEffectiveRunConfig] = useState<RunConfigOptions>({
    proactivity: false,
    affectiveDialog: false
  });
  const [lastSuccessfulRunConfig, setLastSuccessfulRunConfig] = useState<RunConfigOptions>({
    proactivity: false,
    affectiveDialog: false
  });
  const [runConfigStatus, setRunConfigStatus] = useState<"idle" | "applying">("idle");
  const [lastRunConfigQuery, setLastRunConfigQuery] = useState("proactivity=false&affective_dialog=false");
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const liveModeEnabled =
    typeof window !== "undefined" && typeof WebSocket !== "undefined" && !isJsdomRuntime();
  const previousConnectionState = useRef(initialConnectionState);
  const conversationLogRef = useRef<HTMLUListElement>(null);
  const activeAgentMessageIdRef = useRef<string | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const isManualSocketCloseRef = useRef(false);
  const userIdRef = useRef("demo-user");
  const sessionIdRef = useRef(`demo-session-${createMessageId()}`);
  const isVoiceInputActiveRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioInputContextRef = useRef<AudioContext | null>(null);
  const audioInputProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioInputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioOutputContextRef = useRef<AudioContext | null>(null);
  const audioOutputNextPlayAtRef = useRef(0);

  const appendEventLog = useCallback(
    (category: EventLogCategory, summary: string, detail: unknown, kind: EventLogKind = "standard"): void => {
      const entry: EventLogEntry = {
        id: createMessageId(),
        timestamp: new Date().toISOString(),
        summary,
        category,
        kind,
        detail: JSON.stringify(detail)
      };
      setEventLogs((items) => [entry, ...items].slice(0, 100));
    },
    []
  );

  const toggleEventLogExpanded = useCallback((id: string): void => {
    setExpandedEventLogIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }, []);

  const emitMockStreamEvent = useCallback((event: MockStreamEvent): void => {
    window.dispatchEvent(new CustomEvent("mock-stream-event", { detail: event }));
  }, []);

  const stopAudioInputCapture = useCallback((): void => {
    if (audioInputProcessorRef.current) {
      audioInputProcessorRef.current.disconnect();
      audioInputProcessorRef.current.onaudioprocess = null;
      audioInputProcessorRef.current = null;
    }
    if (audioInputSourceRef.current) {
      audioInputSourceRef.current.disconnect();
      audioInputSourceRef.current = null;
    }
    if (audioInputContextRef.current) {
      void audioInputContextRef.current.close();
      audioInputContextRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
  }, []);

  const resetAudioOutputPipeline = useCallback((): void => {
    if (audioOutputContextRef.current) {
      void audioOutputContextRef.current.close();
      audioOutputContextRef.current = null;
    }
    audioOutputNextPlayAtRef.current = 0;
  }, []);

  const playPcmAudioChunk = useCallback(
    (base64Data: string, mimeType?: string): void => {
      try {
        const sampleRate = parsePcmRate(mimeType, 24000);
        if (!audioOutputContextRef.current || audioOutputContextRef.current.sampleRate !== sampleRate) {
          resetAudioOutputPipeline();
          audioOutputContextRef.current = new AudioContext({ sampleRate });
        }

        const audioContext = audioOutputContextRef.current;
        if (!audioContext) {
          return;
        }

        const rawBuffer = decodeBase64ToArrayBuffer(base64Data);
        const view = new DataView(rawBuffer);
        const sampleCount = Math.floor(view.byteLength / 2);
        const floatSamples = new Float32Array(sampleCount);
        for (let i = 0; i < sampleCount; i += 1) {
          const sample = view.getInt16(i * 2, true);
          floatSamples[i] = sample / 0x8000;
        }

        const audioBuffer = audioContext.createBuffer(1, sampleCount, sampleRate);
        audioBuffer.copyToChannel(floatSamples, 0);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        const startAt = Math.max(audioContext.currentTime, audioOutputNextPlayAtRef.current);
        source.start(startAt);
        audioOutputNextPlayAtRef.current = startAt + audioBuffer.duration;
      } catch (error) {
        appendEventLog("notification", "音声再生処理失敗", { message: String(error) });
      }
    },
    [appendEventLog, resetAudioOutputPipeline]
  );

  const handleAdkMessage = useCallback(
    (rawText: string): void => {
      let adkEvent: AdkEventPayload;
      try {
        adkEvent = JSON.parse(rawText) as AdkEventPayload;
      } catch {
        emitMockStreamEvent({
          kind: "error",
          message: "invalid server payload"
        });
        return;
      }

      if (adkEvent.error) {
        const message =
          typeof adkEvent.error === "string" ? adkEvent.error : adkEvent.error.message ?? "unknown websocket error";
        emitMockStreamEvent({ kind: "error", message });
      }

      if (adkEvent.interrupted === true) {
        resetAudioOutputPipeline();
        emitMockStreamEvent({ kind: "interrupted" });
      }

      let hasTextParts = false;
      if (adkEvent.content?.parts) {
        for (const part of adkEvent.content.parts) {
          const inlineData = part.inlineData ?? {
            mimeType: part.inline_data?.mime_type,
            data: part.inline_data?.data
          };
          if (part.text) {
            hasTextParts = true;
            emitMockStreamEvent({
              kind: "text",
              role: adkEvent.author === "user" ? "user" : "agent",
              text: part.text,
              partial: adkEvent.turnComplete !== true
            });
          }
          if (inlineData.mimeType?.startsWith("audio/pcm") && inlineData.data) {
            playPcmAudioChunk(inlineData.data, inlineData.mimeType);
            emitMockStreamEvent({
              kind: "audioOutput",
              chunkSize: inlineData.data.length
            });
          }
          if (inlineData.mimeType?.startsWith("image/") && inlineData.data) {
            emitMockStreamEvent({
              kind: "imageOutput",
              role: adkEvent.author === "user" ? "user" : "agent",
              data: inlineData.data,
              mimeType: inlineData.mimeType
            });
          }
        }
      }

      const transcriptionText =
        adkEvent.outputTranscription?.text ?? adkEvent.output_transcription?.text;
      if (!hasTextParts && transcriptionText?.trim()) {
        emitMockStreamEvent({
          kind: "text",
          role: "agent",
          text: transcriptionText,
          partial: adkEvent.turnComplete !== true
        });
      }

      if (adkEvent.turnComplete === true) {
        emitMockStreamEvent({ kind: "turnComplete" });
      }
    },
    [emitMockStreamEvent, playPcmAudioChunk, resetAudioOutputPipeline]
  );

  const openWebSocketConnection = useCallback((): void => {
      if (!liveModeEnabled) {
        return;
      }
      if (websocketRef.current && websocketRef.current.readyState <= WebSocket.OPEN) {
        return;
      }

      isManualSocketCloseRef.current = false;
      const ws = new WebSocket(buildWebSocketUrl(userIdRef.current, sessionIdRef.current));
      ws.binaryType = "arraybuffer";
      websocketRef.current = ws;

      ws.onopen = () => {
        dispatchConnectionEvent({ type: "CONNECTED" });
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        if (typeof event.data === "string") {
          handleAdkMessage(event.data);
        }
      };

      ws.onerror = () => {
        emitMockStreamEvent({ kind: "error", message: "websocket transport error" });
      };

      ws.onclose = () => {
        websocketRef.current = null;
        stopAudioInputCapture();
        if (isManualSocketCloseRef.current) {
          return;
        }
        dispatchConnectionEvent({ type: "CONNECTION_ERROR" });
        setReconnectScheduled(true);
      };
    },
    [emitMockStreamEvent, handleAdkMessage, liveModeEnabled, stopAudioInputCapture]
  );

  const closeWebSocketConnection = useCallback((): void => {
    if (!websocketRef.current) {
      return;
    }
    isManualSocketCloseRef.current = true;
    websocketRef.current.close();
    websocketRef.current = null;
  }, []);

  const startAudioInputCapture = useCallback(async (): Promise<void> => {
    if (!liveModeEnabled) {
      return;
    }
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket未接続");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    micStreamRef.current = stream;

    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioInputContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    audioInputSourceRef.current = source;
    const processor = audioContext.createScriptProcessor(2048, 1, 1);
    audioInputProcessorRef.current = processor;
    const muteGain = audioContext.createGain();
    muteGain.gain.value = 0;

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!isVoiceInputActiveRef.current) {
        return;
      }
      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      const channel = event.inputBuffer.getChannelData(0);
      const pcm = floatTo16BitPCM(channel);
      websocketRef.current.send(pcm.buffer);
      window.dispatchEvent(new CustomEvent("mock-audio-chunk", { detail: { size: pcm.byteLength } }));
    };

    source.connect(processor);
    processor.connect(muteGain);
    muteGain.connect(audioContext.destination);
  }, [liveModeEnabled]);

  useEffect(() => {
    isVoiceInputActiveRef.current = isVoiceInputActive;
  }, [isVoiceInputActive]);

  useEffect(() => {
    const handleResize = (): void => {
      setLayoutMode(detectLayoutMode(window.innerWidth));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleMockAudioChunk = (): void => {
      if (!isVoiceInputActive) {
        return;
      }
      setAudioUpstreamChunkCount((count) => count + 1);
    };

    window.addEventListener("mock-audio-chunk", handleMockAudioChunk);
    return () => window.removeEventListener("mock-audio-chunk", handleMockAudioChunk);
  }, [isVoiceInputActive]);

  useEffect(() => {
    return () => {
      const stream = cameraStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      closeWebSocketConnection();
      stopAudioInputCapture();
      resetAudioOutputPipeline();
    };
  }, [closeWebSocketConnection, resetAudioOutputPipeline, stopAudioInputCapture]);

  useEffect(() => {
    if (liveModeEnabled) {
      return;
    }
    if (connectionState !== "connecting" && connectionState !== "reconnecting") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatchConnectionEvent({ type: "CONNECTED" });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [connectionState, liveModeEnabled]);

  useEffect(() => {
    const prev = previousConnectionState.current;
    if (prev !== connectionState) {
      if (prev === "connecting" && connectionState === "connected") {
        setSystemNotices((items) => [...items, "接続開始"]);
        appendEventLog("notification", "接続済み", { phase: "initial" });
      }
      if (prev === "reconnecting" && connectionState === "connected") {
        setSystemNotices((items) => [...items, "再接続に成功"]);
        appendEventLog("notification", "再接続に成功", { phase: "recover" });
      }
      if (prev === "reconnecting" && connectionState === "connected" && runConfigStatus === "applying") {
        setEffectiveRunConfig(desiredRunConfig);
        setRunConfigStatus("idle");
        setSystemNotices((items) => [...items, "設定変更を反映しました"]);
        appendEventLog("notification", "RunConfig反映完了", {
          proactivity: desiredRunConfig.proactivity,
          affectiveDialog: desiredRunConfig.affectiveDialog
        });
      }
      previousConnectionState.current = connectionState;
    }
  }, [appendEventLog, connectionState, desiredRunConfig, runConfigStatus]);

  useEffect(() => {
    if (!reconnectScheduled) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      dispatchConnectionEvent({ type: "RECONNECT_REQUESTED" });
      setSystemNotices((items) => [...items, "再接続を試行中"]);
      appendEventLog("notification", "再接続試行", { scheduled: true });
      setReconnectScheduled(false);
      openWebSocketConnection();
    }, 1000);
    return () => window.clearTimeout(timeoutId);
  }, [appendEventLog, openWebSocketConnection, reconnectScheduled]);

  useEffect(() => {
    const conversationLog = conversationLogRef.current;
    if (!conversationLog) {
      return;
    }
    conversationLog.scrollTop = conversationLog.scrollHeight;
  }, [conversationMessages]);

  useEffect(() => {
    const handleMockStreamEvent = (event: Event): void => {
      const customEvent = event as CustomEvent<MockStreamEvent>;
      const streamEvent = customEvent.detail;

      if (!streamEvent) {
        return;
      }

      if (streamEvent.kind === "text") {
        const nextText = streamEvent.text.trim();
        if (!nextText) {
          return;
        }

        if (streamEvent.role === "agent" && activeAgentMessageIdRef.current && streamEvent.partial) {
          const activeId = activeAgentMessageIdRef.current;
          setConversationMessages((items) =>
            items.map((item) =>
              item.id === activeId
                ? {
                    ...item,
                    content: `${item.content}${nextText}`,
                    status: "partial"
                  }
                : item
            )
          );
          appendEventLog("conversation", "エージェント応答更新", { partial: true });
          return;
        }

        const newMessageId = createMessageId();
        setConversationMessages((items) => [
          ...items,
          {
            id: newMessageId,
            role: streamEvent.role,
            content: nextText,
            status: streamEvent.partial ? "partial" : "complete"
          }
        ]);

        if (streamEvent.role === "agent") {
          activeAgentMessageIdRef.current = streamEvent.partial ? newMessageId : null;
        }
        appendEventLog("conversation", "会話イベント受信", {
          role: streamEvent.role,
          partial: streamEvent.partial
        });
        return;
      }

      if (streamEvent.kind === "audioOutput") {
        setAudioDownstreamChunkCount((count) => count + 1);
        setAudioPlaybackState("playing");
        appendEventLog("conversation", "音声出力受信", { chunkSize: streamEvent.chunkSize }, "audio");
        return;
      }

      if (streamEvent.kind === "imageOutput") {
        const newMessageId = createMessageId();
        setConversationMessages((items) => [
          ...items,
          {
            id: newMessageId,
            role: streamEvent.role,
            content: "画像を生成しました",
            status: "complete",
            imageData: streamEvent.data,
            imageMimeType: streamEvent.mimeType
          }
        ]);
        appendEventLog("conversation", "画像生成を受信", { mimeType: streamEvent.mimeType });
        return;
      }

      if (streamEvent.kind === "turnComplete") {
        const activeId = activeAgentMessageIdRef.current;
        if (!activeId) {
          return;
        }
        setConversationMessages((items) =>
          items.map((item) => (item.id === activeId ? { ...item, status: "complete" } : item))
        );
        activeAgentMessageIdRef.current = null;
        appendEventLog("conversation", "ターン完了", { kind: "turnComplete" });
        return;
      }

      if (streamEvent.kind === "runConfigApplyResult") {
        if (streamEvent.status === "applied") {
          setEffectiveRunConfig(streamEvent.effective);
          setLastSuccessfulRunConfig(streamEvent.effective);
          setRunConfigStatus("idle");
          setSystemNotices((items) => [...items, "設定変更を反映しました"]);
          appendEventLog("notification", "RunConfig反映完了", {
            status: streamEvent.status,
            effective: streamEvent.effective
          });
          return;
        }

        const fallbackConfig =
          lastSuccessfulRunConfig.proactivity || lastSuccessfulRunConfig.affectiveDialog
            ? lastSuccessfulRunConfig
            : { proactivity: false, affectiveDialog: false };
        setEffectiveRunConfig(fallbackConfig);
        setRunConfigStatus("idle");
        setSystemNotices((items) => [
          ...items,
          `設定反映に失敗: ${streamEvent.reason ?? "unsupported"}`
        ]);
        appendEventLog("notification", "RunConfig反映失敗", {
          status: streamEvent.status,
          reason: streamEvent.reason,
          fallback: fallbackConfig
        });
        return;
      }

      if (streamEvent.kind === "error") {
        dispatchConnectionEvent({ type: "CONNECTION_ERROR" });
        setSystemNotices((items) => [...items, `WebSocketエラー: ${streamEvent.message}`]);
        appendEventLog("notification", "WebSocketエラー", { message: streamEvent.message });
        setReconnectScheduled(true);
        return;
      }

      if (streamEvent.kind === "interrupted") {
        const activeId = activeAgentMessageIdRef.current;
        if (activeId) {
          setConversationMessages((items) =>
            items.map((item) => (item.id === activeId ? { ...item, status: "interrupted" } : item))
          );
          activeAgentMessageIdRef.current = null;
        }
        setAudioPlaybackState((prev) => (prev === "playing" ? "interrupted" : prev));
        appendEventLog("notification", "中断イベント", { kind: "interrupted" });
      }
    };

    window.addEventListener("mock-stream-event", handleMockStreamEvent as EventListener);
    return () => window.removeEventListener("mock-stream-event", handleMockStreamEvent as EventListener);
  }, [appendEventLog, lastSuccessfulRunConfig]);

  const handleConnectStart = (): void => {
    dispatchConnectionEvent({ type: "CONNECT_REQUESTED" });
    appendEventLog("notification", "接続開始要求", { source: "ui" });
    openWebSocketConnection();
  };

  const handleDisconnect = (): void => {
    closeWebSocketConnection();
    stopAudioInputCapture();
    setIsVoiceInputActive(false);
    dispatchConnectionEvent({ type: "DISCONNECTED" });
    setReconnectScheduled(true);
    setSystemNotices((items) => [...items, "切断"]);
    appendEventLog("notification", "切断", { reconnectScheduled: true });
  };

  const handleTextSend = (): void => {
    const trimmedValue = textInputValue.trim();
    if (!trimmedValue) {
      return;
    }

    setConversationMessages((items) => [
      ...items,
      {
        id: createMessageId(),
        role: "user",
        content: trimmedValue,
        status: "complete"
      }
    ]);
    appendEventLog("conversation", "テキスト送信", { text: trimmedValue });
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(
        JSON.stringify({
          type: "text",
          text: trimmedValue
        })
      );
    }
    setTextInputValue("");
  };

  const handleTextSendSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleTextSend();
  };

  const handleVoiceInputToggle = (): void => {
    if (isVoiceInputActiveRef.current) {
      setIsVoiceInputActive(false);
      stopAudioInputCapture();
      return;
    }

    setIsVoiceInputActive(true);
    void startAudioInputCapture().catch((error: unknown) => {
      setIsVoiceInputActive(false);
      stopAudioInputCapture();
      const message = error instanceof Error ? error.message : "音声入力開始に失敗";
      setSystemNotices((items) => [...items, `音声入力に失敗: ${message}`]);
      appendEventLog("notification", "音声入力開始失敗", { message });
    });
  };

  const handleCameraClose = (): void => {
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraModalOpen(false);
    setCameraActive(false);
  };

  const handleCameraOpen = async (): Promise<void> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("カメラ未対応");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamRef.current = stream;
      setIsCameraModalOpen(true);
      setCameraActive(true);
      appendEventLog("notification", "カメラプレビュー開始", { status: "opened" });
    } catch (error) {
      setIsCameraModalOpen(false);
      setCameraActive(false);
      const message = error instanceof Error ? error.message : "unknown";
      setSystemNotices((items) => [...items, `カメラ利用に失敗: ${message}`]);
      appendEventLog("notification", "カメラ利用失敗", { message });
    }
  };

  const handleCameraSend = (): void => {
    setConversationMessages((items) => [
      ...items,
      {
        id: createMessageId(),
        role: "user",
        content: "[画像を送信しました]",
        status: "complete"
      }
    ]);
    setImageUpstreamCount((count) => count + 1);
    appendEventLog("conversation", "画像送信", { placeholder: true });
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(
        JSON.stringify({
          type: "image",
          mimeType: "image/png",
          // 1x1 transparent PNG
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9mZ1tcQAAAAASUVORK5CYII="
        })
      );
    }
    handleCameraClose();
  };

  const handleAudioEventVisibilityToggle = (): void => {
    setShowAudioEventLogs((current) => !current);
  };

  const handleEventLogsClear = (): void => {
    setEventLogs([]);
    setExpandedEventLogIds([]);
  };

  const requestRunConfigApply = (nextOptions: RunConfigOptions): void => {
    const query = new URLSearchParams({
      proactivity: String(nextOptions.proactivity),
      affective_dialog: String(nextOptions.affectiveDialog)
    }).toString();
    setLastRunConfigQuery(query);
    setRunConfigStatus("applying");
    setSystemNotices((items) => [...items, "設定変更を反映中"]);
    appendEventLog("notification", "RunConfig変更要求", {
      proactivity: nextOptions.proactivity,
      affective_dialog: nextOptions.affectiveDialog,
      query
    });
    dispatchConnectionEvent({ type: "RECONNECT_REQUESTED" });
    if (liveModeEnabled) {
      closeWebSocketConnection();
      setReconnectScheduled(true);
    }
  };

  const handleRunConfigToggle = (key: keyof RunConfigOptions): void => {
    setDesiredRunConfig((current) => {
      const nextOptions: RunConfigOptions = {
        ...current,
        [key]: !current[key]
      };
      if (connectionState === "connected" || connectionState === "reconnecting") {
        requestRunConfigApply(nextOptions);
      } else {
        setLastRunConfigQuery(
          new URLSearchParams({
            proactivity: String(nextOptions.proactivity),
            affective_dialog: String(nextOptions.affectiveDialog)
          }).toString()
        );
      }
      return nextOptions;
    });
  };

  const renderAudioMetrics = (): JSX.Element => (
    <>
      <p className="mt-2 text-xs text-slate-300">
        上流音声チャンク: <span data-testid="audio-upstream-chunk-count">{audioUpstreamChunkCount}</span>
      </p>
      <p className="mt-1 text-xs text-slate-300">
        下流音声チャンク: <span data-testid="audio-downstream-chunk-count">{audioDownstreamChunkCount}</span>
      </p>
      <p className="mt-1 text-xs text-slate-300">
        音声再生状態:{" "}
        <span data-testid="audio-playback-state">
          {audioPlaybackState === "idle" && "待機中"}
          {audioPlaybackState === "playing" && "再生中"}
          {audioPlaybackState === "interrupted" && "中断"}
        </span>
      </p>
      <p className="mt-1 text-xs text-slate-300">
        画像上流送信数: <span data-testid="image-upstream-count">{imageUpstreamCount}</span>
      </p>
    </>
  );

  const renderEventLogs = (): JSX.Element => {
    const visibleLogs = showAudioEventLogs ? eventLogs : eventLogs.filter((log) => log.kind !== "audio");
    return (
      <>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-700/70 pt-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={showAudioEventLogs} onChange={handleAudioEventVisibilityToggle} />
            音声イベントを表示
          </label>
          <button type="button" className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100" onClick={handleEventLogsClear}>
            ログをクリア
          </button>
        </div>
        <ul data-testid="event-log-list" className="mt-3 space-y-2">
          {visibleLogs.map((log) => {
        const expanded = expandedEventLogIds.includes(log.id);
        const categoryLabel = log.kind === "audio" ? "audio" : log.category;
        const itemClassName =
          log.kind === "audio"
            ? "text-cyan-300"
            : log.category === "notification"
              ? "text-amber-300"
              : "text-slate-300";
        return (
          <li key={log.id} data-testid="event-log-item" className="rounded border border-slate-700 bg-slate-900/80 p-2 text-xs">
            <p data-testid={`event-log-item-${categoryLabel}`} className={itemClassName}>
              [{categoryLabel}] {log.summary}
            </p>
            <p className="mt-1 text-slate-500">{log.timestamp}</p>
            <button
              type="button"
              className="mt-1 rounded bg-slate-700 px-2 py-1 text-slate-100"
              onClick={() => toggleEventLogExpanded(log.id)}
            >
              {expanded ? "詳細を閉じる" : "詳細を開く"}
            </button>
            {expanded && (
              <pre data-testid="event-log-detail" className="mt-2 overflow-x-auto rounded bg-slate-800 p-2 text-[11px] text-slate-200">
                {log.detail}
              </pre>
            )}
          </li>
        );
          })}
        </ul>
      </>
    );
  };

  const renderConnectionSection = (
    className: string,
    title = "session_overview",
    configTitle = "run_config"
  ): JSX.Element => (
    <section aria-label="connection" role="region" className={className}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold tracking-wide text-slate-100 [font-family:'JetBrains_Mono',monospace]">{title}</p>
        <span
          data-testid="connection-state"
          className="rounded-full bg-[#1F2A22] px-2 py-1 text-[10px] text-[#2EE6A6] [font-family:'JetBrains_Mono',monospace]"
        >
          {getConnectionStateLabel(connectionState)}
        </span>
      </div>
      {connectionState === "disconnected" && reconnectScheduled && (
        <p className="mt-2 text-sm text-amber-300">再接続予定</p>
      )}
      {connectionState === "error" && reconnectScheduled && (
        <p data-testid="recovery-status-banner" className="mt-2 text-sm text-amber-300">
          自動回復を試行中
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(connectionState === "disconnected" || connectionState === "error") && (
          <button
            type="button"
            className="rounded-[12px] bg-[#00D4AA] px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-[#25e1b7]"
            onClick={handleConnectStart}
          >
            接続開始
          </button>
        )}
        {connectionState === "connected" && (
          <button
            type="button"
            className="rounded-[12px] bg-[#1E2631] px-3 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-600"
            onClick={handleDisconnect}
          >
            切断
          </button>
        )}
      </div>
      <div className="mt-4 rounded-[16px] border border-slate-700 bg-[#151C25] p-3">
        <p className="text-xs font-semibold tracking-wide text-slate-200 [font-family:Oswald,sans-serif]">{configTitle}</p>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={desiredRunConfig.proactivity}
            onChange={() => handleRunConfigToggle("proactivity")}
            disabled={runConfigStatus === "applying"}
          />
          Proactivity
        </label>
        <label className="mt-1 flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={desiredRunConfig.affectiveDialog}
            onChange={() => handleRunConfigToggle("affectiveDialog")}
            disabled={runConfigStatus === "applying"}
          />
          Affective Dialog
        </label>
        <p data-testid="run-config-status" className="mt-2 text-xs text-slate-400">
          {runConfigStatus === "applying" ? "反映中" : "待機"}
        </p>
        <p data-testid="run-config-query" className="mt-1 text-xs text-slate-500">
          {lastRunConfigQuery}
        </p>
        <p data-testid="run-config-effective" className="mt-1 text-xs text-slate-400">
          effective: proactivity={String(effectiveRunConfig.proactivity)}, affectiveDialog=
          {String(effectiveRunConfig.affectiveDialog)}
        </p>
        <p data-testid="run-config-drift" className="mt-1 text-xs text-slate-400">
          {desiredRunConfig.proactivity === effectiveRunConfig.proactivity &&
          desiredRunConfig.affectiveDialog === effectiveRunConfig.affectiveDialog
            ? "一致"
            : "不一致"}
        </p>
      </div>
    </section>
  );

  const renderConversationSection = (className: string, title = "stream_transcript"): JSX.Element => (
    <section aria-label="conversation" role="region" className={className}>
      <p className="text-sm font-semibold tracking-wide text-slate-100 [font-family:Oswald,sans-serif]">{title}</p>
      <ul
        ref={conversationLogRef}
        data-testid="conversation-log"
        className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-[14px] border border-slate-700 bg-[#111821] p-3"
      >
        {conversationMessages.length === 0 && (
          <li className="text-sm text-slate-500">メッセージはまだありません</li>
        )}
        {conversationMessages.map((message) => (
          <li
            key={message.id}
            data-testid={`conversation-message-${message.role}`}
            className={`rounded px-3 py-2 text-sm ${
              message.role === "user"
                ? "bg-[#1E2631] text-[#D9E0EA]"
                : message.status === "interrupted"
                  ? "bg-[#2B1E22] text-[#FF9AA2]"
                  : "bg-[#1A2B27] text-[#DDF6EE]"
            }`}
          >
            {message.content && <p>{message.content}</p>}
            {message.imageData && (
              <img
                src={`data:${message.imageMimeType ?? "image/png"};base64,${message.imageData}`}
                alt="生成画像"
                className="mt-2 max-w-full rounded"
              />
            )}
            <p className="mt-1 text-xs text-slate-400">{message.status}</p>
          </li>
        ))}
      </ul>
    </section>
  );

  const renderEventConsoleSection = (className: string, title = "voice_activity"): JSX.Element => (
    <section aria-label="event-console" role="region" className={className}>
      <p className="text-sm font-semibold tracking-wide text-slate-100 [font-family:Oswald,sans-serif]">{title}</p>
      {renderAudioMetrics()}
      {renderEventLogs()}
    </section>
  );

  return (
    <main className="min-h-screen bg-[#0B0E13] text-slate-100" data-layout={layoutMode}>
      <header className="border-b border-slate-800 bg-[#0F141C] px-4 py-4">
        <h1 className="text-3xl font-semibold leading-none [font-family:Oswald,sans-serif]">Realtime Voice Agent</h1>
        <p className="mt-1 text-xs text-slate-400 [font-family:'JetBrains_Mono',monospace]">
          {layoutMode === "desktop" && "BIDI streaming console for text, audio, and image context"}
          {layoutMode === "tablet" && "tablet_layout // collapsible panels"}
          {layoutMode === "mobile" && "live_voice_console"}
        </p>
        <p data-testid="layout-mode" className="mt-1 text-xs text-slate-500">
          {layoutMode}
        </p>
      </header>

      {layoutMode === "desktop" && (
        <div className="m-4 grid grid-cols-[260px_1fr_360px] gap-6 rounded-[24px] bg-[#0F1115] p-6">
          {renderConnectionSection("rounded-[20px] border border-slate-800 bg-[#151A20] p-[20px_18px]", "session_overview", "run_config")}
          <div className="flex min-h-[560px] flex-col gap-4">
            {renderConversationSection("flex-1 rounded-[16px] border border-slate-800 bg-[#151C25] p-[14px]", "stream_transcript")}
            <div className="rounded-[16px] border border-slate-800 bg-[#151C25] p-3 text-xs text-slate-400 [font-family:'JetBrains_Mono',monospace]">
              stream.websocket ready for text/voice/image payloads
            </div>
          </div>
          <div className="flex min-h-[560px] flex-col gap-4">
            {renderEventConsoleSection("rounded-[16px] border border-slate-800 bg-[#151C25] p-[14px]")}
            <div className="rounded-[16px] border border-slate-800 bg-[#151C25] p-[14px]">
              <p className="text-sm font-semibold tracking-wide text-slate-100 [font-family:Oswald,sans-serif]">image_context</p>
              <p className="mt-2 text-[10px] text-[#6F7B8B] [font-family:'JetBrains_Mono',monospace]">
                model: gemini-live-2.5-flash-native-audio
              </p>
            </div>
          </div>
        </div>
      )}

      {layoutMode === "tablet" && (
        <div className="m-4 grid grid-cols-[1fr_290px] gap-[14px] rounded-[24px] bg-[#0F1115] p-5">
          <div className="flex min-h-[520px] flex-col gap-4">
            {renderConversationSection("rounded-[14px] border border-slate-800 bg-[#151C25] p-3", "conversation_stream")}
            <div className="grid grid-cols-3 gap-[10px]">
              <div className="rounded-[12px] bg-[#171E27] p-[10px]">
                <p className="text-[10px] text-[#8D98A8] [font-family:'JetBrains_Mono',monospace]">latency_ms</p>
                <p className="text-[24px] leading-none [font-family:Oswald,sans-serif]">178</p>
              </div>
              <div className="rounded-[12px] bg-[#171E27] p-[10px]">
                <p className="text-[10px] text-[#8D98A8] [font-family:'JetBrains_Mono',monospace]">turns</p>
                <p className="text-[24px] leading-none [font-family:Oswald,sans-serif]">9</p>
              </div>
              <div className="rounded-[12px] bg-[#FF7A3D] p-[10px] text-[#0F1115]">
                <p className="text-[10px] text-[#2B1408] [font-family:'JetBrains_Mono',monospace]">state</p>
                <p className="text-[24px] leading-none [font-family:Oswald,sans-serif]">SPEAKING</p>
              </div>
            </div>
          </div>
          <div className="flex min-h-[520px] flex-col gap-4">
            {renderConnectionSection("rounded-[14px] border border-slate-800 bg-[#151C25] p-3", "voice_activity", "run_config")}
            {renderEventConsoleSection("flex-1 rounded-[14px] border border-slate-800 bg-[#151C25] p-3", "tool_events")}
          </div>
        </div>
      )}

      {layoutMode === "mobile" && (
        <div className="m-3 flex flex-col gap-[14px] rounded-[28px] bg-[#0F1115] p-[20px_16px]">
          <div className="rounded-[14px] bg-transparent">
            <p className="text-[30px] leading-none [font-family:Oswald,sans-serif]">Voxa Mobile</p>
            <p className="mt-1 text-[11px] text-[#8D98A8] [font-family:'JetBrains_Mono',monospace]">live_voice_console</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-[#1F2A22] px-2 py-1 text-[10px] text-[#2EE6A6]">CONNECTED</span>
              <span className="rounded-full bg-[#2C271B] px-2 py-1 text-[10px] text-[#F7C56B]">reconnecting</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div className="rounded-[12px] bg-[#171E27] p-[10px]">
              <p className="text-[10px] text-[#8D98A8] [font-family:'JetBrains_Mono',monospace]">latency</p>
              <p className="text-[24px] leading-none [font-family:Oswald,sans-serif]">186ms</p>
            </div>
            <div className="rounded-[12px] bg-[#FF7A3D] p-[10px] text-[#0F1115]">
              <p className="text-[10px] text-[#2B1408] [font-family:'JetBrains_Mono',monospace]">state</p>
              <p className="text-[24px] leading-none [font-family:Oswald,sans-serif]">LIVE</p>
            </div>
          </div>
          {renderConversationSection("rounded-[14px] border border-slate-800 bg-[#151C25] p-3", "conversation")}
          <div className="rounded-[16px] border border-slate-800 bg-[#111821] p-3">
            <button
              type="button"
              className="w-full rounded-[16px] bg-[#00D4AA] px-4 py-3 text-xs font-semibold text-[#092118]"
            >
              hold_to_talk
            </button>
          </div>
          <div className="rounded-[14px] border border-slate-800 bg-[#161E28] p-[6px_8px]">
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] [font-family:'JetBrains_Mono',monospace]">
              <div className="rounded-[10px] bg-[#1E2631] py-2 text-white">chat</div>
              <div className="rounded-[10px] bg-[#111722] py-2 text-[#8D98A8]">voice</div>
              <div className="rounded-[10px] bg-[#111722] py-2 text-[#8D98A8]">tools</div>
            </div>
          </div>
          {renderConnectionSection("rounded-[12px] border border-slate-800 bg-[#151C25] p-[10px]", "session_overview", "run_config")}
          {renderEventConsoleSection("rounded-[12px] border border-slate-800 bg-[#151C25] p-[10px]", "tool_events")}
        </div>
      )}

      <section
        aria-label="input-controls"
        role="region"
        className={
          layoutMode === "mobile"
            ? "border-t border-slate-800 bg-[#0F141C] p-3"
            : "sticky bottom-0 border-t border-slate-800 bg-[#0F141C] p-4"
        }
      >
        <form className="flex flex-wrap items-center gap-2" onSubmit={handleTextSendSubmit}>
          <label htmlFor="text-input" className="sr-only">
            テキスト入力
          </label>
          <input
            id="text-input"
            type="text"
            value={textInputValue}
            onChange={(event) => setTextInputValue(event.target.value)}
            className="min-w-[200px] flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="メッセージを入力（例: 画像生成: 夕焼け）"
          />
          <button type="submit" className="rounded-xl bg-[#FF7A3D] px-4 py-2 text-sm font-semibold text-slate-950">
            送信
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#00D4AA] px-4 py-2 text-sm font-semibold text-slate-950"
            onClick={handleVoiceInputToggle}
          >
            {isVoiceInputActive ? "音声停止" : "音声開始"}
          </button>
          <button type="button" className="rounded-xl bg-slate-700 px-3 py-2 text-sm text-white" onClick={handleCameraOpen}>
            画像送信
          </button>
        </form>
        {isVoiceInputActive && (
          <p data-testid="voice-input-state" className="mt-2 text-sm text-emerald-300">
            音声入力中
          </p>
        )}
        <p data-testid="camera-state" className="mt-1 text-sm text-slate-400">
          {cameraActive ? "利用中" : "未使用"}
        </p>
      </section>
      {isCameraModalOpen && (
        <section
          role="dialog"
          aria-label="camera-preview"
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#121821] p-4">
            <p className="text-xl font-semibold [font-family:Oswald,sans-serif]">Camera Preview</p>
            <p className="mt-2 text-sm text-slate-300">プレビュー準備完了</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="rounded-xl bg-[#FF7A3D] px-3 py-2 text-sm font-semibold text-slate-900" onClick={handleCameraSend}>
                画像を送信
              </button>
              <button type="button" className="rounded-xl bg-slate-700 px-3 py-2 text-sm text-white" onClick={handleCameraClose}>
                キャンセル
              </button>
            </div>
          </div>
        </section>
      )}
      <section aria-label="system-notices" role="region" className="border-t border-slate-800 bg-[#0F141C] p-3">
        <p className="text-sm font-medium text-slate-200">システム通知</p>
        <ul data-testid="system-notices" className="mt-1 list-disc pl-5 text-sm text-slate-300">
          {systemNotices.map((notice, index) => (
            <li
              key={`${notice}-${index}`}
              data-testid="system-notice-item"
              className="system-notice-item rounded border-l-2 border-amber-400 bg-amber-950/30 px-2 py-1"
            >
              {notice}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
