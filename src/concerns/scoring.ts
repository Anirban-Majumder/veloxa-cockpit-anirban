type Factors = { impact: number; urgency: number; evidence_strength: number };

/** D019 */
export const scoreConcern = (c: Factors) => 2 * c.impact + c.urgency + c.evidence_strength;

export function rankConcerns<T extends Factors>(concerns: T[]): T[] {
  return [...concerns].sort((a, b) =>
    scoreConcern(b) - scoreConcern(a) || b.urgency - a.urgency || b.impact - a.impact);
}

const CONFLICT = /\b(conflict|disagree|discrepanc|contradict|inconsisten|do not match|don't match|never match)/i;

interface Cappable {
  title: string;
  description: string;
  evidence_strength: number;
  evidence: { id: number }[];
  reasons: { evidence_strength: string };
}

/** Conflicting sources cap strength at 1; "corroborated" (3) needs two distinct source files. */
export function capScores<T extends Cappable>(concern: T, pathOf: Map<number, { path: string }>): T {
  const files = new Set(concern.evidence.map((e) => pathOf.get(e.id)?.path).filter(Boolean));
  const conflicting = CONFLICT.test(`${concern.title} ${concern.description}`);

  let cap: { strength: number; note: string } | undefined;
  if (conflicting && concern.evidence_strength > 1) cap = { strength: 1, note: "Capped at 1: the sources conflict." };
  else if (concern.evidence_strength === 3 && files.size < 2) cap = { strength: 2, note: "Capped at 2: only one source file is cited." };
  if (!cap) return concern;

  return {
    ...concern,
    evidence_strength: cap.strength,
    reasons: { ...concern.reasons, evidence_strength: `${concern.reasons.evidence_strength} (${cap.note})` },
  };
}
