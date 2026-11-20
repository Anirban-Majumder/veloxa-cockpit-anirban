import { createGoogle, type GoogleLanguageModelOptions } from "@ai-sdk/google";

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export function modelSettings() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return undefined;
  return { apiKey, modelId: process.env.GEMINI_MODEL || DEFAULT_MODEL, baseURL: process.env.GEMINI_BASE_URL || undefined };
}

export function getModel() {
  const settings = modelSettings();
  if (!settings) throw new Error("Model not configured: set GOOGLE_GENERATIVE_AI_API_KEY in .env.");
  const google = createGoogle({ apiKey: settings.apiKey, baseURL: settings.baseURL });
  return { model: google(settings.modelId), modelId: settings.modelId };
}

/** Use low reasoning depth for interactive chat backed by retrieved records. */
export const lightThinking = {
  google: { thinkingConfig: { thinkingLevel: "low" } } satisfies GoogleLanguageModelOptions,
};
