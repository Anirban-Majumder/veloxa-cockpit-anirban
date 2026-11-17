import { beforeAll, describe, expect, test } from "bun:test";
import { openDb, type Db } from "../src/db/client";
import { discoverReleases } from "../src/ingestion/releases";
import { ingestRelease } from "../src/ingestion/ingest";
import { evidenceAtCutoff } from "../src/retrieval/evidence";
import { buildEvidencePack } from "../src/concerns/context";
import { rankConcerns, scoreConcern } from "../src/concerns/generate";

const releases = discoverReleases();
const day = (n: number) => releases.find((r) => r.day === n)!;
let db: Db;

beforeAll(async () => {
  db = await openDb(":memory:");
  await ingestRelease(db, day(1));
  await ingestRelease(db, day(2));
});

describe("release discovery", () => {
  test("day folders map to 10:00 IST release times", () => {
    expect(day(1).releasedAt).toBe("2026-11-16T10:00:00+05:30");
    expect(day(2).releasedAt).toBe("2026-11-17T10:00:00+05:30");
  });
});

describe("ingestion", () => {
  test("re-ingesting is a no-op", async () => {
    const before = (await (await db.prepare("SELECT COUNT(*) AS n FROM evidence")).get()) as { n: number };
    const res = await ingestRelease(db, day(1));
    expect(res.added).toBe(0);
    expect((await (await db.prepare("SELECT COUNT(*) AS n FROM evidence")).get()) as { n: number }).toEqual(before);
  });

  test("templates folder is not ingested", async () => {
    const row = await (await db.prepare("SELECT COUNT(*) AS n FROM sources WHERE path LIKE '%/templates/%'")).get();
    expect(row).toEqual({ n: 0 });
  });

  test("14 roster agents are created from the employee master", async () => {
    expect(await (await db.prepare("SELECT COUNT(*) AS n FROM agents")).get()).toEqual({ n: 14 });
    expect(await (await db.prepare("SELECT full_name FROM agents WHERE employee_id = 'VX014'")).get()).toEqual({ full_name: "Fatima Sheikh" });
  });

  test("emails are decoded from quoted-printable", async () => {
    const r = (await (await db.prepare("SELECT text FROM evidence e JOIN sources s ON s.id = e.source_id WHERE s.path LIKE '%email/06.eml'")).get()) as { text: string };
    expect(r.text).toContain("Burn is the priority this quarter.");
  });
});

describe("knowledge cutoff", () => {
  test("Day 1 cutoff excludes Day 2 evidence", async () => {
    const rows = await evidenceAtCutoff(db, day(1).releasedAt);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.path.startsWith("Day1_"))).toBe(true);
  });
  test("Day 2 cutoff includes both days", async () => {
    const paths = new Set((await evidenceAtCutoff(db, day(2).releasedAt)).map((r) => r.path.split("/")[0]));
    expect([...paths].sort()).toEqual(["Day1_Mon_16Nov", "Day2_Tue_17Nov"]);
  });
});

describe("salary privacy (A002)", () => {
  test("individual payroll rows are restricted and absent from the CEO pack", async () => {
    const all = await evidenceAtCutoff(db, day(2).releasedAt, true);
    const payroll = all.filter((r) => r.path.includes("Payroll_Register") && r.data_json);
    expect(payroll.length).toBeGreaterThan(0);
    const visible = new Set((await evidenceAtCutoff(db, day(2).releasedAt)).map((r) => r.id));
    expect(payroll.some((r) => visible.has(r.id))).toBe(false);

    const { pack, ids } = await buildEvidencePack(db, day(2).releasedAt);
    expect(payroll.some((r) => ids.has(r.id))).toBe(false);
    expect(pack).not.toContain("Days Payable");
    expect(pack).toMatch(/Feb-2026: gross Rs\. \d+ across 19 employees/);
  });
});

describe("concern scoring (D019)", () => {
  test("score = 2 × impact + urgency + evidence strength", () => {
    expect(scoreConcern({ impact: 3, urgency: 2, evidence_strength: 1 })).toBe(9);
  });
  test("ties break on urgency", () => {
    const a = { id: "a", impact: 2, urgency: 1, evidence_strength: 3 }; // 8
    const b = { id: "b", impact: 2, urgency: 3, evidence_strength: 1 }; // 8
    const c = { id: "c", impact: 3, urgency: 3, evidence_strength: 3 }; // 12
    expect(rankConcerns([a, b, c]).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});
