import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execute, selectAll, selectOne, transaction, type Db } from "../db/client";
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

  for (const sub of INPUT_DIRS) {
    for (const file of walk(join(root, release.folder, sub))) {
      const path = relative(root, file);
      const type = fileTypeOf(file);
      if (!type) {
        result.skipped.push(path);
        continue;
      }
      const bytes = new Uint8Array(readFileSync(file));
      const sha = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
      if (await selectOne(db, "SELECT id FROM sources WHERE path = ? AND sha256 = ?", path, sha)) {
        result.unchanged++;
        continue;
      }

      const parsed = await parseFile(type, bytes);
      await transaction(db, async () => {
        const source = await selectOne<{ id: number }>(db,
          `INSERT INTO sources (path, sha256, file_type, source_kind, release_day, released_at, ingested_at)
           VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          path, sha, type, sub === "transcripts" ? "transcript" : "data_room", release.day, release.releasedAt, new Date().toISOString());
        for (const e of parsed) {
          await execute(db,
            "INSERT INTO evidence (source_id, locator_json, text, data_json, metadata_json) VALUES (?, ?, ?, ?, ?)",
            source!.id, JSON.stringify(e.locator), e.text,
            e.data ? JSON.stringify(e.data) : null, e.metadata ? JSON.stringify(e.metadata) : null);
        }
      }).catch((error: Error) => {
        throw new Error(`Failed to ingest ${path}: ${error.message}`);
      });
      result.added++;
      result.evidence += parsed.length;
    }
  }
  await syncAgents(db);
  return result;
}

/** Upserts the 14 roster profiles from the latest employee-master rows, preserving `soul` (D025). */
export async function syncAgents(db: Db): Promise<number> {
  const rows = await selectAll<{ data_json: string }>(db,
    `SELECT e.data_json FROM evidence e JOIN sources s ON s.id = e.source_id
     WHERE e.data_json LIKE '%"Emp ID"%' AND e.data_json LIKE '%"Full Name"%'
     ORDER BY s.released_at, e.id`);
  const profiles = rows
    .map((row) => JSON.parse(row.data_json) as Record<string, string | undefined>)
    .filter((d) => d["Emp ID"] && AGENT_ROSTER.includes(d["Emp ID"]));

  await transaction(db, async () => {
    for (const d of profiles) {
      await execute(db,
        `INSERT INTO agents (employee_id, full_name, work_email, department, title, manager_id, join_date, location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (employee_id) DO UPDATE SET full_name = excluded.full_name, work_email = excluded.work_email,
           department = excluded.department, title = excluded.title, manager_id = excluded.manager_id,
           join_date = excluded.join_date, location = excluded.location`,
        d["Emp ID"]!, d["Full Name"]!, d["Work Email"] ?? null, d["Department"] ?? null, d["Title"] ?? null,
        d["Manager ID"] ?? null, d["Join Date"] ?? null, d["Location"] ?? null);
    }
  });
  return profiles.length;
}
