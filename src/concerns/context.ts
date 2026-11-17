import type { Db } from "../db/client";
import { evidenceAtCutoff, type EvidenceRow } from "../retrieval/evidence";

const MAX_TABLE_ROWS = 40;

/** Builds the cutoff-filtered evidence pack given to the model. Restricted rows are excluded; large tables are summarised. */
export async function buildEvidencePack(db: Db, cutoff: string): Promise<{ pack: string; ids: Set<number> }> {
  const all = await evidenceAtCutoff(db, cutoff, true);
  const visible = all.filter((r) => !r.metadata_json || JSON.parse(r.metadata_json).restricted == null);
  const ids = new Set(visible.map((r) => r.id));

  const groups = new Map<string, EvidenceRow[]>();
  for (const r of visible) {
    const sheet = (JSON.parse(r.locator_json) as { sheet?: string }).sheet;
    const key = `${r.path}${sheet ? ` [${sheet}]` : ""}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const parts: string[] = [];
  for (const [key, rows] of groups) {
    const r0 = rows[0]!;
    parts.push(`\n### ${key} (${r0.source_kind}, released ${r0.released_at.slice(0, 10)})`);
    const tableRows = rows.filter((r) => r.data_json && !r.path.endsWith(".eml"));
    if (tableRows.length > MAX_TABLE_ROWS) {
      for (const r of rows.filter((r) => !r.data_json)) parts.push(`[E${r.id}] ${r.text}`);
      parts.push(summariseTable(tableRows));
    } else {
      for (const r of rows) parts.push(`[E${r.id}] ${r.text}`);
    }
  }

  const payroll = payrollTotals(all.filter((r) => !ids.has(r.id)));
  if (payroll) parts.push(`\n### Derived: payroll totals (individual rows withheld from CEO view)\n${payroll}`);
  return { pack: parts.join("\n"), ids };
}

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

/** Month totals across all employees only; never per person (A002). */
function payrollTotals(rows: EvidenceRow[]): string | undefined {
  const totals = new Map<string, { gross: number; n: number }>();
  for (const r of rows) {
    if (!r.data_json) continue;
    const d = JSON.parse(r.data_json) as Record<string, unknown>;
    const month = d["Month"], gross = Number(d["Gross (Rs.)"]);
    if (typeof month !== "string" || !Number.isFinite(gross)) continue;
    const t = totals.get(month) ?? { gross: 0, n: 0 };
    totals.set(month, { gross: t.gross + gross, n: t.n + 1 });
  }
  // Suppress small groups that could reveal an individual by subtraction.
  const lines = [...totals].filter(([, t]) => t.n >= 5).map(([m, t]) => `${m}: gross Rs. ${t.gross} across ${t.n} employees`);
  return lines.length ? lines.join("\n") : undefined;
}
