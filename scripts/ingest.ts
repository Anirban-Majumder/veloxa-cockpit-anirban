/**
 * Usage:
 *   bun run ingest            ingest every released day
 *   bun run ingest 2          ingest Day1 + Day2 (cumulative)
 * Flags:
 *   --no-concerns            skip top-concern generation
 *   --regen-concerns         regenerate concerns even if nothing changed
 *
 * Only one process may open the database. If the API is running on this same database and release folder,
 * it does the work; otherwise this script does.
 */
import { DB_PATH, openDb } from "../src/db/client";
import { RELEASE_ROOT } from "../src/ingestion/releases";
import { runIngest, type IngestOptions } from "../src/ingestion/run";

const API = process.env.VELOXA_API ?? `http://127.0.0.1:${process.env.PORT ?? 8787}`;

interface Job { id: string; status: "running" | "done" | "failed"; log: string[]; error?: string; result?: { concerns: { status: string } } }
type ApiReply = { status: number; body: { job?: Job; error?: string } };

const options = parseArgs(process.argv.slice(2));
const api = await runningApi();
const ok = api?.database !== DB_PATH ? await ingestHere(options) : await ingestThroughApi(api, options);
process.exit(ok ? 0 : 1);

function parseArgs(args: string[]): IngestOptions {
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const positional = args.filter((a) => !a.startsWith("--"));
  const unknown = [...flags].filter((f) => f !== "--no-concerns" && f !== "--regen-concerns");
  if (unknown.length || positional.length > 1 || (positional[0] && !/^[1-9]\d*$/.test(positional[0]))) {
    console.error("Usage: bun run ingest [day] [--no-concerns] [--regen-concerns]");
    process.exit(2);
  }
  return {
    day: positional[0] ? Number(positional[0]) : undefined,
    concerns: !flags.has("--no-concerns"),
    regen: flags.has("--regen-concerns"),
  };
}

interface ApiStatus { database?: string; releaseRoot?: string }

function runningApi(): Promise<ApiStatus | undefined> {
  return fetch(`${API}/api/status`).then((res) => res.json() as Promise<ApiStatus>, () => undefined);
}

async function ingestHere(opts: IngestOptions): Promise<boolean> {
  try {
    const result = await runIngest(await openDb(), opts, (line) => console.log(line));
    return result.concerns.status !== "failed";
  } catch (error) {
    console.error((error as Error).message);
    return false;
  }
}

async function ingestThroughApi(api: ApiStatus, opts: IngestOptions): Promise<boolean> {
  if (api.releaseRoot !== RELEASE_ROOT) {
    console.error(`The running API owns ${DB_PATH} but reads releases from ${api.releaseRoot}. Stop it, or use the same VELOXA_RELEASE_DIR.`);
    return false;
  }
  console.log(`Using the running API at ${API} (its model settings apply).`);
  const start = await call("/api/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (start.status !== 202) {
    const running = start.status === 409 && start.body.job ? ` (job ${start.body.job.id}); wait for it to finish and run this again` : "";
    console.error(`${start.body.error ?? `API returned ${start.status}`}${running}`);
    return false;
  }

  let job = start.body.job!;
  let printed = 0;
  for (;;) {
    for (; printed < job.log.length; printed++) console.log(job.log[printed]);
    if (job.status !== "running") break;
    await Bun.sleep(1000);
    const poll = await call("/api/ingest");
    if (poll.body.job?.id !== job.id) {
      console.error("The ingest job disappeared (API restarted?).");
      return false;
    }
    job = poll.body.job;
  }
  if (job.status === "failed") console.error(`Ingest failed: ${job.error}`);
  return job.status === "done" && job.result?.concerns.status !== "failed";
}

async function call(path: string, init?: RequestInit): Promise<ApiReply> {
  try {
    const res = await fetch(API + path, init);
    return { status: res.status, body: (await res.json().catch(() => ({}))) as ApiReply["body"] };
  } catch {
    return { status: 0, body: { error: `Lost contact with the API at ${API}.` } };
  }
}
