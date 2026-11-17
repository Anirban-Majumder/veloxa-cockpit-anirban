import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { connect } from "@tursodatabase/database";
import { SCHEMA_SQL } from "./schema";

export const DB_PATH = resolve(process.env.VELOXA_DB ?? "data/veloxa.db");

export type Db = Awaited<ReturnType<typeof connect>>;

let cached: Promise<Db> | undefined;

/** Opens the local Turso database and applies the schema (idempotent). */
export function openDb(path = DB_PATH): Promise<Db> {
  if (path === DB_PATH && cached) return cached;
  const p = (async () => {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const db = await connect(path);
    await db.exec(SCHEMA_SQL);
    return db;
  })();
  if (path === DB_PATH) cached = p;
  return p;
}
