import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { getModel } from "./model";

interface StructuredRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  attempts?: number;
}

class InvalidReply extends Error {}

/** Uses the provider's JSON Schema mode when available; otherwise plain text that is parsed and validated here. */
export async function generateStructured<T>({ system, prompt, schema, temperature = 0.2, attempts = 3 }: StructuredRequest<T>) {
  const { model, modelId, nativeJsonSchema } = getModel();
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const output = nativeJsonSchema
        ? (await generateText({ model, system, prompt, temperature, output: Output.object({ schema }) })).output
        : parseReply((await generateText({ model, system: withSchema(system, schema), prompt, temperature })).text, schema);
      return { output, modelId };
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error) && !(error instanceof InvalidReply)) throw error;
      lastError = error;
      console.warn(`[ai] attempt ${attempt}/${attempts}: reply did not match the schema`);
    }
  }
  throw new Error(`The model did not return valid structured output after ${attempts} attempts.`, { cause: lastError });
}

const withSchema = (system: string, schema: z.ZodType) =>
  `${system}\n\nReply with one JSON object only, no prose or code fences, matching this schema:\n${JSON.stringify(z.toJSONSchema(schema))}`;

function parseReply<T>(text: string, schema: z.ZodType<T>): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new InvalidReply("The reply contained no JSON object.");
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new InvalidReply("The reply was not valid JSON.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new InvalidReply(parsed.error.message);
  return parsed.data;
}
