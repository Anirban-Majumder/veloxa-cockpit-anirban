import type { Agent } from "../agents/store";
import type { Db } from "../db/client";
import { evidenceFields, mailBody, mailHeaders, scopedEvidence } from "./search";
import type { EvidenceRow } from "./evidence";

const IST = 19_800_000;
export function recordDay(value: string | undefined) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value);
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? value : undefined;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + IST).toISOString().slice(0, 10) : undefined;
}

export function workDate(row: EvidenceRow, cutoff?: string) {
  const d = evidenceFields(row);
  const value = d.Resolved || d.Updated || d.Created || d.committed_at || d.Opened || d["Week of"] || d.From || mailHeaders(row).date;
  const date = recordDay(value);
  if (date && cutoff && (date > cutoff.slice(0, 10) || (value !== date && Date.parse(value!) > Date.parse(cutoff)))) {
    return undefined;
  }
  return date;
}

export const evidenceRef = (row: EvidenceRow, length: number) => ({
  id: row.id,
  path: row.path,
  released_at: row.released_at,
  locator: JSON.parse(row.locator_json) as Record<string, unknown>,
  text: row.text.slice(0, length),
});

export async function personBrief(db: Db, cutoff: string, agent: Agent) {
  const rows = await scopedEvidence(db, cutoff, agent);
  const select = (pattern: RegExp, limit: number) => rows
    .filter((row) => pattern.test(row.path) && (!workDate(row) || workDate(row, cutoff)))
    .sort((a, b) => (workDate(b) ?? b.released_at).localeCompare(workDate(a) ?? a.released_at) || b.id - a.id)
    .slice(0, limit);
  const profile = rows.filter((row) => {
    if (!/Employee_Master/.test(row.path)) return false;
    const fields = evidenceFields(row);
    const exit = recordDay(fields["Exit Date"]);
    return !!fields["Emp ID"] && (!exit || exit >= cutoff.slice(0, 10));
  });
  const tickets = select(/Jira_Export/, 20);
  const openTickets = tickets.filter((row) => !/^(done|closed|resolved)$/i.test(evidenceFields(row).Status ?? ""));
  const mail = select(/\.eml$/i, 7);
  const awaitingFollowUp = mail.filter((row) => {
    const subject = mailHeaders(row).subject?.replace(/^re:\s*/i, "").toLowerCase();
    const body = mailBody(row);
    if (/\bwill (?:check|look into it) and get back\b/i.test(body)) return true;
    const asks = /\?|\bi'd like to\b|\bneed (?:a date|some time)\b/i.test(body);
    return asks && !!subject && !mail.some((other) => other.id !== row.id
      && mailHeaders(other).subject?.toLowerCase() === `re: ${subject}`
      && Date.parse(mailHeaders(other).date ?? "") > Date.parse(mailHeaders(row).date ?? ""));
  });
  return {
    rows,
    sections: {
      "Role, reporting line, location, join date and direct reports": profile,
      "Atlas tickets (open first)": [...new Set([...openTickets, ...tickets])].slice(0, 6),
      "Recent commits": select(/git_log/, 3),
      "On-call weeks": select(/OnCall_Rota/, 3),
      "Incidents responded to": select(/Incidents_/, 3),
      "Recorded leave": select(/Leave_Register/, 3),
      "Sent or received mail": mail,
      "Mail requesting a follow-up or promising one (no further response found in the available mail)": awaitingFollowUp,
      "Transcript references (may be secondhand or misheard)": select(/\/transcripts\//, 6),
    },
  };
}
