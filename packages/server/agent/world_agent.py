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

WORLD_AGENT_INSTRUCTION = """
あなたは Echo Genesis Online (EGO) の世界管理 AI です。
音声入力から世界変更コマンドを検出し、必要なときは apply_world_patch ツールを呼び出してください。
通常会話の場合は、ツールを呼び出さずに音声応答のみを返してください。
""".strip()


def apply_world_patch(
    *,
    effect: str,
    color: str,
    intensity: int,
    spawn_type: str,
    spawn_x: int,
    spawn_y: int,
    caption: str,
) -> dict[str, Any]:
    spawn = None
    if spawn_type:
        spawn = {"type": spawn_type, "x": spawn_x, "y": spawn_y}

    patch = {
        "effect": effect,
        "color": color,
        "intensity": intensity,
        "spawn": spawn,
        "caption": caption,
    }
    return {"status": "applied", "patch": patch}


def create_world_agent() -> Agent:
    return Agent(
        name="ego_world_agent",
        model=WORLD_AGENT_MODEL,
        instruction=WORLD_AGENT_INSTRUCTION,
        tools=[apply_world_patch],
    )

