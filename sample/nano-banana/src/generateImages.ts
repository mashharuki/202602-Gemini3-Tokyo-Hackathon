import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const { GOOGLE_AI_STUDIO_API_KEY } = process.env;

async function generateImage(prompt: string, filename: string, aspectRatio: string) {
  const ai = new GoogleGenAI({
    apiKey: GOOGLE_AI_STUDIO_API_KEY,
  });

  console.log(`Generating ${filename}...`);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "2K",
        }
      },
    });

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const buffer = Buffer.from(imageData, "base64");
          fs.writeFileSync(filename, buffer);
          console.log(`Image saved as ${filename}`);
          return;
        }
      }
    }
    console.log(`No inlineData found for ${filename}`);
  } catch (error) {
    console.error(`Error generating ${filename}:`, error);
  }
}

async function main() {
  const logoPrompt = "A minimalist, premium tech startup logo for 'EGO'. Flat vector graphic style, extremely clean and simple. Solid dark background (#0a0a0a). Only the text 'EGO' in a modern, bold, sans-serif or geometric font. Very subtle neon green (#7CFFB2) accent on one letter or edge. No glow effects, no 3D rendering, no messy AI artifacts, no complex backgrounds. Pure, crisp typography and minimalist branding.";
  await generateImage(logoPrompt, "../../ego_logo.png", "1:1");

  const bgPrompt = "An abstract, highly minimalist dark UI background for a modern web application. Flat design, dark charcoal and black hues. Very subtle, clean geometric lines or a faint grid pattern in the background. A touch of muted cyan and green gradient in the corners, simulating a high-end glassmorphism UI environment. No characters, no cityscape, no messy 3D renders, no typical sci-fi elements. Extremely clean, professional, and empty enough to place UI elements on top.";
  await generateImage(bgPrompt, "../../ego_background.png", "16:9");
}

main().catch(console.error);
