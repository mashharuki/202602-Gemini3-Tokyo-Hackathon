# Research & Design Decisions — feature-image-agent

## Summary
- **Feature**: `feature-image-agent`
- **Discovery Scope**: New Feature（新規機能）
- **Key Findings**:
  - Gemini API (`@google/genai` v1.42.0) は `gemini-3-pro-image-preview` モデルで画像生成をサポートし、レスポンスの `inlineData` からBase64画像を取得する
  - 既存の `WorldPatchJSON.spawn` フィールドが Image Agent の入力トリガーとなる。`createSystemCalls.ts` に既に `applyWorldPatch` と `spawnEntity` が実装済み
  - クライアントは React + `@react-three/fiber` を採用しており、スプライトはThree.jsの `Sprite` + `SpriteMaterial` + `TextureLoader` で配置可能

## Research Log

### Gemini API 画像生成仕様
- **Context**: Nano Banana API (Gemini画像生成) をスポーン時のアセット生成に利用する
- **Sources Consulted**: `sample/nano-banana/src/generateImages.ts`、`@google/genai` パッケージ、`nano-banana-api-dev` スキル
- **Findings**:
  - 使用モデル: `gemini-3-pro-image-preview`
  - 設定: `responseModalities: ["IMAGE"]`, `imageConfig: { aspectRatio, imageSize }`
  - レスポンス構造: `response.candidates[0].content.parts[].inlineData.data` (Base64)
  - APIキーは `GOOGLE_AI_STUDIO_API_KEY` 環境変数で管理
  - 既存実装はサーバーサイド（Bun）で動作、クライアント直接呼び出しには API キー露出防止が必要
- **Implications**:
  - クライアントから直接 API を呼ぶとキーが露出するため、プロキシサーバーまたはサーバーレス関数が必要
  - ハッカソン MVP では Vite dev proxy または簡易 Express サーバーで対応可能
  - 画像サイズは `1:1` アスペクト比がスプライト用に最適

### 既存 MUD アーキテクチャとスポーンフロー
- **Context**: `spawn` パラメータが画像エージェントへの入力となる
- **Sources Consulted**: `packages/contracts/mud.config.ts`, `WorldPatchSystem.sol`, `createSystemCalls.ts`
- **Findings**:
  - `SpawnRecord` テーブル: `{ id: bytes32, entityType: bytes32, x: int32, y: int32, spawnedAt: uint256 }`
  - `WorldPatchJSON.spawn`: `{ type: string, x: number, y: number } | null`
  - `applyWorldPatch` はオンチェーンで `spawnEntity` を呼び、`SpawnRecord` を書き込む
  - クライアントは `@latticexyz/react` の `useEntityQuery(Has(SpawnRecord))` で変更を検知可能
  - `entityType` (bytes32) がスポーンされるエンティティの種類を識別する
- **Implications**:
  - Image Agent はオンチェーンのスポーンイベントを直接監視するのではなく、`applyWorldPatch` 実行後のクライアント側 MUD 同期イベントを起点にする
  - `entityType` をプロンプトのキーワードとして画像生成に使用する

### Three.js スプライト配置パターン
- **Context**: 生成画像を3D空間内に表示する方式
- **Sources Consulted**: `packages/client/src/App.tsx`, Three.js ドキュメント, `@react-three/fiber` パターン
- **Findings**:
  - 既存の `App.tsx` は `<mesh>` + `<boxGeometry>` / `<sphereGeometry>` でオブジェクトを配置
  - R3F では `<sprite>` + `<spriteMaterial>` で2Dスプライトを3D空間に配置可能
  - `TextureLoader` を使って Base64 データURLまたは Blob URL からテクスチャを生成
  - カメラは固定のアイソメトリック風視点（YXZ回転）
- **Implications**:
  - スプライトは常にカメラ方向を向くため、2Dピクセルアセットとの相性が良い
  - Base64 → Data URL → `TextureLoader` のパスが最も直接的

### フォールバック戦略
- **Context**: API失敗・遅延時の代替表示
- **Sources Consulted**: 要件 3 の受入条件
- **Findings**:
  - `public/fallback-sprites/` ディレクトリはまだ存在しない（新規作成が必要）
  - デフォルトスプライトセットを事前に用意する必要がある
  - タイムアウト閾値と即時切り替えの仕組みが必要
