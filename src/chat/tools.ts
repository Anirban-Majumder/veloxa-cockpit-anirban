import { tool } from "ai";
import { z } from "zod";
import type { Agent } from "../agents/store";
import type { Db } from "../db/client";
import { searchEvidence } from "../retrieval/search";
import { PASSAGE_LENGTH, SEARCH_LIMIT } from "./config";

interface SearchScope {
  db: Db;
  cutoff: string;
  agent?: Agent;
}

/** Cutoff, person scope and pay restrictions come from the request and the retrieval layer, never from the model. */
export function searchEvidenceTool({ db, cutoff, agent }: SearchScope) {
  return tool({
    description: agent
      ? "Search the records you were involved in or told about. Use for any question about work, people, numbers or events."
      : "Search Veloxa's records (data room exports, emails, documents, call transcripts). Use for any question about the company.",
    inputSchema: z.object({
      query: z.string().describe("Keywords to search for: names, projects, metrics, dates."),
    }),
    execute: async ({ query }) => {
      const rows = await searchEvidence(db, query, cutoff, { agent, limit: agent ? SEARCH_LIMIT.person : SEARCH_LIMIT.analyst });
      return rows.map((row) => ({
        id: row.id,
        path: row.path,
        released_at: row.released_at,
        locator: JSON.parse(row.locator_json) as Record<string, unknown>,
        text: row.text.slice(0, PASSAGE_LENGTH),
      }));
    },
  });
}

/** Counts and per-month trends for tables too large to search row by row (analyst only). */
export function summarizeTableTool(summaries: Map<string, string>) {
  return tool({
    description: "Get counts, value breakdowns and per-month trends for a large table. Use for totals, counts and trends, which search alone cannot answer.",
    inputSchema: z.object({ table: z.string().describe("Table name exactly as listed in your instructions.") }),
    execute: async ({ table }) => {
      const index = [...summaries.keys()].indexOf(table);
      if (index < 0) throw new Error(`Unknown table. Use one of: ${[...summaries.keys()].join("; ")}`);
      return { id: `T${index + 1}`, table, summary: summaries.get(table)!.replace(/^\[E\d+–E\d+\] /, "") };
    },
  });
}
