import { isStepCount, ToolLoopAgent, type InferAgentUIMessage } from "ai";
import type { Agent } from "../agents/store";
import { getModel, lightThinking } from "../ai/model";
import { largeTableSummaries } from "../concerns/evidence-pack";
import type { Db } from "../db/client";
import { answerNowPrompt, chatInstructions, MAX_STEPS, memoryPrompt, PASSAGE_LENGTH, SEARCH_FAILED, workingBriefPrompt } from "./config";
import { evidenceRef, personBrief } from "../retrieval/person-brief";
import { searchEvidence } from "../retrieval/search";
import { personConversationSummary } from "./history";
import { citeEvidence, searchEvidenceTool, summarizeTableTool } from "./tools";

interface ChatOptions {
  /** False only for pure small talk. */
  mustSearch: boolean;
  question: string;
  beforeMessage?: number;
  historyThrough?: string;
}

export async function prepareChat(db: Db, cutoff: string, agent: Agent | undefined, { mustSearch, question, beforeMessage, historyThrough }: ChatOptions) {
  const tables = agent ? new Map<string, string>() : await largeTableSummaries(db, cutoff);
  const brief = agent && await personBrief(db, cutoff, agent);
  const initialMatches = !agent && mustSearch ? await searchEvidence(db, question, cutoff, { limit: 10 }) : [];
  const sections = brief ? Object.entries(brief.sections) : [["Records matching the question", initialMatches] as const];
  const sources = [...new Map(sections.flatMap(([, rows]) => rows.map((row) => [row.id, evidenceRef(row, PASSAGE_LENGTH)] as const))).values()];
  const workingBrief = sections.filter(([, rows]) => rows.length).map(([heading, rows]) =>
    `${heading}\n${rows.map((row) => `[E${row.id}] ${row.text.slice(0, PASSAGE_LENGTH)}`).join("\n")}`);
  const memory = agent && brief && await personConversationSummary(db, agent.employee_id, cutoff, brief.rows, beforeMessage, historyThrough);
  const instructions = [
    chatInstructions(agent, cutoff, [...tables.keys()]),
    workingBrief.length && workingBriefPrompt(workingBrief),
    memory && memoryPrompt(memory),
  ].filter(Boolean).join("\n\n");
  const requireTool = mustSearch && !sources.length;

  const tools = {
    search_evidence: searchEvidenceTool({ db, cutoff, agent }),
    summarize_table: summarizeTableTool(tables),
  };
  const { model, modelId } = getModel();
  const chatAgent = new ToolLoopAgent({
    model,
    instructions,
    tools,
    activeTools: tables.size ? ["search_evidence", "summarize_table"] : ["search_evidence"],
    stopWhen: isStepCount(MAX_STEPS),
    temperature: 0.2,
    providerOptions: /(?:^|\/)gemini-3(?:[.-]|$)/i.test(modelId) ? lightThinking : undefined,
    prepareStep: ({ stepNumber, steps, messages }) => {
      const searched = steps.some((step) => step.toolResults.length > 0);
      const lastStep = stepNumber === MAX_STEPS - 1;
      if (lastStep) {
        // Gemini can continue a tool-call sequence even after tools are disabled.
        // Give the final step the same evidence as text without the tool protocol history.
        const results = steps.flatMap((step) => step.toolResults.filter((result) => !result.dynamic).flatMap((result) =>
          result.toolName === "search_evidence"
            ? result.output.map(citeEvidence)
            : `[${result.output.id}] ${result.output.table}\n${result.output.summary}`));
        const answer = searched || !requireTool
          ? answerNowPrompt(results)
          : SEARCH_FAILED;
        return {
          activeTools: [],
          messages: messages.filter((message) => message.role !== "tool" && (message.role !== "assistant"
            || typeof message.content === "string" || !message.content.some((part) => part.type === "tool-call"))),
          instructions: `${instructions}\n\n${answer}`,
        };
      }
      return requireTool && !searched ? { toolChoice: "required" } : {};
    },
  });
  return { chatAgent, sources };
}

export interface ChatMetadata {
  asOf?: string;
  briefSources?: ReturnType<typeof evidenceRef>[];
  scoped?: boolean;
}

export type ChatMessage = InferAgentUIMessage<Awaited<ReturnType<typeof prepareChat>>["chatAgent"], ChatMetadata>;

export const searchedSuccessfully = (message: ChatMessage) =>
  message.parts.some((part) =>
    (part.type === "tool-search_evidence" || part.type === "tool-summarize_table") && part.state === "output-available");
