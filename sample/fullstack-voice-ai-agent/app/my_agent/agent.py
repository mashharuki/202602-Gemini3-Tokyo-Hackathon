"""Agent definition for the bidi-workshop."""

import base64

from google import genai
from google.adk.agents import Agent
from google.adk.tools import google_search
from google.genai import types as genai_types

IMAGE_MODEL_ID = "imagen-3.0-generate-002"
DEFAULT_IMAGE_MIME_TYPE = "image/png"


class ImageGenerationAgent:
    def __init__(self, model_id: str) -> None:
        self._model_id = model_id
        self._client = genai.Client()

    def generate_image(self, prompt: str) -> tuple[str, str]:
        result = self._client.models.generate_images(
            model=self._model_id,
            prompt=prompt,
            config=genai_types.GenerateImagesConfig(
                number_of_images=1,
                output_mime_type=DEFAULT_IMAGE_MIME_TYPE,
            ),
        )
        if not result.generated_images:
            raise ValueError("image generation failed")
        image = result.generated_images[0].image
        image_bytes = image.image_bytes
        mime_type = getattr(image, "mime_type", DEFAULT_IMAGE_MIME_TYPE)
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        return encoded, mime_type


voice_agent = Agent(
    name="my_voice_agent",
    model="gemini-live-2.5-flash-native-audio",
    instruction="""
        You are a helpful AI assistant.

        You can use Google Search to find current information.
        Keep your responses concise and friendly.
    """,
    tools=[google_search],
)

image_agent = ImageGenerationAgent(IMAGE_MODEL_ID)

agent = voice_agent
