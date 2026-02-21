from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from typing import Any, AsyncIterable, Optional

try:
    from fastapi import FastAPI, HTTPException, WebSocket
    from pydantic import BaseModel
except Exception:  # pragma: no cover
    class HTTPException(Exception):  # type: ignore[override]
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class WebSocket:  # type: ignore[override]
        pass

    class FastAPI:  # type: ignore[override]
        def get(self, _path: str):
            def decorator(func):
                return func

            return decorator

        def post(self, _path: str):
            def decorator(func):
                return func

            return decorator

        def websocket(self, _path: str):
            def decorator(func):
                return func

            return decorator

    class BaseModel:  # type: ignore[override]
        pass


from agent.world_agent import create_world_agent

logger = logging.getLogger(__name__)
app = FastAPI()

IMAGE_GENERATION_MODEL = "gemini-2.0-flash-preview-image-generation"


class GenerateImageRequest(BaseModel):
    entity_type: str
    prompt_hint: Optional[str] = None


def build_pixel_art_prompt(entity_type: str, prompt_hint: str | None = None) -> str:
    base_prompt = (
        f"Create a clean pixel art sprite of a {entity_type}. "
        "Transparent background, centered subject, 2D game-ready style, 32x32 look."
    )
    if prompt_hint and prompt_hint.strip():
        return f"{base_prompt} Additional style hint: {prompt_hint.strip()}."
    return base_prompt


async def _generate_image_base64(prompt: str) -> tuple[str, str]:
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    if not project:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is required")

    try:
        from google import genai  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("google-genai dependency is not installed") from exc

    client = genai.Client(vertexai=True, project=project, location=location)
    response = client.models.generate_content(model=IMAGE_GENERATION_MODEL, contents=prompt)

    for candidate in getattr(response, "candidates", []) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", []) or []:
            inline_data = getattr(part, "inline_data", None)
            if inline_data is None:
                continue
            data = getattr(inline_data, "data", None)
            mime_type = getattr(inline_data, "mime_type", "image/png")
            if not data:
                continue
            if isinstance(data, bytes):
                encoded = base64.b64encode(data).decode("utf-8")
            else:
                encoded = str(data)
            return encoded, str(mime_type or "image/png")

    raise RuntimeError("No image data returned from Gemini")


@app.post("/api/generate-image")
async def generate_image(request: GenerateImageRequest) -> dict[str, str]:
    entity_type = request.entity_type.strip() if request.entity_type else ""
    if not entity_type:
        raise HTTPException(status_code=400, detail="entity_type is required")

    prompt = build_pixel_art_prompt(entity_type, request.prompt_hint)
    try:
        image_base64, mime_type = await _generate_image_base64(prompt)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("image generation failed")
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {"image_base64": image_base64, "mime_type": mime_type}


@app.get("/health")
async def health_check_alias() -> dict[str, str]:
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
