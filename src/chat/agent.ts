import { isStepCount, ToolLoopAgent, type InferAgentUIMessage } from "ai";
import type { Agent } from "../agents/store";
import { getModel } from "../ai/model";
import { largeTableSummaries } from "../concerns/evidence-pack";
import type { Db } from "../db/client";
import { chatInstructions, MAX_STEPS, SEARCH_FAILED } from "./config";
import { searchEvidenceTool, summarizeTableTool } from "./tools";

interface ChatOptions {
  /** False only for pure small talk. */
  mustSearch: boolean;
}

export async function createChatAgent(db: Db, cutoff: string, agent: Agent | undefined, { mustSearch }: ChatOptions) {
  const tables = agent ? new Map<string, string>() : await largeTableSummaries(db, cutoff);
  const instructions = chatInstructions(agent, cutoff, [...tables.keys()]);

  return new ToolLoopAgent({
    model: getModel().model,
    instructions,
    tools: {
      search_evidence: searchEvidenceTool({ db, cutoff, agent }),
      summarize_table: summarizeTableTool(tables),
    },
    activeTools: tables.size ? ["search_evidence", "summarize_table"] : ["search_evidence"],
    stopWhen: isStepCount(MAX_STEPS),
    temperature: 0.2,
    prepareStep: ({ stepNumber, steps }) => {
      const searched = steps.some((step) => step.toolResults.length > 0);
      const lastStep = stepNumber === MAX_STEPS - 1;
      if (lastStep) return searched || !mustSearch ? { toolChoice: "none" } : { toolChoice: "none", instructions: `${instructions}\n\n${SEARCH_FAILED}` };
      return mustSearch && !searched ? { toolChoice: "required" } : {};
    },
  });
}

export type ChatMessage = InferAgentUIMessage<Awaited<ReturnType<typeof createChatAgent>>>;

export const searchedSuccessfully = (message: ChatMessage) =>
  message.parts.some((part) =>
    (part.type === "tool-search_evidence" || part.type === "tool-summarize_table") && part.state === "output-available");
