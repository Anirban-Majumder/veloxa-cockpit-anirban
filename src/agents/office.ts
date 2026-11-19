import type { Db } from "../db/client";
import { evidenceAtCutoff, type EvidenceRow } from "../retrieval/evidence";
import { recordDay, workDate } from "../retrieval/person-brief";
import { aliasesFor, evidenceFields, mailBody, mailHeaders } from "../retrieval/search";
import { listAgents } from "./store";

interface Fact {
  label: string;
  date: string;
  evidence: { id: number; path: string };
}
type Status = Fact & { kind: "leave" | "on-call" | "open" | "recent" };

const OPEN_ITEMS = [
  { from: "VX018", to: "VX014", file: "/03.eml", anchor: "Will check and get back.", label: "Payslip query · will check", topic: /payslip/, closed: /(?:resolved|corrected|confirmed correct)/i },
  { from: "VX007", to: "VX004", file: "/09.eml", anchor: "Can we talk about Atlas ownership", label: "Atlas ownership talk · 23:47", topic: /atlas ownership/, closed: /(?:ownership confirmed|we spoke|we met|withdrawn)/i },
  { from: "VX009", to: "VX005", file: "/10.eml", anchor: "make remote permanent", label: "Permanent remote?", topic: /remote/, closed: /(?:approved|declined|denied|withdrawn|confirmed permanent)/i },
  { from: "VX002", to: "VX006", file: "/T4_Head_of_Marketing_Call.docx", anchor: "the summit leads are cold", label: "Summit leads are cold", topic: /summit leads/, closed: /(?:issue resolved|leads requalified)/i },
  { from: "VX003", to: "VX006", file: "/T2_CFO_Call.docx", anchor: "Nikhil's numbers never match mine", label: "Marketing numbers differ", topic: /marketing (?:numbers|spend)/, closed: /(?:reconciled|figures now match)/i },
  { from: "VX006", to: "VX004", file: "/05.eml", corroboration: "v3 launch kit has been ready since July, just waiting on engineering", anchor: "Just need a date from engineering", label: "Launch kit waits for a date", topic: /(?:atlas launch|launch date)/, closed: /(?:date confirmed|launch cancelled|atlas launched)/i },
] as const;

const noteFact = (row: EvidenceRow, label: string, date: string): Fact =>
  ({ label, date, evidence: { id: row.id, path: row.path } });
const note = noteFact;

const dateAge = (day: string, then: string) => (Date.parse(day) - Date.parse(then)) / 86_400_000;
const OPEN_TICKET = /^(?:to do|open|in progress|blocked|reopened|backlog|in review)$/i;
const DECISION = /\b(?:approved|declined|denied|completed|resolved|withdrawn|cancelled|canceled|no longer needed)\b/i;
const PENDING_DECISION = /\b(?:not|haven't|hasn't|will be|could be|might be|pending|if|before)\b/i;
const OPEN_REQUEST = /\b(?:(?:could|can|would|will) you|please)\s+(?:approve|confirm|decide|review|send|share|sign|schedule|arrange|authorize|help|choose|respond|provide|consider|let me know)\b/i;

