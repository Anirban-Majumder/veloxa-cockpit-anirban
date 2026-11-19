import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { Db } from "../db/client";
import type { ChatMessage } from "./agent";
import { saveExchange } from "./history";

const NO_RECORD = "I don't have an employee record available as of that date.";

/** A person who has no record at the narrowed date answers without a model call. */
export function noRecordResponse(db: Db, conversationId: number, cutoff: string, question: ChatMessage, messageId: string, asOf?: string) {
  const reply: ChatMessage = { id: messageId, role: "assistant", metadata: { asOf, scoped: true }, parts: [{ type: "text", text: NO_RECORD }] };
  return createUIMessageStreamResponse({
    stream: createUIMessageStream<ChatMessage>({
      execute: ({ writer }) => {
        writer.write({ type: "start", messageId, messageMetadata: reply.metadata });
        writer.write({ type: "text-start", id: messageId });
        writer.write({ type: "text-delta", id: messageId, delta: NO_RECORD });
        writer.write({ type: "text-end", id: messageId });
        writer.write({ type: "finish" });
      },
      onEnd: ({ isAborted }) => {
        if (!isAborted) return saveExchange(db, conversationId, cutoff, question, reply);
      },
    }),
  });
}
