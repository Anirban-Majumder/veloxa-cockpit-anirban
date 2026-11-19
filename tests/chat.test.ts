import { beforeAll, describe, expect, test } from "bun:test";
import { isSmallTalk } from "../src/chat/config";
import { largeTableSummaries } from "../src/concerns/evidence-pack";
import { ingestRelease } from "../src/ingestion/ingest";
import { discoverReleases } from "../src/ingestion/releases";
import type { ChatMessage } from "../src/chat/agent";
import { loadMessages, savedQuestion, saveExchange, startConversation } from "../src/chat/history";
import { splitCitations, splitConfidence } from "../apps/web/src/components/chat/parse-answer";
import { execute, openDb, selectOne, type Db } from "../src/db/client";
import { withholdPay } from "../src/retrieval/redact";

const DAY_1 = "2026-11-16T10:00:00+05:30";
const DAY_2 = "2026-11-17T10:00:00+05:30";
const text = (id: string, role: "user" | "assistant", body: string): ChatMessage => ({ id, role, parts: [{ type: "text", text: body }] });

let db: Db;
let conversation: number;

beforeAll(async () => {
  db = await openDb(":memory:");
  conversation = await startConversation(db, null);
});

describe("chat history", () => {
  test("concurrent saves both land", async () => {
    await Promise.all([
      saveExchange(db, conversation, DAY_1, text("q1", "user", "one?"), text("a1", "assistant", "one")),
      saveExchange(db, conversation, DAY_2, text("q2", "user", "two?"), text("a2", "assistant", "two")),
    ]);
    expect(await selectOne(db, "SELECT COUNT(*) AS n FROM messages")).toEqual({ n: 4 });
  });

  test("retrying a question stores it once and replaces its answer", async () => {
    await saveExchange(db, conversation, DAY_2, text("q2", "user", "two?"), text("a2b", "assistant", "two again"));
    const ids = (await loadMessages(db, conversation, DAY_2)).map((m) => m.id);
    expect(ids.filter((id) => id === "q2")).toHaveLength(1);
    expect(ids).toContain("a2b");
    expect(ids).not.toContain("a2");
  });

  test("messages from a later cutoff stay hidden", async () => {
    const ids = (await loadMessages(db, conversation, DAY_1)).map((m) => m.id);
    expect(ids).toEqual(["q1", "a1"]);
  });
});

describe("pay amounts", () => {
  test("amounts in pay passages are withheld, other numbers stay", () => {
    expect(withholdPay("Rahul's revised CTC is ₹18,50,000 from April.")).toBe("Rahul's revised CTC is [amount withheld] from April.");
    expect(withholdPay("February pay was ₹93,450")).toBe("February pay was [amount withheld]");
    expect(withholdPay("salary was 93,450 per month")).toBe("salary was [amount withheld] per month");
    expect(withholdPay("Sent 28 Feb 2026 20:15 +0530 about payroll")).toBe("Sent 28 Feb 2026 20:15 +0530 about payroll");
    expect(withholdPay("Burn was ₹42,00,000 in October.")).toBe("Burn was ₹42,00,000 in October.");
    const companyTotal = "Vendor / Payee: Salaries (payroll); Cost Centre: PAYROLL; Amount (Rs.): 3175000";
    expect(withholdPay(companyTotal)).toBe(companyTotal);
    expect(withholdPay("Monthly salary: 2026")).toBe("Monthly salary: [amount withheld]");
    expect(withholdPay(companyTotal + "; Rahul's salary: 95000")).not.toContain("95000");
  });
});

describe("citations", () => {
  test("parsing stays fast on an unfinished bracket", () => {
    const started = performance.now();
    splitCitations(`see [${"1".repeat(5000)}`);
    expect(performance.now() - started).toBeLessThan(50);
  });
  test("[E12], [12], [3, 4] and table [T1] are recognised", () => {
    const ids = splitCitations("a [E12] b [12] c [3, 4] d [T1]").flatMap((p) => (p.kind === "cite" ? p.ids : []));
    expect(ids).toEqual(["E12", "E12", "E3", "E4", "T1"]);
  });
});