- **Implications**:
  - フォールバック用の予備スプライト画像を `packages/client/public/fallback-sprites/` に配置
  - `entityType` ごとに対応するフォールバック画像をマッピングするか、汎用フォールバックを1枚用意

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Client-side Service Layer | React Hook + Service クラスでクライアント内に Image Agent を閉じ込める | シンプル、MUD同期と直接連携 | API キーのクライアント露出 | MVPでは proxy 経由で回避 |
| Cloud Run Server Endpoint | 既存の packages/server FastAPI にエンドポイント追加 | APIキー安全、Vertex AI IAM、既存インフラ活用 | Cloud Run コールドスタート | feature-voice-agent と同一パターン |
| Edge Function | Vercel/Cloudflare Edge で画像生成を仲介 | 低レイテンシ、スケーラブル | 既存インフラと競合 | 不採用 |

**選択**: Cloud Run Server Endpoint + Client-side Service Layer

## Design Decisions

### Decision: 画像生成サービスの配置
- **Context**: Gemini API 呼び出しをどこに配置するか
- **Alternatives Considered**:
  1. クライアント直接呼び出し — APIキー露出リスク
  2. Vite dev proxy 経由 — 開発専用、本番では使えない
  3. 既存 `packages/server/` FastAPI にエンドポイント追加 + Cloud Run デプロイ — 既存インフラ活用
- **Selected Approach**: `packages/server/main.py` に `POST /api/generate-image` を追加し、Cloud Run 上で実行
- **Rationale**: feature-voice-agent と同一の Cloud Run サービスを共有でき、Dockerfile/deploy.sh/ランタイムSA が既に整備済み。Vertex AI 経由で IAM ベースのアクセス制御が可能で、API キー管理が不要
- **Trade-offs**: サーバーサイドに Python 実装が必要だが、既存パターンに沿うため追加コストは最小限
- **Follow-up**: Cloud Run コールドスタートの影響をレイテンシ計測で確認

### Decision: スポーン検知の起点
- **Context**: 画像生成をいつ開始するか
- **Alternatives Considered**:
  1. オンチェーンイベント直接監視 — 複雑
  2. `applyWorldPatch` 呼び出し後のクライアント側フック — シンプル
  3. MUD コンポーネント変更のリアクティブ検知 — 中間
- **Selected Approach**: `applyWorldPatch` 呼び出し側で画像生成を並行起動し、MUD テーブル同期後に配置
- **Rationale**: 既存の `createSystemCalls` に追加するだけで最小限の変更で済む
- **Trade-offs**: 他クライアントからのスポーンは MUD 同期経由で検知する必要がある
- **Follow-up**: マルチクライアント対応は `useEntityQuery(Has(SpawnRecord))` でリアクティブ検知を追加

### Decision: フォールバック画像の管理
- **Context**: API 失敗時にどの画像を表示するか
- **Alternatives Considered**:
  1. `entityType` ごとに個別フォールバック画像 — 柔軟だが初期コスト高
  2. 汎用フォールバック1枚 — シンプルだが識別性が低い
  3. カテゴリ別フォールバック — バランス型
- **Selected Approach**: 汎用フォールバック1枚 + 将来的にカテゴリ別拡張
- **Rationale**: MVP では1枚で十分。カテゴリマッピングは後から追加可能
- **Trade-offs**: 初期は全スポーンが同一見た目のフォールバックになる
- **Follow-up**: カテゴリ別マッピングテーブルの設計

## Risks & Mitigations
- Gemini API レート制限 — バックオフ＋キュー制御で緩和。フォールバック即時採用
- 画像生成レイテンシ（2-10秒） — タイムアウト閾値設定 + 楽観的 UI（フォールバック先行表示→生成完了で差し替え）
- APIキー露出 — Vite proxy で隠蔽、本番化時に Edge Function 移行
- MUD同期遅延 — クライアント側で SpawnRecord の変更を楽観的に処理

## References
- [Gemini API 画像生成ドキュメント](https://ai.google.dev/gemini-api/docs/image-generation) — 画像生成設定とレスポンス形式
- [Three.js Sprite](https://threejs.org/docs/#api/en/objects/Sprite) — 3D空間内スプライト配置
- [MUD Framework](https://mud.dev/) — オンチェーン同期フレームワーク
- [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber/) — React ベースの Three.js ラッパー
