import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
const { GOOGLE_AI_STUDIO_API_KEY } = process.env;

/**
 * メイン関数
 */
async function main() {
  const ai = new GoogleGenAI({
    apiKey: GOOGLE_AI_STUDIO_API_KEY,
  });

  const prompt =
    "Visualize the current weather forecast for the next 5 days in San Francisco as a clean, modern weather chart. Add a visual on what I should wear each day";
  const aspectRatio = "16:9";
  const resolution = "2K";

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: resolution,
      },
      tools: [{ googleSearch: {} }],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.text) {
      console.log(part.text);
    } else if (part.inlineData) {
      const imageData = part.inlineData.data;
      const buffer = Buffer.from(imageData, "base64");
      fs.writeFileSync("image.png", buffer);
      console.log("Image saved as image.png");
    }
  }
}

main();
