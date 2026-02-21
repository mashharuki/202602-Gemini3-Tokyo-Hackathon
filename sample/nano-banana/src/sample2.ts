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

  const chat = ai.chats.create({
    model: "gemini-3-pro-image-preview",
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      tools: [{ googleSearch: {} }],
    },
  });

  const message =
    'Create a vibrant infographic that explains photosynthesis as if it were a recipe for a plant\'s favorite food. Show the "ingredients" (sunlight, water, CO2) and the "finished dish" (sugar/energy). The style should be like a page from a colorful kids\' cookbook, suitable for a 4th grader.';

  let response = await chat.sendMessage({ message });

  for (const part of response.candidates[0].content.parts) {
    if (part.text) {
      console.log(part.text);
    } else if (part.inlineData) {
      const imageData = part.inlineData.data;
      const buffer = Buffer.from(imageData, "base64");
      fs.writeFileSync("photosynthesis.png", buffer);
      console.log("Image saved as photosynthesis.png");
    }
  }
}
await main();
