import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { browseDatabase, isBrowserStatementAllowed } from "../../../../src/db/browse";
import { openDb } from "../../../../src/db/client";
import { HttpError, requireJson, validateJson } from "../http";

const embedUrl = "https://studio.outerbase.com/embed/sqlite";
const queryBody = z.object({ statement: z.string().trim().min(1) });
const transactionBody = z.object({ statements: z.array(queryBody.shape.statement).min(1) });

export function dbBrowser(basePath: string, writable: boolean) {
  async function run(statements: string[], atomic: boolean) {
    if (statements.some((statement) => !isBrowserStatementAllowed(statement, writable))) {
      throw new HttpError(403, writable
        ? "Send one SQL statement at a time without transaction control commands."
        : "Only read-only SQL statements are allowed.");
    }
    return browseDatabase(await openDb(), statements, atomic, writable);
  }

  return new Hono()
    .get("/db", describeRoute({
      summary: "Open the database browser",
      description: "Embeds Outerbase Studio and connects it to the Veloxa database API.",
      tags: ["Database"],
      responses: { 200: { description: "Outerbase Studio page" }, 302: { description: "Redirect to sign-in" } },
    }), (c) => c.html(studioPage(basePath)))
    .post("/api/db/query", describeRoute({
      summary: "Run a SQL statement",
      description: "Runs a statement on the API’s database connection. Writes require explicit opt-in.",
      tags: ["Database"],
      responses: {
        200: { description: "Outerbase result set" },
        400: { description: "Invalid request body" },
        401: { description: "Authentication required" },
        403: { description: "Statement forbidden" },
        415: { description: "Unsupported media type" },
      },
    }), requireJson, validateJson(queryBody), async (c) => {
      const [result] = await run([c.req.valid("json").statement], false);
      return c.json(result);
    })
    .post("/api/db/transaction", describeRoute({
      summary: "Run a SQL transaction",
      description: "Runs a batch atomically and returns one result per statement in input order.",
      tags: ["Database"],
      responses: {
        200: { description: "Outerbase result sets" },
        400: { description: "Invalid request body" },
        401: { description: "Authentication required" },
        403: { description: "Statement forbidden" },
        415: { description: "Unsupported media type" },
      },
    }), requireJson, validateJson(transactionBody), async (c) => {
      return c.json(await run(c.req.valid("json").statements, true));
    });
}

function studioPage(basePath: string) {
  const url = new URL(embedUrl);
  url.searchParams.set("name", "Veloxa");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Veloxa Database</title>
  <style>body { margin: 0 } iframe { display: block; width: 100%; height: 100dvh; border: 0 }</style>
</head>
<body>
  <iframe title="Outerbase Studio"></iframe>
  <script>
    const frame = document.querySelector("iframe");
    const studio = ${JSON.stringify(url.href)};
    const origin = new URL(studio).origin;
    const api = ${JSON.stringify(`${basePath}/api/db/`)};
    window.addEventListener("message", async (event) => {
      if (event.origin !== origin || event.source !== frame.contentWindow) return;
      const { type, id, statement, statements } = event.data ?? {};
      if (!Number.isSafeInteger(id) || (type !== "query" && type !== "transaction")) return;
      const reply = { type, id };
      try {
        const response = await fetch(api + type, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(type === "query" ? { statement } : { statements }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Database request failed.");
        reply.data = data;
      } catch (error) {
        reply.error = error.message || "Database request failed.";
      }
      event.source.postMessage(reply, origin);
    });
    frame.src = studio;
  </script>
</body>
</html>`;
}
