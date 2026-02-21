import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const imagePath = process.argv[2];
const prompt = process.argv[3];
const outDir = process.argv[4] ?? "./out";
const model = process.argv[5] ?? "gemini-2.5-flash-image-preview";

if (!imagePath || !prompt) {
  console.error("Usage: node scripts/edit_image_with_text.mjs <imagePath> \"<prompt>\" [outDir] [model]");
  process.exit(1);
}

const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
const imageData = fs.readFileSync(imagePath, { encoding: "base64" });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const result = await ai.models.generateContent({
  model,
  contents: [
    { text: prompt },
    { inlineData: { mimeType, data: imageData } },
  ],
  config: {
    responseModalities: ["TEXT", "IMAGE"],
  },
});

fs.mkdirSync(outDir, { recursive: true });

const parts = result?.candidates?.flatMap((c) => c?.content?.parts ?? []) ?? [];
let imageIndex = 0;
for (const part of parts) {
  if (!part?.inlineData?.data) continue;
  const outPath = path.join(outDir, `edited-${imageIndex}.png`);
  fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
  imageIndex += 1;
  console.log(`saved: ${outPath}`);
}

if (typeof result?.text === "string" && result.text.trim().length > 0) {
  console.log("assistant:", result.text);
}

if (imageIndex === 0) {
  console.error("No edited images returned.");
  process.exit(2);
}
