import { execute, selectAll, selectOne, transaction, type Db } from "../db/client";
import { withholdPay } from "../retrieval/redact";
import type { ChatMessage } from "./agent";

interface MessageRow {
  id: number;
  role: "user" | "assistant";
  content: string;
}

/** New rows wrap the AI SDK message so they can never be confused with older plain-text rows. */
const FORMAT = "ui-message";

const kindOf = (agentId: string | null) => (agentId ? "person" : "analyst");

export async function latestConversation(db: Db, agentId: string | null): Promise<number | undefined> {
  const row = await selectOne<{ id: number }>(db,
    "SELECT id FROM conversations WHERE user_id = 'ceo' AND kind = ? AND agent_id IS ? ORDER BY id DESC LIMIT 1",
    kindOf(agentId), agentId);
  return row?.id;
}

export async function conversationBelongsTo(db: Db, conversationId: number, agentId: string | null): Promise<boolean> {
  return !!(await selectOne(db,
    "SELECT 1 FROM conversations WHERE id = ? AND user_id = 'ceo' AND kind = ? AND agent_id IS ?",
    conversationId, kindOf(agentId), agentId));
}

export function currentConversation(db: Db, agentId: string | null): Promise<number> {
  return transaction(db, async () => (await latestConversation(db, agentId)) ?? (await startConversation(db, agentId)));
}

/** Older conversations stay stored but no longer feed the model or the UI. */
export async function startConversation(db: Db, agentId: string | null): Promise<number> {
  const row = await selectOne<{ id: number }>(db,
    "INSERT INTO conversations (user_id, agent_id, kind, created_at) VALUES ('ceo', ?, ?, ?) RETURNING id",
    agentId, kindOf(agentId), new Date().toISOString());
  return row!.id;
}

/** Messages saved under a later cutoff stay hidden, so memory cannot leak future knowledge. */
export async function loadMessages(db: Db, conversationId: number, cutoff: string, limit?: number, historyThrough?: string): Promise<ChatMessage[]> {
  const rows = await selectAll<MessageRow>(db,
    `SELECT id, role, content FROM messages
     WHERE conversation_id = ? AND knowledge_cutoff <= ? AND (? IS NULL OR created_at <= ?) ORDER BY id`,
    conversationId, cutoff, historyThrough ?? null, historyThrough ?? null);
  const messages = rows.map(toChatMessage).map(withholdPayInSources);
  return limit ? messages.slice(-limit) : messages;
}

export async function savedQuestion(db: Db, conversationId: number, questionId: string) {
  const row = await selectOne<{ id: number; cutoff: string; latest: number }>(db,
    `SELECT id, knowledge_cutoff AS cutoff,
       id = (SELECT MAX(id) FROM messages WHERE conversation_id = ? AND role = 'user') AS latest
     FROM messages
     WHERE conversation_id = ? AND role = 'user' AND json_valid(content) AND json_extract(content, '$.message.id') = ?`,
    conversationId, conversationId, questionId);
  return row && { cutoff: row.cutoff, isLatest: !!row.latest };
}

export async function questionRowId(db: Db, conversationId: number, questionId: string) {
  return (await selectOne<{ id: number }>(db,
    `SELECT id FROM messages WHERE conversation_id = ? AND role = 'user'
     AND json_valid(content) AND json_extract(content, '$.message.id') = ?`, conversationId, questionId))?.id;
}

/** A retried question is stored once and its new answer replaces the old one; if a newer question arrived meanwhile, the retry is dropped. */
export async function saveExchange(db: Db, conversationId: number, cutoff: string, question: ChatMessage, reply: ChatMessage) {
  const now = new Date().toISOString();
  const insert = (message: ChatMessage) => execute(db,
    "INSERT INTO messages (conversation_id, role, content, created_at, knowledge_cutoff) VALUES (?, ?, ?, ?, ?)",
    conversationId, message.role, JSON.stringify({ format: FORMAT, message }), now, cutoff);

  await transaction(db, async () => {
    const saved = await selectOne<{ id: number }>(db,
      `SELECT id FROM messages
       WHERE conversation_id = ? AND role = 'user' AND json_valid(content) AND json_extract(content, '$.message.id') = ?`,
      conversationId, question.id);
    if (saved) {
      const latest = await selectOne<{ id: number }>(db,
        "SELECT MAX(id) AS id FROM messages WHERE conversation_id = ? AND role = 'user'", conversationId);
      if (latest?.id !== saved.id) return;
      await execute(db, "DELETE FROM messages WHERE conversation_id = ? AND role = 'assistant' AND id > ?", conversationId, saved.id);
    } else {
      await insert(question);
    }
    await insert(reply);
  });
}

function toChatMessage(row: MessageRow): ChatMessage {
  const parsed = row.content.startsWith("{") ? tryParse(row.content) : undefined;
  if (isObject(parsed) && parsed.format === FORMAT && isChatMessage(parsed.message, row.role)) return parsed.message;
  if (row.role === "assistant" && isChatMessage(parsed, "assistant")) return parsed;
  if (row.role === "assistant" && isLegacyReply(parsed)) return fromLegacyReply(row.id, parsed);
  return { id: `legacy-${row.id}`, role: row.role, parts: [{ type: "text", text: row.content }] };
}

