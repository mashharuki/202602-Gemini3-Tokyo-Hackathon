# API Playbook (Gemini Image Generation)

## 前提
- SDK: `@google/genai`
- 認証: `GEMINI_API_KEY`
- 主なモデル: `gemini-2.5-flash-image-preview`

## テキストから画像生成
- `responseModalities` に `TEXT` と `IMAGE` を指定する。
- `contents` にテキストプロンプトを渡す。
- レスポンスの `candidates[].content.parts[]` から `inlineData` を抽出して画像保存する。

## 画像入力 + テキスト編集
- 入力画像をbase64化して `inlineData` として渡す。
- `mimeType` を正しく設定する（例: `image/png`, `image/jpeg`）。
- `contents` は `[prompt, inlineData]` または意味順で構成する。

## マルチターン編集
- `ai.chats.create({ model })` でセッション化する。
- 1ターン目の出力（画像/テキスト）を踏まえて次ターンを送る。
- 中間成果物を保存して、セッション途切れ時に再開可能にする。

## 実装時の注意
- 画像は多数返る可能性を考慮し、配列で扱う。
- テキスト説明が空の場合を考慮してフォールバック文言を用意する。
- 入力サイズ超過時は事前検証で弾き、API失敗を減らす。
