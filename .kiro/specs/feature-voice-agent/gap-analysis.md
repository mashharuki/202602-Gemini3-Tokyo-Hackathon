# ギャップ分析: 音声AIエージェント基盤 (feature-voice-agent)

## 分析サマリ

| 項目 | 状態 |
|---|---|
| 分析対象 | `packages/client/`, `packages/server/`（未作成）, `sample/fullstack-voice-ai-agent/` |
| 既存の音声関連コード | なし（`packages/` 内にはゼロ） |
| 参考実装 | `sample/fullstack-voice-ai-agent/` に完全なリファレンス実装あり |
| 実装アプローチ | **新規 + 参考移植型**（sample のパターンを EGO アーキテクチャに適応） |

---

## 1. 既存コードベースの構造マップ

### 1.1 存在するもの（再利用可能）

| コンポーネント | ファイル | 再利用可能性 |
|---|---|---|
| MUD systemCalls (applyWorldPatch) | `packages/client/src/mud/createSystemCalls.ts` | **高**: feature-mud-world で実装予定 |
| MUDContext | `packages/client/src/context/MUDContext.tsx` | **高**: そのまま利用 |
| Vite + React + R3F | `packages/client/` | **高**: 既存 UI に統合 |
| pnpm workspace | ルート `package.json` | **高**: server パッケージ追加可能 |

### 1.2 参考実装からの移植候補

| コンポーネント | sample パス | 移植先 | 変更度合い |
|---|---|---|---|
| WebSocket エンドポイント | `app/main.py` | `packages/server/main.py` | 中（世界パッチ生成ロジック追加） |
| エージェント定義 | `app/my_agent/agent.py` | `packages/server/agent/world_agent.py` | 高（instruction を世界パッチ用に書き換え） |
| 接続状態マシン | `frontend/src/connection/` | `packages/client/src/connection/` | 低（ほぼそのまま） |
| AppState 型定義 | `frontend/src/state/app-state.ts` | `packages/client/src/state/` | 中（MUD統合を追加） |
| PCM 変換ユーティリティ | `frontend/src/App.tsx` 内 | `packages/client/src/audio/` | 低（関数を抽出して分離） |
| 音声キャプチャ | `frontend/src/App.tsx` 内 | `packages/client/src/audio/` | 中（モジュール分離） |
| 音声再生 | `frontend/src/App.tsx` 内 | `packages/client/src/audio/` | 中（モジュール分離） |

### 1.3 完全新規で必要なもの

| コンポーネント | 説明 |
|---|---|
| `packages/server/` | Python FastAPI サーバー（パッケージ全体） |
| 世界パッチ抽出ロジック | エージェント応答テキストから JSON ブロックを抽出するパーサー |
| Vite proxy 設定 | WebSocket リクエストを App Server に中継する設定 |
| 音声 UI コンポーネント | マイクボタン、接続状態表示、会話ログ |
| pyproject.toml | Python 依存関係管理 |

---

## 2. 要件ごとのギャップ分析

### 要件 1: App Server

**現状**: `packages/server/` ディレクトリは存在しない。`sample/fullstack-voice-ai-agent/app/` に完全なリファレンス実装あり。

**ギャップ**: Python サーバー全体が未作成。

**実装方針 - 2つのオプション**:

#### オプション A: sample のコピー＆修正（推奨）

- `sample/fullstack-voice-ai-agent/app/` の構造をコピーして `packages/server/` に配置
- `agent.py` の instruction を世界パッチ生成用に書き換え
- `main.py` の downstream 処理に世界パッチ JSON の構造化出力ロジックを追加
- **メリット**: 実証済みのパターンを利用、開発速度が速い
- **デメリット**: sample との同期は手動

#### オプション B: ゼロから構築

- `packages/server/` を新規に作成
- FastAPI + google-adk を自前で構成
- **メリット**: EGO に最適化された設計
- **デメリット**: 開発時間が長い、ハッカソン向きではない

**推奨**: **オプション A**

**技術的考慮事項**:
- `google-adk>=1.22.1`: Agent Development Kit の最新版を使用
- `gemini-live-2.5-flash-native-audio`: リアルタイム音声処理モデル
- `LiveRequestQueue`: ADK の双方向ストリーミングキュー
- `RunConfig(streaming_mode=StreamingMode.BIDI)`: 双方向モード設定

### 要件 2: クライアント音声入力

**現状**: `packages/client/` には音声関連のコードが一切ない。`sample/` の `App.tsx` に全ロジックが1ファイルに集約。

