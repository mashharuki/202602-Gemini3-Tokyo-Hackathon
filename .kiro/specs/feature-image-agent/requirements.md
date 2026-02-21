# Requirements Document

## Introduction
この仕様は、Gemini が決定したワールドパッチ JSON の `spawn` パラメータを起点に、画像生成エージェントがピクセルアセットを解決し、Three.js 空間へスポーン配置するための要件を定義する。主目的は、共有世界の変化を即時に可視化しつつ、画像生成 API の失敗や遅延時でも体験を止めないことである。

## Requirements

### Requirement 1: Spawn入力に基づく生成要求の起動
**Objective:** As a プレイヤー, I want spawn指定から画像生成が自動で開始されること, so that 発話後の世界変化をすぐに視認できる

#### Acceptance Criteria
1. When ワールドパッチ JSON に `spawn` が含まれる, the Image Agent Service shall 当該 `spawn` を画像アセット解決要求として受理する。
2. If `spawn` が空値・未定義・不正形式である, the Image Agent Service shall 生成要求を実行せず検証エラーとして扱う。
3. While `spawn` が有効である, the Image Agent Service shall 同一入力に対して一意に追跡可能な要求識別子を付与する。
4. The Image Agent Service shall 生成要求と元パッチの対応関係を後続処理で参照可能な状態として保持する。

### Requirement 2: ピクセルアセット生成結果の受理条件
**Objective:** As a 観戦者, I want 生成結果がゲーム表示に適した形式であること, so that スポーン時に表示破綻が起きない

#### Acceptance Criteria
1. When 画像生成結果が返却される, the Image Agent Service shall 表示可能な2D画像アセットとして受理可否を判定する。
2. If 生成結果が破損・未取得・非対応形式である, the Image Agent Service shall 当該結果を無効として扱う。
3. The Image Agent Service shall 受理された画像アセットに対して `spawn` と対応付くメタデータを保持する。
4. While 画像アセットが有効である, the Image Agent Service shall Three.js 側へ受け渡し可能な参照情報を提供する。

### Requirement 3: APIエラー・生成遅延時の即時フォールバック
**Objective:** As a プレイヤー, I want 生成APIの障害時でも即時に代替表示されること, so that 体験が停止しない

#### Acceptance Criteria
1. If Nano Banana API がエラーを返す, the Image Agent Service shall `public/fallback-sprites/` 内の予備画像から代替アセットを選択する。
2. When 生成要求の開始から規定待機時間を超過する, the Image Agent Service shall 予備画像を即時に採用してスポーン処理を継続する。
3. The Image Agent Service shall フォールバック採用時に「生成失敗」または「生成遅延」の理由区分を記録する。
4. While フォールバックが採用されている, the Image Agent Service shall 生成失敗時と同等の表示フローでThree.js空間へ配置可能なデータを提供する。
5. The Image Agent Service shall フォールバック採用判定から1秒以内に代替アセットを表示可能状態へ遷移させる。

### Requirement 4: Three.js空間へのスポーン配置
**Objective:** As a プレイヤー, I want 画像アセットが世界内の位置情報と整合して配置されること, so that 世界状態の変化を空間的に理解できる

#### Acceptance Criteria
1. When 画像アセットが確定する, the Image Agent Service shall 対応するスポーンイベントをThree.js表示系へ通知する。
2. The Image Agent Service shall スポーン対象ごとに位置・向き・識別子を含む配置情報を提供する。
3. If 配置先情報が欠落している, the Image Agent Service shall 事前定義された安全な既定配置を使用する。
4. While スポーン済みアセットが有効である, the Image Agent Service shall 同一識別子による重複配置を防止する。

### Requirement 5: 共有世界の整合性と可観測性
**Objective:** As a 運用者, I want 生成とフォールバックの状態を追跡できること, so that 障害時に原因を特定し改善できる

#### Acceptance Criteria
1. The Image Agent Service shall 各要求について「受付・生成成功・生成失敗・遅延フォールバック・配置完了」の状態遷移を記録する。
2. When フォールバック率がしきい値を超える, the Image Agent Service shall 運用上検知可能な警告イベントを発行する。
3. If 同一 `spawn` に対して短時間に重複要求が発生する, the Image Agent Service shall 追跡可能な形で集約または順序制御された扱いにする。
4. The Image Agent Service shall 要求識別子を用いて生成結果・フォールバック結果・配置結果を相互に照合可能にする。

