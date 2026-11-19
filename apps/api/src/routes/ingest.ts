import { describeRoute } from "hono-openapi";
import { Hono } from "hono";
import { z } from "zod";
import { openDb } from "../../../../src/db/client";
import { currentIngestJob, startIngest } from "../../../../src/ingestion/job";
import { IngestInputError, resolveDays } from "../../../../src/ingestion/run";
import { HttpError, requireJson, validateJson } from "../http";

const IngestRequest = z.object({
  day: z.number().int().positive("day must be a positive integer").optional(),
  concerns: z.boolean().default(true),
  regen: z.boolean().default(false),
});

/** Runs inside the API because this process owns the database file. Poll GET for progress. */
export const ingest = new Hono()
  .get("/", describeRoute({
  summary: "Get ingest status",
  description: "Reports the current ingestion job and its progress.",
  tags: ["Ingestion"],
  responses: {
    200: { description: "Current job or null" },
  },
}), (c) => c.json({ job: currentIngestJob() ?? null }))
  .post("/", describeRoute({
  summary: "Start ingestion",
  description: "Starts a background ingestion job for the selected day or all available days.",
  tags: ["Ingestion"],
  responses: {
    202: { description: "Ingestion accepted" },
    400: { description: "Invalid ingestion options" },
    409: { description: "An ingest is already running" },
    415: { description: "Unsupported media type" },
  },
}), requireJson, validateJson(IngestRequest), async (c) => {
    const options = c.req.valid("json");
    try {
      resolveDays(options.day);
    } catch (error) {
      if (error instanceof IngestInputError) throw new HttpError(400, error.message);
      throw error;
    }
    if (currentIngestJob()?.status === "running") {
      return c.json({ error: "An ingest is already running.", job: currentIngestJob() }, 409);
    }
    return c.json({ job: startIngest(await openDb(), options) }, 202);
  });
