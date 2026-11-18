import { Hono } from "hono";
import { z } from "zod";
import { openDb } from "../../../../src/db/client";
import { currentIngestJob, startIngest } from "../../../../src/ingestion/job";
import { IngestInputError, resolveDays } from "../../../../src/ingestion/run";
import { HttpError, readBody } from "../http";

const IngestRequest = z.object({
  day: z.number().int().positive("day must be a positive integer").optional(),
  concerns: z.boolean().default(true),
  regen: z.boolean().default(false),
});

/** Runs inside the API because this process owns the database file. Poll GET for progress. */
export const ingest = new Hono()
  .get("/", (c) => c.json({ job: currentIngestJob() ?? null }))
  .post("/", async (c) => {
    const options = await readBody(c, IngestRequest);
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
