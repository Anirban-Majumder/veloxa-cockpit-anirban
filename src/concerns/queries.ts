import type { Db } from "../db/client";

export interface ConcernView {
  id: number; rank: number; title: string; description: string;
  impact: number; urgency: number; evidence_strength: number; score: number;
  reasons: { impact: string; urgency: string; evidence_strength: string; uncertainty: string };
  model: string; generated_at: string;
  evidence: { id: number; rationale: string | null; text: string; path: string; locator: Record<string, unknown>; released_at: string }[];
}

/** Cutoffs that have stored concerns, newest first. */
export async function concernCutoffs(db: Db): Promise<string[]> {
  const rows = (await (await db.prepare("SELECT DISTINCT knowledge_cutoff AS c FROM concerns ORDER BY c DESC")).all()) as { c: string }[];
  return rows.map((r) => r.c);
}

export async function concernsAt(db: Db, cutoff: string, limit = 3): Promise<ConcernView[]> {
  const rows = (await (await db.prepare(
    "SELECT * FROM concerns WHERE knowledge_cutoff = ? ORDER BY rank LIMIT ?")).all(cutoff, limit)) as Record<string, unknown>[];
  const ev = (await db.prepare(
    `SELECT ce.evidence_id AS id, ce.rationale, e.text, e.locator_json, s.path, s.released_at
     FROM concern_evidence ce JOIN evidence e ON e.id = ce.evidence_id JOIN sources s ON s.id = e.source_id
     WHERE ce.concern_id = ? AND s.released_at <= ? ORDER BY ce.evidence_id`));
  const out: ConcernView[] = [];
  for (const r of rows) {
    const links = (await ev.all(r.id, cutoff)) as Record<string, unknown>[];
    out.push({
      id: r.id as number, rank: r.rank as number, title: r.title as string, description: r.description as string,
      impact: r.impact as number, urgency: r.urgency as number, evidence_strength: r.evidence_strength as number,
      score: r.score as number, reasons: JSON.parse(r.scoring_reasons_json as string),
      model: r.model as string, generated_at: r.generated_at as string,
      evidence: links.map((l) => ({
        id: l.id as number, rationale: l.rationale as string | null, text: l.text as string,
        path: l.path as string, locator: JSON.parse(l.locator_json as string), released_at: l.released_at as string,
      })),
    });
  }
  return out;
}
