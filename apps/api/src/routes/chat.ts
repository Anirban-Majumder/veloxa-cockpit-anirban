import { createAgentUIStreamResponse, createIdGenerator } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { findAgent } from "../../../../src/agents/store";
import { prepareChat, searchedSuccessfully, type ChatMessage } from "../../../../src/chat/agent";
import { HISTORY_LIMIT, isSmallTalk } from "../../../../src/chat/config";
import { conversationBelongsTo, currentConversation, latestConversation, loadMessages, questionRowId, savedQuestion, saveExchange, startConversation } from "../../../../src/chat/history";
import { pointInTime } from "../../../../src/chat/point-in-time";
import { noRecordResponse } from "../../../../src/chat/unavailable";
import { openDb } from "../../../../src/db/client";
import { resolveCutoff } from "../cutoff";
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
 * `agent=VX003` talks to a person; no agent means the Veloxa Digital HQ analyst.
 * `conversation` pins a page visit to its own conversation; without it the latest one is used.
 */
export const chat = new Hono()
  .get("/", async (c) => {
    const db = await openDb();
    const cutoff = await resolveCutoff(c.req.query("cutoff"));
    const agentId = (await resolveAgent(c.req.query("agent"), cutoff))?.employee_id ?? null;
    const requested = c.req.query("conversation");
    const conversationId = requested
      ? await resolveConversation(agentId, Number(requested))
      : await latestConversation(db, agentId);
    return c.json(conversationId ? await loadMessages(db, conversationId, cutoff) : []);
  })
  .delete("/", async (c) => {
    const agent = await resolveAgent(c.req.query("agent"), await resolveCutoff(c.req.query("cutoff")));
    const conversation = await startConversation(await openDb(), agent?.employee_id ?? null);
    return c.json({ conversation });
  })
  .post("/", async (c) => {
    const body = await readBody(c, ChatRequest);
    const db = await openDb();
    const selected = await resolveCutoff(body.cutoff);
    const text = body.message.parts[0].text;
    const { cutoff, asOf, historyThrough } = pointInTime(text, selected);
    const dashboardAgent = await resolveAgent(body.agent, selected);
    const agent = dashboardAgent && (cutoff === selected ? dashboardAgent : await findAgent(db, dashboardAgent.employee_id, cutoff));
    const agentId = dashboardAgent?.employee_id ?? null;
    const conversationId = body.conversation
      ? await resolveConversation(agentId, body.conversation)
      : await currentConversation(db, agentId);

    const question: ChatMessage = { id: body.message.id, role: "user", parts: [{ type: "text", text }] };
    const mustSearch = !isSmallTalk(text);
    await assertRetryable(conversationId, question.id, cutoff);

    if (dashboardAgent && !agent) return noRecordResponse(db, conversationId, cutoff, question, newMessageId(), asOf);

    const history = agent ? [] : await loadMessages(db, conversationId, cutoff, undefined, historyThrough);
    const retried = history.findIndex((m) => m.id === question.id);
    const earlier = (retried >= 0 ? history.slice(0, retried) : history).slice(-HISTORY_LIMIT);
    const messages = [...earlier, question];
    const { chatAgent, sources } = await prepareChat(db, cutoff, agent, {
      mustSearch, historyThrough,
      beforeMessage: agent ? await questionRowId(db, conversationId, question.id) : undefined,
    });

    return createAgentUIStreamResponse({
      agent: chatAgent,
      messageMetadata: ({ part }) => part.type === "start" ? { asOf, scoped: !!agent, briefSources: sources } : undefined,
      uiMessages: messages,
      originalMessages: messages,
      generateMessageId: newMessageId,
      abortSignal: c.req.raw.signal,
      onEnd: ({ responseMessage, outcome }) => {
        const answered = responseMessage.parts.some((part) => part.type === "text" && part.text.trim());
        const grounded = !mustSearch || sources.length > 0 || searchedSuccessfully(responseMessage);
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

async function resolveAgent(id: string | undefined, cutoff: string) {
  if (!id || id === "analyst") return undefined;
  const agent = await findAgent(await openDb(), id, cutoff);
  if (!agent) throw new HttpError(404, `${id} isn't at Veloxa as of ${cutoff}.`);
  return agent;
}

