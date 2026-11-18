import type { Db } from "../db/client";
import { evidenceAtCutoff, type EvidenceRow } from "../retrieval/evidence";

const MAX_TABLE_ROWS = 40;

/** Builds the cutoff-filtered evidence pack given to the model. Restricted rows are excluded; large tables are summarised. */
export async function buildEvidencePack(db: Db, cutoff: string): Promise<{ pack: string; ids: Set<number> }> {
  // No derived payroll totals are emitted: month-over-month totals let one joiner's pay be recovered by subtraction (A002).
  const visible = await evidenceAtCutoff(db, cutoff);
  const ids = new Set(visible.map((r) => r.id));

  const parts: string[] = [];
  for (const [key, rows] of groupBySource(visible)) {
    const first = rows[0]!;
    parts.push(`\n### ${key} (${first.source_kind}, released ${first.released_at.slice(0, 10)})`);
    const tableRows = tableRowsOf(rows);
    if (tableRows.length > MAX_TABLE_ROWS) {
      for (const r of rows.filter((r) => !r.data_json)) parts.push(`[E${r.id}] ${r.text}`);
      parts.push(summariseTable(tableRows));
    } else {
      for (const r of rows) parts.push(`[E${r.id}] ${r.text}`);
    }
  }

  return { pack: parts.join("\n"), ids };
}

/** Tables too large to read row by row, keyed like "path [sheet]", each with its deterministic summary. */
export async function largeTableSummaries(db: Db, cutoff: string): Promise<Map<string, string>> {
  const summaries = new Map<string, string>();
  for (const [key, rows] of groupBySource(await evidenceAtCutoff(db, cutoff))) {
    const tableRows = tableRowsOf(rows);
    if (tableRows.length > MAX_TABLE_ROWS) summaries.set(key, summariseTable(tableRows));
  }
  return summaries;
}

function groupBySource(rows: EvidenceRow[]): Map<string, EvidenceRow[]> {
  const groups = new Map<string, EvidenceRow[]>();
  for (const r of rows) {
    const sheet = (JSON.parse(r.locator_json) as { sheet?: string }).sheet;
    const key = `${r.path}${sheet ? ` [${sheet}]` : ""}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return groups;
}

const tableRowsOf = (rows: EvidenceRow[]) => rows.filter((r) => r.data_json && !r.path.endsWith(".eml"));

/** Generic deterministic summary for a large table; rows stay citable via their ID range. */
function summariseTable(rows: EvidenceRow[]): string {
  const data = rows.map((r) => JSON.parse(r.data_json!) as Record<string, unknown>);
  const cols = [...new Set(data.flatMap(Object.keys))];
  const lines = [`[E${rows[0]!.id}–E${rows.at(-1)!.id}] ${rows.length} rows, summarised. Columns: ${cols.join(", ")}`];
  const dateCol = cols.find((c) => data.every((d) => d[c] == null || /^\d{4}-\d{2}-\d{2}/.test(String(d[c]))));
  if (dateCol) {
    const ds = data.map((d) => String(d[dateCol] ?? "")).filter(Boolean).sort();
    lines.push(`${dateCol} range: ${ds[0]} to ${ds.at(-1)}`);
  }
  for (const c of cols) {
    const counts = new Map<string, number>();
    for (const d of data) if (d[c] != null) counts.set(String(d[c]), (counts.get(String(d[c])) ?? 0) + 1);
    if (counts.size < 2 || counts.size > 25) continue;
    lines.push(`${c} counts: ${[...counts].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    // Monthly trend per category, e.g. commits per author per month.
    if (dateCol) {
      const byMonth = new Map<string, Map<string, number>>();
      for (const d of data) {
        if (d[c] == null || d[dateCol] == null) continue;
        const m = String(d[dateCol]).slice(0, 7);
        const inner = byMonth.get(String(d[c])) ?? new Map<string, number>();
        inner.set(m, (inner.get(m) ?? 0) + 1);
        byMonth.set(String(d[c]), inner);
      }
      for (const [k, inner] of byMonth) {
        lines.push(`  ${c}=${k} per month: ${[...inner].sort().map(([m, v]) => `${m}:${v}`).join(" ")}`);
      }
    }
  }
  return lines.join("\n");
}
