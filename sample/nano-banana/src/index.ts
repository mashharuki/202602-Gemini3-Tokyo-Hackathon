import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const { GOOGLE_AI_STUDIO_API_KEY } = process.env;

/**
 * メイン関数
 */
async function main() {
  // Google GenAIクライアントの初期化
  const ai = new GoogleGenAI({
    apiKey: GOOGLE_AI_STUDIO_API_KEY,
  });

  // モデル名
  const model = "gemini-2.5-flash-image";
  // 画像生成のプロンプト
  const prompt = `
    Create a picture of a nano banana Game Asset in a fancy restaurant with a Gemini theme
  `;

  // 画像生成のリクエスト
  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.text) {
      console.log(part.text);
    } else if (part.inlineData) {
      const imageData = part.inlineData.data;
      const buffer = Buffer.from(imageData, "base64");
      fs.writeFileSync("./data/gemini-native-image.png", buffer);
      console.log("Image saved as gemini-native-image.png");
    }
  }
}

main();
