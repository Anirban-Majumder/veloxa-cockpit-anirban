import { Scalar } from "@scalar/hono-api-reference";
import { openAPIRouteHandler } from "hono-openapi";
import { existsSync } from "node:fs";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { compress } from "hono/compress";
import type { DeploySettings } from "./config";
import { handleError } from "./http";
import { agents } from "./routes/agents";
import { auth } from "./routes/auth";
import { chat } from "./routes/chat";
import { concerns } from "./routes/concerns";
import { dbBrowser } from "./routes/db";
import { ingest } from "./routes/ingest";
import { status } from "./routes/status";

const WEB_DIST = "apps/web/dist";

export function createApp(passphrase: string | undefined, settings: DeploySettings) {
  const loginPage = settings.serveBuild ? `${WEB_DIST}/sign-in.html` : "apps/web/public/sign-in.html";
  const app = new Hono()
    .onError(handleError)
    .use(compress())
    .route("/", auth(passphrase, settings, loginPage))
    .route("/api/status", status)
    .route("/api/concerns", concerns)
    .route("/api/agents", agents)
    .route("/api/chat", chat)
    .route("/api/ingest", ingest);

  if (settings.appEnv === "dev" || process.env.VELOXA_DB_BROWSER === "1") {
    app.route("/", dbBrowser(settings.basePath, process.env.VELOXA_DB_WRITE === "1"));
  } else {
    app.get("/db", (c) => c.notFound());
  }

  app.get("/openapi.json", openAPIRouteHandler(app, {
    documentation: {
      info: { title: "Veloxa Digital HQ API", version: "1.0.0" },
      servers: [{ url: settings.basePath || "/" }],
    },
    exclude: ["/doc", "/openapi.json", "/api/*", "/*"],
    defaultValidationErrorResponse: false,
  }));
  app.get("/doc", Scalar({ url: `${settings.basePath}/openapi.json` }));
  app.all("/api/*", (c) => c.json({ error: "API route not found." }, 404));

  if (settings.serveBuild && existsSync(WEB_DIST)) {
    app.use("*", serveStatic({ root: WEB_DIST }));
    app.get("*", serveStatic({ path: `${WEB_DIST}/index.html` }));
  }
  return app;
}
