import type { Context, Next } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

export class HttpError extends Error {
  constructor(readonly status: ContentfulStatusCode, message: string) {
    super(message);
  }
}

export async function readBody<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const mediaType = c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new HttpError(415, "Send the request body as application/json.");
  }
  const raw = await c.req.json().catch(() => {
    throw new HttpError(400, "Request body must be JSON.");
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
  return parsed.data;
}

export function handleError(error: Error, c: Context) {
  if (error instanceof HttpError) return c.json({ error: error.message }, error.status);
  console.error(error);
  return c.json({ error: error.message }, 500);
}

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Blocks other websites from triggering paid model calls through the browser; the CLI sends no Origin. */
export function rejectForeignOrigins(publicOrigins: string[]) {
  const isAllowedOrigin = (origin: string) => LOCAL_ORIGIN.test(origin) || publicOrigins.includes(origin);
  return async (c: Context, next: Next) => {
    const origin = c.req.header("origin");
    if (c.req.method !== "GET" && origin && origin !== new URL(c.req.url).origin && !isAllowedOrigin(origin)) throw new HttpError(403, "Cross-origin requests are not allowed.");
    await next();
  };
}
