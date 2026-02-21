# 実装タスク: MUD世界状態同期基盤 (feature-mud-world)

## 要件カバレッジ

| 要件 ID | タスク |
|---|---|
| 1.1, 1.2, 1.3, 1.4 | Task 1 |
| 2.1 | Task 3 |
| 2.2 | Task 2.1 |
| 2.3 | Task 2.2 |
| 2.4 | Task 2.3 |
| 3.1 | Task 4 |
| 3.2 | Task 4.1 |
| 4.1 | Task 4.2 |
| 5.1 | Task 1.1 |
| 6.1 | Task 2, Task 3.2 |
| 7 | Task 3.1 |
| 8 | Task 1.1 |

---

## Task 1: ECS テーブル定義と codegen 基盤構築

**要件**: 1.1, 1.2, 1.3, 1.4, 5.1, 8
**依存**: なし（最初に実行）

### 1.1 mud.config.ts にテーブル定義を追加

- [x] `packages/contracts/mud.config.ts` を開き、既存の `Position` テーブルを保持したまま、以下の5テーブルを `app` namespace の `tables` に追加する:
  - **WorldEffect**: キー `zoneId: bytes32`、値 `effect: bytes32`, `color: bytes3`, `intensity: uint8`
  - **SpawnRecord**: キー `id: bytes32`、値 `entityType: bytes32`, `x: int32`, `y: int32`, `spawnedAt: uint256`
  - **WorldCaption**: キー `zoneId: bytes32`、値 `updatedAt: uint256`, `caption: string`（MUD制約: 静的型が動的型より前）
  - **WorldPatchLog**: キー `patchId: bytes32`、値 `appliedBy: bytes32`, `appliedAt: uint256`
  - **PatchCounter**: キーなし（シングルトン `key: []`）、値 `value: uint256`
- [x] `@latticexyz/*` バージョン `2.2.23` との互換性を確認する（`bytes3`, `string`, `uint256` 型が `SchemaAbiType` に含まれること）

### 1.2 codegen の生成とビルド検証

- [ ] `packages/contracts` ディレクトリで `pnpm mud build` を実行し、以下が生成されることを確認する:
  - `src/codegen/tables/WorldEffect.sol`
  - `src/codegen/tables/SpawnRecord.sol`
  - `src/codegen/tables/WorldCaption.sol`
  - `src/codegen/tables/WorldPatchLog.sol`
  - `src/codegen/tables/PatchCounter.sol`
  - `src/codegen/world/IWorldPatchSystem.sol`（Task 2 以降で生成）
  - `src/codegen/index.sol` が全テーブルの import を含むこと
- [ ] `forge build` がエラーなく完了すること
- [ ] 既存の `Position.sol` と `IMoveSystem.sol` が破壊されていないこと

---

## Task 2: WorldPatchSystem 個別メソッド実装とテスト

**要件**: 2.2, 2.3, 2.4, 6.1
**依存**: Task 1（codegen 完了後）

### 2.1 (P) setEffect メソッドの実装とテスト

- [ ] `packages/contracts/src/systems/WorldPatchSystem.sol` を新規作成し、`System` を継承する
- [ ] `setEffect(bytes32 zoneId, bytes32 effect, bytes3 color, uint8 intensity)` メソッドを実装する:
  - `intensity > 100` の場合、`"Intensity must be <= 100"` でリバートする
  - `WorldEffect.set(zoneId, effect, color, intensity)` でテーブルを更新する
- [ ] `packages/contracts/test/WorldPatchSystemTest.t.sol` を新規作成し、`MudTest` を継承する
- [ ] テストケース `testSetEffect_updatesWorldEffect` を書き、正常系で WorldEffect が更新されることを検証する
- [ ] テストケース `testSetEffect_revertsOnHighIntensity` を書き、`intensity = 101` で revert することを検証する
- [ ] `pnpm mud test` で全テストが通ることを確認する

### 2.2 (P) spawnEntity メソッドの実装とテスト

- [ ] `WorldPatchSystem` に `spawnEntity(bytes32 entityType, int32 x, int32 y) returns (bytes32)` メソッドを実装する:
  - `PatchCounter.get()` で現在のカウンタ値を取得し、+1 してセットする
  - `entityId = keccak256(abi.encodePacked(_msgSender(), block.timestamp, counter))` で一意 ID を生成する
  - `SpawnRecord.set(entityId, entityType, x, y, block.timestamp)` でテーブルに書き込む
  - `entityId` を返す
- [ ] テストケース `testSpawnEntity_uniqueIds` を書き、連続2回の呼び出しで異なる entityId が返ることを検証する
- [ ] テストケース `testSpawnEntity_setsTimestamp` を書き、`spawnedAt` が `block.timestamp` と一致することを検証する
- [ ] `pnpm mud test` で全テストが通ることを確認する

