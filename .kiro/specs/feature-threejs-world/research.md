# Research & Design Decisions: feature-threejs-world

## Summary
- **Feature**: feature-threejs-world
- **Discovery Scope**: Extension / Complex Integration
- **Key Findings**:
  - `EffectComposer` (@react-three/postprocessing) を基盤とした、カスタムシェーダーによるエフェクト重畳が最も拡張性が高い。
  - 「波紋 (Ripple)」は fragment shader による画面歪みとして実装し、「共鳴 (Resonance)」はオブジェクトの頂点アニメーションまたはブルーム強度の同期で表現可能。
  - パフォーマンス最適化（LOD）は、フレームレート監視に基づく `EffectComposer` のパスの動的有効/無効化で実現する。

## Research Log

### Post-Processing Effect Blending (Requirement 2 & 3)
- **Context**: 複数のオンチェーンエフェクトが同時に発生した際、画面が破綻せず、かつ意図した通りに合成される必要がある。
- **Sources Consulted**: [@react-three/postprocessing docs](https://docs.pmnd.rs/react-postprocessing/introduction), [Three.js EffectComposer](https://threejs.org/docs/#examples/en/postprocessing/EffectComposer)
- **Findings**:
  - `EffectComposer` はデフォルトで各パスの結果を重ね合わせるが、`blendFunction` (SCREEN, OVERLAY 等) を指定することでマトリックス風の質感を維持した合成が可能。
  - 可読性しきい値（Requirement 3.2）の制御は、各エフェクトパスの `opacity` を `1.0 / activeEffects.length` のようにスケールさせるロジックで対応可能。
- **Implications**: `EffectCompositor.tsx` という管理コンポーネントを導入し、現在有効な MUD `WorldEffect` の数に応じて各パスのパラメータを動的に調整する設計を採用する。

### Specialized Effects Implementation (Requirement 2.2)
- **Context**: Ripple, Resonance, Neon, Scanline の各カテゴリをどう実現するか。
- **Findings**:
  - **Scanline/Neon**: `Scanline` パスと `Bloom` パスで対応済み。
  - **Ripple (波紋)**: カスタム `ShaderPass` を作成し、オンチェーンから座標（x, y）を受け取って、その地点を中心に時間を追って広がる `uRadius` を計算する。
  - **Resonance (共鳴)**: 中心点からの距離に応じた `Sine` 波による頂点変位（Vertex Shader）または、ネオン光の周期的な明滅（Emissive Intensity）で表現。
- **Implications**: 基本的なエフェクトは既存コンポーネントで、特殊なシェーダーが必要なものは新規パスとして追加する。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| **Multi-pass Rendering** | 各エフェクトを独立した `EffectComposer` パスとして実装 | モジュール性が高く、個別の ON/OFF が容易 | パスが増えるほど GPU 負荷が増大 | 採用案。LOD による制御を前提とする。 |
| **Unified Shader** | 全エフェクトを 1 つの巨大なシェーダーで処理 | レンダリングパスが 1 回で済むため高速 | コードがスパゲッティ化し、MUD との動的連動が複雑 | 拡張性が低いため不採用。 |

## Design Decisions

### Decision: Effect Priority and Compositing Logic
- **Context**: Requirement 3 (整合性と可読性)
- **Selected Approach**: 各エフェクトカテゴリに「優先度」と「排他グループ」を定義する。
- **Rationale**: 全てのエフェクトを全力で表示すると情報過多になるため。
- **Trade-offs**: 実装の複雑度は微増するが、デモ時の視認性が大幅に向上する。

### Decision: Performance Tiers (LOD)
- **Context**: Requirement 5 (信頼性と品質保証)
- **Selected Approach**: `useFrame` 内でフレームタイムを監視し、3 Tiers (High, Medium, Low) の品質設定を切り替える。
- **Rationale**: ハッカソン会場の多様な機材スペック（低スペックノートPC等）に対応するため。

## Risks & Mitigations
- **GPU 負荷過多** — 重畳エフェクト数に上限（例: 同時3件まで）を設ける。
- **シェーダーコンパイル遅延** — 各エフェクトは初期化時にプリコンパイルし、ランタイムでの動的生成を避ける。
