# Veloxa CXO Cockpit

A hackathon prototype for answering company questions from structured records and source evidence. The planned cockpit provides short cited answers, confidence and uncertainty, interviews with 14 grounded people, and an evidence-backed list of concerns.

## Status — 16 November 2026

The React/Vite/Tailwind frontend starter is implemented and verified. The API, ingestion pipeline and automated answer test suite are not implemented. The agreed stack is React/Vite, Hono on Bun, local Turso and AI SDK streaming with a configurable hosted model. The 14-person roster, seven-table model and persistent per-agent memory are documented in `ARCHITECTURE.md`.

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
