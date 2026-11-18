import { createAgentUIStreamResponse, createIdGenerator } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { findAgent } from "../../../../src/agents/store";
import { createChatAgent, searchedSuccessfully, type ChatMessage } from "../../../../src/chat/agent";
import { HISTORY_LIMIT, isSmallTalk } from "../../../../src/chat/config";
import { conversationBelongsTo, currentConversation, latestConversation, loadMessages, savedQuestion, saveExchange, startConversation } from "../../../../src/chat/history";
import { openDb } from "../../../../src/db/client";
import { releasedCutoffs } from "../../../../src/retrieval/evidence";
import { HttpError, readBody } from "../http";

const newMessageId = createIdGenerator({ prefix: "msg", size: 16 });

const ChatRequest = z.object({
  agent: z.string().optional(),
  cutoff: z.string().optional(),
  conversation: z.number().int().positive().optional(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal("user"),
    parts: z.tuple([z.object({ type: z.literal("text"), text: z.string().trim().min(1, "Type a question first.").max(2000) })]),
  }),
});

/**
 * `agent=VX003` talks to a person; no agent means the cockpit analyst.
 * `conversation` pins a page visit to its own conversation; without it the latest one is used.
 */
export const chat = new Hono()
  .get("/", async (c) => {
    const db = await openDb();
    const agentId = (await resolveAgent(c.req.query("agent")))?.employee_id ?? null;
    const cutoff = await resolveCutoff(c.req.query("cutoff"));
    const requested = c.req.query("conversation");
    const conversationId = requested
      ? await resolveConversation(agentId, Number(requested))
      : await latestConversation(db, agentId);
    return c.json(conversationId ? await loadMessages(db, conversationId, cutoff) : []);
  })
  .delete("/", async (c) => {
    const agent = await resolveAgent(c.req.query("agent"));
    const conversation = await startConversation(await openDb(), agent?.employee_id ?? null);
    return c.json({ conversation });
  })
  .post("/", async (c) => {
    const body = await readBody(c, ChatRequest);
    const db = await openDb();
    const agent = await resolveAgent(body.agent);
    const agentId = agent?.employee_id ?? null;
    const cutoff = await resolveCutoff(body.cutoff);
    const conversationId = body.conversation
      ? await resolveConversation(agentId, body.conversation)
      : await currentConversation(db, agentId);

    const text = body.message.parts[0].text;
    const question: ChatMessage = { id: body.message.id, role: "user", parts: [{ type: "text", text }] };
    const mustSearch = !isSmallTalk(text);
    await assertRetryable(conversationId, question.id, cutoff);

    const history = await loadMessages(db, conversationId, cutoff);
    const retried = history.findIndex((m) => m.id === question.id);
    const earlier = (retried >= 0 ? history.slice(0, retried) : history).slice(-HISTORY_LIMIT);
    const messages = [...earlier, question];

    return createAgentUIStreamResponse({
      agent: await createChatAgent(db, cutoff, agent, { mustSearch }),
      uiMessages: messages,
      originalMessages: messages,
      generateMessageId: newMessageId,
      abortSignal: c.req.raw.signal,
      onEnd: ({ responseMessage, outcome }) => {
        const answered = responseMessage.parts.some((part) => part.type === "text" && part.text.trim());
        const grounded = !mustSearch || searchedSuccessfully(responseMessage);
        if (outcome.status === "completed" && answered && grounded) return saveExchange(db, conversationId, cutoff, question, responseMessage);
      },
      onError: (error) => (error instanceof Error ? error.message : "The model could not answer."),
    });
  });

async function assertRetryable(conversationId: number, questionId: string, cutoff: string) {
  const saved = await savedQuestion(await openDb(), conversationId, questionId);
  if (!saved) return;
  if (!saved.isLatest) throw new HttpError(409, "Only the latest question can be asked again.");
  if (saved.cutoff !== cutoff) throw new HttpError(409, "Ask again on the same day the question was first asked.");
}

async function resolveConversation(agentId: string | null, conversationId: number): Promise<number> {
  if (!Number.isInteger(conversationId) || !(await conversationBelongsTo(await openDb(), conversationId, agentId))) {
    throw new HttpError(404, `Unknown conversation ${conversationId}.`);
  }
  return conversationId;
}

async function resolveAgent(id: string | undefined) {
  if (!id || id === "analyst") return undefined;
  const agent = await findAgent(await openDb(), id);
  if (!agent) throw new HttpError(404, `Unknown person ${id}.`);
  return agent;
}

/** Only exact release cutoffs are accepted: they are compared as text in SQL, so other offsets could leak later data. */
async function resolveCutoff(requested: string | undefined): Promise<string> {
  const cutoffs = (await releasedCutoffs(await openDb())).map((r) => r.released_at);
  if (cutoffs.length === 0) throw new HttpError(409, "Nothing has been ingested yet. Run `bun run ingest`.");
  if (requested === undefined) return cutoffs.at(-1)!;
  if (!cutoffs.includes(requested)) throw new HttpError(400, `Unknown cutoff ${requested}. Use one of: ${cutoffs.join(", ")}.`);
  return requested;
}
