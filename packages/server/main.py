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


try:
    from google.adk.agents.live_request_queue import LiveRequestQueue as AdkLiveRequestQueue
    from google.adk.agents.run_config import RunConfig, StreamingMode
    from google.adk.runners import Runner as AdkRunner
    from google.adk.sessions import InMemorySessionService as AdkInMemorySessionService
    from google.genai import types as genai_types

    ADK_AVAILABLE = True
except Exception:  # pragma: no cover
    AdkLiveRequestQueue = None  # type: ignore[assignment]
    RunConfig = None  # type: ignore[assignment]
    StreamingMode = None  # type: ignore[assignment]
    AdkRunner = None  # type: ignore[assignment]
    AdkInMemorySessionService = None  # type: ignore[assignment]
    genai_types = None  # type: ignore[assignment]
    ADK_AVAILABLE = False


from agent.world_agent import create_world_agent

logger = logging.getLogger(__name__)
app = FastAPI()

APP_NAME = "ego-voice-agent"
IMAGE_GENERATION_MODEL = "gemini-2.0-flash-preview-image-generation"


class GenerateImageRequest(BaseModel):
    entity_type: str
    prompt_hint: Optional[str] = None


class InMemorySessionService:
    def __init__(self) -> None:
        self._sessions: dict[tuple[str, str], dict[str, str]] = {}

    async def get_session(self, user_id: str, session_id: str) -> dict[str, str] | None:
        return self._sessions.get((user_id, session_id))

    async def create_session(self, user_id: str, session_id: str) -> dict[str, str]:
        session = {"user_id": user_id, "session_id": session_id}
        self._sessions[(user_id, session_id)] = session
        return session


class _LiveRequestQueue:
    async def send_realtime(self, _payload: dict[str, Any]) -> None:
        return None

    async def send_content(self, _content: str) -> None:
        return None

    async def aclose(self) -> None:
        return None


class _Runner:
    async def run_live(self, **_kwargs):
        if False:
            yield {}


VOICE_AGENT = create_world_agent()
SESSION_SERVICE = AdkInMemorySessionService() if ADK_AVAILABLE and AdkInMemorySessionService is not None else InMemorySessionService()


def create_runner(session_service: Any) -> Any:
    if ADK_AVAILABLE and AdkRunner is not None:
        return AdkRunner(app_name=APP_NAME, agent=VOICE_AGENT, session_service=session_service)
    return _Runner()


def create_live_request_queue() -> Any:
    if ADK_AVAILABLE and AdkLiveRequestQueue is not None:
        return AdkLiveRequestQueue()
    return _LiveRequestQueue()


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
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


async def health_check_alias() -> dict[str, str]:
    return await health_check()


def build_run_config() -> dict[str, Any]:
    return {
        "streaming_mode": "BIDI",
        "response_modalities": ["AUDIO"],
        "input_audio_transcription": True,
        "output_audio_transcription": True,
    }


def build_runtime_run_config() -> Any:
    if not ADK_AVAILABLE or RunConfig is None or StreamingMode is None or genai_types is None:
        return build_run_config()

    return RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        input_audio_transcription=genai_types.AudioTranscriptionConfig(),
        output_audio_transcription=genai_types.AudioTranscriptionConfig(),
    )


async def _call_maybe_await(func: Any, *args: Any, **kwargs: Any) -> Any:
    result = func(*args, **kwargs)
    if asyncio.iscoroutine(result):
        return await result
    return result


def _build_audio_payload(binary: bytes) -> Any:
    if genai_types is not None:
        return genai_types.Blob(mime_type="audio/pcm;rate=16000", data=binary)
    return {"mime_type": "audio/pcm;rate=16000", "data": binary}


def _build_text_payload(text: str) -> Any:
    if genai_types is not None:
        return genai_types.Content(parts=[genai_types.Part(text=text)])
    return text


def _make_json_safe(value: Any) -> Any:
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("utf-8")
    if isinstance(value, bytearray):
        return base64.b64encode(bytes(value)).decode("utf-8")
    if isinstance(value, memoryview):
        return base64.b64encode(value.tobytes()).decode("utf-8")
    if isinstance(value, dict):
        return {str(key): _make_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_make_json_safe(item) for item in value]
    return value


