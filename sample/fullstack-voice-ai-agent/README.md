# リアル音声AIエージェントのデモアプリ

## プロジェクトの概要

Google ADKのBidiストリーミングを利用した、音声・テキスト・画像に対応するリアルタイムAIデモアプリです。FastAPIのWebSocket経由で双方向通信し、フロントエンドは会話ログ・イベントログ・接続状態などの観測性を提供します。

## 機能一覧表

| 機能 | 概要 |
| --- | --- |
| 音声対話 | マイク入力と音声出力の双方向ストリーミング |
| テキスト対話 | テキスト入力とリアルタイム応答表示 |
| 画像入力 | カメラキャプチャ画像をアップロード |
| 画像生成 | 指定プロンプトで画像生成し会話欄に表示 |
| 文字起こし | 音声入力/出力のトランスクリプション表示 |
| 接続管理 | 接続/再接続/切断の状態表示 |
| イベント観測 | 通信イベントを時系列で確認 |
| PWA対応 | Manifest/Service Worker/オフライン表示 |

## フォルダ構成

```
adk-streaming-guide/
├── app/
│   ├── main.py
│   ├── my_agent/
│   │   └── agent.py
│   └── static/
│       ├── index.html
│       ├── assets/
│       └── service-worker.js
├── frontend/
│   ├── src/
│   └── __tests__/
├── docs/
└── README.md
```

## 技術スタック

| カテゴリ | 技術 | 概要 | バージョン |
| --- | --- | --- | --- |
| Backend | Python | 実行環境 | >=3.10 |
| Backend | FastAPI | WebSocket対応APIサーバー | >=0.115.0 |
| Backend | Google ADK | エージェント/ストリーミング基盤 | >=1.22.1 |
| Backend | Uvicorn | ASGIサーバー | >=0.32.0 |
| Backend | python-dotenv | 環境変数読込 | >=1.0.0 |
| Backend | websockets | WebSocketユーティリティ | >=13.0 |
| Frontend | React | UIライブラリ | 19.0.0 |
| Frontend | Vite | ビルド/開発サーバー | 6.0.3 |
| Frontend | TypeScript | 型付きJavaScript | 5.7.2 |
| Frontend | Tailwind CSS | スタイリング | 4.0.0 |
| Frontend | Vitest | テストランナー | 2.1.8 |
| Frontend | Testing Library | UIテスト支援 | 16.1.0 |

## 動かし方

### venvのセットアップ

```bash
python3 -m venv venv
source venv/bin/activate
```

### 依存関係のインストール

```bash
pip install -e .
```

### 環境変数の設定

`.env`を作って以下の設定

```bash
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=TRUE
```

### フロントエンドアプリケーションのビルド

```bash
cd frontend 
bun run build
```

### 音声エージェントの立ち上げ(バックエンド)

```bash
cd app
python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

### Dockerでバックエンドを起動

Dockerで起動する場合は以下のコマンドを実行する

```bash
cd app
# Dockerコンテナイメージのビルド
docker build -t voice-agent-backend .
source .env
# コンテナ起動
docker run --rm -p 8080:8080 voice-agent-backend \
  -e GOOGLE_APPLICATION_CREDENTIALS=/var/secrets/google/key.json \
  -v /path/to/service-account.json:/var/secrets/google/key.json:ro \
  voice-agent-backend
```

### CloudRunにデプロイ

```bash
./app/deploy.sh
```

### CloudRunからデストロイ

```bash
# Artifact Registryまでまとめて削除
FORCE=true DELETE_SA=true DELETE_AR_REPOSITORY=true ./app/cleanup.sh
```

### PWA の確認

- `http://localhost:8080/` でアクセス
- ブラウザ DevTools の Application タブで以下を確認
  - `Manifest` が読める
  - `Service Workers` に `/service-worker.js` が登録される
  - オフライン時もシェルが表示される

## 参考文献
- [GitHub -adk-samples](https://github.com/google/adk-samples/tree/main)
