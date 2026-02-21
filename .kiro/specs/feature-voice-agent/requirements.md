# 要件定義: 音声AIエージェント基盤 (feature-voice-agent)

## プロジェクト概要

Echo Genesis Online (EGO) における、音声入力を起点とした世界パッチ生成パイプラインの基盤を構築する。ユーザーの音声入力を Gemini Live API（双方向ストリーミング）で処理し、構造化された世界パッチ JSON を生成してMUDワールドに適用する。

### パイプライン全体像

```
音声入力 → PCM エンコード → WebSocket → App Server (Python/FastAPI)
→ Gemini Live API (BIDI streaming) → 構造化 JSON (世界パッチ)
→ WebSocket → クライアント → MUD systemCalls → オンチェーン反映
```

### 参考実装

`sample/fullstack-voice-ai-agent` の以下のパターンを踏襲する:
- WebSocket 双方向ストリーミング (`upstream_task` / `downstream_task`)
- `google.adk` (Agent Development Kit) による Gemini Live API 統合
- 16bit PCM 音声エンコード/デコード
- 接続状態マシン (`connectionStateMachine`)

---

## 要件一覧

### 1 App Server（Python / FastAPI）

#### 1.1 WebSocket エンドポイント

**説明**: クライアントとの双方向リアルタイム通信を提供する WebSocket エンドポイント。

**受入基準**:
- The App Server shall expose a WebSocket endpoint at `/ws/{user_id}/{session_id}` that accepts client connections.
- When a WebSocket connection is established, the server shall create an ADK session via `InMemorySessionService` if one does not exist for the given user/session pair.
- The server shall run upstream (client→server) and downstream (server→client) tasks concurrently using `asyncio.gather`.
- When the WebSocket connection is closed or errors, the server shall clean up the `LiveRequestQueue` and log the disconnection.

#### 1.2 Upstream 処理（音声→Gemini）

**説明**: クライアントから受信した音声データ・テキストを Gemini Live API に転送する。

**受入基準**:
- When the server receives a binary WebSocket message, it shall interpret the data as 16-bit PCM audio at 16kHz and forward it to `LiveRequestQueue.send_realtime` as an audio blob.
- When the server receives a JSON text message with `type: "text"`, it shall forward the text content to `LiveRequestQueue.send_content`.
- The upstream task shall run in an infinite loop until the WebSocket disconnects.

#### 1.3 Downstream 処理（Gemini→クライアント）

**説明**: Gemini Live API からのレスポンスイベントをクライアントに転送する。

**受入基準**:
- The server shall iterate over events from `runner.run_live()` and send each event as JSON text to the WebSocket client.
- When a downstream event contains a `turnComplete` flag, the server shall include it in the forwarded message.
- If `runner.run_live()` raises an exception, the server shall send an error payload to the client before closing.

#### 1.4 Gemini エージェント定義

**説明**: 世界パッチ JSON を生成するための Gemini Live エージェントを定義する。

**受入基準**:
- The agent shall use the `gemini-live-2.5-flash-native-audio` model for real-time audio processing.
- The agent instruction shall direct the model to interpret voice input as world-altering commands and output structured JSON matching the world patch schema (`effect`, `color`, `intensity`, `spawn`, `caption`).
- The RunConfig shall enable `StreamingMode.BIDI` with `response_modalities` set to `["AUDIO"]` and input/output audio transcription enabled.
- The agent shall use a system instruction that constrains output to valid world patch JSON when a world command is detected.

#### 1.5 構造化 JSON 出力（世界パッチスキーマ）

**説明**: Gemini が音声入力に対して世界パッチ JSON を生成する際のスキーマ定義。

**受入基準**:
- The agent's structured output shall conform to the world patch schema: `{ effect: string, color: string, intensity: number, spawn: object|null, caption: string }`.
- When the agent detects a world-altering command in the voice input, it shall include a JSON block in its text response following the world patch schema.
- When the voice input is conversational (not a world command), the agent shall respond with audio only and not generate a world patch JSON.

---

### 2 クライアント音声入力（packages/client）

#### 2.1 マイク入力キャプチャ

**説明**: ブラウザの MediaStream API を使用してマイク音声をキャプチャする。

**受入基準**:
- The client shall request microphone access via `navigator.mediaDevices.getUserMedia({ audio: true })`.
- The client shall create an `AudioContext` with a sample rate of 16000 Hz for capturing audio.
- The client shall use a `ScriptProcessorNode` (or `AudioWorkletNode`) to process audio frames and convert them to 16-bit PCM using the `floatTo16BitPCM` conversion.
- When voice input is active, the client shall send PCM audio chunks as binary WebSocket messages to the App Server.
- When voice input is stopped, the client shall release the `MediaStream`, close the `AudioContext`, and disconnect the processor nodes.

