import type { Db } from "../db/client";
import { evidenceAtCutoff, type EvidenceRow } from "./evidence";

const STOP = new Set("a an the of to in on for and or is are was were be been what who whom how why when where which do does did i we you he she it they this that with at by from about as our your their me my any has have had will would can could should us not".split(" "));

export const tokenize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9₹. -]+/g, " ").split(/\s+/).map((t) => t.replace(/^[.-]+|[.-]+$/g, "")).filter((t) => t.length > 1 && !STOP.has(t));

/** Transcript spellings recorded in ASSUMPTIONS.md A005. */
const EXTRA_ALIASES: Record<string, string[]> = { VX007: ["pria"], VX010: ["kartik"], VX011: ["ayesha"], VX014: ["fatima shaikh"] };
const MISHEARD: Record<string, string[]> = { priya: ["pria"], karthik: ["kartik"], aisha: ["ayesha"], sheikh: ["shaikh"] };
const BLOCKER_TERMS = ["blocker", "blocked", "delay", "paused"];
const RELATED: Record<string, string[]> = {
  blocker: BLOCKER_TERMS,
  blockers: BLOCKER_TERMS,
  blocking: BLOCKER_TERMS,
  overload: ["workload", "overwork"],
  overloaded: ["workload", "overwork"],
};

/** "resignation" also finds "resigned"; short words must match exactly. */
const stem = (term: string) => (term.length >= 7 ? term.slice(0, 6) : term.length > 4 ? term.slice(0, -1) : term);
export const matches = (token: string, term: string) => token === term || (term.length > 4 && token.startsWith(stem(term)));

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

export function evidenceFields(row: EvidenceRow): Record<string, string | undefined> {
  if (row.data_json) return JSON.parse(row.data_json);
  // Pay filtering drops the structured fields of any row that merely mentions payroll, such as
  // Fatima's job title. Employee records carry no pay, so their fields can be read back from the passage.
  if (!/Employee_Master/.test(row.path) || !row.text.startsWith("Emp ID: ")) return {};
  return Object.fromEntries(row.text.split("; ").map((part) => {
    const separator = part.indexOf(": ");
    return [part.slice(0, separator), part.slice(separator + 2)];
  }));
}

/** The message text after the headers, without quoted earlier messages. */
export const mailBody = (row: EvidenceRow) =>
  row.text.split("\n\n").slice(1).join("\n\n").split(/\n>|\nOn .+ wrote:/i, 1)[0] ?? "";

export function mailHeaders(row: EvidenceRow): Record<string, string | undefined> {
  // Pay filtering can remove structured fields. The original top-level headers remain in the passage.
  const header = row.text.split("\n\n", 1)[0] ?? "";
  return Object.fromEntries([...header.matchAll(/^(From|To|Cc|Date|Subject): (.+)$/gmi)]
    .map((match) => [match[1]!.toLowerCase(), match[2]]));
}

export async function scopedEvidence(db: Db, cutoff: string, agent?: AgentIdentity) {
  const rows = await evidenceAtCutoff(db, cutoff);
  if (!agent) return rows;
  const aliases = aliasesFor(agent);
  const initials = agent.full_name.split(" ").map((part) => part[0]).join("").toUpperCase();
  const manager = rows.filter((row) => /Employee_Master/.test(row.path)).map(evidenceFields)
    .find((fields) => fields["Emp ID"] === agent.employee_id)?.["Manager ID"];
  const calls = new Set(rows.filter((row) =>
    row.source_kind === "transcript" && /Speakers:/i.test(row.text)
    && mentions({ ...row, text: row.text.split(/Speakers:/i)[1] ?? "" }, aliases, initials)).map((row) => row.path));
  return rows.filter((row) => {
    if (/\/email\//i.test(row.path) || /\.eml$/i.test(row.path)) {
      // Compiled printouts contain mixed participants and page breaks. The separate .eml records
      // provide the same messages with independently verifiable envelopes.
      if (!/\.eml$/i.test(row.path) || !agent.work_email) return false;
      const { from, to, cc } = mailHeaders(row);
      return [from, to, cc].some((header) => header?.toLowerCase().match(/[\w.+-]+@[\w.-]+/g)?.includes(agent.work_email!.toLowerCase()));
    }
    if (calls.has(row.path)) return true;
    const fields = evidenceFields(row);
    if (fields["Emp ID"] && fields["Full Name"]) {
      return fields["Emp ID"] === agent.employee_id || fields["Emp ID"] === manager || fields["Manager ID"] === agent.employee_id;
    }
    const subject = fields.Employee ?? fields.Assignee ?? fields.author_email ?? fields.Responder;
    if (subject) return mentions({ ...row, text: subject, data_json: null }, aliases, initials) || subject === initials;
    if (fields.Primary || fields.Secondary) {
      return mentions({ ...row, text: `${fields.Primary} ${fields.Secondary}`, data_json: null }, aliases, initials);
    }
    return mentions(row, aliases, initials);
  });
}

/**
 * Keyword retrieval over cutoff-visible evidence (D006). Restricted rows are never returned.
 * For a person agent, only evidence connected to that person is searchable (D008).
 */
export async function searchEvidence(db: Db, query: string, cutoff: string,
  opts: { agent?: AgentIdentity; limit?: number; excludeIds?: ReadonlySet<number> } = {}) {
  const visible = await scopedEvidence(db, cutoff, opts.agent);
  const { excludeIds } = opts;
  const rows = excludeIds ? visible.filter((row) => !excludeIds.has(row.id)) : visible;
  const asked = tokenize(query);
  const q = [...new Set([...asked, ...asked.flatMap((t) => MISHEARD[t] ?? RELATED[t] ?? [])])];
  const docs = rows.map((r) => ({ r, toks: tokenize(`${r.path} ${r.text}`) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d.toks)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length || 1;
  const scored = docs.map(({ r, toks }) => {
    let s = 0;
    for (const term of q) {
      const tf = toks.filter((t) => matches(t, term)).length;
      if (tf) s += (1 + Math.log(tf)) * Math.log(1 + N / (df.get(term) ?? 1));
    }
    if (r.source_kind === "data_room") s *= 1.1; // D016: exports preferred over machine transcripts
    return { r, s: s / Math.sqrt(1 + toks.length / 60) };
  });
  // A broad project search should surface documents and version records alongside repetitive ticket rows.
  const seenBySheet = new Map<string, number>();
  const ranked = scored.filter(({ s }) => s > 0).sort((a, b) => b.s - a.s).map(({ r, s }) => {
    const sheet = (JSON.parse(r.locator_json) as { sheet?: string }).sheet ?? "";
    const key = `${r.source_id}:${sheet}`;
    const earlier = seenBySheet.get(key) ?? 0;
    seenBySheet.set(key, earlier + 1);
    return { r, s: s / (1 + 0.4 * Math.max(0, earlier - 1)) };
  });
  const hits = ranked.sort((a, b) => b.s - a.s).slice(0, opts.limit ?? 24).map(({ r }) => r);
  // A person always knows their own core record, even if the question has no matching words.
  if (opts.agent && hits.length < 6) for (const r of rows) if (!hits.includes(r) && hits.length < 12) hits.push(r);
  return hits;
}
