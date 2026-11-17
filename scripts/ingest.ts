/**
 * Usage:
 *   bun run ingest            ingest every day folder found
 *   bun run ingest 2          ingest Day1 + Day2 (cumulative)
 * Flags:
 *   --no-concerns            skip top-concern generation
 *   --regen-concerns         regenerate concerns even if nothing changed
 */
import { openDb, DB_PATH } from "../src/db/client";
import { discoverReleases, RELEASE_ROOT } from "../src/ingestion/releases";
import { ingestRelease } from "../src/ingestion/ingest";
import { generateConcerns } from "../src/concerns/generate";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
if (positional.length > 1 || (positional[0] && !/^\d+$/.test(positional[0]))) {
  console.error("Usage: bun run ingest [day] [--no-concerns] [--regen-concerns]");
  process.exit(2);
}

const releases = discoverReleases();
if (!releases.length) { console.error(`No DayN_* folders found in ${RELEASE_ROOT}`); process.exit(1); }
const upTo = positional[0] ? Number(positional[0]) : Math.max(...releases.map((r) => r.day));
const selected = releases.filter((r) => r.day <= upTo);
if (!selected.some((r) => r.day === upTo)) { console.error(`Day ${upTo} not found in ${RELEASE_ROOT}`); process.exit(1); }

const db = await openDb();
console.log(`Database: ${DB_PATH}\nReleases: ${RELEASE_ROOT}\n`);
let changed = 0;
for (const r of selected) {
  const res = await ingestRelease(db, r);
  changed += res.added;
  console.log(`Day ${r.day} (${r.folder}): ${res.added} new file(s), ${res.evidence} evidence rows, ${res.unchanged} unchanged` +
    (res.skipped.length ? `, skipped unsupported: ${res.skipped.join(", ")}` : ""));
}
const agents = (await (await db.prepare("SELECT COUNT(*) AS n FROM agents")).get()) as { n: number };
console.log(`Agents: ${agents.n} profile(s)`);

const cutoff = selected.at(-1)!.releasedAt;
if (flags.has("--no-concerns")) process.exit(0);
const existing = (await (await db.prepare("SELECT COUNT(*) AS n FROM concerns WHERE knowledge_cutoff = ?")).get(cutoff)) as { n: number };
if (!changed && existing.n && !flags.has("--regen-concerns")) {
  console.log(`\nConcerns for ${cutoff} are up to date (use --regen-concerns to refresh).`);
  process.exit(0);
}
console.log(`\nGenerating top concerns as of ${cutoff}…`);
try {
  const g = await generateConcerns(db, cutoff);
  console.log(`Stored ${g.stored} ranked concerns${g.droppedCitations ? ` (dropped ${g.droppedCitations} invalid citation(s))` : ""}. Top 3:`);
  g.top.forEach((c, i) => console.log(`  ${i + 1}. [${c.score}] ${c.title}`));
} catch (e) {
  console.error(`Concern generation failed: ${(e as Error).message}\nEvidence was ingested; rerun with --regen-concerns once the model is reachable.`);
  process.exit(1);
}
