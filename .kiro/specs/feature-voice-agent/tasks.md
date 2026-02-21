# 実装タスク: 音声AIエージェント基盤 (feature-voice-agent)

## 要件カバレッジ

| 要件 ID         | タスク                  |
| --------------- | ----------------------- |
| 1.1, 1.2, 1.3  | Task 2.2                |
| 1.4, 1.5       | Task 2.1                |
| 2.1             | Task 3.2, Task 4.1      |
| 2.2             | Task 3.3, Task 5.1, Task 6.1 |
| 2.3             | Task 5.2, Task 6.1      |
| 2.4             | Task 4.2                |
| 3.1             | Task 5.2                |
| 3.2             | Task 6.1, Task 6.2      |
| 4.1             | Task 1                  |
| 4.2             | Task 6.2                |
| 5.1             | Task 3.3                |
| 5.2             | Task 5.2                |
| 5.3             | Task 3.2                |
| 6               | Task 2.2                |
| 7               | Task 1                  |

---

## Task 1: App Server プロジェクト初期化と環境設定

**要件**: 4.1, 7
**依存**: なし（最初に実行）

- [ ] 1. App Server の Python プロジェクトを monorepo 内に新規作成する
  - `packages/server/` ディレクトリと `agent/` サブディレクトリを作成する
  - `pyproject.toml` に FastAPI, google-adk, uvicorn の依存を定義する
  - `.env.example` に `GOOGLE_API_KEY` の環境変数テンプレートを作成する
  - `.env` を `.gitignore` に追加し、API キーがリポジトリに含まれないようにする
  - `agent/__init__.py` を空ファイルとして作成する
  - _Requirements: 4.1, 7_

---

## Task 2: Gemini エージェントと WebSocket エンドポイント

**要件**: 1.1, 1.2, 1.3, 1.4, 1.5, 6
**依存**: Task 1（プロジェクト構成が完了後）

### 2.1 世界パッチツール関数と Gemini Live エージェントを定義する

- [ ] 2.1 世界パッチツール関数と Gemini Live エージェントを定義する
  - `apply_world_patch` ツール関数を定義し、effect, color, intensity, spawn_type, spawn_x, spawn_y, caption パラメータを受け取り、構造化された世界パッチ辞書を返す
  - ツール関数の戻り値に `status: "applied"` と `patch` オブジェクトを含める
  - `gemini-live-2.5-flash-native-audio` モデルを使用する ADK Agent を定義する
  - エージェントの instruction に、音声入力から世界変更コマンドを検出し `apply_world_patch` ツールを呼び出す指示を記述する
  - 通常会話では音声応答のみを返し、ツールを呼び出さない旨を instruction に含める
  - _Requirements: 1.4, 1.5_

### 2.2 WebSocket エンドポイントの upstream/downstream 処理を実装する

- [ ] 2.2 WebSocket エンドポイントの upstream/downstream 処理を実装する
  - FastAPI アプリケーションに `/ws/{user_id}/{session_id}` WebSocket エンドポイントを作成する
  - 接続時に `InMemorySessionService` でセッションを作成/取得する
  - upstream タスクで、binary メッセージを 16kHz PCM 音声として `LiveRequestQueue.send_realtime` に転送する
  - upstream タスクで、`type: "text"` の JSON メッセージを `LiveRequestQueue.send_content` に転送する
  - downstream タスクで、`runner.run_live()` のイベントを JSON として WebSocket クライアントに送信する
  - ツール呼び出し結果に世界パッチデータが含まれる場合、`{ type: "worldPatch", patch: {...} }` 形式で送信する
  - `turnComplete` フラグをイベントに含めて転送する
  - RunConfig に `StreamingMode.BIDI`, `response_modalities: ["AUDIO"]`, 音声トランスクリプション有効化を設定する
  - upstream/downstream を `asyncio.gather` で並行実行する
  - 接続終了・エラー時に `LiveRequestQueue` をクリーンアップしログを出力する
  - エラー発生時はクライアントにエラーペイロードを送信してから接続を閉じる
  - _Requirements: 1.1, 1.2, 1.3, 6_

