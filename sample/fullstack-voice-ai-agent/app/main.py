"""Step 8: Add image input for multimodal AI."""

import asyncio
import base64
import json
import warnings
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

# Suppress noisy warnings
warnings.filterwarnings("ignore", message="Your application has authenticated using end user credentials")
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

# 環境変数の読み込み
load_dotenv(Path(__file__).parent / ".env")

from my_agent.agent import image_agent, voice_agent  # noqa: E402

APP_NAME = "bidi-workshop"

# FastAPIインスタンス化
app = FastAPI()
# 静的アセットの設定
static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# メモリセッション用の機能を設定
session_service = InMemorySessionService()
IMAGE_PROMPT_PREFIXES = ("画像生成:", "画像生成：", "画像:", "画像：", "/image ", "image:")

# Runnerインスタンスの初期化
runner = Runner(app_name=APP_NAME, agent=voice_agent, session_service=session_service)


def extract_image_prompt(text: str) -> Optional[str]:
    stripped = text.strip()
    if not stripped:
        return None
    folded = stripped.casefold()
    for prefix in IMAGE_PROMPT_PREFIXES:
        if folded.startswith(prefix.casefold()):
            candidate = stripped[len(prefix):].strip()
            return candidate if candidate else None
    return None


async def build_image_event(prompt: str) -> dict[str, Any]:
    base64_data, mime_type = await asyncio.to_thread(image_agent.generate_image, prompt)
    return {
        "author": "image_agent",
        "turnComplete": True,
        "content": {
            "parts": [
                {"text": "画像を生成しました"},
                {"inlineData": {"mimeType": mime_type, "data": base64_data}},
            ]
        },
    }


def build_image_error_event(message: str) -> dict[str, Any]:
    return {
        "author": "image_agent",
        "turnComplete": True,
        "error": {"message": message},
        "content": {
            "parts": [
                {"text": f"画像生成に失敗しました: {message}"},
            ]
        },
    }

# デフォルトのエンドポイント
@app.get("/")
async def root():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/manifest.webmanifest")
async def manifest():
    return FileResponse(
        Path(__file__).parent / "static" / "manifest.webmanifest",
        media_type="application/manifest+json",
    )


@app.get("/service-worker.js")
async def service_worker():
    return FileResponse(
        Path(__file__).parent / "static" / "service-worker.js",
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/"},
    )

# WebSocket用のAPI
@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    session_id: str,
) -> None:
    await websocket.accept()
    print("Connection open")

    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

    live_request_queue = LiveRequestQueue()

    async def upstream_task() -> None:
        """Receives messages from WebSocket and sends to LiveRequestQueue."""
        while True:
            message = await websocket.receive()

            # Handle text messages (JSON)
            if "text" in message:
                json_message = json.loads(message["text"])

                # Handle text messages
                if json_message.get("type") == "text":
                    user_text = json_message["text"]
                    print(f"[UPSTREAM] Text: {user_text}")

                    image_prompt = extract_image_prompt(user_text)
                    if image_prompt:
                        try:
                            image_event = await build_image_event(image_prompt)
                            await websocket.send_text(json.dumps(image_event))
                        except Exception as error:
                            error_message = str(error) or "unknown error"
                            error_event = build_image_error_event(error_message)
                            await websocket.send_text(json.dumps(error_event))
                        continue

                    content = types.Content(
                        parts=[types.Part(text=user_text)]
                    )
                    live_request_queue.send_content(content)

                # Handle image messages
                elif json_message.get("type") == "image":
                    print("[UPSTREAM] Image received")

                    # Decode base64 image data
                    image_data = base64.b64decode(json_message["data"])
                    mime_type = json_message.get("mimeType", "image/jpeg")

                    print(f"[UPSTREAM] Image: {len(image_data)} bytes, {mime_type}")

                    # Create image blob and send
                    image_blob = types.Blob(
                        mime_type=mime_type,
                        data=image_data
                    )
                    live_request_queue.send_realtime(image_blob)

            # Handle binary messages (audio)
            elif "bytes" in message:
                audio_data = message["bytes"]
                print(f"[UPSTREAM] Audio chunk: {len(audio_data)} bytes")

                audio_blob = types.Blob(
                    mime_type="audio/pcm;rate=16000",
                    data=audio_data
                )
                live_request_queue.send_realtime(audio_blob)

    async def downstream_task() -> None:
        """Receives Events from run_live() and sends to WebSocket."""
        print("[DOWNSTREAM] Starting run_live()")
        try:
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                event_json = event.model_dump_json(exclude_none=True, by_alias=True)
                print(f"[DOWNSTREAM] Event: {event_json[:100]}...")
                await websocket.send_text(event_json)
        except Exception as error:
            # Surface backend failures to the client and avoid noisy ASGI tracebacks.
            error_payload = json.dumps(
                {
                    "error": {
                        "message": str(error),
                    }
                }
            )
            print(f"[DOWNSTREAM] Fatal error: {error}")
            try:
                await websocket.send_text(error_payload)
            except Exception:
                pass

        print("[DOWNSTREAM] run_live() completed")

    try:
        await asyncio.gather(upstream_task(), downstream_task())
    except (WebSocketDisconnect, RuntimeError):
        print("Client disconnected")
    except Exception as error:
        print(f"Session failed: {error}")
    finally:
        live_request_queue.close()
        print("Session terminated")
