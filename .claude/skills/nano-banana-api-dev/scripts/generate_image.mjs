import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const prompt = process.argv[2];
const outDir = process.argv[3] ?? "./out";
const model = process.argv[4] ?? "gemini-2.5-flash-image-preview";

if (!prompt) {
  console.error("Usage: node scripts/generate_image.mjs \"<prompt>\" [outDir] [model]");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const result = await ai.models.generateContent({
  model,
  contents: prompt,
  config: {
    responseModalities: ["TEXT", "IMAGE"],
  },
});

fs.mkdirSync(outDir, { recursive: true });

const parts = result?.candidates?.flatMap((c) => c?.content?.parts ?? []) ?? [];
let imageIndex = 0;
for (const part of parts) {
  if (!part?.inlineData?.data) continue;
  const ext = part.inlineData.mimeType?.includes("png") ? "png" : "jpg";
  const outPath = path.join(outDir, `generated-${imageIndex}.${ext}`);
  fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
  imageIndex += 1;
  console.log(`saved: ${outPath}`);
}

if (typeof result?.text === "string" && result.text.trim().length > 0) {
  console.log("assistant:", result.text);
}

if (imageIndex === 0) {
  console.error("No images returned. Check prompt/model/responseModalities.");
  process.exit(2);
}
