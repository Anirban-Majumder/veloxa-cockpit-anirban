import { expect, test } from "bun:test";
import { browseDatabase, isBrowserStatementAllowed } from "../src/db/browse";
import { execute, openDb } from "../src/db/client";

test("the database browser accepts inspection SQL and blocks mutations by default", () => {
  for (const sql of [
    "/* inspect */ SELECT ';' AS value;",
    "PRAGMA main.table_info('sources');",
    "PRAGMA database_list;",
    "EXPLAIN QUERY PLAN SELECT * FROM sources",
    "WITH sample(value) AS (SELECT 1), more AS (SELECT * FROM sample) SELECT * FROM more",
  ]) expect(isBrowserStatementAllowed(sql)).toBe(true);

  for (const sql of [
    "DELETE FROM sources",
    "WITH sample AS (SELECT 1) DELETE FROM sources",
    "SELECT 1; DELETE FROM sources",
    "PRAGMA foreign_keys = OFF",
    "PRAGMA journal_mode(WAL)",
    "PRAGMA writable_schema(ON)",
    "EXPLAIN PRAGMA foreign_keys = OFF",
    'SELECT "load_extension"(\'external-library\')',
    "BEGIN",
  ]) expect(isBrowserStatementAllowed(sql)).toBe(false);

  expect(isBrowserStatementAllowed("DELETE FROM sources", true)).toBe(true);
  expect(isBrowserStatementAllowed("ROLLBACK", true)).toBe(false);
});

test("database browser returns Outerbase rows, metadata for empty results, and write stats", async () => {
  const db = await openDb(":memory:");
  try {
    await execute(db, "CREATE TABLE browser_test (id INTEGER PRIMARY KEY, label TEXT)");
    const [write, read, empty] = await browseDatabase(db, [
      "INSERT INTO browser_test VALUES (42, 'demo')",
      "SELECT id AS value, label AS value FROM browser_test",
      "SELECT label FROM browser_test WHERE id = 0",
    ], true, true);

    expect(write).toMatchObject({ rows: [], headers: [], stat: { rowsAffected: 1 }, lastInsertRowid: 42 });
    expect(read).toEqual({
      rows: [{ value: 42, __value_1: "demo" }],
      headers: [
        { name: "value", displayName: "value", originalType: "INTEGER", type: 2 },
        { name: "__value_1", displayName: "value", originalType: "TEXT", type: 1 },
      ],
      stat: { rowsAffected: 0, rowsRead: null, rowsWritten: null, queryDurationMs: null },
      lastInsertRowid: undefined,
    });
    expect(empty).toMatchObject({ rows: [], headers: [{ name: "label", originalType: "TEXT", type: 1 }] });

    await expect(browseDatabase(db, [
      "INSERT INTO browser_test VALUES (43, 'rolled back')",
      "INSERT INTO browser_test VALUES (42, 'duplicate')",
    ], true, true)).rejects.toThrow();
    const [afterRollback] = await browseDatabase(db, ["SELECT id FROM browser_test"], true, false);
    expect(afterRollback?.rows).toEqual([{ id: 42 }]);
    await expect(browseDatabase(db, ["DELETE FROM browser_test"], false, false)).rejects.toThrow("query_only");
    await execute(db, "DELETE FROM browser_test");
  } finally {
    await db.close();
  }
});
