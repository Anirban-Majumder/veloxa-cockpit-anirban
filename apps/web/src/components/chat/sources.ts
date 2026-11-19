import type { ChatMessage, EvidenceRef } from '../../lib/api'

export type Source =
  | { kind: 'evidence'; evidence: EvidenceRef }
  | { kind: 'table'; table: string; summary: string }

/** Evidence and table summaries provided for this answer, by citation ID ("E12", "T1"). */
export function collectSources(message: ChatMessage): Map<string, Source> {
  const sources = new Map<string, Source>()
  for (const evidence of message.metadata?.briefSources ?? []) sources.set(`E${evidence.id}`, { kind: 'evidence', evidence })
  for (const part of message.parts) {
    if (part.type === 'tool-search_evidence' && part.state === 'output-available') {
      for (const evidence of part.output) sources.set(`E${evidence.id}`, { kind: 'evidence', evidence })
    }
    if (part.type === 'tool-summarize_table' && part.state === 'output-available') {
      sources.set(part.output.id, { kind: 'table', table: part.output.table, summary: part.output.summary })
    }
  }
  return sources
}