function workStatus(rows: EvidenceRow[], cutoff: string, aliases: string[], initials: string): Status | undefined {
  const day = cutoff.slice(0, 10);
  const isPerson = (value?: string) => !!value && (value === initials || aliases.includes(value.toLowerCase()));
  const candidates: Status[] = [];
  for (const row of rows) {
    const fields = evidenceFields(row);
    const recorded = workDate(row, cutoff);
    const datedAfterCutoff = !recorded && !!recordDay(fields.Resolved || fields.Updated || fields.Created || fields.committed_at || fields.Opened || fields["Week of"] || fields.From);
    if (datedAfterCutoff) continue;
    // Records without a reliable date are aged from the day their pack was released.
    const date = recorded ?? row.released_at.slice(0, 10);
    const note = (row: EvidenceRow, label: string, date: string) =>
      noteFact(row, recorded ? label : `${label} (date unknown, released ${date})`, date);
    if (fields.Employee && /Leave_Register/.test(row.path) && isPerson(fields.Employee) && day <= (recordDay(fields.To) ?? date)) {
      candidates.push({ ...note(row, "Recorded leave", date), kind: "leave" });
    }
    if (fields["Week of"] && dateAge(day, date) < 7 && (isPerson(fields.Primary) || isPerson(fields.Secondary))) {
      candidates.push({ ...note(row, isPerson(fields.Primary) ? "Primary on call" : "Secondary on call", date), kind: "on-call" });
    }
    if (dateAge(day, date) > 30) continue;
    if (/Jira_Export/.test(row.path) && fields.Key && isPerson(fields.Assignee)) {
      candidates.push({
        ...note(row, `Last recorded: ${fields.Key} ${fields.Summary ?? ""} (${fields.Status ?? "status unspecified"})`, date),
        kind: OPEN_TICKET.test(fields.Status ?? "") && !fields.Resolved ? "open" : "recent",
      });
    }
    if (/Incidents_/.test(row.path) && isPerson(fields.Responder)) {
      candidates.push({ ...note(row, `Last recorded: ${fields.ID} on ${fields.Service}`, date), kind: fields.Resolved ? "recent" : "open" });
    }
    if (/git_log/.test(row.path) && fields.repo && fields.author_email && (
      isPerson(fields.author_email) || isPerson(fields.author_email.split("@")[0])
    )) {
      candidates.push({ ...note(row, `Last recorded commit: ${fields.repo} (${fields.sha})`, date), kind: "recent" });
    }
  }
  const priority = { leave: 0, "on-call": 1, open: 2, recent: 3 };
  return candidates.sort((a, b) => priority[a.kind] - priority[b.kind] || b.date.localeCompare(a.date) || b.evidence.id - a.evidence.id)[0];
}

const addresses = (value?: string): string[] => value?.toLowerCase().match(/[\w.+-]+@[\w.-]+/g) ?? [];
const topicOf = (subject?: string) => subject?.replace(/^(?:(?:re|fwd?):\s*)+/i, "").trim().toLowerCase();

function ceoRequests(mail: { row: EvidenceRow; headers: ReturnType<typeof mailHeaders>; date?: string }[], sender: string, ceo: string) {
  return mail.flatMap(({ row, headers, date }) => {
    const recipients = addresses(headers.to);
    if (!date || !headers.subject || !addresses(headers.from).includes(sender) || !recipients.includes(ceo)) return [];
    const body = mailBody(row);
    if (recipients.length > 1 && !/^\s*(?:(?:hi|dear|hello)\s+)?ananya(?: rao)?[,!:]/i.test(body)) return [];
    const request = body.replace(/\s+/g, " ")
      .match(/[^.!?\n]*(?:\b(?:could|can|would|will) you|\bplease)\s+[^.!?\n]+[.!?]?/gi)?.find((sentence) => OPEN_REQUEST.test(sentence));
    if (!request) return [];
    const replies = mail.filter((reply) => reply.row.id !== row.id && (reply.date ?? "") >= date
      && topicOf(reply.headers.subject) === topicOf(headers.subject)
      && addresses(reply.headers.from).includes(ceo) && addresses(reply.headers.to).includes(sender)
      && Date.parse(reply.headers.date ?? "") > Date.parse(headers.date ?? ""));
    const withdrawn = mail.some((reply) => topicOf(reply.headers.subject) === topicOf(headers.subject)
      && addresses(reply.headers.from).includes(sender) && addresses(reply.headers.to).includes(ceo)
      && Date.parse(reply.headers.date ?? "") > Date.parse(headers.date ?? "")
      && /\b(?:withdrawing|withdrawn|no longer needed|please disregard)\b/i.test(mailBody(reply.row)));
    const decided = replies.some((reply) => {
      const body = mailBody(reply.row);
      return DECISION.test(body) && !PENDING_DECISION.test(body);
    });
    if (withdrawn || decided) return [];
    return [{ ...note(row, request.trim().slice(0, 180), date), response: replies.length ? "Response recorded · no decision found" : "No response found" }];
  }).sort((a, b) => b.date.localeCompare(a.date) || b.evidence.id - a.evidence.id);
}

