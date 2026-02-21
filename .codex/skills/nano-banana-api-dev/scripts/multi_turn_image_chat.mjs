import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const imagePath = process.argv[2];
const prompt1 = process.argv[3] ?? "Create a stylized variation.";
const prompt2 = process.argv[4] ?? "Now make the colors warmer and add cinematic lighting.";
const outDir = process.argv[5] ?? "./out";
const model = process.argv[6] ?? "gemini-2.5-flash-image-preview";

if (!imagePath) {
  console.error("Usage: node scripts/multi_turn_image_chat.mjs <imagePath> [prompt1] [prompt2] [outDir] [model]");
  process.exit(1);
}

const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
const imageData = fs.readFileSync(imagePath, { encoding: "base64" });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const chat = ai.chats.create({ model });

const turn1 = await chat.sendMessage({
  message: [
    { text: prompt1 },
    { inlineData: { mimeType, data: imageData } },
  ],
});

const turn2 = await chat.sendMessage({ message: prompt2 });

fs.mkdirSync(outDir, { recursive: true });

const saveImages = (res, prefix) => {
  const parts = res?.candidates?.flatMap((c) => c?.content?.parts ?? []) ?? [];
  let idx = 0;
  for (const part of parts) {
    if (!part?.inlineData?.data) continue;
    const outPath = path.join(outDir, `${prefix}-${idx}.png`);
    fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
    idx += 1;
    console.log(`saved: ${outPath}`);
  }
};

saveImages(turn1, "turn1");
saveImages(turn2, "turn2");
