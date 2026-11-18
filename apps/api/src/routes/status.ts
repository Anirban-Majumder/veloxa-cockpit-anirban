import { Hono } from "hono";
import { modelSettings } from "../../../../src/ai/model";
import { concernCutoffs } from "../../../../src/concerns/store";
import { DB_PATH, openDb, selectAll, selectOne } from "../../../../src/db/client";
import { isReleased, RELEASE_ROOT } from "../../../../src/ingestion/releases";
import { releasedCutoffs } from "../../../../src/retrieval/evidence";

export const status = new Hono().get("/", async (c) => {
  const db = await openDb();
  const perRelease = await selectAll<{ released_at: string; sources: number; evidence: number }>(db,
    `SELECT s.released_at, COUNT(DISTINCT s.id) AS sources, COUNT(e.id) AS evidence
     FROM sources s LEFT JOIN evidence e ON e.source_id = s.id
     GROUP BY s.released_at`);
  const released = perRelease.filter((r) => isReleased(r.released_at));

  return c.json({
    releases: await releasedCutoffs(db),
    concernCutoffs: await concernCutoffs(db),
    sources: released.reduce((sum, r) => sum + r.sources, 0),
    evidence: released.reduce((sum, r) => sum + r.evidence, 0),
    agents: (await selectOne<{ n: number }>(db, "SELECT COUNT(*) AS n FROM agents"))!.n,
    model: modelSettings()?.modelId ?? null,
    database: DB_PATH,
    releaseRoot: RELEASE_ROOT,
  });
});
