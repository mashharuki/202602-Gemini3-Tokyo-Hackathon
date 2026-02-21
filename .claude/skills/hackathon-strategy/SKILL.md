---
name: hackathon-strategy
description: Gemini3 Tokyo Hackathon 攻略ガイド。要件定義・設計フェーズで特に活用。ハッカソンのアイデア出し、コンセプト設計、技術選定、受賞戦略の策定を支援。Use when starting hackathon ideation, defining requirements, designing architecture, or planning a winning strategy for AI hackathons.
---

# Hackathon Strategy - Gemini3 Tokyo Hackathon 攻略ガイド

このSKILLは **要件定義・設計フェーズ** に特化し、ハッカソンで **受賞する** プロジェクトを設計するための包括的ガイドです。

## 使用タイミング

1. ハッカソンのアイデア出し・ブレインストーミング時
2. `/kiro:spec-init` や `/kiro:spec-requirements` 実行前の戦略策定時
3. `/kiro:spec-design` 実行前の技術設計時
4. プロジェクトの方向性を決める意思決定時

## クイックスタート: 5ステップ攻略フロー

```
Step 1: 戦略策定 (15分)     → このSKILLの「受賞パターン分析」を読む
Step 2: アイデア検証 (20分)  → 「5つのフィルター」でアイデアを評価
Step 3: 要件定義 (30分)     → テンプレートで要件を形式化
Step 4: 技術設計 (30分)     → Gemini 3 最適アーキテクチャを選定
Step 5: スコープ管理 (15分)  → MVP / Stretch / Dream に分割
```

## 受賞プロジェクトの5つの共通パターン

過去の Cerebral Valley ハッカソン受賞作品（50+プロジェクト分析）から抽出:

### Pattern 1: 「Wow Factor」 - 30秒で伝わるインパクト
- デモの最初の30秒で審査員の心を掴む
- 例: OpenGlass ($20でスマートグラス構築) → 「えっ、$20で!?」
- 例: Gripmind (脳信号でロボットアーム制御) → 視覚的インパクト

### Pattern 2: 「Real Problem」 - 実在する課題を解決
- 架空の問題ではなく、誰もが共感できる課題
- 例: Just Price (医療費の不透明性) → 審査員全員が経験した問題
- 例: Guardian (NHS トリアージ) → 社会的意義

### Pattern 3: 「API Mastery」 - スポンサー技術の深い活用
- スポンサーAPIを表面的に使うのではなく、その強みを最大限活用
- Gemini 3 の場合: マルチモーダル推論、長文コンテキスト、Antigravity
- 例: ArtLens (Gemini画像理解で絵画を現実世界に再解釈)

### Pattern 4: 「Polish & Demo」 - 完成度の高いデモ
- 半完成のプロトタイプよりも、スコープを絞って磨き上げたデモ
- 例: Waddle (ECショッピングアシスタント) → 完成度でOpenAI契約獲得

### Pattern 5: 「Technical Depth」 - 技術的な深み
- 単なるAPI呼び出しではなく、独自の技術的工夫
- 例: Moongrade (マルチコーディングエージェントによるDB移行)
- 例: Team AAA (Llama 3 アクティベーション層の無効化)

## 今回のハッカソン固有コンテキスト

### Gemini 3 Tokyo Hackathon 概要
- **日程**: 2026年2月21日 (対面)
- **テーマ**: Gemini 3 x 次世代ゲーム体験 (Supercell提携)
- **賞金**: $150K Gemini APIクレジット + Supercellフィギュア (上位3チーム)
- **審査員**:
  - Supercell Tokyo AI Innovation Lab ヘッド → ゲームAI・イノベーション重視
  - Zehitomo 共同創業者・会長 → プロダクト・市場適合性重視
  - Antler ベンチャーパートナー → スケーラビリティ・投資価値重視
  - AnotherBall CEO → 起業家視点

### 利用可能技術
- **Gemini 3 API** (メイン)
- **AI Studio** (プロトタイピング)
- **Vertex AI** (本番デプロイ)
- **Antigravity** (エージェント開発プラットフォーム)

### 審査員へのアピールポイント
| 審査員 | 刺さるポイント | 避けるべき点 |
|--------|---------------|-------------|
| Supercell Lab | ゲームAIの革新性、プレイヤー体験の向上 | 既存ゲームの単純なクローン |
| Zehitomo | 実用性、ユーザー価値、市場性 | 技術だけで価値が不明瞭 |
| Antler | スケール可能性、ビジネスモデル | 1回きりのデモ |
| AnotherBall | 起業家精神、野心的ビジョン | 保守的すぎるアイデア |

## アイデア評価: 5つのフィルター

すべてのフィルターを通過するアイデアが受賞確率が高い:

```
Filter 1: [Demo映え] 2分間のデモで「すごい」と言わせられるか？
Filter 2: [技術適合] Gemini 3 の強みを活かしているか？
Filter 3: [実現可能性] 制限時間内にMVPが完成するか？
Filter 4: [差別化] 他チームと被りにくい独自性があるか？
Filter 5: [審査員適合] 4人の審査員のうち3人以上に刺さるか？
```

### 各フィルターの評価基準 (1-5点)

**Filter 1: Demo映え**
- 5: 見た瞬間に「欲しい/すごい」と思える
- 3: 説明すれば良さが伝わる
- 1: 長い説明が必要

**Filter 2: 技術適合**
- 5: Gemini 3 でしかできないこと
- 3: Gemini 3 だとより良くできること
- 1: 任意のLLMで代替可能

