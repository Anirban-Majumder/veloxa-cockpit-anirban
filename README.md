# Veloxa CXO Cockpit

A hackathon prototype for answering company questions from structured records and source evidence. The planned cockpit provides short cited answers, confidence and uncertainty, interviews with 14 grounded people, and an evidence-backed list of concerns.

## Status — 16 November 2026

Architecture and evidence review only. No application, ingestion pipeline, or automated tests have been implemented. The agreed stack is React/Vite, Hono on Bun, local Turso and AI SDK streaming with a configurable hosted model. The 14-person roster, seven-table model and persistent per-agent memory are documented in `ARCHITECTURE.md`.

## Run and test

Setup/run command: pending implementation. Test command: pending implementation. Neither is currently available. Setup will require the original release pack at a documented local path and a hosted-model API key supplied through environment variables.

The final submission must work from a fresh clone with one setup/run command after those prerequisites. One test command will run deterministic checks and at least 25 questions through the live model-backed chat pipeline, including at least five uncertainty or refusal cases.

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
