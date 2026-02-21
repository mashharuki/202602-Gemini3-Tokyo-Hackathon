import type {
  AdkEventPart,
  AdkEventPayload,
  AudioCaptureHandle,
  AudioPlaybackHandle,
  ConnectionState,
  ConversationMessage,
  DownstreamMessage,
  WorldPatchJSON,
} from "./types";

type Assert<T extends true> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;
type IsAssignable<T, U> = T extends U ? true : false;

type _ConnectionStateIncludesDisconnected = Assert<
  IsAssignable<"disconnected", ConnectionState>
>;
type _ConnectionStateIncludesConnecting = Assert<
  IsAssignable<"connecting", ConnectionState>
>;
type _ConnectionStateIncludesConnected = Assert<IsAssignable<"connected", ConnectionState>>;
type _ConnectionStateIncludesReconnecting = Assert<
  IsAssignable<"reconnecting", ConnectionState>
>;
type _ConnectionStateIncludesError = Assert<IsAssignable<"error", ConnectionState>>;

type _DownstreamHasWorldPatch = Assert<
  IsAssignable<{ type: "worldPatch"; patch: WorldPatchJSON }, DownstreamMessage>
>;
type _DownstreamHasAdkEvent = Assert<
  IsAssignable<{ type: "adkEvent"; payload: AdkEventPayload }, DownstreamMessage>
>;
type _DownstreamHasError = Assert<
  IsAssignable<{ type: "error"; message: string }, DownstreamMessage>
>;

type _AdkEventHasAuthor = Assert<HasKey<AdkEventPayload, "author">>;
type _AdkEventHasTurnComplete = Assert<HasKey<AdkEventPayload, "turnComplete">>;
type _AdkEventHasContent = Assert<HasKey<AdkEventPayload, "content">>;
type _AdkEventHasParts = Assert<HasKey<AdkEventPart, "text">>;

type _WorldPatchHasEffect = Assert<HasKey<WorldPatchJSON, "effect">>;
type _WorldPatchHasColor = Assert<HasKey<WorldPatchJSON, "color">>;
type _WorldPatchHasIntensity = Assert<HasKey<WorldPatchJSON, "intensity">>;
type _WorldPatchHasSpawn = Assert<HasKey<WorldPatchJSON, "spawn">>;
type _WorldPatchHasCaption = Assert<HasKey<WorldPatchJSON, "caption">>;

type _ConversationHasId = Assert<HasKey<ConversationMessage, "id">>;
type _ConversationHasRole = Assert<HasKey<ConversationMessage, "role">>;
type _ConversationHasContent = Assert<HasKey<ConversationMessage, "content">>;
type _ConversationHasStatus = Assert<HasKey<ConversationMessage, "status">>;

type _CaptureHasStream = Assert<HasKey<AudioCaptureHandle, "stream">>;
type _CaptureHasContext = Assert<HasKey<AudioCaptureHandle, "context">>;
type _CaptureHasProcessor = Assert<HasKey<AudioCaptureHandle, "processor">>;
type _CaptureHasSource = Assert<HasKey<AudioCaptureHandle, "source">>;

type _PlaybackHasContext = Assert<HasKey<AudioPlaybackHandle, "context">>;
type _PlaybackHasNextPlayAt = Assert<HasKey<AudioPlaybackHandle, "nextPlayAt">>;
type _PlaybackHasActiveNodes = Assert<HasKey<AudioPlaybackHandle, "activeNodes">>;

