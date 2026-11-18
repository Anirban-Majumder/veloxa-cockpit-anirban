import { execute, selectAll, selectOne, transaction, type Db } from "../db/client";
import { isReleased } from "../ingestion/releases";
import { isRestricted } from "../retrieval/evidence";
import { maskAmounts, mentionsPay, withholdPay } from "../retrieval/redact";
import type { ProposedConcern } from "./config";
import { scoreConcern } from "./scoring";

export interface Concern {
  id: number;
  rank: number;
  title: string;
  description: string;
  impact: number;
  urgency: number;
  evidence_strength: number;
  score: number;
  reasons: { impact: string; urgency: string; evidence_strength: string; uncertainty: string };
  model: string;
  generated_at: string;
  evidence: CitedEvidence[];
}

interface CitedEvidence {
  id: number;
  rationale: string | null;
  text: string;
  path: string;
  locator: Record<string, unknown>;
  released_at: string;
}

type ConcernRow = Omit<Concern, "reasons" | "evidence"> & { scoring_reasons_json: string };
type EvidenceLinkRow = Omit<CitedEvidence, "locator"> & { locator_json: string; metadata_json: string | null };

/** Replaces any earlier set for the same cutoff. `ranked` must already be in rank order. */
export async function saveConcerns(db: Db, cutoff: string, ranked: ProposedConcern[], model: string) {
  const generatedAt = new Date().toISOString();
  await transaction(db, async () => {
    await execute(db, "DELETE FROM concerns WHERE knowledge_cutoff = ?", cutoff);
    for (const [index, c] of ranked.entries()) {
      const row = await selectOne<{ id: number }>(db,
        `INSERT INTO concerns (knowledge_cutoff, title, description, impact, urgency, evidence_strength,
           scoring_reasons_json, score, rank, model, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        cutoff, c.title, c.description, c.impact, c.urgency, c.evidence_strength,
        JSON.stringify({ ...c.reasons, uncertainty: c.uncertainty }), scoreConcern(c), index + 1, model, generatedAt);
      for (const e of c.evidence) {
        await execute(db, "INSERT OR IGNORE INTO concern_evidence (concern_id, evidence_id, rationale) VALUES (?, ?, ?)",
          row!.id, e.id, e.rationale);
      }
    }
  });
}

export async function hasConcerns(db: Db, cutoff: string): Promise<boolean> {
  return !!(await selectOne(db, "SELECT 1 FROM concerns WHERE knowledge_cutoff = ? LIMIT 1", cutoff));
}

/** Released cutoffs only, newest first. */
export async function concernCutoffs(db: Db): Promise<string[]> {
  const rows = await selectAll<{ cutoff: string }>(db,
    "SELECT DISTINCT knowledge_cutoff AS cutoff FROM concerns ORDER BY cutoff DESC");
  return rows.map((r) => r.cutoff).filter((cutoff) => isReleased(cutoff));
}

/** One transaction, so a regeneration cannot swap concerns between the reads. Stored text is filtered again on the way out. */
export function topConcerns(db: Db, cutoff: string, limit = 3): Promise<Concern[]> {
  return transaction(db, () => readTopConcerns(db, cutoff, limit));
}

async function readTopConcerns(db: Db, cutoff: string, limit: number): Promise<Concern[]> {
  const rows = await selectAll<ConcernRow>(db,
    `SELECT id, rank, title, description, impact, urgency, evidence_strength, score, model, generated_at, scoring_reasons_json
     FROM concerns WHERE knowledge_cutoff = ? ORDER BY rank LIMIT ?`, cutoff, limit);

  const concerns: Concern[] = [];
  for (const { scoring_reasons_json, ...row } of rows) {
    const links = await selectAll<EvidenceLinkRow>(db,
      `SELECT ce.evidence_id AS id, ce.rationale, e.text, e.locator_json, e.metadata_json, s.path, s.released_at
       FROM concern_evidence ce
       JOIN evidence e ON e.id = ce.evidence_id
       JOIN sources s ON s.id = e.source_id
       WHERE ce.concern_id = ? AND s.released_at <= ?
       ORDER BY ce.evidence_id`, row.id, cutoff);
    const reasons = JSON.parse(scoring_reasons_json) as Concern["reasons"];
    const visibleLinks = links.filter((link) => !isRestricted(link));
    const ownText = [row.title, row.description, ...Object.values(reasons), ...links.map((l) => l.rationale ?? "")].join("\n");
    const filter = mentionsPay(ownText) ? maskAmounts : withholdPay;

    concerns.push({
      ...row,
      title: filter(row.title),
      description: filter(row.description),
      reasons: Object.fromEntries(Object.entries(reasons).map(([key, value]) => [key, filter(value)])) as Concern["reasons"],
      evidence: visibleLinks.map(({ id, path, released_at, locator_json, text, rationale }) => ({
        id,
        path,
        released_at,
        text: withholdPay(text),
        rationale: rationale && filter(rationale),
        locator: JSON.parse(locator_json),
      })),
    });
  }
  return concerns;
}
