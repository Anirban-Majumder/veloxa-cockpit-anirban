import { generateConcerns } from "../concerns/generate";
import { hasConcerns } from "../concerns/store";
import { selectOne, type Db } from "../db/client";
import { ingestRelease, syncAgents } from "./ingest";
import { ingestSouls } from "./souls";
import { discoverReleases, isReleased, type Release } from "./releases";

export async function hasDayEvidence(db: Db, day: number): Promise<boolean> {
  return !!await selectOne(db,
    `SELECT 1 FROM evidence e JOIN sources s ON s.id = e.source_id
     WHERE s.release_day = ? LIMIT 1`, day);
}

/** Container startup trusts any evidence for a day as a completed import; manual ingest still checks files. */
export async function initializeData(db: Db, log: (line: string) => void = console.log,
  releases: Release[] = discoverReleases()): Promise<void> {
  const released = releases.filter((release) => isReleased(release.releasedAt));
  if (!released.length) throw new Error("No released packs found in the mounted data/Release_Packs folder.");
  for (const release of released) {
    if (await hasDayEvidence(db, release.day)) {
      log(`Day ${release.day}: evidence exists; skipping import.`);
    } else {
      log(`Day ${release.day}: importing evidence…`);
      await ingestRelease(db, release);
    }
  }
  await syncAgents(db);
  await ingestSouls(db, log);
  for (const release of released) {
    if (!await hasConcerns(db, release.releasedAt)) {
      log(`Day ${release.day}: generating missing concerns…`);
      await generateConcerns(db, release.releasedAt);
    }
  }
}
