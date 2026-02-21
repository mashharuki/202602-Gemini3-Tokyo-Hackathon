# ギャップ分析: MUD世界状態同期基盤 (feature-mud-world)

## 分析サマリ

| 項目 | 状態 |
|---|---|
| 分析対象 | `packages/contracts/`, `packages/client/src/mud/` |
| 既存テーブル | `Position` のみ（1テーブル）|
| 既存システム | `MoveSystem` のみ（1システム）|
| MUD バージョン | `@latticexyz/*` 2.2.23 |
| 実装アプローチ | **拡張型**（既存スキャフォールドを活かして拡張）|

---

## 1. 既存コードベースの構造マップ

### 1.1 コントラクト層 (`packages/contracts/`)

| ファイル | 役割 | 変更要否 |
|---|---|---|
| `mud.config.ts` | テーブル定義（`Position` のみ） | **要変更**: 4テーブル追加 |
| `src/systems/MoveSystem.sol` | 移動ロジック | 変更不要 |
| `src/codegen/` | MUD 自動生成コード | `mud build` で再生成 |
| `test/WorldTest.t.sol` | 最小テスト（World 存在確認のみ） | **要拡張**: WorldPatchSystem テスト追加 |
| `foundry.toml` | Foundry 設定 | 変更不要 |

### 1.2 クライアント層 (`packages/client/src/mud/`)

| ファイル | 役割 | 変更要否 |
|---|---|---|
| `setupNetwork.ts` | viem client + syncToRecs | 変更不要（自動で新テーブル同期） |
| `createClientComponents.ts` | コンポーネント登録 | 変更不要（`...components` スプレッドで自動） |
| `createSystemCalls.ts` | World contract 呼び出し | **要変更**: 新しい system call 追加 |
| `setup.ts` | 初期化統合 | 変更不要 |
| `getNetworkConfig.ts` | ネットワーク設定 | 変更不要 |
| `world.ts` | RECS world インスタンス | 変更不要 |

### 1.3 クライアント UI 層

| ファイル | 役割 | 変更要否 |
|---|---|---|
| `App.tsx` | 3D シーン + Position 表示 | 将来的に要変更（本仕様スコープ外） |
| `context/MUDContext.tsx` | MUD Provider | 変更不要（型は自動推論） |
| `hooks/useKeyboardMovement.ts` | キーボード入力 | 変更不要 |

---

## 2. 要件ごとのギャップ分析

### 要件 1: ECS テーブル定義

**現状**: `mud.config.ts` に `Position` テーブル1つのみ。
**ギャップ**: `WorldEffect`, `SpawnRecord`, `WorldCaption`, `WorldPatchLog` の4テーブルが未定義。

**実装方針**:
- `mud.config.ts` の `tables` オブジェクトにテーブル定義を追加
- `mud build` で codegen を再生成
- MUD v2 の `defineWorld` API は複数テーブルの同一 namespace 内定義をネイティブにサポート

**リスクと注意点**:
- `bytes3` 型は MUD の `SchemaType` でサポート済み（RGB カラー表現として利用可能）
- `string` 型（caption 用）は動的長さフィールドとして MUD が処理する
- テーブル追加後はワールドの再デプロイが必要（ローカル devnet なら問題なし）

**実装コスト**: 低（設定ファイルの拡張 + 再生成）

---

### 要件 2: WorldPatchSystem コントラクト

**現状**: `MoveSystem.sol` が唯一のシステムコントラクト。MUD `System` 基底クラスの利用パターンは確立済み。
**ギャップ**: `WorldPatchSystem` が存在しない。

**実装方針 - 2つのオプション**:

#### オプション A: 単一ファイル方式（推奨）
```
src/systems/WorldPatchSystem.sol  (新規)
```
- `applyWorldPatch`, `setEffect`, `spawnEntity`, `setCaption` を1つのコントラクトに集約
- `MoveSystem` と同じパターンで `System` を継承
- **メリット**: シンプル、デプロイコスト低、ハッカソン向き
- **デメリット**: コントラクトサイズが大きくなる可能性（ただしMVPでは問題なし）

#### オプション B: 機能分割方式
```
src/systems/EffectSystem.sol   (新規)
src/systems/SpawnSystem.sol    (新規)
src/systems/CaptionSystem.sol  (新規)
```
- 機能ごとにシステムを分離
- **メリット**: 責務分離、テスト容易性
- **デメリット**: ファイル数増加、`applyWorldPatch` の一括操作が複雑化

**推奨**: **オプション A**（ハッカソンの時間制約、既存パターンとの一致）

**技術的考慮事項**:
- エンティティ ID 生成: `keccak256(abi.encodePacked(msg.sender, block.timestamp, nonce))` パターンが一般的
- パッチログの連番管理: コントラクト内に `uint256 patchCounter` を持つか、テーブル自体にカウンタを保持
- MUD の namespace prefix: `app__` が自動付与される（例: `app__applyWorldPatch`）

---

### 要件 3: クライアント統合

**現状**:
- `createClientComponents.ts`: `...components` スプレッドにより、MUD が `mud.config.ts` から自動推論するコンポーネントはすべて登録済み。**新テーブル追加時に変更不要**。
- `createSystemCalls.ts`: `moveTo` / `moveBy` のみ。worldContract の `write` メソッドを使用するパターンが確立済み。
- `setupNetwork.ts`: `syncToRecs` が `mudConfig` を受け取って自動同期。**変更不要**。

