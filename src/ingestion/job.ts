import type { Db } from "../db/client";
import { runIngest, type IngestOptions, type IngestResult } from "./run";

export interface IngestJob {
  id: string;
  status: "running" | "done" | "failed";
  options: IngestOptions;
  log: string[];
  result?: IngestResult;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

/** Only the latest job is kept; only one can run at a time (they share one connection and write the same tables). */
let current: IngestJob | undefined;

export const currentIngestJob = () => current;

export function startIngest(db: Db, options: IngestOptions): IngestJob {
  if (current?.status === "running") throw new Error("An ingest is already running.");
  const job: IngestJob = { id: crypto.randomUUID(), status: "running", options, log: [], startedAt: new Date().toISOString() };
  current = job;
  runIngest(db, options, (line) => job.log.push(line))
    .then((result) => { job.result = result; job.status = "done"; })
    .catch((e: Error) => { job.error = e.message; job.status = "failed"; })
    .finally(() => { job.finishedAt = new Date().toISOString(); });
  return job;
}
