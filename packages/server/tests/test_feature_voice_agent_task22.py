import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SERVER_DIR = ROOT
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from main import (_normalize_event, build_run_config, handle_voice_session, health_check,  # type: ignore  # noqa: E402
                  process_downstream_events, process_upstream_messages)


class FakeLiveQueue:
    def __init__(self) -> None:
        self.realtime_calls = []
        self.content_calls = []
        self.closed = False

    async def send_realtime(self, payload):
        self.realtime_calls.append(payload)

    async def send_content(self, content):
        self.content_calls.append(content)

    async def aclose(self):
        self.closed = True


class FakeWebSocket:
    def __init__(self, incoming):
        self._incoming = list(incoming)
        self.sent_json = []
        self.accepted = False
        self.closed = False

    async def accept(self):
        self.accepted = True

    async def receive(self):
        if self._incoming:
            return self._incoming.pop(0)
        return {"type": "websocket.disconnect"}

    async def send_json(self, payload):
        self.sent_json.append(payload)

    async def close(self):
        self.closed = True


class FakeSessionService:
    def __init__(self):
        self.sessions = {}

    async def get_session(self, user_id, session_id):
        return self.sessions.get((user_id, session_id))

    async def create_session(self, user_id, session_id):
        self.sessions[(user_id, session_id)] = {"user_id": user_id, "session_id": session_id}
        return self.sessions[(user_id, session_id)]


class FakeRunner:
    def __init__(self, events, fail_after=False):
        self.events = list(events)
        self.fail_after = fail_after

    async def run_live(self, **_kwargs):
        for event in self.events:
            yield event
        if self.fail_after:
            raise RuntimeError("downstream failed")


class Task22Tests(unittest.IsolatedAsyncioTestCase):
    def test_normalize_event_converts_bytes_to_base64(self):
        event = {
            "content": {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "audio/pcm;rate=24000",
                            "data": b"\x01\x02\x03",
                        }
                    }
                ]
            }
        }
        normalized = _normalize_event(event)
        encoded = normalized["content"]["parts"][0]["inlineData"]["data"]
        self.assertEqual(encoded, "AQID")

    async def test_health_check_returns_ok_status(self):
        payload = await health_check()
        self.assertEqual(payload, {"status": "ok"})

    async def test_upstream_routes_binary_and_text_messages(self):
        queue = FakeLiveQueue()
        ws = FakeWebSocket(
            [
                {"type": "websocket.receive", "bytes": b"\x01\x02"},
                {"type": "websocket.receive", "text": '{"type":"text","text":"hello"}'},
                {"type": "websocket.disconnect"},
            ]
        )
        await process_upstream_messages(ws, queue)
        self.assertEqual(queue.realtime_calls[0]["mime_type"], "audio/pcm;rate=16000")
        self.assertEqual(queue.realtime_calls[0]["data"], b"\x01\x02")
        self.assertEqual(queue.content_calls, ["hello"])

    async def test_downstream_forwards_adk_event_worldpatch_and_turn_complete(self):
        ws = FakeWebSocket([])
        event = {
            "turnComplete": True,
            "toolResponse": {
                "status": "applied",
                "patch": {
                    "effect": "aurora",
                    "color": "#7B68EE",
                    "intensity": 80,
                    "spawn": None,
                    "caption": "オーロラ",
                },
            },
        }
        runner = FakeRunner([event])
        await process_downstream_events(ws, runner.run_live())
        self.assertEqual(ws.sent_json[0]["type"], "adkEvent")
        self.assertTrue(ws.sent_json[0]["turnComplete"])
        self.assertEqual(ws.sent_json[1]["type"], "worldPatch")
        self.assertEqual(ws.sent_json[1]["patch"]["effect"], "aurora")

    async def test_downstream_extracts_worldpatch_from_nested_actions(self):
        ws = FakeWebSocket([])
        event = {
            "author": "ego_world_agent",
            "actions": [
                {
                    "functionResponse": {
                        "name": "apply_world_patch",
                        "response": {
                            "status": "applied",
                            "patch": {
                                "effect": "neon",
                                "color": "#00FF99",
                                "intensity": 64,
                                "spawn": {"type": "robot", "x": 3, "y": 4},
                                "caption": "ネオンが走る",
                            },
                        },
                    }
                }
            ],
        }
        runner = FakeRunner([event])
        await process_downstream_events(ws, runner.run_live())

        self.assertEqual(ws.sent_json[0]["type"], "adkEvent")
        self.assertEqual(ws.sent_json[1]["type"], "worldPatch")
        self.assertEqual(ws.sent_json[1]["patch"]["effect"], "neon")
        self.assertEqual(ws.sent_json[1]["patch"]["spawn"]["type"], "robot")

    async def test_handle_voice_session_creates_session_and_sends_error_payload(self):
        queue = FakeLiveQueue()
        ws = FakeWebSocket([{"type": "websocket.disconnect"}])
        session_service = FakeSessionService()
        runner = FakeRunner([], fail_after=True)

        await handle_voice_session(
            websocket=ws,
            user_id="u1",
            session_id="s1",
            session_service=session_service,
            runner=runner,
            live_request_queue=queue,
        )

        self.assertIn(("u1", "s1"), session_service.sessions)
        self.assertTrue(queue.closed)
        self.assertTrue(any("error" in payload for payload in ws.sent_json))
        self.assertTrue(ws.closed)

    def test_run_config_contains_required_streaming_settings(self):
        config = build_run_config()
        self.assertEqual(config["streaming_mode"], "BIDI")
        self.assertEqual(config["response_modalities"], ["AUDIO"])
        self.assertTrue(config["input_audio_transcription"])
        self.assertTrue(config["output_audio_transcription"])


if __name__ == "__main__":
    unittest.main()
