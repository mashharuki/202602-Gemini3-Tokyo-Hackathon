import { FunctionTool } from "@google/adk";
import { z } from "zod";

/**
 * Mock tool implementation
 */
export const getWeather = new FunctionTool({
  name: "get_weather",
  description: "Returns the current weather in a specified city.",
  parameters: z.object({
    city: z.string().describe("The name of the city for which to retrieve the weather."),
  }),
  execute: ({ city }) => {
    return { status: "success", report: `The weather in ${city} is sunny with a temperature of 72°F` };
  },
});