**ギャップ**: `createSystemCalls.ts` に世界パッチ関連の関数が未定義。

**実装方針**:
```typescript
// createSystemCalls.ts に追加するパターン
const applyWorldPatch = async (
  effect: string, color: string, intensity: number,
  spawnType: string | null, spawnX: number, spawnY: number,
  caption: string
) => {
  // Gemini JSON → Solidity パラメータ変換
  // worldContract.write.app__applyWorldPatch([...])
  // await waitForTransaction(tx)
};
```

**型変換の注意点**:
| Gemini JSON | TypeScript | Solidity | 変換 |
|---|---|---|---|
| `effect: string` | `string` | `bytes32` | `stringToHex` / `toBytes32` |
| `color: "#FF00FF"` | `string` | `bytes3` | hex parse → `0xFF00FF` |
| `intensity: 80` | `number` | `uint8` | 範囲チェック後そのまま |
| `spawn.type: string` | `string` | `bytes32` | `stringToHex` / `toBytes32` |
| `spawn.x, spawn.y` | `number` | `int32` | そのまま |
| `caption: string` | `string` | `string` | そのまま |

---

### 要件 4: バリデーション

**現状**: バリデーション層は存在しない。
**ギャップ**: Gemini JSON の構造・値域チェックが未実装。

**実装方針 - 2つのオプション**:

#### オプション A: systemCalls 内でインラインバリデーション（推奨）
- `createSystemCalls.ts` 内の各関数で送信前にチェック
- **メリット**: 既存パターンに合致、追加ファイル不要
- **デメリット**: バリデーションロジックが systemCalls に混在

#### オプション B: 独立バリデーション関数
- `src/mud/validateWorldPatch.ts` を新設
- **メリット**: 責務分離、再利用可能
- **デメリット**: ファイル追加

**推奨**: **オプション A**（MVP 段階では十分、後から分離可能）

---

### 要件 5: 既存テーブルとの共存

**リスク**: 低
- `mud.config.ts` の `tables` はオブジェクトのマージであり、既存 `Position` テーブルに影響しない
- `mud build` は全テーブルを再生成するが、既存の `Position.sol` の API は不変
- `MoveSystem.sol` は `Position` のみに依存しており、新テーブル追加の影響を受けない

---

### 要件 6: テスト

**現状**: `test/WorldTest.t.sol` に World 存在確認テストのみ（実質テストなし）。
**ギャップ**: WorldPatchSystem のロジックテストが完全に不足。

**実装方針**:
- `test/WorldPatchSystemTest.t.sol` を新設
- `MudTest` 基底クラスを継承（既存パターンと同一）
- 各メソッドの正常系・異常系をカバー

---

### 要件 7-8: 非機能要件

**ガスコスト**: MUD v2 のテーブル書き込みは最適化されており、4テーブルへの書き込みでも一般的なブロックガスリミット内に収まる。spawn スキップの条件分岐は `bytes32(0)` チェックで実装可能。

**バージョン互換性**: 全パッケージが `2.2.23` で統一されており、互換性リスクなし。

---

## 3. 影響範囲の全体図

```
変更ファイル（最小セット）:
  packages/contracts/
    ├── mud.config.ts              [変更] テーブル4つ追加
    ├── src/systems/
    │   └── WorldPatchSystem.sol   [新規] メインシステム
    └── test/
        └── WorldPatchSystemTest.t.sol [新規] テスト

  packages/client/
    └── src/mud/
        └── createSystemCalls.ts   [変更] 世界パッチ関連関数追加

自動再生成（mud build）:
  packages/contracts/
    └── src/codegen/
        ├── index.sol              [再生成]
        ├── tables/
        │   ├── WorldEffect.sol    [新規生成]
        │   ├── SpawnRecord.sol    [新規生成]
        │   ├── WorldCaption.sol   [新規生成]
        │   └── WorldPatchLog.sol  [新規生成]
        └── world/
            ├── IWorld.sol         [再生成]
            └── IWorldPatchSystem.sol [新規生成]
```

---

## 4. 未調査事項・設計フェーズへの引き継ぎ

| 項目 | 説明 | 優先度 |
|---|---|---|
| `bytes3` 型の MUD サポート状況 | `mud.config.ts` で `bytes3` が `SchemaType` として利用可能か実機確認が必要 | 高 |
| パッチカウンタの管理方法 | `WorldPatchLog` のキー生成にカウンタを使う場合、System 内の状態変数 vs テーブルベース | 中 |
| ゾーン ID の初期設計 | MVP ではグローバルスコープ（固定キー `bytes32(0)`）で十分か | 中 |
| クライアント ABI 型の自動生成 | `IWorld.abi.json` の再生成でクライアント側の型が自動更新されるか確認 | 低（MUD の標準動作） |

---

## 5. 推奨実装順序

1. `mud.config.ts` にテーブル定義追加 → `mud build`
2. `WorldPatchSystem.sol` 実装
3. `WorldPatchSystemTest.t.sol` でテスト
4. `createSystemCalls.ts` にクライアント関数追加
5. E2E 動作確認（ローカル devnet）
