# Veloxa CXO Cockpit

A hackathon prototype for answering company questions from structured records and source evidence. The planned cockpit provides short cited answers, confidence and uncertainty, interviews with 14 grounded people, and an evidence-backed list of concerns.

## Status — 16 November 2026

The React/Vite/Tailwind frontend starter is implemented and verified. Ingestion, the database schema, the API and the Day 2 top-three-concerns page are implemented. Person/analyst chat and the 25-question answer suite are not yet implemented. The agreed stack is React/Vite, Hono on Bun, local Turso and AI SDK streaming with a configurable hosted model. The 14-person roster, seven-table model and persistent per-agent memory are documented in `ARCHITECTURE.md`.

## Run and test

The current frontend starter needs Bun 1.4.4. Install stable Bun using the [official installation instructions](https://bun.sh/docs/installation), or update an existing installation with `bun upgrade --stable`.

From the repository root:

```sh
bun install --frozen-lockfile
bun run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The starter displays a hello-world page with a working counter and Tailwind styling.

```sh
bun run build      # TypeScript check and production bundle
bun run lint       # Starter lint checks
bun run preview    # Serve the production bundle after building
```

The single root package owns dependencies; the UI lives in `apps/web`. Installed stable versions are Bun 1.4.4, React 19.3.1, Vite 8.3.8 and Tailwind CSS 4.3.5. The committed Bun lockfile records exact dependency resolutions.

Setup follows the official [Bun/Vite guide](https://bun.sh/docs/guides/ecosystem/vite), [Vite React TypeScript template](https://vite.dev/guide/) and [Tailwind Vite installation](https://tailwindcss.com/docs/installation/using-vite). Tailwind uses `@tailwindcss/vite` and `@import "tailwindcss"`; no legacy Tailwind init command is required.

The final full-app setup/run command and answer-test command remain pending. Full setup will require the original release pack at a documented local path and a hosted-model API key supplied through environment variables. One test command will run deterministic checks and at least 25 questions through the live model-backed chat pipeline, including at least five uncertainty or refusal cases.

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

```sh
bun run ingest        # ingest all DayN_* folders, then generate top concerns at the latest cutoff
bun run ingest 2      # ingest Day 1 + Day 2 only (cumulative); concerns as of Day 2 10:00 IST
bun run ingest 2 --no-concerns      # evidence only
bun run ingest 2 --regen-concerns   # force concern regeneration
bun run dev           # API (port 8787) + UI (http://localhost:5173)
bun test tests        # deterministic ingestion, cutoff, privacy and scoring tests
```

- Each `DayN_Ddd_DDMon` folder is treated as released at 10:00 IST on that date. Only `data_room/` and `transcripts/` are ingested; `data_room/templates/` and `brief/` are skipped.
- Re-running is idempotent (`(path, sha256)` per source); a changed file becomes a new source version and the latest version at a cutoff wins.
- Spreadsheet/CSV rows keep structured fields in `evidence.data_json`; documents are split by paragraph/page; emails are one row each.
- Individual payroll rows are tagged `restricted: individual_salary` and never reach the CEO view or the model; only monthly totals over at least 5 employees are passed.
- Concerns: the model proposes candidates with 1–3 factor scores, reasons, uncertainty and evidence IDs; the backend drops unknown citations, computes `2 × impact + urgency + evidence strength`, ranks (ties by urgency, then impact) and stores them per knowledge cutoff. The home page shows the top three with expandable evidence.
