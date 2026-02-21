# 要件定義: MUD世界状態同期基盤 (feature-mud-world)

## プロジェクト概要

Echo Genesis Online (EGO) における、MUD フレームワーク (`packages/contracts`) を用いた世界状態（World State）の同期基盤を構築する。Gemini から出力される構造化JSON（世界パッチ）をオンチェーンの ECS アーキテクチャ（テーブル）にマッピングし、複数クライアント間で世界の変化をリアルタイムに同期可能にする。

### 世界パッチ JSON の構造（Gemini 出力）

Gemini が音声/テキスト入力に対して生成する構造化 JSON は、以下のフィールドを持つ：

| フィールド | 型 | 説明 |
|---|---|---|
| `effect` | string | 世界に適用される視覚効果の種類（例: `"aurora"`, `"storm"`, `"calm"`, `"fire"`） |
| `color` | string | 効果の主色（hex形式、例: `"#FF00FF"`） |
| `intensity` | number | 効果の強度（0〜100 の整数） |
| `spawn` | object \| null | 新規エンティティの生成情報（`{ type, x, y }` 形式） |
| `caption` | string | 世界の変化を説明するテキスト |

---

## 要件一覧

### 1 ECS テーブル定義（mud.config.ts）

#### 1.1 WorldEffect テーブル

**説明**: 世界全体またはゾーンごとに適用される視覚効果の状態を保持するテーブル。

**受入基準**:
- The WorldEffect table shall store an effect type as a string identifier for each zone entity.
- The WorldEffect table shall store a color value as a 3-byte RGB representation for each zone entity.
- The WorldEffect table shall store an intensity value as an unsigned 8-bit integer (0-100) for each zone entity.
- The WorldEffect table shall use a `bytes32` key to identify the zone or global scope to which the effect applies.
- When the WorldEffect table is defined, the system shall register it under the `app` namespace in `mud.config.ts`.

#### 1.2 SpawnRecord テーブル

**説明**: Gemini の spawn 指示に基づいて生成されたエンティティを記録するテーブル。

**受入基準**:
- The SpawnRecord table shall store a `entityType` as a `bytes32` value identifying the type of spawned entity.
- The SpawnRecord table shall store `x` and `y` coordinates as `int32` values for the spawn position.
- The SpawnRecord table shall store a `spawnedAt` timestamp as a `uint256` block timestamp.
- The SpawnRecord table shall use a `bytes32` key as the unique entity identifier.
- When the SpawnRecord table is defined, the system shall register it under the `app` namespace in `mud.config.ts`.

#### 1.3 WorldCaption テーブル

**説明**: 世界の変化に伴うキャプション（説明テキスト）を保持するテーブル。

**受入基準**:
- The WorldCaption table shall store a `caption` as a `string` value describing the world change.
- The WorldCaption table shall store an `updatedAt` timestamp as a `uint256` block timestamp.
- The WorldCaption table shall use a `bytes32` key to associate the caption with a zone or global scope.
- When the WorldCaption table is defined, the system shall register it under the `app` namespace in `mud.config.ts`.

#### 1.4 WorldPatchLog テーブル

**説明**: 適用された世界パッチの履歴を記録し、デバッグや再生を可能にするテーブル。

**受入基準**:
- The WorldPatchLog table shall store a `patchIndex` as a `uint256` auto-incrementing counter.
- The WorldPatchLog table shall store the `appliedBy` address as a `bytes32` value identifying the caller.
- The WorldPatchLog table shall store an `appliedAt` timestamp as a `uint256` block timestamp.
- The WorldPatchLog table shall use a `bytes32` key derived from the patch index.
- When the WorldPatchLog table is defined, the system shall register it under the `app` namespace in `mud.config.ts`.

---

### 2 System コントラクト（WorldPatchSystem）

#### 2.1 applyWorldPatch メソッド

**説明**: Gemini から生成された世界パッチ JSON のフィールドをまとめてオンチェーンに適用するメインエントリポイント。

**受入基準**:
- The WorldPatchSystem shall expose an `applyWorldPatch` method that accepts `effect` (bytes32), `color` (bytes3), `intensity` (uint8), `spawnType` (bytes32), `spawnX` (int32), `spawnY` (int32), and `caption` (string) as parameters.
- When `applyWorldPatch` is called, the system shall update the WorldEffect table with the provided effect, color, and intensity values for the specified zone.
- When `applyWorldPatch` is called with a non-zero `spawnType`, the system shall create a new entry in the SpawnRecord table with the provided type and coordinates.
- When `applyWorldPatch` is called with a non-empty `caption`, the system shall update the WorldCaption table with the provided caption text.
- When `applyWorldPatch` is called, the system shall append an entry to the WorldPatchLog table recording the caller address and block timestamp.

#### 2.2 setEffect メソッド

**説明**: 世界効果のみを個別に更新するための軽量メソッド。