export async function officeAtCutoff(db: Db, cutoff: string) {
  const agents = await listAgents(db, cutoff);
  const rows = await evidenceAtCutoff(db, cutoff);
  const day = cutoff.slice(0, 10);
  const people = new Map(rows.flatMap((row) => {
    const fields = evidenceFields(row);
    return fields["Emp ID"] && fields["Full Name"] ? [[fields["Emp ID"], fields] as const] : [];
  }));
  const mail = rows.filter((row) => /\.eml$/i.test(row.path)).map((row) => ({
    row, headers: mailHeaders(row), date: recordDay(mailHeaders(row).date),
  })).filter(({ headers, date }) => date && Date.parse(headers.date ?? "") <= Date.parse(cutoff));
  const names = Object.fromEntries([...people].map(([id, fields]) => [id, fields["Full Name"]!]));
  const reporting = [...people].flatMap(([from, fields]) => {
    const to = fields["Manager ID"];
    const profile = agents.find((agent) => agent.employee_id === from);
    if (profile) return profile.manager_id ? [{ from, to: profile.manager_id }] : [];
    return to ? [{ from, to }] : [];
  });
  const openItems = OPEN_ITEMS.flatMap((item) => {
    const row = rows.find((r) => r.path.endsWith(item.file) && r.text.includes(item.anchor));
    if (!row) return [];
    if ("corroboration" in item && !rows.some((r) => r.text.includes(item.corroboration))) return [];
    const date = workDate(row) ?? row.released_at.slice(0, 10);
    const sentAt = Date.parse(mailHeaders(row).date ?? "");
    if (date > day || (Number.isFinite(sentAt) && sentAt > Date.parse(cutoff)) || mail.some(({ row: update, headers, date: updateDay }) => {
      const participants = [...addresses(headers.from), ...addresses(headers.to)];
      return (Number.isFinite(sentAt) ? Date.parse(headers.date ?? "") > sentAt : updateDay! > date) && item.topic.test(update.text.toLowerCase()) && item.closed.test(mailBody(update)) && !PENDING_DECISION.test(mailBody(update))
        && [item.from, item.to].every((id) => participants.includes(people.get(id)?.["Work Email"]?.toLowerCase() ?? ""));
    })) return [];
    return [{ from: item.from, to: item.to, ...note(row, item.label, date) }];
  });
  const workRows = rows.filter((row) => /Jira_Export|Incidents_|OnCall_Rota|Leave_Register|git_log/.test(row.path));
  const datedWorkItems = new Set(mail.map(({ row }) => row.id));
  const indicators = Object.fromEntries(agents.map((agent) => {
    const fields = people.get(agent.employee_id);
    const email = fields?.["Work Email"]?.toLowerCase() ?? "";
    const aliases = aliasesFor({ ...agent, work_email: email });
    const initials = agent.full_name.split(" ").map((part) => part[0]).join("");
    const work = workStatus(workRows, cutoff, aliases, initials);
    const open = openItems.filter((item) => item.from === agent.employee_id && datedWorkItems.has(item.evidence.id)
      && dateAge(day, item.date) <= 30).sort((a, b) => b.date.localeCompare(a.date))[0];
    const status: Status | undefined = open && (!work || work.kind === "recent" || (work.kind === "open" && open.date > work.date))
      ? { ...open, label: `Last recorded: ${open.label}`, kind: "open" } : work;
    return [agent.employee_id, { status, requests: ceoRequests(mail, email, people.get("VX001")?.["Work Email"]?.toLowerCase() ?? "") }];
  }));
  return { agents, names, reporting, openItems, indicators };
}