function isChatMessage(value: unknown, role: "user" | "assistant"): value is ChatMessage {
  if (!isObject(value) || typeof value.id !== "string" || value.role !== role || !Array.isArray(value.parts)) return false;
  return value.parts.length > 0 && value.parts.every(isValidPart);
}

function isValidPart(part: unknown): boolean {
  if (!isObject(part) || typeof part.type !== "string") return false;
  if (part.type === "text" || part.type === "reasoning") return typeof part.text === "string";
  if (part.type === "tool-search_evidence") return isValidSearchPart(part);
  if (part.type === "tool-summarize_table") return isValidSummaryPart(part);
  if (part.type.startsWith("tool-")) return false;
  return true;
}

function isValidSearchPart(part: Record<string, unknown>): boolean {
  if (typeof part.toolCallId !== "string") return false;
  const hasQuery = isObject(part.input) && typeof part.input.query === "string";
  if (part.state === "output-available") {
    return hasQuery && Array.isArray(part.output) && part.output.every(
      (s) => isObject(s) && typeof s.id === "number" && typeof s.text === "string" && typeof s.path === "string");
  }
  return (part.state === "output-error" || part.state === "input-available") && hasQuery;
}

function isValidSummaryPart(part: Record<string, unknown>): boolean {
  if (typeof part.toolCallId !== "string" || !isObject(part.input) || typeof part.input.table !== "string") return false;
  if (part.state === "output-available") return isObject(part.output) && typeof part.output.id === "string" && typeof part.output.summary === "string";
  return part.state === "output-error" || part.state === "input-available";
}

/** Answers were written from already-filtered evidence; the stored search results are re-filtered under the current rules. */
function withholdPayInSources(message: ChatMessage): ChatMessage {
  const parts = message.parts.map((part) => {
    if (part.type === "tool-search_evidence" && part.state === "output-available") {
      return { ...part, output: part.output.map((source) => ({ ...source, text: withholdPay(source.text) })) };
    }
    return part;
  });
  const briefSources = message.metadata?.briefSources?.map((source) => ({ ...source, text: withholdPay(source.text) }));
  return { ...message, parts, ...(briefSources && { metadata: { ...message.metadata, briefSources } }) } as ChatMessage;
}

interface LegacyReply {
  answer: string;
  confidence?: string;
  confidence_reason?: string;
  evidence?: { id: number; path: string; text: string; locator?: Record<string, unknown> }[];
}

function isLegacyReply(value: unknown): value is LegacyReply {
  return isObject(value) && typeof value.answer === "string";
}

/** Keeps an old reply's sources and confidence as a search step and a confidence line. Old replies predate the pay filter, so their text is filtered too. */
function fromLegacyReply(rowId: number, reply: LegacyReply): ChatMessage {
  const sources = (reply.evidence ?? []).map((e) => ({ id: e.id, path: e.path, released_at: "", locator: e.locator ?? {}, text: withholdPay(e.text) }));
  const citations = sources.map((s) => `[E${s.id}]`).join(" ");
  const confidence = reply.confidence ? `\nConfidence: ${reply.confidence} — ${withholdPay(reply.confidence_reason ?? "")}` : "";
  const search = { type: "tool-search_evidence" as const, toolCallId: `legacy-${rowId}`, state: "output-available" as const, input: { query: "earlier answer" }, output: sources };
  return {
    id: `legacy-${rowId}`,
    role: "assistant",
    parts: [...(sources.length ? [search] : []), { type: "text", text: `${withholdPay(reply.answer)}${citations ? ` ${citations}` : ""}${confidence}` }],
  };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function tryParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

/** Bound the prompt memory across conversations and exclude legacy answers produced before mail scoping. */
export async function personConversationSummary(
  db: Db, agentId: string, cutoff: string, allowed: { id: number }[], beforeMessage = Number.MAX_SAFE_INTEGER, historyThrough?: string,
): Promise<string> {
  const cutoffTime = new Date(cutoff).toISOString();
  const through = historyThrough && historyThrough < cutoffTime ? historyThrough : cutoffTime;
  const rows = await selectAll<MessageRow>(db,
    `SELECT m.id, m.role, m.content FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE c.user_id = 'ceo' AND c.kind = 'person' AND c.agent_id = ?
       AND m.knowledge_cutoff <= ? AND m.id < ? AND m.created_at <= ?
     ORDER BY m.id DESC LIMIT ?`,
    agentId, cutoff, beforeMessage, through, 12);
  const ids = new Set(allowed.map((row) => row.id));
  return rows.reverse().flatMap((row) => {
    const message = toChatMessage(row);
    const text = message.parts.flatMap((part) => part.type === "text" ? [part.text] : []).join(" ");
    if (!text) return [];
    if (message.role === "assistant") {
      if (!message.metadata?.scoped) return [];
      if ([...text.matchAll(/\[E(\d+)\]/gi)].some((match) => !ids.has(Number(match[1])))) return [];
    }
    return [`${message.role === "user" ? "CEO asked" : "You replied"}: ${withholdPay(text).slice(0, 450)}`];
  }).join("\n");
}
