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

/** Records each roster member's identity, plus their role and reporting line as of every export that lists them. */
export async function syncAgents(db: Db): Promise<number> {
  const rows = await selectAll<{ data_json: string; released_at: string }>(db,
    `SELECT e.data_json, s.released_at FROM evidence e JOIN sources s ON s.id = e.source_id
     WHERE e.data_json LIKE '%"Emp ID"%' AND e.data_json LIKE '%"Full Name"%'
     ORDER BY s.released_at, e.id`);
  const records = rows
    .map((row) => ({ releasedAt: row.released_at, fields: JSON.parse(row.data_json) as Record<string, string | undefined> }))
    .filter(({ fields }) => fields["Emp ID"] && AGENT_ROSTER.includes(fields["Emp ID"]));

  await transaction(db, async () => {
    for (const { releasedAt, fields: d } of records) {
      await execute(db,
        `INSERT INTO agents (employee_id, full_name, work_email, join_date) VALUES (?, ?, ?, ?)
         ON CONFLICT (employee_id) DO UPDATE SET
           full_name = excluded.full_name, work_email = excluded.work_email, join_date = excluded.join_date`,
        d["Emp ID"]!, d["Full Name"]!, d["Work Email"] ?? null, d["Join Date"] ?? null);
      await execute(db,
        `INSERT OR REPLACE INTO agent_profiles (employee_id, effective_from, department, title, manager_id, location, status, exit_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        d["Emp ID"]!, releasedAt, d["Department"] ?? null, d["Title"] ?? null, d["Manager ID"] ?? null,
        d["Location"] ?? null, d["Status"] ?? null, d["Exit Date"]?.slice(0, 10) || null);
    }
  });
  return new Set(records.map(({ fields }) => fields["Emp ID"])).size;
}