def _normalize_event(event: Any) -> dict[str, Any]:
    if isinstance(event, dict):
        safe_event = _make_json_safe(event)
        return safe_event if isinstance(safe_event, dict) else {}

    model_dump = getattr(event, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump(by_alias=True, exclude_none=True)
        if isinstance(dumped, dict):
            safe_dumped = _make_json_safe(dumped)
            return safe_dumped if isinstance(safe_dumped, dict) else {}

    model_dump_json = getattr(event, "model_dump_json", None)
    if callable(model_dump_json):
        try:
            dumped_json = model_dump_json(by_alias=True, exclude_none=True)
            if isinstance(dumped_json, str):
                parsed = json.loads(dumped_json)
                if isinstance(parsed, dict):
                    safe_parsed = _make_json_safe(parsed)
                    return safe_parsed if isinstance(safe_parsed, dict) else {}
        except Exception:
            pass

    return {}


def _is_world_patch(candidate: Any) -> bool:
    if not isinstance(candidate, dict):
        return False
    return all(key in candidate for key in ("effect", "color", "intensity", "spawn", "caption"))


def _find_world_patch(candidate: Any) -> dict[str, Any] | None:
    if isinstance(candidate, dict):
        if _is_world_patch(candidate):
            return candidate

        patch_value = candidate.get("patch")
        if _is_world_patch(patch_value):
            return patch_value

        for value in candidate.values():
            found = _find_world_patch(value)
            if found is not None:
                return found
        return None

    if isinstance(candidate, list):
        for item in candidate:
            found = _find_world_patch(item)
            if found is not None:
                return found

    return None


def extract_world_patch(event: dict[str, Any]) -> dict[str, Any] | None:
    return _find_world_patch(event)


async def _ensure_session(session_service: Any, user_id: str, session_id: str) -> None:
    try:
        session = await session_service.get_session(app_name=APP_NAME, user_id=user_id, session_id=session_id)
    except TypeError:
        session = await session_service.get_session(user_id, session_id)

    if session is not None:
        return

    try:
        await session_service.create_session(app_name=APP_NAME, user_id=user_id, session_id=session_id)
    except TypeError:
        await session_service.create_session(user_id, session_id)


def _build_run_live_stream(runner: Any, user_id: str, session_id: str, live_request_queue: Any, run_config: Any):
    try:
        return runner.run_live(
            user_id=user_id,
            session_id=session_id,
            live_request_queue=live_request_queue,
            run_config=run_config,
        )
    except TypeError:
        return runner.run_live()


async def _close_live_request_queue(live_request_queue: Any) -> None:
    aclose = getattr(live_request_queue, "aclose", None)
    close = getattr(live_request_queue, "close", None)

    if callable(aclose):
        await _call_maybe_await(aclose)
        return
    if callable(close):
        await _call_maybe_await(close)


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
            await _call_maybe_await(live_request_queue.send_realtime, _build_audio_payload(binary))
            continue

        text = message.get("text")
        if not text:
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue
        if payload.get("type") == "text" and isinstance(payload.get("text"), str):
            await _call_maybe_await(live_request_queue.send_content, _build_text_payload(payload["text"]))


async def process_downstream_events(websocket: Any, events: AsyncIterable[Any]) -> None:
    async for event in events:
        normalized_event = _normalize_event(event)
        forward_payload: dict[str, Any] = {"type": "adkEvent", "payload": normalized_event}
        if "turnComplete" in normalized_event:
            forward_payload["turnComplete"] = bool(normalized_event["turnComplete"])
        await websocket.send_json(forward_payload)

        patch = extract_world_patch(normalized_event)
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

    await _ensure_session(session_service, user_id, session_id)
    run_config = build_runtime_run_config()
    events = _build_run_live_stream(runner, user_id, session_id, live_request_queue, run_config)

    try:
        await asyncio.gather(
            process_upstream_messages(websocket, live_request_queue),
            process_downstream_events(websocket, events),
        )
    except Exception as exc:
        logger.exception("voice session failed")
        await websocket.send_json({"error": {"message": str(exc)}})
    finally:
        await _close_live_request_queue(live_request_queue)
        await websocket.close()


@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, session_id: str) -> None:
    await handle_voice_session(
        websocket=websocket,
        user_id=user_id,
        session_id=session_id,
        session_service=SESSION_SERVICE,
        runner=create_runner(SESSION_SERVICE),
        live_request_queue=create_live_request_queue(),
    )
