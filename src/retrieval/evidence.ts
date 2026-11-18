import { selectAll, type Db } from "../db/client";
import { isReleased } from "../ingestion/releases";
import { mentionsPay, withholdPay, withoutPayFields } from "./redact";

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

/** Latest version of each source released by the cutoff. Unless asked for, restricted rows (A002) are dropped and pay details withheld. */
export async function evidenceAtCutoff(db: Db, cutoff: string, includeRestricted = false): Promise<EvidenceRow[]> {
  const rows = await selectAll<EvidenceRow>(db,
    `SELECT e.id, e.source_id, s.path, s.source_kind, s.released_at, e.locator_json, e.text, e.data_json, e.metadata_json
     FROM evidence e JOIN sources s ON s.id = e.source_id
     WHERE s.id IN (
       SELECT s2.id FROM sources s2
       WHERE s2.released_at <= ?
         AND s2.id = (SELECT MAX(s3.id) FROM sources s3 WHERE s3.path = s2.path AND s3.released_at <= ?)
     )
     ORDER BY s.released_at, s.path, e.id`, cutoff, cutoff);
  if (includeRestricted) return rows;
  return rows.filter((r) => !isRestricted(r)).map(withholdPayFromRow);
}

export function isRestricted(r: Pick<EvidenceRow, "metadata_json">): boolean {
  return !!r.metadata_json && JSON.parse(r.metadata_json).restricted != null;
}

/** Ingested days whose release time has passed. */
export async function releasedCutoffs(db: Db): Promise<{ day: number; released_at: string }[]> {
  const days = await selectAll<{ day: number; released_at: string }>(db,
    "SELECT release_day AS day, MAX(released_at) AS released_at FROM sources GROUP BY release_day ORDER BY day");
  return days.filter((d) => isReleased(d.released_at));
}

function withholdPayFromRow(row: EvidenceRow): EvidenceRow {
  if (mentionsPay(row.text)) return { ...row, text: withholdPay(row.text), data_json: null };
  const data = row.data_json ? JSON.stringify(withoutPayFields(JSON.parse(row.data_json))) : null;
  return { ...row, data_json: data };
}
