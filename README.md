# Veloxa CXO Cockpit

A hackathon prototype for answering company questions from structured records and source evidence. The planned cockpit provides short cited answers, confidence and uncertainty, interviews with 14 grounded people, and an evidence-backed list of concerns.

## Status — 16 November 2026

Ingestion, the database, the API, the Day 2 top-three concerns, the pixel-office UI and streaming analyst/person chat are implemented. The 25-question answer suite is not yet implemented. The agreed stack is React/Vite, Hono on Bun, local Turso and AI SDK streaming with a configurable hosted model. The 14-person roster, seven-table model and persistent per-agent memory are documented in `ARCHITECTURE.md`.

## Run and test

Needs Bun 1.4.4 ([install](https://bun.sh/docs/installation)) and the release pack at `Veloxa_Hackathon_Release_Packs/` (or set `VELOXA_RELEASE_DIR`).

```sh
bun install --frozen-lockfile
cp .env.example .env    # set LLM_BASE_URL and LLM_MODEL (LLM_API_KEY is optional)
bun run dev             # API on :8787 + UI on http://localhost:5173
bun run ingest          # works with or without the dev server running
```

```sh
bun run start           # production: builds the UI and serves it from the API on :8787
bun run typecheck
bun run lint
bun test tests
```

The embedded database allows one process at a time. When the API is running, `bun run ingest` asks it to do the work; otherwise the script ingests directly. Days count only from 10:00 IST on their release date.

## Docker

Requires Docker with Compose. Copy `.env.example` to `.env` and set `GOOGLE_GENERATIVE_AI_API_KEY`, then run:

```sh
docker compose up --build
```

Open http://localhost:8787. Compose mounts the repository's `./data` at `/app/data`, so the release packs, database and chat history stay on the host through container stops, removal and rebuilds. The image contains neither the database nor API keys. Only production dependencies and the built frontend are included in the runtime image.

Startup checks each released day: any evidence row for that day means its entire import is treated as complete, even if files were added or a previous import was interrupted. Days without evidence are ingested. Missing concerns are generated separately; existing concerns are preserved. A generation failure stops startup; rerun the command after fixing the key or model access to retry missing concerns without reimporting evidence. Initialization can take time and incurs model calls on a fresh database. Unreleased packs stay excluded; restart after a new day's release to initialize it.

Do not run the host API against the same database while the container is running. For a deliberate file-by-file refresh, use `docker compose exec cockpit bun scripts/ingest.ts` (the running API owns the database). Stop with `docker compose down`; this leaves `./data` intact.

## Code layout

```
apps/api/src/index.ts       Hono app: routes, error handler, static UI in production
apps/api/src/routes/        one file per resource: chat, concerns, agents, ingest, status
apps/web/src/components/chat/  streaming chat UI (search steps, citations, confidence)
src/ai/                     model setup and generateStructured (AI SDK Output.object)
src/chat/                   chat agent: prompt (config.ts), search tool, history
src/concerns/               top-concern prompt + schema (config.ts), scoring, generation, storage
src/ingestion/              release discovery, parsers, ingest job
src/retrieval/              cutoff-filtered evidence and keyword search
src/db/                     schema, connection and query helpers
```

## Materials and schedule

Source materials are under `Veloxa_Hackathon_Release_Packs/`. Veloxa and its records are fictional. The hackathon email overrides the older candidate brief on schedule and mandatory scope.

- 16 November, 11:59 PM IST: share the public repository link and commit `ARCHITECTURE.md`.
- Commit at least twice daily.
- 17 November: respond to T6a; 18 November: T6b; 19 November: T6c and T6d. Each response is due by 11:59 PM IST on its release day.
- 20 November, 6:00 PM IST: code freeze and final email submission with repository URL, frozen commit hash, and setup/run command.

All packs arrived upfront. Treat each day’s sources as available from 10:00 AM IST on its release date. Friday has no new release.

## Project records

- [Architecture](ARCHITECTURE.md): proposed system and implementation boundaries.
- [Assumptions](ASSUMPTIONS.md): explicit assumptions and revision history.
- [Transcript notes](TRANSCRIPT_NOTES.md): discrepancies and evidence requiring review.
- [Decisions](DECISIONS.md): choices and their rationale.
- [AI log](AI_LOG.md): assistance used, mistakes, and corrections.

## Ingestion and top concerns (Day 2)

Copy `.env.example` to `.env` and set `LLM_BASE_URL` and `LLM_MODEL` (any OpenAI-compatible endpoint; `LLM_API_KEY` is optional and only sent when set). Put the release pack at `Veloxa_Hackathon_Release_Packs/` or set `VELOXA_RELEASE_DIR`.

If the API is running on the same database and release folder, `bun run ingest` posts the job to it and prints its progress (the API's model settings apply). With a different database it ingests locally; with the same database but a different release folder it stops and says so. The same job is available as `POST /api/ingest` (body `{day?, concerns?, regen?}`) with progress at `GET /api/ingest`.

```sh
bun run ingest        # ingest every released day (from 10:00 IST on its date), then generate top concerns
bun run ingest 2      # ingest Day 1 + Day 2 only (cumulative); concerns as of Day 2 10:00 IST
bun run ingest 2 --no-concerns      # evidence only
bun run ingest 2 --regen-concerns   # force concern regeneration
```

- Each `DayN_Ddd_DDMon` folder is treated as released at 10:00 IST on that date. Only `data_room/` and `transcripts/` are ingested; `data_room/templates/` and `brief/` are skipped.
- Re-running is idempotent (`(path, sha256)` per source); a changed file becomes a new source version and the latest version at a cutoff wins.
- Spreadsheet/CSV rows keep structured fields in `evidence.data_json`; documents are split by paragraph/page; emails are one row each.
- Individual payroll rows are tagged `restricted: individual_salary` and never reach the CEO view or the model. In any other passage that mentions pay, amounts are masked; company-wide monthly payroll lines in the GL are kept, since A002 allows totals.
- Concerns: the model proposes candidates with 1–3 factor scores, reasons, uncertainty and evidence IDs; the backend drops unknown citations, computes `2 × impact + urgency + evidence strength`, ranks (ties by urgency, then impact) and stores them per knowledge cutoff. The home page shows the top three with expandable evidence.

## Chat

Chat streams through the AI SDK (`ToolLoopAgent`, `useChat`). Tools: `search_evidence` (both the analyst and people) and, for the analyst, `summarize_table`, which returns counts and per-month trends of large tables, cited as `[T1]`. Pure small talk is answered directly; anything else must search first. The knowledge cutoff, the person's scope and the salary filter are applied inside the tool from the request, never taken from the model. Answers cite records inline as `[E12]`, end with a confidence line, and the UI shows each search step, its results and the cited passages. `GET /api/chat?agent=&cutoff=` returns history, `POST /api/chat` streams a reply, `DELETE /api/chat?agent=` starts a fresh conversation.