---

## Task 3: クライアント共通基盤（型定義・ユーティリティ・状態マシン）

**要件**: 2.1, 2.2, 5.1, 5.3
**依存**: なし（Task 1, 2 と並行可能）

### 3.1 (P) 音声エージェントの型定義を作成する

- [ ] 3.1 (P) 音声エージェントの型定義を作成する
  - 接続状態型 (`disconnected`, `connecting`, `connected`, `reconnecting`, `error`) を定義する
  - Downstream メッセージ型（worldPatch, adkEvent, error の判別共用体）を定義する
  - ADK イベントペイロード型（author, turnComplete, content, parts 等）を定義する
  - 世界パッチ JSON 型（effect, color, intensity, spawn, caption）を定義する
  - 会話メッセージ型（id, role, content, status）を定義する
  - AudioCaptureHandle, AudioPlaybackHandle 型を定義する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_

### 3.2 (P) PCM 変換ユーティリティを実装しテストを書く

- [ ] 3.2 (P) PCM 変換ユーティリティを実装しテストを書く
  - `floatTo16BitPCM` 関数で Float32Array を Int16Array に変換する（クランプ処理含む）
  - `parsePcmRate` 関数で MIME タイプ文字列からサンプルレートを解析する（例: `audio/pcm;rate=24000` → 24000）
  - `decodeBase64ToArrayBuffer` 関数で base64 文字列を ArrayBuffer にデコードする
  - テストで `floatTo16BitPCM` の変換精度を検証する（0.0 → 0, 1.0 → 32767, -1.0 → -32768）
  - テストで `parsePcmRate` が正しいレート値を返すことを検証する
  - テストで不正な MIME タイプにフォールバック値を使うことを検証する
  - _Requirements: 2.1, 5.3_

### 3.3 (P) 接続状態マシンを実装しテストを書く

- [ ] 3.3 (P) 接続状態マシンを実装しテストを書く
  - 純粋関数 `connectionStateMachine(state, event)` を実装し、状態とイベントから次の状態を返す
  - 遷移ルール: `disconnected` → `connecting`, `connecting` → `connected` or `error`, `connected` → `disconnected` or `error`, `error` → `reconnecting`, `reconnecting` → `connected` or `error`
  - 無効な遷移では現在の状態を維持する
  - `getConnectionStateLabel(state)` で日本語表示ラベルを返す関数を実装する
  - テストで全有効遷移（7パターン）を検証する
  - テストで無効な遷移が状態を変更しないことを検証する
  - _Requirements: 2.2, 5.1_

---

## Task 4: クライアント音声処理モジュール

**要件**: 2.1, 2.4
**依存**: Task 3（型定義と PCM ユーティリティが必要）

### 4.1 (P) マイク入力キャプチャモジュールを実装する

- [ ] 4.1 (P) マイク入力キャプチャモジュールを実装する
  - `startAudioCapture` 関数で `getUserMedia({ audio: true })` によりマイクアクセスを取得する
  - `AudioContext` を 16kHz サンプルレートで作成する
  - `ScriptProcessorNode`（bufferSize: 4096）で音声フレームを処理する
  - `floatTo16BitPCM` で変換した PCM データをコールバック関数で返す
  - `stopAudioCapture` 関数で MediaStream トラック停止、AudioContext クローズ、プロセッサ切断を行う
  - 戻り値の `AudioCaptureHandle` に stream, context, processor, source を含める
  - _Requirements: 2.1_

### 4.2 (P) 音声応答再生モジュールを実装する

