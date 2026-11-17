import { generateText } from "ai";
import { z } from "zod";
import type { Db } from "../db/client";
import { getModel } from "./model";
import { searchEvidence, type AgentIdentity } from "../retrieval/search";
import { buildEvidencePack } from "../concerns/context";
import { evidenceAtCutoff } from "../retrieval/evidence";

/** Above this size the analyst falls back to keyword retrieval instead of the full filtered pack. */
const FULL_PACK_LIMIT = 120_000;

export const ChatReply = z.object({
  answer: z.string(),
  status: z.enum(["answered", "unknown", "disagree", "refused"]),
  confidence: z.enum(["high", "medium", "low"]),
  confidence_reason: z.string(),
  citations: z.array(z.union([z.number(), z.string()])),
});
export type ChatReplyT = z.infer<typeof ChatReply>;

interface AgentRow extends AgentIdentity { department: string | null; title: string | null; manager_id: string | null; join_date: string | null; location: string | null; soul: string | null }

const RULES = `Rules (non-negotiable):
- Use ONLY the evidence below plus this conversation. No outside knowledge about Veloxa.
- Cite every factual claim with evidence IDs in "citations" (numbers from [E12] → 12). Cite only IDs shown.
- Keep the answer short: at most 4 sentences, plain language for a busy CEO.
- If the evidence does not answer the question, say "I don't know" and what is missing (status "unknown").
- If sources conflict, say "the sources disagree", give both sides with citations (status "disagree"). System exports are generally more reliable than machine-generated transcripts, which may mishear names and numbers.
- Never reveal or estimate an individual's salary or pay; totals only (status "refused" if asked).
- Knowledge cutoff: you know nothing released after it. If asked about later events, say you don't know yet.
- confidence: high = corroborated exports; medium = single source or minor gaps; low = transcript-only, conflicting or partial. Give a one-line reason.
Respond with JSON only: {"answer":"...","status":"answered|unknown|disagree|refused","confidence":"high|medium|low","confidence_reason":"...","citations":[12]}`;

function persona(agent: AgentRow | undefined, cutoff: string): string {
  if (!agent) return `You are the Veloxa cockpit analyst answering the CEO, Ananya Rao. Knowledge cutoff: ${cutoff}.`;
  return `You are ${agent.full_name}, ${agent.title} in ${agent.department} at Veloxa (employee ${agent.employee_id}, joined ${agent.join_date}, based in ${agent.location}, reports to ${agent.manager_id}). The CEO, Ananya Rao, is talking to you. Speak in first person as yourself, naturally and briefly.
You only know what the evidence below shows you were involved in or told about; if something is outside your knowledge, say so. ${agent.soul ? `Your personality and life (invented, not evidence; never use it to support business facts): ${agent.soul}` : ""}
Knowledge cutoff: ${cutoff}.`;
}

async function conversationFor(db: Db, agentId: string | null): Promise<number> {
  const found = (await (await db.prepare(
    "SELECT id FROM conversations WHERE user_id = 'ceo' AND kind = ? AND agent_id IS ? ORDER BY id DESC LIMIT 1")).get(agentId ? "person" : "analyst", agentId)) as { id: number } | undefined;
  if (found) return found.id;
  const row = (await (await db.prepare(
    "INSERT INTO conversations (user_id, agent_id, kind, created_at) VALUES ('ceo', ?, ?, ?) RETURNING id")).get(agentId, agentId ? "person" : "analyst", new Date().toISOString())) as { id: number };
  return row.id;
}

/** Starts a fresh conversation (the latest one is the live one); earlier messages stay stored but unused. */
export async function newConversation(db: Db, agentId: string | null): Promise<number> {
  const row = (await (await db.prepare(
    "INSERT INTO conversations (user_id, agent_id, kind, created_at) VALUES ('ceo', ?, ?, ?) RETURNING id")).get(agentId, agentId ? "person" : "analyst", new Date().toISOString())) as { id: number };
  return row.id;
}