### 2.3 (P) setCaption メソッドの実装とテスト

- [ ] `WorldPatchSystem` に `setCaption(bytes32 zoneId, string calldata caption)` メソッドを実装する:
  - `WorldCaption.set(zoneId, caption, block.timestamp)` でテーブルを更新する
- [ ] テストケース `testSetCaption_updatesWithTimestamp` を書き、caption と updatedAt が正しく設定されることを検証する
- [ ] `pnpm mud test` で全テストが通ることを確認する

---

## Task 3: applyWorldPatch 統合メソッドと統合テスト

**要件**: 2.1, 6.1, 7
**依存**: Task 2（個別メソッド完了後）

### 3.1 applyWorldPatch 統合メソッドの実装

- [ ] `WorldPatchSystem` に `applyWorldPatch(bytes32 effect, bytes3 color, uint8 intensity, bytes32 spawnType, int32 spawnX, int32 spawnY, string calldata caption)` メソッドを実装する:
  - `intensity > 100` の場合リバートする
  - `GLOBAL_ZONE = bytes32(0)` を定数として定義する
  - `WorldEffect.set(GLOBAL_ZONE, effect, color, intensity)` を呼び出す
  - `spawnType != bytes32(0)` の場合のみ、spawnEntity ロジックを実行する（ガス節約）
  - `bytes(caption).length > 0` の場合のみ、`WorldCaption.set(GLOBAL_ZONE, caption, block.timestamp)` を呼び出す
  - `PatchCounter` をインクリメントし、`patchId` を生成して `WorldPatchLog.set(patchId, callerAsBytes32, block.timestamp)` を記録する

### 3.2 統合テストの作成

- [ ] テストケース `testApplyWorldPatch_updatesAllTables` を書き、全フィールド指定時に WorldEffect, SpawnRecord, WorldCaption, WorldPatchLog の4テーブルすべてが更新されることを検証する
- [ ] テストケース `testApplyWorldPatch_skipsSpawnWhenZeroType` を書き、`spawnType = bytes32(0)` の場合に SpawnRecord が書き込まれないことを検証する
- [ ] テストケース `testApplyWorldPatch_incrementsCounter` を書き、PatchCounter が呼び出しごとにインクリメントされることを検証する
- [ ] `pnpm mud test` で全テストが通ることを確認する

---

## Task 4: クライアント systemCalls とバリデーション

**要件**: 3.1, 3.2, 4.1
**依存**: Task 3（コントラクト ABI が確定後）

### 4.1 createSystemCalls.ts に世界パッチ関数を追加

- [ ] `packages/client/src/mud/createSystemCalls.ts` に `WorldPatchJSON` 型を定義する:
  ```
  { effect: string, color: string, intensity: number, spawn: { type: string, x: number, y: number } | null, caption: string }
  ```
- [ ] `applyWorldPatch(patch: WorldPatchJSON)` 関数を追加する:
  - 4.2 のバリデーション関数を呼び出し、不正時は Error を throw する
  - `effect` を `stringToHex(effect, { size: 32 })` で `bytes32` に変換する
  - `color` の `"#RRGGBB"` を `"0xRRGGBB"` に変換し `bytes3` として渡す
  - `spawn` が null の場合は `spawnType` に `pad("0x", { size: 32 })` を渡す
  - `worldContract.write.app__applyWorldPatch([...args])` を呼び出し、`waitForTransaction` で確認する
- [ ] `setEffect(zoneId, effect, color, intensity)` 関数を追加する（個別メソッド呼び出し用）
- [ ] `spawnEntity(entityType, x, y)` 関数を追加する
- [ ] `setCaption(zoneId, caption)` 関数を追加する
- [ ] 戻り値のオブジェクトに `applyWorldPatch`, `setEffect`, `spawnEntity`, `setCaption` を追加する

### 4.2 バリデーション関数の実装

- [ ] `createSystemCalls.ts` 内にプライベート関数 `validateWorldPatch(patch: WorldPatchJSON)` を実装する:
  - `effect` が空文字でないことを検証する
  - `color` が `/^#[0-9A-Fa-f]{6}$/` にマッチすることを検証する
  - `intensity` が 0 以上 100 以下の整数であることを検証する
  - `spawn` が存在する場合、`type` が空でなく `x`, `y` が整数であることを検証する
  - 検証失敗時は全エラーを配列で収集し、`Error` として throw する

### 4.3 TypeScript 型チェックの実行

- [ ] `packages/client` ディレクトリで `pnpm run test`（`tsc --noEmit`）を実行し、型エラーがないことを確認する
- [ ] `createSystemCalls` の戻り値型に新関数が正しく含まれていることを確認する
- [ ] `MUDContext` 経由で新しい systemCalls にアクセスできることを型レベルで確認する
