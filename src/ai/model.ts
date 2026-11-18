import { createGoogle, type GoogleLanguageModelOptions } from "@ai-sdk/google";

export const DEFAULT_MODEL = "gemini-4-hydrogen";

export function modelSettings() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return undefined;
  return { apiKey, modelId: process.env.GEMINI_MODEL || DEFAULT_MODEL };
}

export function getModel() {
  const settings = modelSettings();
  if (!settings) throw new Error("Model not configured: set GOOGLE_GENERATIVE_AI_API_KEY in .env.");
  const google = createGoogle({ apiKey: settings.apiKey });
  return { model: google(settings.modelId), modelId: settings.modelId };
}

/** Small talk should answer in a second or two; everything else keeps the model's default depth. */
export const lightThinking = {
  google: { thinkingConfig: { thinkingLevel: "low" } } satisfies GoogleLanguageModelOptions,
};