**受入基準**:
- The WorldPatchSystem shall expose a `setEffect` method that accepts `zoneId` (bytes32), `effect` (bytes32), `color` (bytes3), and `intensity` (uint8) as parameters.
- When `setEffect` is called, the system shall update only the WorldEffect table for the given zone.
- If `intensity` exceeds 100, the WorldPatchSystem shall revert the transaction with an appropriate error message.

#### 2.3 spawnEntity メソッド

**説明**: エンティティ生成のみを個別に行うメソッド。

**受入基準**:
- The WorldPatchSystem shall expose a `spawnEntity` method that accepts `entityType` (bytes32), `x` (int32), and `y` (int32) as parameters.
- When `spawnEntity` is called, the system shall generate a unique `bytes32` entity ID and store the entity data in the SpawnRecord table.
- When `spawnEntity` is called, the system shall set the `spawnedAt` field to the current block timestamp.

#### 2.4 setCaption メソッド

**説明**: キャプションのみを個別に更新するメソッド。

**受入基準**:
- The WorldPatchSystem shall expose a `setCaption` method that accepts `zoneId` (bytes32) and `caption` (string) as parameters.
- When `setCaption` is called, the system shall update the WorldCaption table for the given zone with the provided caption and current block timestamp.

---

### 3 クライアント統合（systemCalls / components）

#### 3.1 クライアントコンポーネント登録

**説明**: 新規テーブルに対応するクライアントコンポーネントを MUD の同期レイヤーに追加する。

**受入基準**:
- The client shall register `WorldEffect`, `SpawnRecord`, `WorldCaption`, and `WorldPatchLog` as client components via `createClientComponents.ts`.
- When a table's on-chain state is updated, the client shall automatically receive the updated values through MUD's `syncToRecs` mechanism without additional polling.

#### 3.2 systemCalls の追加

**説明**: クライアントから WorldPatchSystem を呼び出すための TypeScript 関数を追加する。

**受入基準**:
- The client shall expose an `applyWorldPatch` function in `createSystemCalls.ts` that converts the Gemini JSON fields into the contract method's expected parameter types.
- The client shall expose individual `setEffect`, `spawnEntity`, and `setCaption` functions for granular updates.
- When a system call is invoked, the client shall await transaction confirmation via `waitForTransaction` before resolving.

---

### 4 世界パッチ JSON のバリデーション

#### 4.1 入力値の検証

**説明**: Gemini の出力を contract に送信する前に、クライアント側でバリデーションを行う。

**受入基準**:
- When the client receives a world patch JSON, the system shall validate that `intensity` is an integer between 0 and 100 (inclusive).
- When the client receives a world patch JSON, the system shall validate that `color` is a valid 6-character hex color string.
- When the client receives a world patch JSON, the system shall validate that `effect` is a non-empty string.
- If the world patch JSON contains a `spawn` object, the system shall validate that `spawn.type` is a non-empty string and `spawn.x`, `spawn.y` are integers.
- If validation fails, the system shall reject the patch and log a descriptive error without sending a transaction.

---

### 5 mud.config.ts の整合性

#### 5.1 既存テーブルとの共存

**説明**: 新規テーブルは既存の `Position` テーブルと同一 namespace 内で共存する。

**受入基準**:
- When new tables are added to `mud.config.ts`, the system shall preserve the existing `Position` table definition and its key schema.
- The system shall ensure all tables are defined under the `app` namespace.
- When `mud build` is executed after table changes, the system shall regenerate `src/codegen/` without errors.

---

### 6 テスト要件

#### 6.1 コントラクトテスト

**説明**: WorldPatchSystem の動作を検証する Foundry テストを作成する。

**受入基準**:
- The test suite shall verify that `applyWorldPatch` correctly updates all four tables (WorldEffect, SpawnRecord, WorldCaption, WorldPatchLog) in a single transaction.
- The test suite shall verify that `setEffect` reverts when `intensity` exceeds 100.
- The test suite shall verify that `spawnEntity` generates unique entity IDs for consecutive calls.
- The test suite shall verify that `setCaption` updates the timestamp correctly.

---

## 非機能要件

### 7 ガスコスト考慮

**受入基準**:
- The `applyWorldPatch` method shall complete within a single transaction and shall not exceed a gas limit that would prevent execution on the target chain (Redstone / local devnet).
- Where a `spawn` field is null in the world patch JSON, the WorldPatchSystem shall skip the SpawnRecord write to reduce gas consumption.

### 8 MUD バージョン互換性

**受入基準**:
- The implementation shall be compatible with `@latticexyz/*` version `2.2.23` as specified in the current `package.json`.
- The table definitions shall follow MUD v2 `defineWorld` API conventions.

---

## スコープ外

- AI (Gemini) との音声/テキスト入力処理（別仕様で管理）
- 3D ビジュアライゼーション / R3F レンダリング（クライアント UI 層）
- アクセス制御 / 権限管理（MVP 後のフェーズ）
- マルチゾーン管理の高度なロジック（MVP ではグローバルスコープのみ対応）
