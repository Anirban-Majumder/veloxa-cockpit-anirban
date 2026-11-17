import type { Db } from "../db/client";
import { evidenceAtCutoff, type EvidenceRow } from "./evidence";

const STOP = new Set("a an the of to in on for and or is are was were be been what who whom how why when where which do does did i we you he she it they this that with at by from about as our your their me my any has have had will would can could should us not".split(" "));

export const tokenize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9₹. -]+/g, " ").split(/\s+/).map((t) => t.replace(/^[.-]+|[.-]+$/g, "")).filter((t) => t.length > 1 && !STOP.has(t));

/** Transcript spellings recorded in ASSUMPTIONS.md A005. */
const EXTRA_ALIASES: Record<string, string[]> = { VX007: ["pria"], VX010: ["kartik"], VX014: ["fatima shaikh"] };

export interface AgentIdentity { employee_id: string; full_name: string; work_email: string | null }

/** Ways a person is referred to across exports: full name, first name, "P. Nair", initials, email handle. */
export function aliasesFor(a: AgentIdentity): string[] {
  const [first = "", ...rest] = a.full_name.split(" ");
  const last = rest.at(-1) ?? "";
  const handle = a.work_email?.split("@")[0];
  return [a.full_name, first, `${first[0]}. ${last}`, `${first[0]}${last}`.toLowerCase(), a.employee_id, handle, a.work_email,
    ...(EXTRA_ALIASES[a.employee_id] ?? [])].filter((x): x is string => !!x).map((x) => x.toLowerCase());
}

function mentions(row: EvidenceRow, aliases: string[], initials: string): boolean {
  const t = row.text.toLowerCase();
  if (aliases.some((al) => new RegExp(`(^|[^a-z])${al.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(t))) return true;
  // Initials are only trusted inside structured fields (Jira assignee "PN", approver "VM").
  return !!row.data_json && Object.values(JSON.parse(row.data_json)).some((v) => String(v) === initials);
}

/**
 * Keyword retrieval over cutoff-visible evidence (D006). Restricted rows are never returned.
 * For a person agent, only evidence connected to that person is searchable (D008).
 */
export async function searchEvidence(db: Db, query: string, cutoff: string, opts: { agent?: AgentIdentity; limit?: number } = {}) {
  let rows = await evidenceAtCutoff(db, cutoff);
  if (opts.agent) {
    const aliases = aliasesFor(opts.agent);
    const initials = opts.agent.full_name.split(" ").map((p) => p[0]).join("").toUpperCase();
    rows = rows.filter((r) => mentions(r, aliases, initials));
  }
  const q = [...new Set(tokenize(query))];
  const docs = rows.map((r) => ({ r, toks: tokenize(`${r.path} ${r.text}`) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d.toks)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length || 1;
  const scored = docs.map(({ r, toks }) => {
    let s = 0;
    for (const term of q) {
      const tf = toks.filter((t) => t === term || (term.length > 4 && t.startsWith(term.slice(0, -1)))).length;
      if (tf) s += (1 + Math.log(tf)) * Math.log(1 + N / (df.get(term) ?? 1));
    }
    if (r.source_kind === "data_room") s *= 1.1; // D016: exports preferred over machine transcripts
    return { r, s: s / Math.sqrt(1 + toks.length / 60) };
  });
  const hits = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, opts.limit ?? 24).map((x) => x.r);
  // A person always knows their own core record, even if the question has no matching words.
  if (opts.agent && hits.length < 6) for (const r of rows) if (!hits.includes(r) && hits.length < 12) hits.push(r);
  return hits;
}
