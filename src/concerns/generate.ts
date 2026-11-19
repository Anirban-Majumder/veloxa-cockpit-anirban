import type { Db } from "../db/client";
import { generateStructured } from "../ai/generate";
import { evidenceAtCutoff, type EvidenceRow } from "../retrieval/evidence";
import { searchEvidence } from "../retrieval/search";
import { PROPOSE_PROMPT, ProposalSchema, VERIFY_PROMPT, type Proposal } from "./config";
import { formatEvidencePack } from "./evidence-pack";
import { capScores, rankConcerns, scoreConcern } from "./scoring";
import { previousConcerns, saveConcerns } from "./store";

const MIN_CONCERNS = 3;
const RELATED_PER_SOURCE = 5;
const MAX_RELATED_ROWS = 40;

export interface GeneratedConcerns {
  stored: number;
  droppedCitations: number;
  top: { title: string; score: number }[];
}

export async function generateConcerns(db: Db, cutoff: string): Promise<GeneratedConcerns> {
  const previous = await previousConcerns(db, cutoff);
  const visible = await evidenceAtCutoff(db, cutoff);
  const evidenceById = new Map(visible.map((row) => [row.id, row]));
  const newRows = previous ? visible.filter((row) => row.released_at > previous.cutoff) : visible;
  const pack = formatEvidencePack(newRows);
  const priorRows = new Map<number, EvidenceRow>();
  const priorConcerns = previous?.concerns.map(({ title, description, impact, urgency, evidence_strength, reasons, evidence }, index) => ({
    index: index + 1, title, description, impact, urgency, evidence_strength, reasons,
    evidence: evidence.flatMap(({ id }) => {
      const row = evidenceById.get(id);
      if (!row) return [];
      priorRows.set(id, row);
      return [quote(row, 300)];
    }),
  }));
  const related = previous ? await relatedEvidence(db, cutoff, newRows, priorRows) : [];
  const inputEvidence = previous
    ? `NEW EVIDENCE:\n${pack}\n\nRELATED OLDER EVIDENCE:\n${related.map((row) => quote(row, 300)).join("\n")}`
    : `EVIDENCE:\n${pack}`;
  const priorBriefing = priorConcerns ? `\n\nPREVIOUS CONCERNS:\n${JSON.stringify(priorConcerns)}` : "";

  const { output: proposal, modelId } = await generateStructured({
    system: PROPOSE_PROMPT,
    prompt: `Knowledge cutoff: ${cutoff}.${priorBriefing}\n\n${inputEvidence}`,
    schema: ProposalSchema,
  });
  const priorEvidence = [...priorRows.values()].map((row) => quote(row, 300)).join("\n");
  const verificationEvidence = priorEvidence ? `${inputEvidence}\n\nPREVIOUSLY CITED EVIDENCE:\n${priorEvidence}` : inputEvidence;
  const verified = await verify(proposal, evidenceById, verificationEvidence);

  let droppedCitations = 0;
  const concerns = verified.concerns
    .filter((concern) => concern.status !== "resolve")
    .map((concern) => {
      const valid = concern.evidence.filter((e) => evidenceById.has(e.id));
      droppedCitations += concern.evidence.length - valid.length;
      return { ...concern, evidence: uniqueById(valid) };
    })
    .filter((concern) => concern.evidence.length > 0)
    .map((concern) => capScores(concern, evidenceById));

  const ranked = rankConcerns(concerns);
  if (ranked.length < MIN_CONCERNS) {
    throw new Error(`Only ${ranked.length} concern(s) had valid citations; kept the previous briefing.`);
  }
  await saveConcerns(db, cutoff, ranked, modelId);

  return {
    stored: ranked.length,
    droppedCitations,
    top: ranked.slice(0, 3).map((c) => ({ title: c.title, score: scoreConcern(c) })),
  };
}

async function relatedEvidence(db: Db, cutoff: string, newRows: EvidenceRow[], priorRows: Map<number, EvidenceRow>) {
  const excludeIds = new Set([...priorRows.keys(), ...newRows.map((row) => row.id)]);
  const queries = new Map<number, string[]>();
  for (const row of newRows) {
    const terms = queries.get(row.source_id) ?? [row.path];
    if (terms.length < 4) terms.push(row.text.slice(0, 300));
    queries.set(row.source_id, terms);
  }

  const related: EvidenceRow[] = [];
  for (const terms of queries.values()) {
    const limit = Math.min(RELATED_PER_SOURCE, MAX_RELATED_ROWS - related.length);
    if (!limit) break;
    const hits = await searchEvidence(db, terms.join(" "), cutoff, { limit, excludeIds });
    for (const row of hits) excludeIds.add(row.id);
    related.push(...hits);
  }
  return related;
}

const quote = (row: EvidenceRow, length?: number) => `[E${row.id}] (${row.path}) ${row.text.slice(0, length)}`;

async function verify(proposal: Proposal, evidenceById: Map<number, EvidenceRow>, inputEvidence: string): Promise<Proposal> {
  const cited = uniqueById(proposal.concerns.flatMap((concern) => concern.evidence))
    .map(({ id }) => {
      const row = evidenceById.get(id);
      return row ? quote(row) : `[E${id}] (NOT FOUND, remove)`;
    })
    .join("\n");

  try {
    const { output } = await generateStructured({
      system: VERIFY_PROMPT,
      prompt: `CONCERNS JSON:\n${JSON.stringify(proposal)}\n\nCITED EVIDENCE:\n${cited}\n\n${inputEvidence}`,
      schema: ProposalSchema,
      temperature: 0,
      attempts: 2,
    });
    return output;
  } catch (error) {
    console.warn(`Verification pass failed; storing the unverified proposal. ${(error as Error).message}`);
    return proposal;
  }
}

const uniqueById = <T extends { id: number }>(items: T[]) => [...new Map(items.map((item) => [item.id, item])).values()];
