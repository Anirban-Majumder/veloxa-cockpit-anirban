import { getModel } from "../src/ai/model";
import { findAgent } from "../src/agents/store";
import { prepareChat } from "../src/chat/agent";
import { pointInTime } from "../src/chat/point-in-time";
import { openDb } from "../src/db/client";
import { runIngest } from "../src/ingestion/run";
import { scopedEvidence } from "../src/retrieval/search";
import { questions, type Question } from "../tests/fixtures/eval-questions";
import { answerFailures } from "./eval-answer";

const color = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const style = (code: number, line: string) => color ? `\x1b[${code}m${line}\x1b[0m` : line;
const seconds = (ms: number) => `${(ms / 1_000).toFixed(1)}s`;
const started = performance.now();
const statusStyle = { PASS: [32, "✓"], FAIL: [31, "✗"], ERROR: [33, "!"] } as const;
type Status = keyof typeof statusStyle;

try {
  const { modelId } = getModel();
  const db = await openDb(":memory:");
  const { cutoff: selected, upTo, changedFiles, agents } = await runIngest(db, { concerns: false }, (line) => {
    if (/\b(?:warning|skipped unsupported)\b/i.test(line)) console.log(style(2, line));
  });
  const delayMs = Number(process.env.EVAL_DELAY_MS ?? 5_000);
  console.log(style(1, "Veloxa live eval"));
  console.log(`  Model     ${modelId}\n  Cutoff    ${selected}\n  Questions ${questions.length}\n  Delay     ${seconds(delayMs)}`);
  console.log(style(2, `  Ingested ${changedFiles} files through Day ${upTo} with ${agents} agents\n`));

  async function evaluate(question: Question) {
    const { cutoff } = pointInTime(question.text, selected);
    const agent = question.agent ? await findAgent(db, question.agent, cutoff) : undefined;
    if (question.agent && !agent) throw new Error(`Agent unavailable at ${cutoff}`);
    const { chatAgent, sources } = await prepareChat(db, cutoff, agent, { mustSearch: true });
    const result = await chatAgent.generate({ prompt: question.text, abortSignal: AbortSignal.timeout(Number(process.env.EVAL_TIMEOUT_MS ?? 120_000)) });
    const rows = await scopedEvidence(db, cutoff, agent);
    const shown = new Set(sources.map((source) => source.id));
    for (const step of result.steps) {
      for (const tool of step.toolResults) {
        if (tool.toolName === "search_evidence" && Array.isArray(tool.output)) {
          for (const row of tool.output) {
            if (row && typeof row.id === "number") shown.add(row.id);
          }
        }
      }
    }
    return { answer: result.text, failures: answerFailures(question, result.text, rows, shown, result.finishReason) };
  }

  const counts = { PASS: 0, FAIL: 0, ERROR: 0 };
  const failedIds: string[] = [];
  let refusalPasses = 0;
  for (const [index, question] of questions.entries()) {
    if (index > 0) await Bun.sleep(delayMs);
    const questionStarted = performance.now();
    let status: Status;
    let reasons: string[];
    let answer = "";
    try {
      ({ answer, failures: reasons } = await evaluate(question));
      status = reasons.length ? "FAIL" : "PASS";
    } catch (error) {
      status = "ERROR";
      reasons = [error instanceof Error ? error.message : String(error)];
    }

    const [code, icon] = statusStyle[status];
    const progress = `[${String(index + 1).padStart(String(questions.length).length)}/${questions.length}]`;
    const categories = [question.cutoff && "point-in-time", question.refusal && "refusal"].filter(Boolean).join(", ");
    console.log(`${progress} ${style(code, `${icon} ${status.padEnd(5)}`)}  ${question.id}  (${seconds(performance.now() - questionStarted)})${categories ? `  ${style(2, categories)}` : ""}`);
    counts[status]++;
    if (status === "PASS") {
      if (question.refusal) refusalPasses++;
      continue;
    }
    failedIds.push(question.id);
    for (const reason of reasons) console.log(`       • ${Bun.stripANSI(reason).replace(/\s*\n\s*/g, " ")}`);
    const lines = Bun.stripANSI(answer).trim().split(/\r?\n/).filter((line) => line.trim());
    for (const line of lines.slice(0, 3)) console.log(style(2, `         ${line.length > 200 ? `${line.slice(0, 199)}…` : line}`));
    if (lines.length > 3) console.log(style(2, "         …"));
  }

  console.log(style(1, "\nSummary"));
  console.log(`  ${counts.PASS}/${questions.length} passed · ${counts.FAIL} failed · ${counts.ERROR} errored`);
  console.log(`  Refusals ${refusalPasses}/${questions.filter((question) => question.refusal).length} passed · Total ${seconds(performance.now() - started)}`);
  if (failedIds.length) console.log(`  Failed IDs  ${failedIds.join(", ")}`);
  process.exitCode = failedIds.length ? 1 : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
