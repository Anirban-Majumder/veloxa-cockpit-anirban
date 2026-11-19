import { selectOne, type Db } from "../db/client";
import { generateConcerns } from "../concerns/generate";
import { hasConcerns } from "../concerns/store";
import { ingestRelease } from "./ingest";
import { ingestSouls } from "./souls";
import { discoverReleases, isReleased, RELEASE_ROOT } from "./releases";

export interface IngestOptions {
  /** Ingest Day 1..day (cumulative). Omit for every day found. */
  day?: number;
  /** Generate top concerns afterwards (default true). */
  concerns?: boolean;
  /** Regenerate concerns even if nothing changed. */
  regen?: boolean;
}

export interface IngestResult {
  upTo: number;
  cutoff: string;
  changedFiles: number;
  agents: number;
  concerns: { status: "skipped" | "up-to-date" | "generated" | "failed"; top?: { score: number; title: string }[]; error?: string };
}

export class IngestInputError extends Error {}

/** Throws IngestInputError when the requested day does not exist. Used by the API before it starts a job. */
export function resolveDays(day?: number) {
  const releases = discoverReleases();
  if (!releases.length) throw new IngestInputError(`No DayN_* folders found in ${RELEASE_ROOT}`);
  const released = releases.filter((r) => isReleased(r.releasedAt));
  if (!released.length) throw new IngestInputError(`No day has been released yet (Day 1 opens at ${releases[0]!.releasedAt}).`);
  const upTo = day ?? Math.max(...released.map((r) => r.day));
  const target = releases.find((r) => r.day === upTo);
  if (!target) throw new IngestInputError(`Day ${upTo} not found in ${RELEASE_ROOT}`);
  if (!isReleased(target.releasedAt)) throw new IngestInputError(`Day ${upTo} is not released until ${target.releasedAt}.`);
  return { upTo, selected: releases.filter((r) => r.day <= upTo) };
}

/** Ingests days 1..N, then optionally generates concern snapshots in release order. */
export async function runIngest(db: Db, opts: IngestOptions, log: (line: string) => void): Promise<IngestResult> {
  const { upTo, selected } = resolveDays(opts.day);
  log(`Releases: ${RELEASE_ROOT}`);
  let changedFiles = 0;
  for (const r of selected) {
    const res = await ingestRelease(db, r);
    changedFiles += res.added;
    log(`Day ${r.day} (${r.folder}): ${res.added} new file(s), ${res.evidence} evidence rows, ${res.unchanged} unchanged` +
      (res.skipped.length ? `, skipped unsupported: ${res.skipped.join(", ")}` : ""));
  }
  await ingestSouls(db, log);
  const agents = (await selectOne<{ n: number }>(db, "SELECT COUNT(*) AS n FROM agents"))!.n;
  log(`Agents: ${agents} profile(s)`);

  const cutoff = selected.at(-1)!.releasedAt;
  const base = { upTo, cutoff, changedFiles, agents };
  if (opts.concerns === false) return { ...base, concerns: { status: "skipped" } };

  try {
    let top: IngestResult["concerns"]["top"];
    let previousChanged = false;
    for (const { releasedAt } of selected) {
      if (!opts.regen && !previousChanged && !(releasedAt === cutoff && changedFiles)
        && await hasConcerns(db, releasedAt)) continue;

      log(`Generating top concerns as of ${releasedAt}…`);
      const generated = await generateConcerns(db, releasedAt);
      log(`Stored ${generated.stored} ranked concerns${generated.droppedCitations ? ` (dropped ${generated.droppedCitations} invalid citation(s))` : ""}.`);
      generated.top.forEach((c, i) => log(`  ${i + 1}. [${c.score}] ${c.title}`));
      top = generated.top;
      previousChanged = true;
    }
    if (top) return { ...base, concerns: { status: "generated", top } };
    log(`Concerns for ${cutoff} are up to date (pass regen to refresh).`);
    return { ...base, concerns: { status: "up-to-date" } };
  } catch (e) {
    const error = (e as Error).message;
    log(`Concern generation failed: ${error}. Evidence was ingested; retry with regen once the model is reachable.`);
    return { ...base, concerns: { status: "failed", error } };
  }
}
