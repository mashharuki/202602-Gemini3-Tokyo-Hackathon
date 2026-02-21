from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

try:
    from google.adk.agents import Agent  # type: ignore
except Exception:  # pragma: no cover
    @dataclass
    class Agent:  # type: ignore[override]
        name: str
        model: str
        instruction: str
        tools: list[Callable[..., Any]]


WORLD_AGENT_MODEL = "gemini-live-2.5-flash-native-audio"

DEFAULT_EFFECT = "neon"
DEFAULT_COLOR = "#66AAEE"
DEFAULT_INTENSITY = 70

EFFECT_ALIASES = {
    "aurora": "neon",
    "storm": "ripple",
    "wave": "ripple",
    "pulse": "resonance",
    "glitch": "scanline",
    "キラキラ": "neon",
    "波": "ripple",
    "共鳴": "resonance",
    "走査線": "scanline",
}

SUPPORTED_EFFECTS = {"ripple", "resonance", "neon", "scanline"}

WORLD_AGENT_INSTRUCTION = """
あなたは Echo Genesis Online (EGO) の世界管理 AI です。
ユーザー発話が「世界を変える/演出を変える/色や強さを変える/スポーンする」意図を含む場合は、必ず apply_world_patch ツールを1回呼び出してください。
通常会話の場合は、ツールを呼び出さずに音声応答のみを返してください。

短い命令でも成立させてください（例: 「ネオンにして」「赤くして」「狼を右に出して」）。
不足パラメータはルールに従って補完してください。

[ツール呼び出しルール]
- effect は次のいずれかに正規化: ripple / resonance / neon / scanline
- 指定が曖昧または不明な effect は neon にする
- color は必ず #RRGGBB 形式。指定がなければ #66AAEE
- intensity は 0〜100 の整数。指定がなければ 70
- spawn が不要なときは spawn_type を空文字、spawn_x=0、spawn_y=0
- spawn が必要なときは spawn_type を非空文字、spawn_x/spawn_y は整数
- caption は必ず短い日本語文字列を設定

[応答方針]
- 世界変更意図を検出したターンでは、まず apply_world_patch を呼び、その結果を短く伝える
- 可能な限りユーザーの日本語指示を尊重しつつ、無効値は上記ルールで補正して安全に適用する
""".strip()


def _normalize_effect(effect: str | None) -> str:
    raw = (effect or "").strip().lower()
    if not raw:
        return DEFAULT_EFFECT
    mapped = EFFECT_ALIASES.get(raw, raw)
    if mapped in SUPPORTED_EFFECTS:
        return mapped
    return DEFAULT_EFFECT


def _normalize_color(color: str | None) -> str:
    raw = (color or "").strip()
    if len(raw) == 7 and raw.startswith("#") and all(ch in "0123456789abcdefABCDEF" for ch in raw[1:]):
        return raw.upper()
    return DEFAULT_COLOR


def _normalize_intensity(intensity: int | None) -> int:
    if intensity is None:
        return DEFAULT_INTENSITY
    if intensity < 0:
        return 0
    if intensity > 100:
        return 100
    return int(intensity)


def apply_world_patch(
    *,
    effect: str = "",
    color: str = "",
    intensity: int = DEFAULT_INTENSITY,
    spawn_type: str = "",
    spawn_x: int = 0,
    spawn_y: int = 0,
    caption: str = "",
) -> dict[str, Any]:
    normalized_effect = _normalize_effect(effect)
    normalized_color = _normalize_color(color)
    normalized_intensity = _normalize_intensity(intensity)
    normalized_caption = caption.strip() or f"{normalized_effect} applied"

    spawn = None
    if spawn_type:
        spawn = {"type": spawn_type, "x": spawn_x, "y": spawn_y}

    patch = {
        "effect": normalized_effect,
        "color": normalized_color,
        "intensity": normalized_intensity,
        "spawn": spawn,
        "caption": normalized_caption,
    }
    return {"status": "applied", "patch": patch}


def create_world_agent() -> Agent:
    return Agent(
        name="ego_world_agent",
        model=WORLD_AGENT_MODEL,
        instruction=WORLD_AGENT_INSTRUCTION,
        tools=[apply_world_patch],
    )

