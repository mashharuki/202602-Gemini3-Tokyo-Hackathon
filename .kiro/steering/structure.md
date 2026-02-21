# Structure Steering

## リポジトリ構造
- `packages/`: プロダクト本体
  - `client/`: React + R3F による表示と入力
  - `contracts/`: MUD world 定義と system 実装
- `sample/`: 独立した検証・参考実装（本体と責務分離）
- `.kiro/specs/`: 機能ごとの仕様管理
- `.kiro/steering/`: プロジェクト全体の永続方針

## クライアント構造パターン
- `src/mud/` にチェーン接続・設定・system call を集約する
- `src/App.tsx` など UI は `MUDContext` 経由で状態/操作を受け取る
- import は「ローカル相対 import」と「workspace エイリアス（例: `contracts/...`）」を使い分ける

## コントラクト構造パターン
- `mud.config.ts`: テーブル/namespace の定義
- `src/systems/`: 手書きロジック
- `src/codegen/`: MUD 生成コード（直接編集しない）
- `test/`: Foundry テスト

## 変更時の配置ルール
- 世界スキーマ変更は `mud.config.ts` 起点で行い、関連生成物を再生成する
- UI 表現変更は `client/src` に閉じ込め、チェーン同期ロジックを混在させない
- 新しい機能単位は、まず `packages` 配下の責務境界に従って配置先を決める

## 命名・依存の一貫性
- 機能名は「world/systems/components」など既存ドメイン語彙を優先する
- 依存方向は `client -> contracts(生成成果物参照)` を維持し、逆依存は作らない
- 新規ディレクトリ追加時は「既存パターンで表現できない理由」を明確にする
