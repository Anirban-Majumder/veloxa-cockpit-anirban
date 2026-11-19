import { describeRoute } from "hono-openapi";
import { Hono } from "hono";
import { concernCutoffs, topConcerns } from "../../../../src/concerns/store";
import { openDb } from "../../../../src/db/client";
import { isReleased } from "../../../../src/ingestion/releases";

export const concerns = new Hono().get("/", describeRoute({
  summary: "List top concerns",
  description: "Returns the top concerns for a release, defaulting to the latest available concern cutoff.",
  tags: ["Concerns"],
  parameters: [
    { name: "cutoff", in: "query", description: "Exact release cutoff, defaults to the latest available release.", schema: { type: "string" } },
    { name: "limit", in: "query", description: "Number of concerns from 1 to 10, or all. Defaults to 3.", schema: { type: "string" } },
  ],
  responses: {
    200: { description: "Release cutoff and concerns" },
  },
}), async (c) => {
  const db = await openDb();
  const cutoff = c.req.query("cutoff") ?? (await concernCutoffs(db))[0];
  if (!cutoff || !isReleased(cutoff)) return c.json({ cutoff: null, concerns: [] });

  const requested = c.req.query("limit");
  const limit = requested === "all" ? -1 : Math.min(10, Math.max(1, Number(requested) || 3));
  return c.json({ cutoff, concerns: await topConcerns(db, cutoff, limit) });
});