**ギャップ**: 音声キャプチャ、WebSocket 接続、PCM 変換、音声再生のすべてが未実装。

**実装方針**:

sample の `App.tsx` から以下のパターンを **モジュール分離** して移植:

```
packages/client/src/
  audio/
    capture.ts         ← startAudioInputCapture() / stopAudioInputCapture()
    playback.ts        ← playPcmAudioChunk() / stopAudioPlayback()
    pcm-utils.ts       ← floatTo16BitPCM() / parsePcmRate() / decodeBase64ToArrayBuffer()
  connection/
    connection-state-machine.ts  ← そのまま移植
    websocket-manager.ts         ← WebSocket 接続・再接続ロジック
  state/
    voice-agent-state.ts         ← 接続状態、会話履歴、イベントログ
  hooks/
    useVoiceAgent.ts             ← 音声エージェント統合フック
```

**メリット**: UI 層とロジック層の分離（steering の方針に準拠）

### 要件 3: EGO 統合

**現状**: `feature-mud-world` の `applyWorldPatch` systemCall が実装予定（Task 4）。

**ギャップ**: 音声エージェント → MUD systemCalls の橋渡しロジックが未実装。

**技術的課題**:
- **世界パッチ JSON 抽出**: Gemini の応答テキストから JSON ブロックを正確に抽出する必要がある
- **タイミング**: 音声応答の再生と同時にオンチェーン書き込みを行う（非同期並行）
- **エラーハンドリング**: トランザクション失敗時にユーザーに通知

### 要件 4: プロジェクト構成

**現状**: monorepo は `packages/client` と `packages/contracts` のみ。Python プロジェクトは monorepo 管理外。

**ギャップ**: `packages/server/` ディレクトリと pyproject.toml が未作成。

**考慮事項**:
- pnpm workspace は Node.js パッケージを管理するが、Python パッケージは管理外
- `mprocs` を使用した同時起動設定が必要
- Vite の `server.proxy` で WebSocket を Python サーバーに中継

### 要件 5: テスト

**現状**: `sample/` に `connection-state-machine.test.ts` と `app-state.test.ts` がある。

**ギャップ**: EGO 用のテストはゼロ。

**移植候補**:
- `connection-state-machine.test.ts` → ほぼそのまま移植可能
- 世界パッチ抽出テスト → 新規作成
- PCM 変換テスト → sample の型から推論可能

---

## 3. 依存関係の調査

### Python 依存関係

| パッケージ | バージョン | 用途 |
|---|---|---|
| `google-adk` | >=1.22.1 | Gemini Live API 統合 |
| `fastapi` | >=0.115.0 | WebSocket サーバー |
| `uvicorn` | >=0.32.0 | ASGI サーバー |
| `python-dotenv` | >=1.0.0 | 環境変数管理 |
| `websockets` | >=13.0 | WebSocket プロトコル |

### クライアント追加依存（なし）

- 音声キャプチャは Web API (`MediaStream`, `AudioContext`) で完結
- WebSocket は標準 API
- 追加 npm パッケージは不要

---

## 4. 未調査事項・設計フェーズへの引き継ぎ

| 項目 | 説明 | 優先度 |
|---|---|---|
| Gemini の構造化出力制御 | Live API で JSON スキーマを強制する方法（instruction ベース vs tool use） | 高 |
| Vite WebSocket proxy 設定 | `vite.config.ts` の `server.proxy` で ws:// をフォワードする設定の詳細 | 高 |
| 音声レイテンシの実測 | 擬似ストリーミング（1-2秒チャンク）の実際の遅延 | 中 |
| Python パッケージの pnpm 統合 | `mprocs.yaml` の設定とルートからの同時起動方法 | 中 |
| AudioWorklet vs ScriptProcessorNode | ScriptProcessorNode は deprecated だが、AudioWorklet はセットアップが複雑 | 低（MVP では ScriptProcessorNode で十分） |

---

## 5. 推奨実装順序

1. `packages/server/` を sample から移植・初期化（pyproject.toml + main.py + agent.py）
2. Gemini エージェントの instruction を世界パッチ生成用に書き換え
3. クライアント音声モジュール分離（capture, playback, pcm-utils）
4. WebSocket 接続管理と状態マシン
5. Downstream イベント処理と世界パッチ抽出
6. MUD systemCalls 統合
7. UI コンポーネント（マイクボタン、接続状態、会話ログ）
8. Vite proxy + 開発サーバー同時起動設定
9. テスト
