import type { Db } from "../db/client";

export interface EvidenceRow {
  id: number;
  source_id: number;
  path: string;
  source_kind: string;
  released_at: string;
  locator_json: string;
  text: string;
  data_json: string | null;
  metadata_json: string | null;
}

/**
 * Evidence visible at a knowledge cutoff: sources released on or before it, latest version per path.
 * Pass includeRestricted=false (the default) for anything the CEO can see (A002).
 */
export async function evidenceAtCutoff(db: Db, cutoff: string, includeRestricted = false): Promise<EvidenceRow[]> {
  const rows = (await (await db.prepare(
    `SELECT e.id, e.source_id, s.path, s.source_kind, s.released_at, e.locator_json, e.text, e.data_json, e.metadata_json
     FROM evidence e JOIN sources s ON s.id = e.source_id
     WHERE s.id IN (
       SELECT s2.id FROM sources s2
       WHERE s2.released_at <= ?
         AND s2.id = (SELECT MAX(s3.id) FROM sources s3 WHERE s3.path = s2.path AND s3.released_at <= ?)
     )
     ORDER BY s.released_at, s.path, e.id`)).all(cutoff, cutoff)) as EvidenceRow[];
  return includeRestricted ? rows : rows.filter((r) => !isRestricted(r));
}

export function isRestricted(r: Pick<EvidenceRow, "metadata_json">): boolean {
  return !!r.metadata_json && JSON.parse(r.metadata_json).restricted != null;
}

export async function releasedCutoffs(db: Db): Promise<{ day: number; released_at: string }[]> {
  return (await (await db.prepare(
    "SELECT release_day AS day, MAX(released_at) AS released_at FROM sources GROUP BY release_day ORDER BY day")).all()) as
    { day: number; released_at: string }[];
}
