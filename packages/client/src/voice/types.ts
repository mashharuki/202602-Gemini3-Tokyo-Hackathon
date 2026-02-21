export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export interface WorldPatchJSON {
  effect: string;
  color: string;
  intensity: number;
  spawn: {
    type: string;
    x: number;
    y: number;
  } | null;
  caption: string;
}

export interface AdkEventPart {
  text?: string;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
}

export interface AdkEventPayload {
  author?: string;
  turnComplete?: boolean;
  interrupted?: boolean;
  content?: {
    parts?: AdkEventPart[];
  };
  inputTranscription?: {
    text?: string;
  };
  outputTranscription?: {
    text?: string;
  };
  error?: string | { message?: string };
}

export type DownstreamMessage =
  | { type: "worldPatch"; patch: WorldPatchJSON }
  | { type: "adkEvent"; payload: AdkEventPayload }
  | { type: "error"; message: string };

export interface ConversationMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  status: "streaming" | "final" | "error";
}

export interface AudioCaptureHandle {
  stream: MediaStream;
  context: AudioContext;
  processor: ScriptProcessorNode | AudioWorkletNode;
  source: MediaStreamAudioSourceNode;
}

export interface AudioPlaybackHandle {
  context: AudioContext;
  nextPlayAt: number;
  activeNodes: Set<AudioBufferSourceNode>;
}
