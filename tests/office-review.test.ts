import { expect, test } from "bun:test";
import { officeAtCutoff } from "../src/agents/office";
import { findAgent } from "../src/agents/store";
import { pointInTime } from "../src/chat/point-in-time";
import { execute, openDb, selectOne } from "../src/db/client";
import { ingestRelease } from "../src/ingestion/ingest";
import { discoverReleases } from "../src/ingestion/releases";
import { personBrief } from "../src/retrieval/person-brief";

const releases = discoverReleases();

test("a payroll job title does not hide an employee's own record from the office or their manager", async () => {
  const db = await openDb(":memory:");
  await ingestRelease(db, releases[0]!);
  const cutoff = releases[0]!.releasedAt;
  expect((await officeAtCutoff(db, cutoff)).names.VX014).toBe("Fatima Sheikh");
  const meera = (await findAgent(db, "VX003", cutoff))!;
  const fatima = (await findAgent(db, "VX014", cutoff))!;
  const reports = (await personBrief(db, cutoff, meera)).sections["Role, reporting line, location, join date and direct reports"];
  expect(reports.some((row) => row.text.includes("Emp ID: VX014"))).toBe(true);
  expect((await personBrief(db, cutoff, fatima)).sections["Role, reporting line, location, join date and direct reports"]
    .some((row) => row.text.includes("Emp ID: VX014"))).toBe(true);
});

test("a decision in a later paragraph of a reply still closes a request to the CEO", async () => {
  const db = await openDb(":memory:");
  await ingestRelease(db, releases[0]!);
  const [monday, , wednesday] = releases.map(({ releasedAt }) => releasedAt) as [string, string, string];
  async function email(path: string, released: string, from: string, to: string, subject: string, body: string) {
    const source = await selectOne<{ id: number }>(db, `INSERT INTO sources
      (path, sha256, file_type, source_kind, release_day, released_at, ingested_at)
      VALUES (?, ?, 'eml', 'data_room', 1, ?, ?) RETURNING id`, path, path, released, released);
    await execute(db, "INSERT INTO evidence (source_id, locator_json, text) VALUES (?, '{}', ?)", source!.id,
      `From: ${from}\nTo: ${to}\nSubject: ${subject}\nDate: ${released}\n\n${body}`);
  }
  await email("email/20.eml", monday, "deepa@veloxa.in", "ananya@veloxa.in", "Review", "Ananya,\n\nCould you approve the training plan?");
  await email("email/21.eml", wednesday, "ananya@veloxa.in", "deepa@veloxa.in", "Re: Review",
    "Deepa,\n\nThanks for flagging this.\n\nThe training plan is approved.\n\n> Could you approve the training plan?");
  expect((await officeAtCutoff(db, monday)).indicators.VX005?.requests).toHaveLength(1);
  expect((await officeAtCutoff(db, wednesday)).indicators.VX005?.requests).toEqual([]);
});

test("point-in-time dates keep narrowing for timestamps and dotted dates, and ignore future weekdays", async () => {
  const thursday = releases[3]!.releasedAt;
  for (const asked of ["as of 2026-11-17T09:30:00+05:30", "as of 17-11-2026", "as of 17.11.2026"]) {
    expect(pointInTime(asked, thursday).asOf).toBe("2026-11-17");
  }
  expect(pointInTime("what is planned for next Monday?", thursday).cutoff).toBe(thursday);
  expect(pointInTime("5-6 people were on call", thursday).cutoff).toBe(thursday);
});