- [ ] 4.2 (P) 音声応答再生モジュールを実装する
  - `createAudioPlayback` 関数で 24kHz サンプルレートの再生用 `AudioContext` を作成する
  - `playPcmChunk` 関数で base64 データを ArrayBuffer にデコードし、MIME タイプからサンプルレートを解析する
  - `AudioBufferSourceNode` を使い、`nextPlayAt` タイムスタンプでシームレスにスケジュール再生する
  - `stopPlayback` 関数で AudioContext をクローズする
  - `interruptPlayback` 関数で再生中のノードを即座に停止し `nextPlayAt` をリセットする（ターン割り込み対応）
  - _Requirements: 2.4_

---

## Task 5: WebSocket 管理と世界パッチ処理

**要件**: 2.2, 2.3, 3.1, 5.2
**依存**: Task 3（型定義と接続状態マシンが必要）

### 5.1 WebSocket 接続マネージャーを実装する

- [ ] 5.1 WebSocket 接続マネージャーを実装する
  - WebSocket インスタンスの生成・管理を行うモジュールを作成する
  - `ws(s)://{host}/ws/{userId}/{sessionId}` に接続する関数を提供する
  - 接続状態マシンと連携し、接続/切断/エラーイベントに応じて状態を遷移させる
  - binary メッセージ（PCM 音声）と text メッセージ（JSON）の送信関数を提供する
  - 予期しない切断時に `reconnecting` 状態への遷移とリコネクトを試行する
  - _Requirements: 2.2_

### 5.2 世界パッチイベントハンドラーを実装しテストを書く

- [ ] 5.2 世界パッチイベントハンドラーを実装しテストを書く
  - `handleDownstreamMessage` 関数で WebSocket テキストメッセージを解析し、`DownstreamMessage` 型に分類する
  - `type: "worldPatch"` メッセージから `WorldPatchJSON` を抽出する
  - `applyWorldPatchFromAgent` 関数で `validateWorldPatch` → `systemCalls.applyWorldPatch` の流れを実装する
  - バリデーション失敗時はトランザクションを送信せずエラーを返す
  - テストで世界パッチ JSON ブロックが正しく抽出されることを検証する
  - テストで通常テキスト応答（非世界パッチ）がパッチ抽出をトリガーしないことを検証する
  - テストでバリデーション失敗時にエラーが返ることを検証する
  - _Requirements: 2.3, 3.1, 5.2_

---

## Task 6: 統合（React フック・Vite プロキシ・UI）

**要件**: 2.2, 2.3, 3.2, 4.2
**依存**: Task 4, Task 5（音声モジュールとイベント処理が完了後）

### 6.1 音声エージェント統合 React フックを実装する

- [ ] 6.1 音声エージェント統合 React フックを実装する
  - `useVoiceAgent` フックで WebSocket 接続管理、音声キャプチャ、イベント処理を統合する
  - `connect` / `disconnect` で WebSocket 接続を制御する
  - `toggleVoice` でマイク入力の開始/停止を切り替え、PCM チャンクを WebSocket 経由で送信する
  - Downstream イベント受信時に世界パッチの自動適用と音声応答の自動再生を行う
  - `turnComplete` イベントで会話メッセージの確定処理を行う
  - WebSocket インスタンスを React ref で管理し、re-render の副作用を回避する
  - 接続状態、音声アクティブ状態、会話履歴、パッチ適用結果を公開する
  - `sendText` でテキストコマンドを送信する機能を提供する
  - _Requirements: 2.2, 2.3, 3.2_

### 6.2 Vite プロキシ設定と音声エージェント UI を統合する

- [ ] 6.2 Vite プロキシ設定と音声エージェント UI を統合する
  - `vite.config.ts` に `/ws` パスを App Server（`http://localhost:8000`）に転送する WebSocket プロキシを追加する
  - 既存の App.tsx に音声エージェント UI コンポーネントを追加する
  - 接続状態（connecting/connected/disconnected/error）をラベル表示する
  - 音声入力のオン/オフを切り替えるボタンを配置する
  - ユーザーの発話トランスクリプションとエージェント応答の会話ログを表示する
  - 世界パッチの適用成功時に通知を表示する
  - _Requirements: 3.2, 4.2_