**Filter 3: 実現可能性**
- 5: チームの既存スキルで2-3時間で核心部分が完成
- 3: 新しい技術習得が1つ必要
- 1: 複数の未知技術が必要

**Filter 4: 差別化**
- 5: 誰も思いつかないユニークなアプローチ
- 3: 既存アイデアの新しい組み合わせ
- 1: よくある定番アイデア

**Filter 5: 審査員適合**
- 5: 全審査員の専門性に合致
- 3: 2人以上の審査員に刺さる
- 1: 1人以下にしか響かない

**合格ライン: 合計 18点以上 / 25点**

## 要件定義フェーズ: テンプレート

詳細テンプレート → [requirements-template.md](references/requirements-template.md)

### 最小要件定義 (ハッカソン用高速版)

```markdown
# プロジェクト: [名前]

## 一行ピッチ
[WHO]が[WHAT]できる[HOW]を使った[TYPE]

## コア課題
- 誰の: [ターゲットユーザー]
- 何の問題: [具体的な課題]
- なぜ今: [タイミングの理由]

## MVP機能 (必須 - 制限時間内に完成させる)
1. [ ] [機能1] - [所要時間見積]
2. [ ] [機能2] - [所要時間見積]
3. [ ] [機能3] - [所要時間見積]

## Stretch機能 (時間があれば)
1. [ ] [追加機能1]
2. [ ] [追加機能2]

## デモシナリオ (2分間)
1. [0:00-0:30] フック - [最もインパクトのある瞬間を最初に見せる]
2. [0:30-1:00] 課題提示 - [なぜこれが必要か]
3. [1:00-1:30] ソリューション - [コア機能のデモ]
4. [1:30-2:00] ビジョン - [将来の可能性]
```

## 設計フェーズ: Gemini 3 アーキテクチャ選定

詳細ガイド → [gemini3-capabilities.md](references/gemini3-capabilities.md)

### アーキテクチャパターン

#### Pattern A: マルチモーダルインタラクション
```
User Input (text/image/voice) → Gemini 3 → Rich Output
```
- 適用: ゲーム内AIアシスタント、リアルタイムコーチング
- 強み: Gemini 3のネイティブマルチモーダル能力を直接活用

#### Pattern B: エージェンティック
```
User Goal → Antigravity Agent → [Tool1, Tool2, Gemini3] → Result
```
- 適用: 自律ゲームプレイ、戦略立案AI
- 強み: 複雑なタスクの自律実行

#### Pattern C: リアルタイムパイプライン
```
Live Data Stream → Gemini 3 Processing → Real-time Feedback
```
- 適用: ライブゲーム分析、リアルタイムナレーション
- 強み: 即時性とインタラクティブ性

#### Pattern D: 生成＋評価ループ
```
Generate (Gemini 3) → Evaluate → Refine → Output
```
- 適用: ゲームコンテンツ生成、レベルデザイン
- 強み: 品質の自動改善

### 技術スタック推奨構成

```
フロントエンド: Next.js / React + Tailwind CSS (高速UI構築)
バックエンド:   Next.js API Routes / FastAPI
AI:            Gemini 3 API (AI Studio for proto, Vertex AI for prod)
エージェント:   Antigravity (Google公式)
デプロイ:       Vercel / Cloud Run (最速デプロイ)
```

## 時間管理戦略

### ハッカソン全体のタイムライン例 (8時間想定)

```
[Phase 0] 0:00-0:30  戦略策定・チーム合意 (このSKILL活用)
[Phase 1] 0:30-1:30  要件定義・設計 (kiro:spec-requirements, spec-design)
[Phase 2] 1:30-5:30  実装 (kiro:spec-impl) ← 最も長い
[Phase 3] 5:30-6:30  統合テスト・バグ修正
[Phase 4] 6:30-7:30  デモ準備・プレゼン練習
[Phase 5] 7:30-8:00  バッファ・最終調整
```

### 危険信号 (これが出たら方向転換)

- 2時間経過してもコア機能が動かない → スコープ縮小
- Gemini 3 APIの応答が不安定 → フォールバック計画発動
- チーム内で方向性が分裂 → 最もDemo映えするものに集中
- 他チームと同じアイデアと判明 → 差別化ポイントを即座に追加

## プレゼン・デモ設計

### 勝つプレゼンの構造

```
1. フック (10秒): 最もインパクトのある画面/結果を最初に見せる
2. 問題 (20秒): 共感を呼ぶ課題提示
3. ソリューション (30秒): どう解決するか
4. ライブデモ (40秒): 実際に動くところを見せる
5. 技術的深み (10秒): Gemini 3をどう活用したか
6. ビジョン (10秒): 未来の可能性
```

### デモの鉄則

- **ライブデモは必ずバックアップ動画を用意する**
- **最も印象的な機能を最初に見せる** (時間切れリスク対策)
- **画面は大きく、フォントは大きく** (会場の後ろからも見える)
- **専門用語は最小限** (審査員全員が技術者とは限らない)

## 参考資料

- [受賞パターン詳細分析](references/winning-patterns.md) - 過去50+受賞プロジェクトの分析
- [Gemini 3 技術ガイド](references/gemini3-capabilities.md) - API活用の具体例
- [要件定義テンプレート](references/requirements-template.md) - ハッカソン用高速版
- [設計テンプレート](references/design-template.md) - アーキテクチャ設計フレームワーク
