from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterable

try:
    from fastapi import FastAPI, WebSocket
except Exception:  # pragma: no cover
    class WebSocket:  # type: ignore[override]
        pass

    class FastAPI:  # type: ignore[override]
        def websocket(self, _path: str):
            def decorator(func):
                return func

            return decorator


from agent.world_agent import create_world_agent

logger = logging.getLogger(__name__)
app = FastAPI()


@app.get("/healthz")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


class InMemorySessionService:
    def __init__(self) -> None:
        self._sessions: dict[tuple[str, str], dict[str, str]] = {}

    async def get_session(self, user_id: str, session_id: str) -> dict[str, str] | None:
        return self._sessions.get((user_id, session_id))

    async def create_session(self, user_id: str, session_id: str) -> dict[str, str]:
        session = {"user_id": user_id, "session_id": session_id}
        self._sessions[(user_id, session_id)] = session
        return session


def build_run_config() -> dict[str, Any]:
    return {
        "streaming_mode": "BIDI",
        "response_modalities": ["AUDIO"],
        "input_audio_transcription": True,
        "output_audio_transcription": True,
    }


def extract_world_patch(event: dict[str, Any]) -> dict[str, Any] | None:
    tool_response = event.get("toolResponse")
    if isinstance(tool_response, dict) and isinstance(tool_response.get("patch"), dict):
        return tool_response["patch"]
    return None


async def process_upstream_messages(websocket: Any, live_request_queue: Any) -> None:
    while True:
        message = await websocket.receive()
        message_type = message.get("type")
        if message_type == "websocket.disconnect":
            break

        if message_type != "websocket.receive":
            continue

        binary = message.get("bytes")
        if binary is not None:
            await live_request_queue.send_realtime(
                {"mime_type": "audio/pcm;rate=16000", "data": binary}
            )
            continue

        text = message.get("text")
        if not text:
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue
        if payload.get("type") == "text" and isinstance(payload.get("text"), str):
            await live_request_queue.send_content(payload["text"])


async def process_downstream_events(websocket: Any, events: AsyncIterable[dict[str, Any]]) -> None:
    async for event in events:
        forward_payload: dict[str, Any] = {"type": "adkEvent", "payload": event}
        if "turnComplete" in event:
            forward_payload["turnComplete"] = bool(event["turnComplete"])
        await websocket.send_json(forward_payload)

        patch = extract_world_patch(event)
        if patch is not None:
            await websocket.send_json({"type": "worldPatch", "patch": patch})


async def handle_voice_session(
    *,
    websocket: Any,
    user_id: str,
    session_id: str,
    session_service: Any,
    runner: Any,
    live_request_queue: Any,
) -> None:
    await websocket.accept()

    session = await session_service.get_session(user_id, session_id)
    if session is None:
        await session_service.create_session(user_id, session_id)

    try:
        await asyncio.gather(
            process_upstream_messages(websocket, live_request_queue),
            process_downstream_events(websocket, runner.run_live()),
        )
    except Exception as exc:
        logger.exception("voice session failed")
        await websocket.send_json({"error": {"message": str(exc)}})
    finally:
        if hasattr(live_request_queue, "aclose"):
            await live_request_queue.aclose()
        await websocket.close()


class _LiveRequestQueue:
    async def send_realtime(self, _payload: dict[str, Any]) -> None:
        return None

    async def send_content(self, _content: str) -> None:
        return None

    async def aclose(self) -> None:
        return None


class _Runner:
    async def run_live(self):
        if False:
            yield {}


@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, session_id: str) -> None:
    # Task 2.2 will replace placeholders with ADK concrete wiring.
    _ = build_run_config()
    _ = create_world_agent()
    await handle_voice_session(
        websocket=websocket,
        user_id=user_id,
        session_id=session_id,
        session_service=InMemorySessionService(),
        runner=_Runner(),
        live_request_queue=_LiveRequestQueue(),
    )
