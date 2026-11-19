import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { connect } from "@tursodatabase/database";
import { SCHEMA_SQL } from "./schema";

export const DB_PATH = resolve(process.env.VELOXA_DB ?? "data/veloxa.db");

export type Db = Awaited<ReturnType<typeof connect>>;
type Param = string | number | null;

let cached: Promise<Db> | undefined;
let queue: Promise<unknown> = Promise.resolve();
const insideTransaction = new AsyncLocalStorage<true>();

export function openDb(path = DB_PATH): Promise<Db> {
  if (path === DB_PATH && cached) return cached;
  const opening = (async () => {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const db = await connect(path);
    await db.exec("PRAGMA foreign_keys = ON");
    await db.exec(SCHEMA_SQL);
    return db;
  })();
  if (path === DB_PATH) cached = opening;
  return opening;
}

/** Every request shares one connection, so statements and transactions take turns. */
function exclusive<T>(work: () => Promise<T>): Promise<T> {
  if (insideTransaction.getStore()) return work();
  const run = queue.then(work);
  queue = run.catch(() => {});
  return run;
}

export function selectOne<T>(db: Db, sql: string, ...params: Param[]): Promise<T | undefined> {
  return exclusive(async () => (await (await db.prepare(sql)).get(...params)) as T | undefined);
}

export function selectAll<T>(db: Db, sql: string, ...params: Param[]): Promise<T[]> {
  return exclusive(async () => (await (await db.prepare(sql)).all(...params)) as T[]);
}

type StatementBatch = { statements: string[]; atomic: boolean; readOnly: boolean };

export function execute(db: Db, sql: string, ...params: Param[]): Promise<void>;
export function execute(db: Db, batch: StatementBatch): ReturnType<Db["batch"]>;
export function execute(db: Db, sql: string | StatementBatch, ...params: Param[]) {
  if (typeof sql !== "string") {
    return exclusive(async () => {
      const options = { raw: true, mode: sql.atomic ? "deferred" : undefined };
      if (!sql.readOnly) return db.batch(sql.statements, options);

      // query_only is connection-wide, so keep the queue until it is restored.
      await db.exec("PRAGMA query_only = 1");
      try {
        return await db.batch(sql.statements, options);
      } finally {
        await db.exec("PRAGMA query_only = 0");
      }
    });
  }
  return exclusive(async () => {
    await (await db.prepare(sql)).run(...params);
  });
}

export function transaction<T>(db: Db, work: () => Promise<T>): Promise<T> {
  return exclusive(() => insideTransaction.run(true, async () => {
    await db.exec("BEGIN");
    try {
      const result = await work();
      await db.exec("COMMIT");
      return result;
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  }));
}
