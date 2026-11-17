import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Configurable hosted model via an OpenAI-compatible endpoint (D010). Never falls back silently (D011).
 * LLM_API_KEY is optional: it is sent only when set (some gateways allow keyless access).
 */
export function getModel() {
  const baseURL = process.env.LLM_BASE_URL;
  const modelId = process.env.LLM_MODEL;
  if (!baseURL || !modelId) {
    throw new Error("Model not configured: set LLM_BASE_URL and LLM_MODEL in .env (LLM_API_KEY optional)");
  }
  const provider = createOpenAICompatible({ name: "llm", baseURL, apiKey: process.env.LLM_API_KEY || undefined });
  return { model: provider(modelId), modelId };
}
