import pathlib
import sys
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

SERVER_DIR = pathlib.Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from main import GenerateImageRequest, build_pixel_art_prompt, generate_image  # type: ignore  # noqa: E402


class TestFeatureImageAgentTask21(unittest.IsolatedAsyncioTestCase):
    def test_build_pixel_art_prompt_includes_entity_type(self) -> None:
        prompt = build_pixel_art_prompt("tree")
        self.assertIn("tree", prompt)
        self.assertIn("pixel art", prompt.lower())

    async def test_generate_image_returns_base64_payload(self) -> None:
        request = GenerateImageRequest(entity_type="tree")

        with patch("main._generate_image_base64", AsyncMock(return_value=("ZmFrZQ==", "image/png"))):
            response = await generate_image(request)

        self.assertEqual(response["image_base64"], "ZmFrZQ==")
        self.assertEqual(response["mime_type"], "image/png")

    async def test_generate_image_rejects_empty_entity_type(self) -> None:
        with self.assertRaises(HTTPException) as context:
            await generate_image(GenerateImageRequest(entity_type="   "))

        self.assertEqual(context.exception.status_code, 400)

    async def test_generate_image_returns_503_when_generation_fails(self) -> None:
        request = GenerateImageRequest(entity_type="tree")

        with patch("main._generate_image_base64", AsyncMock(side_effect=RuntimeError("boom"))):
            with self.assertRaises(HTTPException) as context:
                await generate_image(request)

        self.assertEqual(context.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
