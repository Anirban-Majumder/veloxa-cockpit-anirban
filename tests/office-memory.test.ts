import { beforeAll, expect, test } from "bun:test";
import { officeAtCutoff } from "../src/agents/office";
import { findAgent } from "../src/agents/store";
import { personConversationSummary, saveExchange, startConversation } from "../src/chat/history";
import { pointInTime } from "../src/chat/point-in-time";
import { execute, openDb, selectOne, type Db } from "../src/db/client";
import { ingestRelease } from "../src/ingestion/ingest";
import { discoverReleases } from "../src/ingestion/releases";
import { ingestSouls } from "../src/ingestion/souls";
import { evidenceAtCutoff, isRestricted } from "../src/retrieval/evidence";
import { personBrief } from "../src/retrieval/person-brief";
import { scopedEvidence, searchEvidence } from "../src/retrieval/search";

const releases = discoverReleases();
const [monday, tuesday, wednesday, thursday] = releases.map(({ releasedAt }) => releasedAt) as [string, string, string, string];
let db: Db;

beforeAll(async () => {
  db = await openDb(":memory:");
  for (const release of releases) await ingestRelease(db, release);
});

test("point-in-time parsing uses IST end of day and only narrows the selected release", () => {
  for (const date of ["18 Nov", "Nov 18", "18/11", "2026-11-18", "on 18th November", "by Wednesday", "yesterday"]) {
    expect(pointInTime(`What did we know ${date}?`, thursday)).toEqual({
      cutoff: "2026-11-18T23:59:59.999+05:30", asOf: "2026-11-18", historyThrough: "2026-11-18T18:29:59.999Z",
    });
  }
  expect(pointInTime("as of last Monday", thursday).cutoff).toBe("2026-11-16T23:59:59.999+05:30");
  expect(pointInTime("as of 19 Nov", wednesday).cutoff).toBe(wednesday);
  expect(pointInTime("by Thursday", wednesday).cutoff).toBe(wednesday);
  expect(pointInTime("As of 18 Nov, what did Priya write on 1 Sep?", thursday).asOf).toBe("2026-11-18");
  expect(pointInTime("as of 31 Nov", wednesday).asOf).toBeUndefined();
  expect(pointInTime("as of 2026/01/02", wednesday).asOf).toBeUndefined();
  expect(pointInTime("as of 11/12/26", wednesday).asOf).toBeUndefined();
  expect(pointInTime("as of 03/04", wednesday).asOf).toBe("2026-04-03");
  expect(pointInTime("Compare 18 Nov with 16 Nov", thursday).cutoff).toBe("2026-11-16T23:59:59.999+05:30");
});

test("mail envelopes, pay restrictions and released sources also scope the working brief", async () => {
  const rahul = (await findAgent(db, "VX018", wednesday))!;
  const meera = (await findAgent(db, "VX003", wednesday))!;
  const vikram = (await findAgent(db, "VX004", wednesday))!;
  const fatima = (await findAgent(db, "VX014", wednesday))!;
  const brief = await personBrief(db, wednesday, rahul);
  const searched = await searchEvidence(db, "private Atlas plan 15 Sep", wednesday, { agent: rahul });
  for (const rows of [brief.rows, searched]) {
    expect(rows.some((r) => /\/04\.eml$|Email_Printouts|Payroll_Register/.test(r.path))).toBe(false);
  }
  expect(brief.sections["Sent or received mail"].map((r) => r.path)).toEqual([
    expect.stringMatching(/\/03\.eml$/), expect.stringMatching(/\/02\.eml$/),
  ]);
  expect((await personBrief(db, wednesday, fatima)).rows.some((r) => /\/01\.eml$/.test(r.path))).toBe(false);
  expect((await personBrief(db, wednesday, vikram)).rows.some((r) => /\/04\.eml$/.test(r.path))).toBe(true);
  expect((await personBrief(db, monday, meera)).rows.some((r) => /\/06\.eml$/.test(r.path))).toBe(false);
});

test("memory stays within its agent, cutoff and historical message date", async () => {
  const priya = await startConversation(db, "VX007");
  const rahul = await startConversation(db, "VX018");
  const save = (conversation: number, cutoff: string, id: string, answer: string, scoped = true) => saveExchange(db,
    conversation, cutoff, { id, role: "user", parts: [{ type: "text", text: "Question " + id }] },
    { id: "reply-" + id, role: "assistant", metadata: { scoped }, parts: [{ type: "text", text: answer }] });
  await save(priya, monday, "one", "First reply [E1]");
  await save(priya, monday, "two", "Old private reply", false);
  await save(priya, wednesday, "three", "Future reply");
  await save(rahul, monday, "four", "Different agent");
  await execute(db, "UPDATE messages SET created_at = ? WHERE conversation_id = ? AND knowledge_cutoff = ?",
    "2026-11-16T04:00:00.000Z", priya, monday);
  const late = await startConversation(db, "VX007");
  await save(late, monday, "late", "Same-day reply after the cutoff");
  await execute(db, "UPDATE messages SET created_at = ? WHERE conversation_id = ?",
    "2026-11-16T11:00:00.000Z", late);
  const summary = await personConversationSummary(db, "VX007", monday, [{ id: 1 }], undefined, "2026-11-16T18:29:59.999Z");
  expect(summary).toContain("First reply");
  expect(await personConversationSummary(db, "VX007", monday, [{ id: 1 }])).toBe(summary);
  expect(summary).not.toMatch(/Old private reply|Future reply|Different agent|Same-day reply after the cutoff/);
  expect(await personConversationSummary(db, "VX007", monday, [{ id: 1 }], undefined, "2026-11-16T03:00:00.000Z")).toBe("");
});

