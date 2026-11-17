# AI Log

## 16 November 2026 (IST)

**Initial understanding.** GPT-6.1 Sol, through the Codex harness in T3 Code, helped review the challenge, explain its requirements and create the project documents. The first review missed the board PDFs and inspected only part of the spreadsheets. The user asked for a complete reread, including installing temporary file readers; that review covered all four supplied day folders. The user corrected the headcount interpretation and chose to leave the conflicting ARR and burn figures unresolved pending better evidence.

**Architecture planning.** The user used the assistant's grilling skill to challenge the design through roughly 50 questions, recorded across 30 numbered decision IDs, including later revisions. The user made the architecture choices and corrected the assistant when it misunderstood the product boundary, proposed temporary agent memory, and overcomplicated the database. The resulting plan ingests daily data-room files and transcripts, keeps per-agent conversation history, and uses unified evidence. The user selected the 14 agents, React/Vite, Hono on Bun, local Turso, AI SDK streaming, and the verification approach. A small Bun–Turso read/write/reopen check passed locally; it was not a performance or cross-platform test.

**Frontend starter.** The assistant checked the official Bun, Vite and Tailwind setup and scaffolded the React/TypeScript starter. The user directed the agreed single-package layout. Build, lint and a browser smoke check passed; the first browser attempt required correcting the Chromium path. The API, ingestion and required answer tests remain to be built.

### AI004 — Schema, per-day ingestion and Day 2 top concerns

- Task: implement the seven-table schema, `bun run ingest [day]` (cumulative per day), and a basic page answering voice note T6a ("tell me what to worry about, top three").
- Implementation: local Turso schema; parsers for xlsx (ExcelJS), csv, docx (fflate XML), pdf (unpdf, per page) and eml (quoted-printable); cutoff-filtered evidence retrieval; salary restriction; concern generation through the AI SDK OpenAI-compatible provider with backend scoring; Hono API; React page.
- Model: the owner's gateway rejected `glm-5.3-flash` for the configured key; the owner chose `gemini-3.5-flash-lite`, which the gateway serves without an API key, so the key is now optional and was commented out in the local `.env`.
- Verification: 10 deterministic `bun test` cases (release dates, idempotent re-ingest, template exclusion, 14 agents, QP decoding, Day 1 cutoff excludes Day 2, payroll rows excluded from the CEO pack, scoring formula and tie-break); typecheck, lint, build; live concern generation for Day 2; headless browser check of the page (3 cards, no page errors).
- Known limits: model output varies between runs; the model proposed only 3 candidates despite being asked for 4–6; citations are filtered to known IDs but not semantically verified (D014).
