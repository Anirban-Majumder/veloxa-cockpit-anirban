import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Configurable hosted model via an OpenAI-compatible endpoint (D010). Never falls back silently (D011).
 * BIFROST_API_KEY is optional: it is sent only when set (some gateways allow keyless access).
 */
export function getModel() {
  const baseURL = process.env.BIFROST_BASE_URL;
  const modelId = process.env.BIFROST_MODEL;
  if (!baseURL || !modelId) {
    throw new Error("Model not configured: set BIFROST_BASE_URL and BIFROST_MODEL in .env (BIFROST_API_KEY optional)");
  }
  const provider = createOpenAICompatible({ name: "bifrost", baseURL, apiKey: process.env.BIFROST_API_KEY || undefined });
  return { model: provider(modelId), modelId };
}
