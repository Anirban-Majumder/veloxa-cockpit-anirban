import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function modelSettings() {
  const baseURL = process.env.LLM_BASE_URL;
  const modelId = process.env.LLM_MODEL;
  if (!baseURL || !modelId) return undefined;
  return {
    baseURL,
    modelId,
    apiKey: process.env.LLM_API_KEY || undefined,
    nativeJsonSchema: process.env.LLM_JSON_SCHEMA !== "false",
  };
}

export function getModel() {
  const settings = modelSettings();
  if (!settings) throw new Error("Model not configured: set LLM_BASE_URL and LLM_MODEL in .env (LLM_API_KEY is optional).");
  const provider = createOpenAICompatible({
    name: "llm",
    baseURL: settings.baseURL,
    apiKey: settings.apiKey,
    supportsStructuredOutputs: settings.nativeJsonSchema,
  });
  return { model: provider(settings.modelId), modelId: settings.modelId, nativeJsonSchema: settings.nativeJsonSchema };
}
