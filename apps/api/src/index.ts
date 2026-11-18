import { existsSync } from "node:fs";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { compress } from "hono/compress";
import { modelSettings } from "../../../src/ai/model";
import { handleError, rejectForeignOrigins } from "./http";
import { agents } from "./routes/agents";
import { chat } from "./routes/chat";
import { concerns } from "./routes/concerns";
import { ingest } from "./routes/ingest";
import { status } from "./routes/status";

const WEB_DIST = "apps/web/dist";

const app = new Hono()
  .onError(handleError)
  .use(compress())
  .use("/api/*", rejectForeignOrigins)
  .route("/api/status", status)
  .route("/api/concerns", concerns)
  .route("/api/agents", agents)
  .route("/api/chat", chat)
  .route("/api/ingest", ingest);

if (process.env.NODE_ENV === "production" && existsSync(WEB_DIST)) {
  app.use("*", serveStatic({ root: WEB_DIST }));
  app.get("*", serveStatic({ path: `${WEB_DIST}/index.html` }));
}

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";

if (!modelSettings()) console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set: chat and concern generation will fail.");
console.log(`API listening on http://${hostname}:${port}`);

export default { port, hostname, fetch: app.fetch, idleTimeout: 120 };
