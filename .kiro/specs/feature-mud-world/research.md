# リサーチログ: MUD世界状態同期基盤 (feature-mud-world)

## サマリ

- **ディスカバリ種別**: 拡張型（Extension）— 既存 MUD スキャフォールドへの機能追加
- **調査範囲**: MUD v2.2.23 のテーブルスキーマ型、System コントラクトパターン、クライアント同期メカニズム
- **結論**: 既存パターンをそのまま拡張可能。破壊的変更なし。

---

## リサーチログ

### トピック 1: `bytes3` 型の MUD サポート

**調査内容**: `mud.config.ts` で `bytes3` を color フィールドに使用可能か。

**調査結果**:
- `@latticexyz/schema-type` v2.2.23 の `schemaAbiTypes` 定義を実機確認
- `bytes1` 〜 `bytes32` すべてが `staticAbiTypes` に含まれることを確認
- `bytes3` は静的型（固定長3バイト）として正しくサポートされている

**含意**: RGB カラー値（3バイト）を `bytes3` として直接保存可能。追加の変換やパッキングは不要。

**ソース**: `packages/contracts/node_modules/@latticexyz/schema-type/dist/internal.d.ts`

---

### トピック 2: MUD シングルトンテーブルパターン

**調査内容**: カウンタ等の単一値を保持するテーブルの定義方法。

**調査結果**:
- MUD v2 では `key: []`（空配列）でシングルトンテーブルを定義可能
- 単一行のみ持つテーブルとして動作し、`get()` / `set()` でアクセス
- Solidity 側では `TableName.get()` と `TableName.set(value)` がキーなしで生成される

**含意**: `PatchCounter` テーブルを `key: []` で定義し、パッチ連番とエンティティ ID 生成に利用する。

---

### トピック 3: MUD クライアント自動同期

**調査内容**: 新テーブル追加時のクライアント側変更要否。

**調査結果**:
- `setupNetwork.ts` の `syncToRecs` は `mudConfig` を引数に取り、config 内の全テーブルを自動同期
- `createClientComponents.ts` は `...components` スプレッドで全コンポーネントを公開
- `mud.config.ts` にテーブルを追加 → `mud build` → クライアント側は `createSystemCalls.ts` のみ変更

**含意**: ネットワーク層・コンポーネント登録層は変更不要。型も `mud.config.ts` から自動推論される。

**ソース**: `packages/client/src/mud/setupNetwork.ts`, `packages/client/src/mud/createClientComponents.ts`

---

### トピック 4: System コントラクトの namespace prefix

**調査内容**: `app` namespace 内の System メソッドのクライアント呼び出し規約。

**調査結果**:
- 既存 `MoveSystem.move()` は `worldContract.write.app__move([x, y, z])` で呼び出し
- namespace `app` のメソッドには `app__` prefix が自動付与される
- 新 `WorldPatchSystem` のメソッドも `app__applyWorldPatch(...)` 等になる

**含意**: クライアント側 systemCalls で `app__` prefix を使用する必要がある。

**ソース**: `packages/client/src/mud/createSystemCalls.ts`, `packages/contracts/src/codegen/world/IMoveSystem.sol`

---

### トピック 5: viem の型変換ユーティリティ

**調査内容**: Gemini JSON のフィールド（string, hex color）を Solidity 型に変換する方法。

**調査結果**:
- `viem` (v2.35.1) は以下のユーティリティを提供:
  - `stringToHex(str, { size: 32 })` → `bytes32` 変換
  - `toHex(value)` → 汎用 hex 変換
  - `pad(hex, { size: N })` → パディング
- カラー変換: `"#FF00FF"` → `"0xFF00FF"` → `0xFF00FF` as `Hex`（3バイト）

**含意**: viem の既存ユーティリティで全型変換をカバー可能。追加ライブラリ不要。

---

## アーキテクチャパターン評価

### 単一 System vs 分割 System

| 観点 | 単一 (WorldPatchSystem) | 分割 (Effect/Spawn/Caption) |
|---|---|---|
| 複雑さ | 低 | 中 |
| デプロイコスト | 低（1コントラクト） | 高（3コントラクト） |
| テスト容易性 | 十分 | やや高い |
| 一括操作 | 自然（1メソッド） | 複雑（委譲 or 複数 tx） |
| ハッカソン適合 | 高 | 低 |

**決定**: 単一 `WorldPatchSystem` を採用。

### カウンタ管理: テーブル vs コントラクト変数

| 観点 | PatchCounter テーブル | contract storage |
|---|---|---|
| MUD 哲学 | 準拠（全状態をテーブルに） | 非準拠 |
| クライアント可視性 | 自動同期で読取可能 | 別途 view 関数が必要 |
| ガスコスト | やや高い | やや低い |
| デバッグ | 容易（テーブル参照可能） | 困難 |

**決定**: `PatchCounter` シングルトンテーブルを採用。

---

## リスクと軽減策

| リスク | 影響度 | 軽減策 |
|---|---|---|
| ガスリミット超過（4テーブル同時書き込み） | 低 | spawn スキップ条件分岐で削減、ローカル devnet ではほぼ問題なし |
| bytes3 カラー値のエンディアン | 低 | Solidity は big-endian、viem も big-endian で一致 |
| 再デプロイ時のデータ消失 | 中 | MVP ではローカル devnet 前提で許容、本番では migration が必要 |
