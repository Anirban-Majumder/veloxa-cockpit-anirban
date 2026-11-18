import { Hono } from "hono";
import { modelSettings } from "../../../../src/ai/model";
import { concernCutoffs } from "../../../../src/concerns/store";
import { listAgents } from "../../../../src/agents/store";
import { DB_PATH, openDb, selectAll } from "../../../../src/db/client";
import { isReleased, RELEASE_ROOT } from "../../../../src/ingestion/releases";
import { releasedCutoffs } from "../../../../src/retrieval/evidence";

export const status = new Hono().get("/", async (c) => {
  const db = await openDb();
  const perRelease = await selectAll<{ released_at: string; sources: number; evidence: number }>(db,
    `SELECT s.released_at, COUNT(DISTINCT s.id) AS sources, COUNT(e.id) AS evidence
     FROM sources s LEFT JOIN evidence e ON e.source_id = s.id
     GROUP BY s.released_at`);
  const releases = await releasedCutoffs(db);
  const latest = releases.at(-1)?.released_at;
  const released = perRelease.filter((r) => isReleased(r.released_at));

  return c.json({
    releases,
    concernCutoffs: await concernCutoffs(db),
    sources: released.reduce((sum, r) => sum + r.sources, 0),
    evidence: released.reduce((sum, r) => sum + r.evidence, 0),
    agents: latest ? (await listAgents(db, latest)).length : 0,
    model: modelSettings()?.modelId ?? null,
    database: DB_PATH,
    releaseRoot: RELEASE_ROOT,
  });
});