test("office returns cutoff-visible links for the full roster and ages status from record dates", async () => {
  for (const [cutoff, expected] of [[monday, 2], [tuesday, 3], [wednesday, 6], [thursday, 6]] as const) {
    const office = await officeAtCutoff(db, cutoff);
    expect(office.agents).toHaveLength(14);
    expect(Object.keys(office.indicators)).toHaveLength(14);
    expect(office.openItems).toHaveLength(expected);
    expect(office.names.VX001).toBe("Ananya Rao");
    expect(office.reporting).toContainEqual({ from: "VX007", to: "VX004" });
    expect(office.indicators.VX005?.requests).toEqual([]);
    for (const { evidence } of office.openItems) {
      expect(await selectOne(db, "SELECT id FROM evidence WHERE id = ?", evidence.id)).toBeDefined();
    }
  }
  const day3 = await officeAtCutoff(db, wednesday);
  expect(day3.indicators.VX018?.status?.label ?? "").not.toMatch(/payslip/i);
  expect(day3.openItems.some((item) => /payslip/i.test(item.label))).toBe(true);
});

test("a direct CEO request is dated and disappears when a decision becomes available", async () => {
  const requestDb = await openDb(":memory:");
  await ingestRelease(requestDb, releases[0]!);
  async function email(path: string, cutoff: string, sender: string, receiver: string, subject: string, body: string, cc?: string, sentAt = cutoff) {
    const source = await selectOne<{ id: number }>(requestDb, `INSERT INTO sources
      (path, sha256, file_type, source_kind, release_day, released_at, ingested_at)
      VALUES (?, ?, 'eml', 'data_room', 1, ?, ?) RETURNING id`, path, path, cutoff, cutoff);
    await execute(requestDb, "INSERT INTO evidence (source_id, locator_json, text) VALUES (?, '{}', ?)", source!.id,
      `From: ${sender}\nTo: ${receiver}\n${cc ? `Cc: ${cc}\n` : ""}Subject: ${subject}\nDate: ${sentAt}\n\n${body}`);
  }
  await email("email/12.eml", monday, "deepa@veloxa.in", "ananya@veloxa.in", "Review", "Could you approve the training plan?");
  await email("email/13.eml", monday, "deepa@veloxa.in", "meera@veloxa.in", "Budget", "Please approve the budget.", "ananya@veloxa.in");
  await email("email/multi.eml", monday, "deepa@veloxa.in", "vikram@veloxa.in, ananya@veloxa.in",
    "Team", "Vikram, could you approve the team schedule?");
  await email("email/ack.eml", tuesday, "ananya@veloxa.in", "deepa@veloxa.in", "Re: Review",
    "It has not yet been approved.");
  await email("email/14.eml", wednesday, "ananya@veloxa.in", "deepa@veloxa.in", "Re: Review", "The training plan is approved.", undefined, "2026-11-18T11:00:00+05:30");
  expect((await officeAtCutoff(requestDb, monday)).indicators.VX005?.requests).toEqual([
    expect.objectContaining({ label: "Could you approve the training plan?", response: "No response found", date: "2026-11-16" }),
  ]);
  expect((await officeAtCutoff(requestDb, tuesday)).indicators.VX005?.requests[0]?.response)
    .toBe("Response recorded · no decision found");
  expect((await officeAtCutoff(requestDb, wednesday)).indicators.VX005?.requests[0]?.response)
    .toBe("Response recorded · no decision found");
  expect((await officeAtCutoff(requestDb, "2026-11-18T11:00:00+05:30")).indicators.VX005?.requests).toEqual([]);
});

test("soul loading is repeatable, warns for a missing file, and rejects unknown IDs", async () => {
  await ingestSouls(db, console.log);
  await ingestSouls(db, console.log);
  expect(await selectOne(db, "SELECT COUNT(*) AS count FROM agents WHERE soul IS NOT NULL")).toEqual({ count: 14 });
  const notes: string[] = [];
  await ingestSouls(db, (note) => notes.push(note), "data/does-not-exist.json");
  expect(notes[0]).toMatch(/warning.*missing/i);
  const path = `/tmp/veloxa-souls-${crypto.randomUUID()}.json`;
  await Bun.write(path, JSON.stringify([{ employee_id: "VX999", soul: "Unknown" }]));
  try {
    await expect(ingestSouls(db, console.log, path)).rejects.toThrow("Unknown employee ID");
  } finally {
    await Bun.file(path).delete();
  }
});