describe("confidence line", () => {
  test("is split off the answer", () => {
    expect(splitConfidence("Atlas slipped [E4].\nConfidence: high — two board updates")).toEqual({
      body: "Atlas slipped [E4].",
      confidence: { level: "high", reason: "two board updates" },
    });
  });
  test("a half-typed line is hidden while streaming", () => {
    expect(splitConfidence("Atlas slipped [E4].\nConfid").body).toBe("Atlas slipped [E4].");
  });
  test("long whitespace runs parse quickly", () => {
    const started = performance.now();
    splitConfidence(`a${"\n".repeat(20000)}b`);
    splitConfidence(`Confidence: high${" ".repeat(16000)}\u2028x`);
    expect(performance.now() - started).toBeLessThan(50);
  });
});

describe("legacy messages", () => {
  test("old JSON replies keep their sources and confidence; odd user text stays text", async () => {
    const id = await startConversation(db, null);
    const legacyReply = { answer: "Atlas moved.", confidence: "high", confidence_reason: "two updates", evidence: [{ id: 4, path: "b.pdf", text: "GA moved" }] };
    await execute(db, "INSERT INTO messages (conversation_id, role, content, created_at, knowledge_cutoff) VALUES (?, 'user', ?, '', ?)",
      id, '{"id":"x","role":"user","parts":[null]}', DAY_1);
    await execute(db, "INSERT INTO messages (conversation_id, role, content, created_at, knowledge_cutoff) VALUES (?, 'assistant', ?, '', ?)",
      id, JSON.stringify(legacyReply), DAY_1);
    const [question, reply] = await loadMessages(db, id, DAY_1);
    expect(question!.parts).toEqual([{ type: "text", text: '{"id":"x","role":"user","parts":[null]}' }]);
    expect(reply!.parts.map((p) => p.type)).toEqual(["tool-search_evidence", "text"]);
    expect(JSON.stringify(reply!.parts[1])).toContain("Confidence: high");
  });
});

describe("small talk", () => {
  test("only pure pleasantries skip the search", () => {
    for (const text of ["hi", "Hey there!", "thanks so much", "good morning Ananya", "how are you?"]) expect(isSmallTalk(text)).toBe(true);
    for (const text of ["hi, is Atlas late?", "What are you working on?", "thanks, and the burn rate?"]) expect(isSmallTalk(text)).toBe(false);
  });
});

describe("retries", () => {
  test("only the latest question is retryable, at its own cutoff", async () => {
    const id = await startConversation(db, null);
    await saveExchange(db, id, DAY_1, text("r1", "user", "one?"), text("r1a", "assistant", "one"));
    await saveExchange(db, id, DAY_1, text("r2", "user", "two?"), text("r2a", "assistant", "two"));
    expect(await savedQuestion(db, id, "r1")).toEqual({ cutoff: DAY_1, isLatest: false });
    expect(await savedQuestion(db, id, "r2")).toEqual({ cutoff: DAY_1, isLatest: true });
    await saveExchange(db, id, DAY_1, text("r2", "user", "two?"), text("r2b", "assistant", "two again"));
    expect((await loadMessages(db, id, DAY_1)).map((m) => m.id)).toEqual(["r1", "r1a", "r2", "r2b"]);
  });

  test("a retry that finishes after a newer question is dropped", async () => {
    const id = await startConversation(db, null);
    await saveExchange(db, id, DAY_1, text("s1", "user", "one?"), text("s1a", "assistant", "one"));
    await saveExchange(db, id, DAY_1, text("s2", "user", "two?"), text("s2a", "assistant", "two"));
    await saveExchange(db, id, DAY_1, text("s1", "user", "one?"), text("s1b", "assistant", "late retry"));
    expect((await loadMessages(db, id, DAY_1)).map((m) => m.id)).toEqual(["s1", "s1a", "s2", "s2a"]);
  });
});

describe("table summaries", () => {
  test("give the September atlas-engine commit count on Day 3", async () => {
    const throughDay3 = await openDb(":memory:");
    const days = discoverReleases().slice(0, 3);
    for (const d of days) await ingestRelease(throughDay3, d);
    const summary = [...(await largeTableSummaries(throughDay3, days[2]!.releasedAt)).values()].join("\n");
    expect(summary).toMatch(/repo=atlas-engine per month:.* 2026-09:80 /);
  });
});
