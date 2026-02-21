import { LlmAgent } from "@google/adk";
import { getWeather } from "./tools/getWeather.js";

/**
 * AI Agentを作成
 */
export const rootAgent = new LlmAgent({
  name: "my_ts_agent_agent",
  model: "gemini-2.5-flash",
  description: "Tells the current weather in a specified city.",
  instruction: `You are a helpful assistant that tells the current weather in a city.
                Use the 'getWeather' tool for this purpose.`,
  tools: [getWeather],
});
