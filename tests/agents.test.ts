import { beforeAll, describe, expect, test } from "bun:test";
import { findAgent, listAgents } from "../src/agents/store";
import { execute, openDb, type Db } from "../src/db/client";
import { discoverReleases } from "../src/ingestion/releases";
import { ingestRelease, syncAgents } from "../src/ingestion/ingest";

const DAY_1 = "2026-11-16T10:00:00+05:30";
const DAY_3 = "2026-11-18T10:00:00+05:30";
const AFTER_REORG = "2026-12-14T10:00:00+05:30";
const AFTER_EXIT = "2027-01-11T10:00:00+05:30";
let db: Db;

/** A later employee export, as a future release would add it. */
async function addEmployeeExport(releasedAt: string, rows: Record<string, string>[]) {
  await execute(db,
    `INSERT INTO sources (path, sha256, file_type, source_kind, release_day, released_at, ingested_at)
     VALUES (?, ?, 'xlsx', 'data_room', 99, ?, ?)`, `export-${releasedAt}.xlsx`, releasedAt, releasedAt, releasedAt);
  for (const row of rows) {
    await execute(db,
      `INSERT INTO evidence (source_id, locator_json, text, data_json)
       VALUES ((SELECT id FROM sources WHERE released_at = ?), '{}', '', ?)`, releasedAt, JSON.stringify(row));
  }
  await syncAgents(db);
}

const nikhil = (changes: Record<string, string>) => ({
  "Emp ID": "VX006", "Full Name": "Nikhil Bose", "Work Email": "nikhil@veloxa.in", "Department": "Marketing",
  "Title": "Head of Marketing", "Manager ID": "VX001", "Join Date": "2024-09-02", "Location": "Bengaluru", "Status": "Active", ...changes,
});

beforeAll(async () => {
  db = await openDb(":memory:");
  await ingestRelease(db, discoverReleases().find((r) => r.day === 1)!);
  await addEmployeeExport(AFTER_REORG, [nikhil({ "Manager ID": "VX020", "Department": "Revenue", "Work Email": "nikhil.bose@veloxa.in" })]);
  await addEmployeeExport(AFTER_EXIT, [nikhil({ "Manager ID": "VX020", "Department": "Revenue", "Status": "Exited", "Exit Date": "2027-01-08" })]);
});

describe("agents follow the selected day", () => {
  test("the 14 roster agents exist from Day 1", async () => {
    expect(await listAgents(db, DAY_1)).toHaveLength(14);
  });

  test("a reorg shows only from the release that recorded it", async () => {
    expect(await findAgent(db, "VX006", DAY_3)).toMatchObject({ department: "Marketing", manager_id: "VX001", work_email: "nikhil@veloxa.in" });
    expect(await findAgent(db, "VX006", AFTER_REORG)).toMatchObject({ department: "Revenue", manager_id: "VX020", work_email: "nikhil.bose@veloxa.in" });
  });

  test("someone serving notice stays; after their last working day they are hidden", async () => {
    const leaving = nikhil({ "Manager ID": "VX020", "Department": "Revenue", "Status": "Notice period", "Exit Date": "2027-01-08" });
    await addEmployeeExport("2026-12-21T10:00:00+05:30", [leaving]);
    expect(await findAgent(db, "VX006", "2026-12-21T10:00:00+05:30")).toMatchObject({ status: "Notice period" });
    expect(await findAgent(db, "VX006", AFTER_EXIT)).toBeUndefined();
    expect(await listAgents(db, AFTER_EXIT)).toHaveLength(13);
  });
});
