import { Hono } from "hono";
import { openDb } from "../../../src/db/client";
import { releasedCutoffs } from "../../../src/retrieval/evidence";
import { concernCutoffs, concernsAt } from "../../../src/concerns/queries";

const app = new Hono();

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

app.get("/api/status", async (c) => {
  const db = await openDb();
  const count = async (sql: string) => ((await (await db.prepare(sql)).get()) as { n: number }).n;
  return c.json({
    releases: await releasedCutoffs(db),
    sources: await count("SELECT COUNT(*) AS n FROM sources"),
    evidence: await count("SELECT COUNT(*) AS n FROM evidence"),
    agents: await count("SELECT COUNT(*) AS n FROM agents"),
    concernCutoffs: await concernCutoffs(db),
    model: process.env.BIFROST_MODEL ?? null,
  });
});

/** Top concerns at a knowledge cutoff (default: latest cutoff that has concerns). */
app.get("/api/concerns", async (c) => {
  const db = await openDb();
  const cutoffs = await concernCutoffs(db);
  const cutoff = c.req.query("cutoff") ?? cutoffs[0];
  if (!cutoff) return c.json({ cutoff: null, concerns: [], message: "No concerns yet. Run `bun run ingest`." });
  const limit = Math.min(10, Math.max(1, Number(c.req.query("limit") ?? 3)));
  return c.json({ cutoff, concerns: await concernsAt(db, cutoff, limit) });
});

app.get("/api/agents", async (c) => {
  const db = await openDb();
  return c.json(await (await db.prepare(
    "SELECT employee_id, full_name, department, title, manager_id, join_date, location FROM agents ORDER BY employee_id")).all());
});

const port = Number(process.env.PORT ?? 8787);
export default { port, fetch: app.fetch };
console.log(`API listening on http://localhost:${port}`);
