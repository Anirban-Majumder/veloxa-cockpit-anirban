import { generateText } from "ai";
import { z } from "zod";
import type { Db } from "../db/client";
import { getModel } from "../ai/model";
import { buildEvidencePack } from "./context";
import { evidenceAtCutoff } from "../retrieval/evidence";

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
  })).min(4).max(8),
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
From ONLY the evidence provided, propose 5 to 7 distinct candidate concerns the CEO should worry about now. Do not use outside knowledge.

Score each factor 1-3 with a short evidence-based reason:
- impact: 1 limited / 2 team-level / 3 company-wide or critical project
- urgency: 1 monitor / 2 act soon / 3 act now
- evidence_strength: 1 tentative or conflicting / 2 direct single source / 3 corroborated by independent sources
Do NOT rank or compute totals; the backend does that.

Before choosing, consider at least these areas and include any the evidence supports: delivery of critical projects (e.g. release dates, slips), finance (ARR, burn, runway, and conflicts between sources), headcount and hiring, retention/morale/workload, people or key-person risk, payroll or process errors raised in emails, and requests or decisions still open in transcripts. A risk does not disappear because a newer release says nothing about it; keep it if nothing resolves it.

Accuracy rules:
- State only what the cited evidence says. Never upgrade claims: one documented move is "moved", not "repeatedly moved"; a board update is "reported by the board update", not "actual".
- Never add a unit, date or number a source did not state (e.g. a transcript's "forty-eight" with no unit stays unitless).
- Name the source type correctly: board updates are reports; the GL export contains transactions and costs, not ARR.
- When sources conflict, present both sides as attributed claims and do not say which is true; evidence_strength must then be 1.
- When describing a change from X to Y, cite the rows for BOTH X and Y.
- evidence_strength reason must match the citations: 3 only if two or more independent sources agree; say how many sources.
- Describe payroll or pay issues without any amounts or individual pay.
- impact 3 only for company-wide effects or a named critical project; a single team is 2.

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

  // Verification pass: check every claim against only its cited text and correct it (audit loop, 17 Nov).
  const byId = new Map((await evidenceAtCutoff(db, cutoff)).map((e) => [e.id, e]));
  proposal = await verifyProposal(model, proposal, byId);

  let dropped = 0;
  const cleaned = proposal.concerns.map((c) => {
    const ev = c.evidence
      .map((e) => ({ id: Number(String(e.id).replace(/^E/i, "")), rationale: e.rationale }))
      .filter((e) => { const ok = ids.has(e.id); if (!ok) dropped++; return ok; });
    return { ...c, evidence: [...new Map(ev.map((e) => [e.id, e])).values()] };
  }).filter((c) => c.evidence.length > 0) // a concern with no valid citation is not shown
    .map((c) => capScores(c, byId));
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

const VERIFY = `You are a strict fact-checker for a CEO briefing. For each concern, compare EVERY sentence in title, description and reasons against ONLY the text of its cited evidence (shown below each concern), plus the full evidence list if you need to add a citation.
Fix, do not merely flag:
- Remove or correct any claim, number, unit, date, name or adjective the cited text does not state (e.g. "repeatedly", "actual", "significantly", a unit that was not said, or a unit wrongly called missing).
- If a sentence relies on a row that is not cited, add that row's ID to evidence (with rationale) or delete the sentence.
- If the concern describes a conflict between sources, both sides must be cited and evidence_strength must be 1.
- Reasons must match the citations (count of independent sources, what they are).
- Keep pay amounts out. Keep the same JSON shape. Keep every concern unless it is wholly unsupported.
Respond with the corrected JSON only.`;

async function verifyProposal(
  model: Parameters<typeof generateText>[0]["model"],
  proposal: z.infer<typeof Proposal>,
  byId: Map<number, { text: string; path: string }>,
): Promise<z.infer<typeof Proposal>> {
  const cited = proposal.concerns.map((c, i) => {
    const ev = c.evidence.map((e) => {
      const row = byId.get(Number(String(e.id).replace(/^E/i, "")));
      return row ? `  [E${e.id}] (${row.path}) ${row.text.slice(0, 1200)}` : `  [E${e.id}] (NOT FOUND, remove)`;
    }).join("\n");
    return `Concern ${i + 1} cited evidence:\n${ev}`;
  }).join("\n\n");
  const all = [...byId.entries()].map(([id, r]) => `[E${id}] (${r.path}) ${r.text.slice(0, 400)}`).join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await generateText({
        model, system: VERIFY, temperature: 0,
        prompt: `CONCERNS JSON:\n${JSON.stringify(proposal)}\n\nCITED EVIDENCE:\n${cited}\n\nALL EVIDENCE (for adding citations):\n${all}`,
      });
      return Proposal.parse(extractJson(text));
    } catch { /* retry, then fall back to the unverified proposal */ }
  }
  console.warn("Verification pass failed; storing unverified proposal.");
  return proposal;
}

const CONFLICT = /\b(conflict|disagree|discrepanc|contradict|inconsisten|do not match|don't match|never match)/i;

/**
 * Deterministic guards on model-proposed evidence strength (D019):
 * a conflict is "tentative or conflicting" (1); "corroborated" (3) needs at least two distinct source files.
 */
export function capScores<T extends { title: string; description: string; evidence_strength: number; evidence: { id: number }[]; reasons: { evidence_strength: string } }>(
  c: T, byId: Map<number, { path: string }>,
): T {
  const files = new Set(c.evidence.map((e) => byId.get(e.id)?.path).filter(Boolean));
  let strength = c.evidence_strength, note = "";
  if (CONFLICT.test(`${c.title} ${c.description}`) && strength > 1) { strength = 1; note = " (Capped at 1: the sources conflict.)"; }
  else if (strength === 3 && files.size < 2) { strength = 2; note = " (Capped at 2: only one source file is cited.)"; }
  return note ? { ...c, evidence_strength: strength, reasons: { ...c.reasons, evidence_strength: c.reasons.evidence_strength + note } } : c;
}
