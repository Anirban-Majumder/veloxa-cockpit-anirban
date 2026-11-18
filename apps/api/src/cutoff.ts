import { openDb } from "../../../src/db/client";
import { releasedCutoffs } from "../../../src/retrieval/evidence";
import { HttpError } from "./http";

/** Only exact release cutoffs are accepted: they are compared as text in SQL, so other offsets could leak later data. */
export async function resolveCutoff(requested: string | undefined): Promise<string> {
  const cutoffs = (await releasedCutoffs(await openDb())).map((r) => r.released_at);
  if (cutoffs.length === 0) throw new HttpError(409, "Nothing has been ingested yet. Run `bun run ingest`.");
  if (requested === undefined) return cutoffs.at(-1)!;
  if (!cutoffs.includes(requested)) throw new HttpError(400, `Unknown cutoff ${requested}. Use one of: ${cutoffs.join(", ")}.`);
  return requested;
}
