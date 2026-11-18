import { z } from "zod";

const Factor = z.number().int().min(1).max(3);

export const ProposalSchema = z.object({
  concerns: z.array(z.object({
    title: z.string(),
    description: z.string(),
    impact: Factor,
    urgency: Factor,
    evidence_strength: Factor,
    reasons: z.object({ impact: z.string(), urgency: z.string(), evidence_strength: z.string() }),
    uncertainty: z.string(),
    evidence: z.array(z.object({ id: z.number().int(), rationale: z.string() })),
  })),
});

export type Proposal = z.infer<typeof ProposalSchema>;
export type ProposedConcern = Proposal["concerns"][number];

export const PROPOSE_PROMPT = `You are the analyst behind Veloxa's CEO cockpit. The CEO (Ananya Rao) said: "When I open it, it should just tell me what to worry about. Top three."
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
- Cite evidence by numeric ID (12 for [E12]); every concern needs at least one citation; cite only IDs that appear in the evidence.
- Transcripts are machine-generated and may mishear names/numbers; prefer system exports when they conflict, and say so in uncertainty.
- Never reveal or infer an individual's salary.
- Be specific and concise: description <= 2 sentences, written for a busy CEO.
- State what is unknown in "uncertainty".`;

export const VERIFY_PROMPT = `You are a strict fact-checker for a CEO briefing. For each concern, compare EVERY sentence in title, description, reasons, uncertainty and each evidence rationale against ONLY the text of its cited evidence (shown below each concern), plus the full evidence list if you need to add a citation.
Fix, do not merely flag:
- Remove or correct any claim, number, unit, date, deadline, name or adjective the cited text does not state ("moved past September" when no new date is given is unsupported) (e.g. "repeatedly", "actual", "significantly", a unit that was not said, or a unit wrongly called missing).
- If a sentence relies on a row that is not cited, add that row's ID to evidence (with rationale) or delete the sentence.
- If the concern describes a conflict between sources, both sides must be cited and evidence_strength must be 1.
- Reasons must match the citations (count of independent sources, what they are).
- Keep pay amounts out. Keep the same shape. Keep every concern unless it is wholly unsupported.`;
