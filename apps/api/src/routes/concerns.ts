import { Hono } from "hono";
import { concernCutoffs, topConcerns } from "../../../../src/concerns/store";
import { openDb } from "../../../../src/db/client";
import { isReleased } from "../../../../src/ingestion/releases";

export const concerns = new Hono().get("/", async (c) => {
  const db = await openDb();
  const cutoff = c.req.query("cutoff") ?? (await concernCutoffs(db))[0];
  if (!cutoff || !isReleased(cutoff)) return c.json({ cutoff: null, concerns: [] });

  const limit = Math.min(10, Math.max(1, Number(c.req.query("limit")) || 3));
  return c.json({ cutoff, concerns: await topConcerns(db, cutoff, limit) });
});
