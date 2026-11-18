import { generateText, NoObjectGeneratedError, Output } from "ai";
import type { z } from "zod";
import { getModel } from "./model";

interface StructuredRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  attempts?: number;
}

export async function generateStructured<T>({ system, prompt, schema, temperature = 0.2, attempts = 3 }: StructuredRequest<T>) {
  const { model, modelId } = getModel();
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { output } = await generateText({ model, system, prompt, temperature, output: Output.object({ schema }) });
      return { output, modelId };
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) throw error;
      lastError = error;
      console.warn(`[ai] attempt ${attempt}/${attempts}: reply did not match the schema`);
    }
  }
  throw new Error(`The model did not return valid structured output after ${attempts} attempts.`, { cause: lastError });
}
