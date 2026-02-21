# Tech Steering

## 技術スタック方針
本リポジトリは `pnpm workspace` による monorepo を前提とし、`packages/client` と `packages/contracts` を中核に構成する。

- フロントエンド: React + Vite + TypeScript
- 3D 表現: `@react-three/fiber`（Three.js ラッパー）
- オンチェーン同期: Lattice MUD (`@latticexyz/*`)
- コントラクト開発: Solidity + Foundry + MUD CLI

## 実装規約
- TypeScript はルート `tsconfig.json` を起点に各パッケージで拡張する
- クライアントは MUD 初期化を `setup -> setupNetwork -> systemCalls/components` の流れで分離し、UI 層とネットワーク層を分ける
- コントラクト側は `mud.config.ts` をスキーマの単一情報源とし、`src/codegen` は生成物として扱う
- Lint/format/test はパッケージ単位で持ち、ルートから再帰実行できる形を維持する

## 依存関係と生成物の扱い
- `node_modules`, `out`, `cache`, `deploys` などの生成物は編集対象にしない
- 実装変更は原則 `src` と設定ファイルに限定し、生成コードはコマンドで再生成する
- 秘密情報は `.env` で管理し、コードへ埋め込まない

## 品質ゲート
- 変更時は少なくとも影響パッケージの `build` と `test` が通ること
- 仕様変更がある場合は `.kiro/specs/` の対応仕様を更新してから実装する
- 既存パターンで説明できる変更は、新しい規約を増やさない（最小原則）
