import type { Db } from "../db/client";
import { generateStructured } from "../ai/generate";
import { evidenceAtCutoff, type EvidenceRow } from "../retrieval/evidence";
import { PROPOSE_PROMPT, ProposalSchema, VERIFY_PROMPT, type Proposal } from "./config";
import { buildEvidencePack } from "./evidence-pack";
import { capScores, rankConcerns, scoreConcern } from "./scoring";
import { saveConcerns } from "./store";

const MIN_CONCERNS = 3;

export interface GeneratedConcerns {
  stored: number;
  droppedCitations: number;
  top: { title: string; score: number }[];
}

export async function generateConcerns(db: Db, cutoff: string): Promise<GeneratedConcerns> {
  const { pack, ids } = await buildEvidencePack(db, cutoff);
  const evidenceById = new Map((await evidenceAtCutoff(db, cutoff)).map((e) => [e.id, e]));

  const { output: proposal, modelId } = await generateStructured({
    system: PROPOSE_PROMPT,
    prompt: `Knowledge cutoff: ${cutoff}. Evidence released after this does not exist for you.\n\nEVIDENCE:\n${pack}`,
    schema: ProposalSchema,
  });
  const verified = await verify(proposal, evidenceById);

  let droppedCitations = 0;
  const concerns = verified.concerns
    .map((concern) => {
      const valid = concern.evidence.filter((e) => ids.has(e.id));
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

/** Second pass: each claim is checked against only the text it cites. Falls back to the unverified proposal. */
async function verify(proposal: Proposal, evidenceById: Map<number, EvidenceRow>): Promise<Proposal> {
  const quote = (id: number, length: number) => {
    const row = evidenceById.get(id);
    return row ? `[E${id}] (${row.path}) ${row.text.slice(0, length)}` : `[E${id}] (NOT FOUND, remove)`;
  };
  const cited = proposal.concerns
    .map((c, i) => `Concern ${i + 1} cited evidence:\n${c.evidence.map((e) => `  ${quote(e.id, 1200)}`).join("\n")}`)
    .join("\n\n");
  const all = [...evidenceById.keys()].map((id) => quote(id, 400)).join("\n");

  try {
    const { output } = await generateStructured({
      system: VERIFY_PROMPT,
      prompt: `CONCERNS JSON:\n${JSON.stringify(proposal)}\n\nCITED EVIDENCE:\n${cited}\n\nALL EVIDENCE (for adding citations):\n${all}`,
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
