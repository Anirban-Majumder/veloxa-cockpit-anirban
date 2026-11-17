import { generateText } from "ai";
import { z } from "zod";
import type { Db } from "../db/client";
import { getModel } from "../ai/model";
import { buildEvidencePack } from "./context";

const Factor = z.number().int().min(1).max(3);
const Proposal = z.object({
  concerns: z.array(z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    impact: Factor,
    urgency: Factor,
    evidence_strength: Factor,
    reasons: z.object({ impact: z.string(), urgency: z.string(), evidence_strength: z.string() }),
    uncertainty: z.string(),
    evidence: z.array(z.object({ id: z.union([z.number(), z.string()]), rationale: z.string() })).min(1),
  })).min(3).max(8),
});
type ProposedConcern = z.infer<typeof Proposal>["concerns"][number];

/** D019: score = 2 × impact + urgency + evidence strength. */
export const scoreConcern = (c: Pick<ProposedConcern, "impact" | "urgency" | "evidence_strength">) =>
  2 * c.impact + c.urgency + c.evidence_strength;

/** Orders by score, then urgency (D019 tie-break), then impact. */
export function rankConcerns<T extends Pick<ProposedConcern, "impact" | "urgency" | "evidence_strength">>(cs: T[]) {
  return [...cs].sort((a, b) => scoreConcern(b) - scoreConcern(a) || b.urgency - a.urgency || b.impact - a.impact);
}

const SYSTEM = `You are the analyst behind Veloxa's CEO cockpit. The CEO (Ananya Rao) said: "When I open it, it should just tell me what to worry about. Top three."
From ONLY the evidence provided, propose 4 to 6 candidate concerns the CEO should worry about now. Do not use outside knowledge.

Score each factor 1-3 with a short evidence-based reason:
- impact: 1 limited / 2 team-level / 3 company-wide or critical project
- urgency: 1 monitor / 2 act soon / 3 act now
- evidence_strength: 1 tentative or conflicting / 2 direct single source / 3 corroborated by independent sources
Do NOT rank or compute totals; the backend does that.

Rules:
- Cite evidence by numeric ID (e.g. 12 for [E12]); every concern needs at least one citation; cite only IDs that appear in the evidence.
- Transcripts are machine-generated and may mishear names/numbers; prefer system exports when they conflict, and say so in uncertainty.
- Never reveal or infer an individual's salary.
- Be specific and concise: description <= 2 sentences, written for a busy CEO.
- State what is unknown in "uncertainty".

Respond with JSON only, no prose or code fences:
{"concerns":[{"title":"...","description":"...","impact":1,"urgency":1,"evidence_strength":1,"reasons":{"impact":"...","urgency":"...","evidence_strength":"..."},"uncertainty":"...","evidence":[{"id":12,"rationale":"..."}]}]}`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model returned no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

export interface GeneratedConcerns { cutoff: string; stored: number; top: { title: string; score: number }[]; droppedCitations: number }

/** Generates, scores and stores concerns for a knowledge cutoff, replacing any previous set for that cutoff. */
export async function generateConcerns(db: Db, cutoff: string): Promise<GeneratedConcerns> {
  const { model, modelId } = getModel();
  const { pack, ids } = await buildEvidencePack(db, cutoff);
  const prompt = `Knowledge cutoff: ${cutoff}. Evidence released after this does not exist for you.\n\nEVIDENCE:\n${pack}`;

  let proposal: z.infer<typeof Proposal> | undefined;
  let lastErr = "";
  for (let attempt = 0; attempt < 3 && !proposal; attempt++) {
    const { text } = await generateText({
      model, system: SYSTEM, temperature: 0.2,
      prompt: attempt === 0 ? prompt : `${prompt}\n\nYour previous reply was invalid (${lastErr}). Reply with valid JSON only.`,
    });
    try { proposal = Proposal.parse(extractJson(text)); }
    catch (e) { lastErr = (e as Error).message.slice(0, 300); }
  }
  if (!proposal) throw new Error(`Concern generation failed after 3 attempts: ${lastErr}`);

  let dropped = 0;
  const cleaned = proposal.concerns.map((c) => {
    const ev = c.evidence
      .map((e) => ({ id: Number(String(e.id).replace(/^E/i, "")), rationale: e.rationale }))
      .filter((e) => { const ok = ids.has(e.id); if (!ok) dropped++; return ok; });
    return { ...c, evidence: [...new Map(ev.map((e) => [e.id, e])).values()] };
  });
  const ranked = rankConcerns(cleaned);

  const now = new Date().toISOString();
  const insert = (await db.prepare(
    `INSERT INTO concerns (knowledge_cutoff, title, description, impact, urgency, evidence_strength,
       scoring_reasons_json, score, rank, model, generated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id`));
  const link = (await db.prepare("INSERT OR IGNORE INTO concern_evidence (concern_id, evidence_id, rationale) VALUES (?,?,?)"));
  await db.exec("BEGIN");
  try {
    await (await db.prepare("DELETE FROM concern_evidence WHERE concern_id IN (SELECT id FROM concerns WHERE knowledge_cutoff = ?)")).run(cutoff);
    await (await db.prepare("DELETE FROM concerns WHERE knowledge_cutoff = ?")).run(cutoff);
    for (const [i, c] of ranked.entries()) {
      const row = (await insert.get(cutoff, c.title, c.description, c.impact, c.urgency, c.evidence_strength,
        JSON.stringify({ ...c.reasons, uncertainty: c.uncertainty }), scoreConcern(c), i + 1, modelId, now)) as { id: number };
      for (const e of c.evidence) await link.run(row.id, e.id, e.rationale);
    }
    await db.exec("COMMIT");
  } catch (e) { await db.exec("ROLLBACK"); throw e; }

  return { cutoff, stored: ranked.length, top: ranked.slice(0, 3).map((c) => ({ title: c.title, score: scoreConcern(c) })), droppedCitations: dropped };
}
