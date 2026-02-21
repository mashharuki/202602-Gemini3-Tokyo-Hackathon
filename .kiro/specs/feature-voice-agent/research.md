# リサーチログ: 音声AIエージェント基盤 (feature-voice-agent)

## サマリ

- **ディスカバリ種別**: フル（Complex Integration）— 新規 Python サーバー + Gemini Live API + クライアント音声 + MUD 統合
- **調査範囲**: Google ADK Live API, Gemini 構造化出力, Vite WebSocket proxy, 参考実装パターン
- **重要発見**: Gemini Live API (BIDI) は `output_schema` をサポートしない → **ADK Tool Use（関数呼び出し）** で構造化出力を実現する設計に変更

---

## リサーチログ

### トピック 1: Gemini Live API と構造化出力の互換性

**調査内容**: BIDI ストリーミングモードで `output_schema` を使用して世界パッチ JSON を強制できるか。

**調査結果**:
- Google ADK ドキュメントによると、`output_schema` は「LLM Agent の最終応答を JSON スキーマに準拠させる」機能
- ただし BIDI ストリーミングモード（Live API）での `output_schema` サポートは未文書化
- `output_schema` with tools は `Gemini 3.0` 以降でのみサポート
- Live API のリアルタイム性と構造化出力の制約は互換性に課題がある

**含意**: instruction ベースの JSON 生成は信頼性が低い。**ADK Tool Use を採用し、`apply_world_patch` ツールを定義** して構造化パラメータを受け取る設計に変更。

**ソース**: https://google.github.io/adk-docs/agents/models/google-gemini/

---

### トピック 2: ADK Tool Use パターン

**調査内容**: ADK のカスタムツール定義と Live API での関数呼び出しの動作。

**調査結果**:
- ADK の `Agent` はコンストラクタに `tools=[...]` を渡してツールを登録
- ツールは Python 関数として定義し、型ヒントと docstring から自動的にスキーマが生成される
- `runner.run_live()` のイベントストリームにはツール呼び出し結果が含まれる
- sample 実装では `google_search` ツールが登録されており、同じパターンでカスタムツールを追加可能

**含意**: `apply_world_patch(effect, color, intensity, spawn_type, spawn_x, spawn_y, caption)` 関数を定義し、エージェントが世界変更コマンドを検出した際に呼び出す。サーバーはツール呼び出し結果をクライアントに `worldPatch` イベントとして転送する。

**ソース**: `sample/fullstack-voice-ai-agent/app/my_agent/agent.py`, https://github.com/google/adk-python

---

### トピック 3: Vite WebSocket Proxy

**調査内容**: Vite dev server で WebSocket リクエストを Python サーバーにプロキシする設定。

**調査結果**:
- Vite は `server.proxy` で WebSocket プロキシをサポート: `{ '/ws': { target: 'http://localhost:8000', ws: true } }`
- `ws: true` オプションが必須
- 既知の問題: 一部のケースで HTTP として処理される場合がある
- 現在の `vite.config.ts` は port 3000 で、proxy 設定なし

**含意**: `vite.config.ts` に `/ws` パスの proxy 設定を追加する。Python サーバーは port 8000 で起動。

**ソース**: https://vite.dev/config/server-options, https://github.com/vitejs/vite/issues/11146

---

### トピック 4: 音声キャプチャの技術選択

**調査内容**: ScriptProcessorNode vs AudioWorkletNode の選択。

**調査結果**:
- `ScriptProcessorNode` は deprecated だが、全ブラウザで安定動作
- `AudioWorkletNode` はメインスレッドをブロックしないが、セットアップが複雑（別ファイルの Worklet プロセッサが必要）
- sample 実装は `ScriptProcessorNode` を使用（`bufferSize: 4096`）

**含意**: MVP では `ScriptProcessorNode` を採用。ハッカソンの時間制約で十分。

---

### トピック 5: 世界パッチイベントの伝播設計

**調査内容**: サーバーからクライアントへの世界パッチデータの伝播方法。

**調査結果 - 3つのオプション**:

| オプション | 説明 | 信頼性 | レイテンシ |
|---|---|---|---|
| A. Instruction-based JSON | エージェントにテキスト内 JSON 出力を指示 | 低 | 低 |
| B. ADK Tool Use | `apply_world_patch` ツールで構造化パラメータ | 高 | 低 |
| C. Post-processing | 自然言語→別途 Gemini で JSON 変換 | 高 | 高 |

**決定**: **オプション B（ADK Tool Use）** を採用。構造化パラメータの信頼性が高く、追加レイテンシなし。

---

## アーキテクチャパターン評価

### サーバーアーキテクチャ: 統合 vs 分離

| 観点 | 統合型（sample パターン） | マイクロサービス分離 |
|---|---|---|
| 複雑さ | 低 | 高 |
| デプロイ | 単一プロセス | 複数プロセス |
| WebSocket 管理 | 直接 | ゲートウェイ必要 |
| ハッカソン適合 | 高 | 低 |

**決定**: 統合型（単一 FastAPI プロセス）を採用。

---

## リスクと軽減策

| リスク | 影響度 | 軽減策 |
|---|---|---|
| Gemini Live API のツール呼び出し遅延 | 中 | 音声応答とツール結果を並行処理 |
| WebSocket 接続の不安定性 | 中 | 接続状態マシン + 自動再接続 |
| ブラウザの AudioContext 制限 | 低 | ユーザージェスチャー後に初期化 |
| GOOGLE_API_KEY の漏洩 | 高 | サーバー側のみで管理、クライアントに露出しない |
