import type { EvidenceRow } from "../src/retrieval/evidence";
import type { Question, Support } from "../tests/fixtures/eval-questions";

const UNCERTAIN = /\b(?:don['’]t|do not) (?:know|have|see|find)|\b(?:can['’]t|cannot|couldn['’]t|could not|unable to)\s+(?:access|check|confirm|disclose|find|provide|recall|say|see|share|tell|verify|determine|answer|give|retrieve)\b|\b(?:isn['’]t|aren['’]t|wasn['’]t|weren['’]t|is not|are not|was not|were not|not yet)\s+(?:in|available|released|recorded|documented|known|included|sent|shared|copied|disclosed)\b|\bno\s+(?:available |relevant )?(?:records?|evidence|information|access|record of)\b|\b(?:withheld|restricted|confidential|unavailable|unknown|not permitted|rather not guess|outside (?:my|the) (?:records|cutoff|scope))\b/i;

const NEGATED = /\b(?:not(?! (?:only|just)\b)|never|wasn['’]t|isn['’]t|weren['’]t|aren['’]t|rather than|instead of)\s+(?:\w+\s+){0,3}$/i;
const CONFIDENCE_LINE = /^\s*(?:\*\*)?Confidence\s*:/im;

export function supports(row: Pick<EvidenceRow, "path" | "text">, source: Support) {
  return row.path.endsWith(source.file) && source.passage.test(row.text);
}

export function answerFailures(
  question: Question,
  answer: string,
  rows: EvidenceRow[],
  shown: ReadonlySet<number>,
  finishReason?: string,
) {
  if (!answer.trim()) return [`empty answer${finishReason ? ` (finish: ${finishReason})` : ""}`];

  const body = answer.split(CONFIDENCE_LINE, 1)[0] ?? "";
  const citations = new Set<number>();
  const bodyCitations = new Set<number>();
  const failures: string[] = [];
  for (const { 0: bracket, index } of answer.matchAll(/\[\s*E\d[^\]\n[]*\]?/gi)) {
    if (!/^\[\s*E\d+(?:\s*,\s*E\d+)*\s*\]$/i.test(bracket)) {
      failures.push(`malformed citation ${bracket}`);
      continue;
    }
    for (const [, id] of bracket.matchAll(/E(\d+)/gi)) {
      citations.add(Number(id));
      if (index < body.length) bodyCitations.add(Number(id));
    }
  }
  const cited = rows.filter((row) => citations.has(row.id) && shown.has(row.id));
  if (cited.length !== citations.size) failures.push("citation was outside retrieved evidence");

  const response = body.replace(/\[\s*[ET]\d[^\]\n]*\]/gi, "");
  const uncitedAnswer = answer.replace(/\[\s*[ET]\d[^\]\n]*\]/gi, "");
  for (const pattern of question.includes ?? []) {
    const hits = [...response.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
    if (!hits.length) failures.push(`missing ${pattern}`);
    else if (hits.some(({ index }) => NEGATED.test(response.slice(0, index)))) failures.push(`negated ${pattern}`);
  }
  for (const pattern of question.excludes ?? []) {
    if (pattern.test(uncitedAnswer)) failures.push(`forbidden ${pattern}`);
  }
  if (question.refusal && (!UNCERTAIN.test(response) || !question.refusal.reason.test(response))) {
    failures.push("missing refusal or uncertainty about the requested information");
  }

  for (const alternatives of question.support ?? []) {
    if (!cited.some((row) => bodyCitations.has(row.id) && alternatives.some((source) => supports(row, source)))) {
      failures.push(`missing supporting citation from ${[...new Set(alternatives.map(({ file }) => file))].join(" or ")}`);
    }
  }
  return failures;
}
