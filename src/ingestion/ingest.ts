import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import type { Db } from "../db/client";
import { fileTypeOf, parseFile } from "./parsers";
import { INPUT_DIRS, RELEASE_ROOT, SKIP_DIRS, type Release } from "./releases";

/** Person-agent roster (D024). */
export const AGENT_ROSTER = [
  "VX002", "VX003", "VX004", "VX005", "VX006", "VX007", "VX009",
  "VX010", "VX011", "VX012", "VX014", "VX015", "VX017", "VX018",
];

export interface ReleaseResult {
  day: number;
  added: number;
  unchanged: number;
  evidence: number;
  skipped: string[];
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return SKIP_DIRS.has(name) ? [] : walk(p);
    return [p];
  });
}

/** Ingests one day's release. Re-running is a no-op for unchanged files; changed files become new source versions. */
export async function ingestRelease(db: Db, release: Release, root = RELEASE_ROOT): Promise<ReleaseResult> {
  const result: ReleaseResult = { day: release.day, added: 0, unchanged: 0, evidence: 0, skipped: [] };
  const findSource = (await db.prepare("SELECT id FROM sources WHERE path = ? AND sha256 = ?"));
  const insertSource = (await db.prepare(
    `INSERT INTO sources (path, sha256, file_type, source_kind, release_day, released_at, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`));
  const insertEvidence = (await db.prepare(
    "INSERT INTO evidence (source_id, locator_json, text, data_json, metadata_json) VALUES (?, ?, ?, ?, ?)"));

  for (const sub of INPUT_DIRS) {
    for (const file of walk(join(root, release.folder, sub))) {
      const rel = relative(root, file);
      const type = fileTypeOf(file);
      if (!type) { result.skipped.push(rel); continue; }
      const bytes = new Uint8Array(readFileSync(file));
      const sha = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
      if (await findSource.get(rel, sha)) { result.unchanged++; continue; }

      const parsed = await parseFile(type, bytes);
      await db.exec("BEGIN");
      try {
        const src = (await insertSource.get(
          rel, sha, type, sub === "transcripts" ? "transcript" : "data_room",
          release.day, release.releasedAt, new Date().toISOString(),
        )) as { id: number };
        for (const e of parsed) {
          await insertEvidence.run(
            src.id, JSON.stringify(e.locator), e.text,
            e.data ? JSON.stringify(e.data) : null,
            e.metadata ? JSON.stringify(e.metadata) : null,
          );
        }
        await db.exec("COMMIT");
      } catch (err) {
        await db.exec("ROLLBACK");
        throw new Error(`Failed to ingest ${rel}: ${(err as Error).message}`);
      }
      result.added++;
      result.evidence += parsed.length;
    }
  }
  await syncAgents(db);
  return result;
}

/** Upserts the 14 roster profiles from the latest employee-master rows, preserving `soul` (D025). */
export async function syncAgents(db: Db): Promise<number> {
  const rows = (await (await db.prepare(
    `SELECT e.data_json FROM evidence e JOIN sources s ON s.id = e.source_id
     WHERE e.data_json LIKE '%"Emp ID"%' AND e.data_json LIKE '%"Full Name"%'
     ORDER BY s.released_at, e.id`)).all()) as { data_json: string }[];
  const upsert = (await db.prepare(
    `INSERT INTO agents (employee_id, full_name, work_email, department, title, manager_id, join_date, location)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (employee_id) DO UPDATE SET full_name = excluded.full_name, work_email = excluded.work_email,
       department = excluded.department, title = excluded.title, manager_id = excluded.manager_id,
       join_date = excluded.join_date, location = excluded.location`));
  let n = 0;
  for (const { data_json } of rows) {
    const d = JSON.parse(data_json) as Record<string, string | undefined>;
    const id = d["Emp ID"];
    if (!id || !AGENT_ROSTER.includes(id)) continue;
    await upsert.run(id, d["Full Name"]!, d["Work Email"] ?? null, d["Department"] ?? null, d["Title"] ?? null,
      d["Manager ID"] ?? null, d["Join Date"] ?? null, d["Location"] ?? null);
    n++;
  }
  return n;
}
