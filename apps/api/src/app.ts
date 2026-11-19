import { existsSync } from "node:fs";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { compress } from "hono/compress";
import { handleError } from "./http";
import { agents } from "./routes/agents";
import { auth } from "./routes/auth";
import { chat } from "./routes/chat";
import { concerns } from "./routes/concerns";
import { ingest } from "./routes/ingest";
import { status } from "./routes/status";

const WEB_DIST = "apps/web/dist";

export function createApp(passphrase: string | undefined, production: boolean) {
  const loginPage = production ? `${WEB_DIST}/sign-in.html` : "apps/web/public/sign-in.html";
  const app = new Hono()
    .onError(handleError)
    .use(compress())
    .route("/", auth(passphrase, production, loginPage))
    .route("/api/status", status)
    .route("/api/concerns", concerns)
    .route("/api/agents", agents)
    .route("/api/chat", chat)
    .route("/api/ingest", ingest)
    .all("/api/*", (c) => c.json({ error: "API route not found." }, 404));

  if (production && existsSync(WEB_DIST)) {
    app.use("*", serveStatic({ root: WEB_DIST }));
    app.get("*", serveStatic({ path: `${WEB_DIST}/index.html` }));
  }
  return app;
}
