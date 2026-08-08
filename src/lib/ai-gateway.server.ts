import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createAiProvider(apiKey: string, baseURL: string) {
  return createOpenAICompatible({
    name: "ai-gateway",
    baseURL,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}