export interface StoredMessage { id: number; role: "user" | "assistant"; content: string; reply?: ChatReplyT & { evidence: { id: number; path: string; text: string }[] }; created_at: string; knowledge_cutoff: string }

/** History visible at a cutoff: messages created under a later cutoff are hidden (no leakage via memory). */
export async function history(db: Db, agentId: string | null, cutoff: string): Promise<StoredMessage[]> {
  const conv = await conversationFor(db, agentId);
  const rows = (await (await db.prepare(
    "SELECT id, role, content, created_at, knowledge_cutoff FROM messages WHERE conversation_id = ? AND knowledge_cutoff <= ? ORDER BY id")).all(conv, cutoff)) as { id: number; role: "user" | "assistant"; content: string; created_at: string; knowledge_cutoff: string }[];
  return rows.map((r) => {
    if (r.role === "user") return { ...r };
    const reply = JSON.parse(r.content);
    return { ...r, content: reply.answer, reply };
  });
}

export async function ask(db: Db, agentId: string | null, question: string, cutoff: string) {
  const agent = agentId
    ? ((await (await db.prepare("SELECT * FROM agents WHERE employee_id = ?")).get(agentId)) as AgentRow | undefined)
    : undefined;
  if (agentId && !agent) throw new Error(`Unknown agent ${agentId}`);
  const conv = await conversationFor(db, agentId);
  const past = (await history(db, agentId, cutoff)).slice(-12);
  const query = [question, ...past.filter((m) => m.role === "user").slice(-2).map((m) => m.content)].join(" ");
  let evidence = agent ? await searchEvidence(db, query, cutoff, { agent, limit: 60 }) : [];
  let pack = evidence.map((e) => `[E${e.id}] (${e.path}, released ${e.released_at.slice(0, 10)}) ${e.text.slice(0, 900)}`).join("\n");
  let ids = new Set(evidence.map((e) => e.id));
  if (!agent) {
    const full = await buildEvidencePack(db, cutoff);
    if (full.pack.length <= FULL_PACK_LIMIT) {
      pack = full.pack; ids = full.ids;
      evidence = (await evidenceAtCutoff(db, cutoff)).filter((e) => ids.has(e.id));
    } else {
      evidence = await searchEvidence(db, query, cutoff, { limit: 40 });
      ids = new Set(evidence.map((e) => e.id));
      pack = evidence.map((e) => `[E${e.id}] (${e.path}) ${e.text.slice(0, 900)}`).join("\n");
    }
  }

  const { model, modelId } = getModel();
  let reply: ChatReplyT | undefined, err = "";
  for (let i = 0; i < 2 && !reply; i++) {
    const { text } = await generateText({
      model, temperature: 0.2,
      system: `${persona(agent, cutoff)}\n\n${RULES}\n\nEVIDENCE:\n${pack || "(none matched)"}`,
      messages: [
        ...past.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: i ? `${question}\n\n(Previous reply was invalid: ${err}. JSON only.)` : question },
      ],
    });
    try {
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      reply = ChatReply.parse(JSON.parse(text.slice(s, e + 1)));
    } catch (x) { err = (x as Error).message.slice(0, 200); }
  }
  if (!reply) throw new Error(`Model reply was not valid JSON: ${err}`);
  const cited = [...new Set(reply.citations.map((c) => Number(String(c).replace(/^E/i, ""))))].filter((c) => ids.has(c));
  const full = { ...reply, citations: cited, model: modelId,
    evidence: evidence.filter((e) => cited.includes(e.id)).map((e) => ({ id: e.id, path: e.path, text: e.text, locator: JSON.parse(e.locator_json) })) };

  const now = new Date().toISOString();
  const insert = await db.prepare("INSERT INTO messages (conversation_id, role, content, created_at, knowledge_cutoff) VALUES (?, ?, ?, ?, ?)");
  await insert.run(conv, "user", question, now, cutoff);
  await insert.run(conv, "assistant", JSON.stringify(full), now, cutoff);
  return full;
}
