import { mockProvider } from "./mock";
import { openaiProvider } from "./openai";
import type { LlmProvider } from "./provider";

export function getLlmProvider(): LlmProvider {
  return process.env.OPENAI_API_KEY ? openaiProvider : mockProvider;
}
