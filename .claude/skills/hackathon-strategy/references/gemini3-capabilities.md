# Gemini 3 技術ガイド - ハッカソン実装向け

ハッカソンで Gemini 3 を最大限活用するための実践的技術ガイド。

## 目次

1. [利用可能なプラットフォーム](#利用可能なプラットフォーム)
2. [Gemini 3 コア機能](#gemini-3-コア機能)
3. [Antigravity エージェントプラットフォーム](#antigravity)
4. [実装パターン集](#実装パターン集)
5. [ハッカソン向けクイックスタート](#クイックスタート)
6. [トラブルシューティング](#トラブルシューティング)

---

## 利用可能なプラットフォーム

### AI Studio (プロトタイピング向け)
- **用途**: 素早い実験、プロンプト調整
- **メリット**: ブラウザで即座に試せる、無料枠あり
- **URL**: aistudio.google.com
- **推奨フェーズ**: アイデア検証 (Phase 0-1)

### Vertex AI (本番デプロイ向け)
- **用途**: 安定したAPI呼び出し、スケーラブル
- **メリット**: 高可用性、エンタープライズ機能
- **推奨フェーズ**: 実装・デモ (Phase 2-4)

### Antigravity (エージェント開発向け)
- **用途**: マルチエージェント、ツール統合
- **メリット**: Google公式エージェントフレームワーク
- **推奨フェーズ**: エージェンティック設計 (Phase 1-2)

---

## Gemini 3 コア機能

### 1. マルチモーダル入力
```
対応入力: テキスト、画像、音声、動画、PDF
特徴: ネイティブ統合 (変換不要)
強み: 異なるモダリティを同時に理解
```

**ハッカソンでの活用:**
- ゲーム画面のスクリーンショット分析
- プレイ動画のリアルタイム解析
- 音声コマンドとビジュアル情報の統合

### 2. 超長文コンテキスト
```
コンテキストウィンドウ: 非常に大きい
強み: 大量のゲームデータを一度に処理
用途: ゲームログ分析、ルールブック全体の理解
```

**ハッカソンでの活用:**
- ゲームの全ルールをコンテキストに入れてAIプレイヤーを作成
- 大量のプレイログを分析してパターン発見
- 複数ドキュメントの横断的な理解

### 3. Function Calling (ツール使用)
```
機能: 外部ツール・APIの呼び出し
強み: 構造化された出力、確実なアクション実行
用途: ゲームエンジンとの連携、データベース操作
```

**実装例:**
```python
tools = [
    {
        "function_declarations": [{
            "name": "analyze_game_state",
            "description": "現在のゲーム状態を分析して最適な行動を提案",
            "parameters": {
                "type": "object",
                "properties": {
                    "game_screenshot": {"type": "string", "description": "Base64エンコードされたゲーム画面"},
                    "player_stats": {"type": "object", "description": "プレイヤーの統計データ"}
                }
            }
        }]
    }
]
```

### 4. 構造化出力 (JSON Mode)
```
機能: JSON形式での確実な出力
強み: パース不要、型安全
用途: ゲームデータの構造化、API連携
```

### 5. ストリーミング
```
機能: トークンごとのリアルタイム出力
強み: UXの向上、リアルタイム感
用途: ライブ解説、リアルタイムフィードバック
```

---

## Antigravity

### 概要
Google の公式エージェント開発プラットフォーム。Gemini 3 と組み合わせてマルチエージェントシステムを構築可能。

### ハッカソンでの活用ポイント

1. **エージェント定義**: 役割と能力を明確に定義
2. **ツール統合**: 外部APIやデータベースとの連携
3. **オーケストレーション**: 複数エージェントの協調動作
4. **監視・デバッグ**: エージェントの行動ログ

### 推奨アーキテクチャ

```
[ユーザー]
    ↓
[オーケストレーター Agent]
    ├── [分析 Agent] ← ゲームデータ分析
    ├── [戦略 Agent] ← 最適行動の計算
    └── [生成 Agent] ← コンテンツ/レポート生成
    ↓
[統合レスポンス]
```

---

## 実装パターン集

### Pattern 1: ゲーム画面分析パイプライン

```python
import google.generativeai as genai

model = genai.GenerativeModel('gemini-3')

def analyze_game_screen(screenshot_path, context=""):
    """ゲーム画面を分析して戦略提案を返す"""
    image = genai.upload_file(screenshot_path)

    prompt = f"""
    あなたはゲーム戦略AIアドバイザーです。

    このゲーム画面を分析して以下を提供してください:
    1. 現在の状況の要約
    2. 推奨される次のアクション (優先順位付き)
    3. リスク分析
    4. 長期戦略への影響

    追加コンテキスト: {context}

    JSON形式で回答してください。
    """

    response = model.generate_content([prompt, image])
    return response.text
```

### Pattern 2: リアルタイムゲーム実況

```python
async def live_commentary(game_stream):
    """ゲーム映像をリアルタイムで解説"""
    model = genai.GenerativeModel('gemini-3')

    async for frame in game_stream:
        response = await model.generate_content_async(
            [
                "あなたはプロのゲーム実況者です。この場面を30文字以内でエキサイティングに実況してください。",
                frame
            ],
            stream=True
        )
        async for chunk in response:
            yield chunk.text
```

### Pattern 3: AIゲームマスター

```python
def game_master(player_action, game_state, story_context):
    """プレイヤーの行動に応じて物語を動的に生成"""
    model = genai.GenerativeModel('gemini-3')

    system_prompt = """
    あなたはインタラクティブゲームのゲームマスターです。
    プレイヤーの行動に応じて:
    1. 結果を描写する
    2. 新しい選択肢を提示する
    3. 物語の整合性を保つ
    4. 難易度を動的に調整する

    応答はJSON形式で:
    {
        "narration": "物語の描写",
        "choices": ["選択肢1", "選択肢2", "選択肢3"],
        "game_state_update": {...},
        "difficulty_adjustment": float
    }
    """

    response = model.generate_content([
        system_prompt,
        f"ゲーム状態: {game_state}",
        f"物語コンテキスト: {story_context}",
        f"プレイヤーの行動: {player_action}"
    ])
    return response.text
```

### Pattern 4: マルチモーダルゲームアシスタント

```python
def multimodal_assistant(text_query=None, image=None, audio=None):
    """テキスト/画像/音声の任意の組み合わせで入力を受け付ける"""
    model = genai.GenerativeModel('gemini-3')

    parts = [
        "あなたはゲームの万能アシスタントです。プレイヤーの質問に答え、ヒントを提供します。"
    ]

    if text_query:
        parts.append(f"質問: {text_query}")
    if image:
        parts.append(image)
    if audio:
        parts.append(audio)

    response = model.generate_content(parts)
    return response.text
```

---

## クイックスタート

### 最速セットアップ (5分)

```bash
# 1. パッケージインストール
pip install google-generativeai

# 2. APIキー設定
export GOOGLE_API_KEY="your-api-key"

# 3. 動作確認
python -c "
import google.generativeai as genai
model = genai.GenerativeModel('gemini-3')
response = model.generate_content('Hello, Gemini 3!')
print(response.text)
"
```

### Next.js + Gemini 3 セットアップ

```bash
# 1. プロジェクト作成
npx create-next-app@latest my-hackathon-app --typescript --tailwind --app
cd my-hackathon-app

# 2. Gemini SDK インストール
npm install @google/generative-ai

# 3. 環境変数設定
echo "GOOGLE_API_KEY=your-api-key" > .env.local
```

```typescript
// app/api/gemini/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: Request) {
  const { prompt, image } = await req.json();
  const model = genAI.getGenerativeModel({ model: "gemini-3" });

  const parts = [prompt];
  if (image) {
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: image }
    });
  }

  const result = await model.generateContent(parts);
  return NextResponse.json({ text: result.response.text() });
}
```

---

## トラブルシューティング

### よくある問題と対策

| 問題 | 原因 | 対策 |
|------|------|------|
| API レート制限 | 短時間に大量のリクエスト | バッチ処理、キャッシュ、リクエスト間隔の調整 |
| レスポンスが遅い | 大きな入力/複雑なプロンプト | プロンプト最適化、ストリーミング使用 |
| 出力が不安定 | プロンプトが曖昧 | Few-shot例の追加、JSON Mode使用 |
| 画像分析の精度が低い | 画像の質が低い/小さい | 高解像度画像の使用、コンテキスト追加 |
| コスト超過 | 不要なAPIコール | キャッシュ戦略、入力の最適化 |

### ハッカソン中のフォールバック戦略

```
Level 1: Gemini 3 が不安定 → AI Studio UIで手動デモ
Level 2: API全体が不安定 → 事前録画したデモ動画
Level 3: ネットワーク障害 → ローカルキャッシュからの再生
```

### パフォーマンス最適化のコツ

1. **プロンプトキャッシュ**: 同じシステムプロンプトを使い回す
2. **ストリーミング**: ユーザー体験を向上させつつ、待ち時間を隠す
3. **バッチ処理**: 複数のリクエストをまとめて送信
4. **結果キャッシュ**: 同じ入力に対する結果をキャッシュ
5. **並列処理**: 独立したAPIコールを並列実行