#### 2.2 WebSocket 接続管理

**説明**: App Server との WebSocket 接続を管理する。

**受入基準**:
- The client shall establish a WebSocket connection to `ws(s)://{host}/ws/{userId}/{sessionId}` when the user initiates a connection.
- The client shall use a connection state machine with states: `disconnected`, `connecting`, `connected`, `reconnecting`, `error`.
- When the WebSocket connection is lost unexpectedly, the client shall transition to `reconnecting` state and attempt reconnection.
- The client shall store the WebSocket instance in a React ref to avoid re-render side effects.

#### 2.3 Downstream イベント処理

**説明**: App Server から受信したイベントを解析し、世界パッチとして処理する。

**受入基準**:
- When the client receives a text WebSocket message, it shall parse the JSON payload as an ADK event.
- When the parsed event contains a text part with a valid world patch JSON block, the client shall extract and validate the JSON.
- When a valid world patch JSON is extracted, the client shall invoke `applyWorldPatch` from MUD `systemCalls` to apply the patch on-chain.
- When the event contains `turnComplete: true`, the client shall finalize the current agent response.
- When the event contains audio data, the client shall decode and play the audio response.

#### 2.4 音声出力（エージェント応答再生）

**説明**: Gemini エージェントの音声応答をブラウザで再生する。

**受入基準**:
- The client shall create a separate `AudioContext` for audio output playback.
- When the client receives PCM audio chunks from the downstream, it shall decode and schedule playback using `AudioBufferSourceNode`.
- The client shall parse the sample rate from the MIME type (e.g., `audio/pcm;rate=24000`) and resample if necessary.
- When a new turn starts (interruption), the client shall stop current audio playback.

---

### 3 EGO 統合

#### 3.1 MUD systemCalls 連携

**説明**: 音声エージェントが生成した世界パッチをMUDのオンチェーン状態に反映する。

**受入基準**:
- When a world patch JSON is received from the agent, the client shall call the `applyWorldPatch` function defined in `feature-mud-world` to apply the patch on-chain.
- The client shall validate the world patch JSON using the `validateWorldPatch` function before sending the transaction.
- If validation fails, the client shall display an error notice without sending a transaction.

#### 3.2 UI 統合

**説明**: 音声エージェントの接続状態と会話履歴を既存のUIに統合する。

**受入基準**:
- The client shall display the current connection state (connecting/connected/disconnected/error) in the UI.
- The client shall provide a button to toggle voice input on/off.
- The client shall display a conversation log showing user transcriptions and agent responses.
- The client shall display a notification when a world patch is successfully applied.

---

### 4 App Server 配置と環境設定

#### 4.1 プロジェクト構成

**説明**: App Server を monorepo 内に配置する。

**受入基準**:
- The App Server shall be placed at `packages/server/` within the monorepo structure.
- The server shall use Python with FastAPI and `google-adk` as its primary dependencies.
- The server shall read API keys from environment variables (never hardcoded).
- The server shall include a `pyproject.toml` for dependency management.

#### 4.2 開発サーバー起動

**説明**: ローカル開発でクライアントとサーバーを同時起動する。

**受入基準**:
- The development setup shall support running the App Server and the client dev server concurrently (via `mprocs` or similar).
- The client's Vite dev server shall proxy WebSocket requests to the App Server.
- The server shall be startable with `uvicorn` on a configurable port.

---

### 5 テスト要件

#### 5.1 接続状態マシンテスト

**受入基準**:
- The test suite shall verify all state transitions of the connection state machine (disconnected→connecting→connected, connected→disconnected, etc.).

#### 5.2 世界パッチ抽出テスト

**受入基準**:
- The test suite shall verify that world patch JSON blocks are correctly extracted from agent text responses.
- The test suite shall verify that non-world-patch text responses do not trigger patch extraction.

#### 5.3 PCM 変換テスト

**受入基準**:
- The test suite shall verify that `floatTo16BitPCM` correctly converts Float32Array audio samples to Int16Array PCM data.

---

## 非機能要件

### 6 レイテンシ

**受入基準**:
- The end-to-end latency from voice input to world patch application shall be perceptible but acceptable for a demo environment (target: under 3 seconds for the AI processing portion).

### 7 セキュリティ

**受入基準**:
- The App Server shall not expose API keys to the client.
- The WebSocket endpoint shall not require authentication for MVP (demo environment only).

---

## スコープ外

- 音声入力のノイズキャンセリングや高度な音声処理
- マルチプレイヤー音声チャネル管理
- App Server の本番デプロイ・スケーリング
- Gemini の Nano Banana（画像生成）統合（別仕様で管理）
- MUD コントラクト側の変更（`feature-mud-world` で完了済み）
