import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SERVER_DIR = ROOT
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from agent.world_agent import (WORLD_AGENT_INSTRUCTION, WORLD_AGENT_MODEL,  # type: ignore  # noqa: E402
                               apply_world_patch, create_world_agent)


class TestFeatureVoiceAgentTask21(unittest.TestCase):
    def test_apply_world_patch_returns_applied_status_and_patch(self) -> None:
        result = apply_world_patch(
            effect="aurora",
            color="#7B68EE",
            intensity=80,
            spawn_type="crystal",
            spawn_x=12,
            spawn_y=34,
            caption="オーロラが空を覆う",
        )
        self.assertEqual(result["status"], "applied")
        self.assertEqual(result["patch"]["effect"], "aurora")
        self.assertEqual(result["patch"]["color"], "#7B68EE")
        self.assertEqual(result["patch"]["intensity"], 80)
        self.assertEqual(
            result["patch"]["spawn"], {"type": "crystal", "x": 12, "y": 34}
        )
        self.assertEqual(result["patch"]["caption"], "オーロラが空を覆う")

    def test_apply_world_patch_allows_spawn_skip(self) -> None:
        result = apply_world_patch(
            effect="calm",
            color="#88AAFF",
            intensity=20,
            spawn_type="",
            spawn_x=0,
            spawn_y=0,
            caption="静寂が訪れる",
        )
        self.assertIsNone(result["patch"]["spawn"])

    def test_world_agent_uses_required_model_and_instruction(self) -> None:
        self.assertEqual(WORLD_AGENT_MODEL, "gemini-live-2.5-flash-native-audio")
        self.assertIn("音声入力", WORLD_AGENT_INSTRUCTION)
        self.assertIn("世界変更コマンド", WORLD_AGENT_INSTRUCTION)
        self.assertIn("apply_world_patch", WORLD_AGENT_INSTRUCTION)
        self.assertIn("通常会話", WORLD_AGENT_INSTRUCTION)
        self.assertIn("音声応答のみ", WORLD_AGENT_INSTRUCTION)

    def test_create_world_agent_registers_patch_tool(self) -> None:
        agent = create_world_agent()
        self.assertEqual(agent.model, WORLD_AGENT_MODEL)
        self.assertIn("apply_world_patch", [tool.__name__ for tool in agent.tools])


if __name__ == "__main__":
    unittest.main()
