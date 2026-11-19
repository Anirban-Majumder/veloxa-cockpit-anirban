import { expect, test } from "bun:test";
import { execute, openDb, selectOne } from "../src/db/client";
import { hasDayEvidence, initializeData } from "../src/ingestion/initialize";

const release = { day: 1, folder: "missing-folder", releasedAt: "2026-11-16T10:00:00+05:30" };

test("startup trusts one evidence row, preserves concerns, and ignores future packs", async () => {
  const db = await openDb(":memory:");
  await execute(db, `INSERT INTO sources VALUES (1, 'existing', 'hash', 'txt', 'data_room', 1, ?, 'now')`, release.releasedAt);
  expect(await hasDayEvidence(db, 1)).toBe(false);
  await execute(db, `INSERT INTO evidence (source_id, locator_json, text) VALUES (1, '{}', 'existing evidence')`);
  await execute(db, "INSERT INTO evidence (source_id, locator_json, text, data_json) VALUES (1, '{}', 'employee', ?)",
    JSON.stringify({ "Emp ID": "VX007", "Full Name": "Priya Nair" }));
  expect(await hasDayEvidence(db, 1)).toBe(true);
  expect(await hasDayEvidence(db, 2)).toBe(false);
  await execute(db, `INSERT INTO concerns (knowledge_cutoff, title, description, impact, urgency, evidence_strength,
    scoring_reasons_json, score, rank, model, generated_at) VALUES (?, 'keep me', '', 1, 1, 1, '{}', 4, 1, 'test', 'now')`, release.releasedAt);
  const logs: string[] = [];
  await initializeData(db, (line) => logs.push(line), [release,
    { day: 2, folder: "future", releasedAt: "2999-11-17T10:00:00+05:30" }]);
  expect(logs).toEqual(["Day 1: evidence exists; skipping import."]);
  expect(await selectOne(db, "SELECT title FROM concerns")).toEqual({ title: "keep me" });
  expect(await selectOne(db, "SELECT soul FROM agents WHERE employee_id = 'VX007'")).toEqual({
    soul: expect.stringContaining("overloaded"),
  });
});

test("startup fails clearly when no packs have been released", async () => {
  await expect(initializeData(await openDb(":memory:"), () => {}, [])).rejects.toThrow("No released packs");
});
