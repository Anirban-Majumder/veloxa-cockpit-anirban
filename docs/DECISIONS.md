# Decisions

### D001 — Start with structured data and conversational evidence retrieval

Status: confirmed by the owner. Implemented; see the update below.

The cockpit will combine a structured database for people, dates and calculations with searchable source passages. Structured queries and deterministic code handle calculations and date filtering; a language model composes cited answers from retrieved evidence. The owner chose this hybrid approach over relying only on document retrieval so precise calculations and evidence-based conversation can work together. It requires maintaining source links and keeping structured data and passages consistent. The concern ranking can be implemented later, with support included in the initial architecture.

Revision: D018 supersedes the calculation responsibility above. The model performs arithmetic; backend date and access filtering remain in code.

Subsequent decisions below settle the framework, roster and ranking. Detailed search implementation, model selection and evidence-access implementation remain open.

Update (implemented): structured fields live in `evidence.data_json` beside the passage text, so one table serves both. Calculations moved to the model (D018); date and access filters stayed in code (`retrieval`).

### D002 — Database: Turso

Status: selected by the owner. Implemented; see the update below.

The owner chose Turso after considering SQLite and PostgreSQL, and subsequently chose local database operation for the evaluator. A fresh-clone run must not require a hosted database or its credentials. The specific Turso product is undecided; its local setup, compatibility, retrieval integration and data availability must be verified. Rationale (owner): this is a single-user application, so it does not need a server database such as PostgreSQL or MongoDB; an embedded file database is enough. Turso was chosen over plain SQLite because it keeps SQLite's file format and SQL while adding features SQLite lacks, including built-in vector search, which keeps embeddings available (D006) without adding a second store.

Update (implemented): `database` opens one local file, `veloxa.db`. Only the API process opens it; `bun run ingest` hands work to the running API. Vector search is not used yet (D006).

### D003 — Backend runtime and language: Bun and TypeScript

Status: confirmed by the owner. Implemented.

Use Bun and TypeScript for the backend. Python was considered for its document-processing libraries.

Rationale:
- One language across the API, the ingestion scripts and the React UI, so request and response types are shared and one `bun run typecheck` covers the whole system.
- Bun runs TypeScript directly with no build step, and includes the package manager and test runner (`bun test`), so a fresh clone needs one tool.
- The AI SDK, which streams chat to the UI, is a TypeScript library.

Consequences: TypeScript types check code, not input; request bodies are still validated at runtime with zod. Document parsing relies on JavaScript libraries for xlsx, docx, pdf and eml, which handled all four release packs.

### D004 — Separate repeatable ingestion

Status: confirmed by the owner. Implemented; see the update below.

Ingest the supplied source files in a repeatable step before the chatbot runs, storing extracted records with exact source locations in the local database. This avoids parsing PDFs and spreadsheets on each question and makes records available for citation. On-demand parsing was considered as an alternative. The implementation must handle reruns without corrupting or duplicating records, and the degree of automated interpretation remains undecided.

Owner clarification: retain the original document and deterministically extracted text, with a vector representation as a possibility. Original storage and initial retrieval were subsequently settled in D005 and D006. This does not settle the review process for entity matches or business conclusions.

Update (implemented): `bun run ingest` (also `POST /api/ingest` and container start). Re-runs are idempotent on path + sha256; a changed file becomes a new source version, and the latest version at a cutoff wins.

### D005 — Original source storage

Status: confirmed by the owner. Implemented; see the update below.

Keep original files on disk and store a stable path and content hash in the database, instead of storing their bytes there. This keeps the database smaller, enables citations to refer back to originals, and allows changes to files to be detected. Source availability and paths must work on a fresh clone; the evaluator-supplied local release pack is documented in D029.

Update (implemented): `sources.path` and `sources.sha256`; evidence rows keep an exact locator (sheet and row, page, paragraph).

### D006 — Initial retrieval without embeddings

Status: confirmed by the owner. Implemented; see the update below.

Start with keyword and structured search over the extracted records, rather than adding vector embeddings immediately. Names, identifiers and precise citations matter in this small dataset; the initial design avoids an embedding model and vector index. Add embeddings if retrieval tests demonstrate an improvement. The search implementation and passage boundaries remain open.

Update (implemented): TF-IDF keyword search with stemming and transcript-spelling aliases (`search.ts`). Export rows score slightly above transcripts (D016). No embeddings; no retrieval test has shown a need yet.

### D007 — Shared implementation for interviewable people

Status: confirmed by the owner. Implemented; see the update below.

Use one shared agent implementation with a separate profile and evidence for each of the 14 interviewable people, rather than 14 separately maintained implementations. Profiles provide distinct roles and histories while keeping the implementation consistent and easier to change. The roster and detailed implementation remain open; subsequent knowledge and memory decisions are recorded in D008 and D009.

Update (implemented): one `ToolLoopAgent` (`agent.ts`) serves all 14 people, each with their own profile, soul, working brief and conversation history.

### D008 — Person-agent knowledge boundary

Status: confirmed by the owner. Implemented; see the update below.

Each person agent may draw on evidence explicitly connected to the person or their work, and broadly shared company information. Treat access to other material as unknown unless a record supports it. Personal-life inventions must be labelled as assumptions and cannot support business claims; salary restrictions continue to apply. This conservative boundary reduces unsupported claims about what someone knows, but requires a defensible way to identify relevant and broadly shared evidence. Those implementation rules remain open; conversation memory is addressed in D009.

Update (implemented): `scopedEvidence` (`search.ts`) keeps only rows connected to the person: email they sent, received or were copied on; calls they spoke in; their own, their manager's and their reports' employee rows; and Jira, git, on-call, incident and leave rows naming them.

### D009 — Interview conversation memory

Status: superseded by D020.

Interview conversations are temporary by default and do not carry new memory into later sessions. Source-backed profiles persist. This reduces the risk of generated conversation being mistaken for company evidence or contaminating point-in-time answers, at the cost of continuity across sessions. Within-session context handling remains to be designed.

Revision: the owner clarified that agents must remember CEO conversations across sessions and days. D020 replaces the temporary-memory approach.

### D010 — AI SDK and hosted models

Status: confirmed by the owner as the initial approach. Implemented; see the update below.

Use the AI SDK with hosted models for cockpit and person-agent responses for now. Compared with requiring a local model, this avoids requiring an evaluator to download and run a large model, but introduces network, credential, provider-availability and potential cost dependencies. The owner subsequently selected one configurable provider and model shared by both paths, with its API key supplied through an environment variable. The provider, model and evaluator key provisioning remain undecided. The local database does not require a hosted database or credentials.

Update: the provider is Gemini (D032).

### D011 — Hosted model failure behavior

Status: confirmed by the owner. Implemented; see the update below.

If the API key is absent or the hosted model is unavailable, show a clear error rather than fabricate an answer or silently switch models. Keep non-AI features such as evidence browsing usable where practical. This makes the dependency explicit but means AI responses require a working configured model.

Update (implemented): without a key, the model setup throws "Model not configured" and the chat shows that error; no fallback model is used.

### D012 — Initial retrieval with optional search tool

Status: confirmed by the owner. Implemented; see the update below.

The backend retrieves relevant evidence before the model call. The model may optionally invoke a search tool for additional evidence; a tool call is not required for every answer. Both retrieval paths enforce the applicable release-date, salary and person-knowledge filters before returning evidence to the model. This gives the model a way to seek more context without unrestricted database access. Tool limits, search mechanics and enforcement still need design and tests.

Update (implemented, revised): person agents get their working brief up front instead of a search; the analyst gets deterministic summaries of large tables. Any question that is not small talk must search before answering if no brief evidence was supplied. Filters are applied inside the tools.

### D013 — Restricted evidence search tool

Status: confirmed by the owner. Implemented; see the update below.

The optional search tool accepts a natural-language query and returns matching, filtered evidence with source IDs and locations. It does not execute arbitrary model-generated SQL. Backend code must enforce access and date restrictions for each call; search ranking, result limits and implementation remain open. This reduces unrestricted data access while preserving a way to find additional evidence.

Update (implemented): `search_evidence` for everyone and `summarize_table` for the analyst (`tools.ts`). Cutoff, person scope and pay rules come from the request, never from the model. Each agent turn is capped at 3 steps.

### D014 — Citation validation

Status: confirmed by the owner. Implemented; see the update below.

For the first version, trust the model's citations rather than validating citation IDs in the backend or rejecting and retrying answers with unknown IDs. Tests should still assess citation accuracy. This keeps the answer path simpler but risks fabricated, unavailable or irrelevant citations; even checking an ID would not establish that a source supports a claim. Revisit if evaluation shows citation errors.

Update (finding, not changed): the live eval caught a citation error. Asked who her manager is, Priya's agent answered correctly (Vikram) but cited Vikram's own employee row instead of her row that records "Manager ID: VX004". The eval keeps this as a failure. Answers are still not checked at runtime; concerns are, since a second pass checks each claim against the rows it cites (D019).

### D015 — User-selected knowledge date

Status: confirmed by the owner. Implemented; see the update below.

Allow the user to select a knowledge date. Both initial retrieval and optional tool searches must exclude material released after that cutoff, and derived facts and agent context must respect it too. When no date is selected, default to the latest release available in the local dataset. This supports the mandatory point-in-time questions and avoids later material leaking into earlier answers. The input interface remains open; cutoff behavior needs tests.

Update (implemented): the dashboard date selects the cutoff, and dates written in the question narrow it further but never widen it (D037). `evidenceAtCutoff` applies it to search, briefs, concerns and stored conversations.

### D016 — Conflicting sources

Status: confirmed by the owner. Implemented; see the update below.

Prefer system exports over machine transcripts where they conflict, but report the discrepancy and reduce confidence where appropriate. Preserve the attributed claims and their evidence; source preference alone does not settle a conflict. In particular, ARR and burn remain unresolved under A007 until the owner records a resolution. A general preference is not proof that any individual export is correct, so dates, coverage and source-specific evidence still matter.

Update (implemented): the answer prompt says exports are more reliable than machine transcripts and requires "the sources disagree" with both sides cited when they conflict. Search ranks export rows slightly higher.

### D017 — Confidence labels

Status: confirmed by the owner. Implemented; see the update below.

Use high, medium and low confidence labels with a short reason based on source quality, agreement and coverage, rather than numeric probabilities. The available evidence does not justify calibrated percentages. The exact criteria and how confidence is assigned remain to be designed and tested.

Update (implemented): every evidence-based answer ends with `Confidence: high|medium|low — reason`. High means corroborated exports; medium, a single source or minor gaps; low, transcript-only, conflicting or partial.

### D018 — Model-performed calculations

Status: confirmed by the owner. Implemented; see the update below. Revises D001.

The model performs arithmetic from retrieved evidence rather than relying on predefined backend calculations for supported metrics. This simplifies the initial calculation path but may produce less reproducible or incorrect numerical answers. Numerical tests must check expected results and incomplete coverage. Backend code continues to enforce release-date and access filters; model arithmetic does not resolve conflicting source values.

Update (implemented): arithmetic is done by the model in the answer. For large tables, the analyst's `summarize_table` tool supplies deterministic counts and monthly totals.

### D019 — Fixed concern-ranking formula

Status: confirmed by the owner. Implemented; see the update below.

Use a fixed scoring formula for the ranked concerns view rather than allowing the model to choose the ordering directly. The owner selected business impact, urgency and evidence strength as the three factors and confirmed `score = 2 × impact + urgency + evidence strength`, with each factor scored from 1 to 3. This weights impact most heavily; weak evidence lowers priority without automatically hiding a serious concern. The model proposes concerns and factor scores from filtered evidence; backend code validates the ranges and computes the final scores and ordering. Each concern must retain supporting evidence and uncertainty. Ranking is reproducible for fixed inputs, but model-proposed inputs may vary between runs. This deterministic ranking is separate from model-performed calculations in conversational answers (D018).

Confirmed initial criteria: impact 1/2/3 = limited / team-level / company-or-critical-project; urgency = monitor / act soon / act now; evidence strength = tentative-or-conflicting / direct single-source / corroborated independent sources. Require a short evidence-based reason for every factor score. Break equal total scores by urgency first; further tie handling is deferred to implementation.

Architecture review scope: settle the main architecture, tools, tables and flows before discussing further implementation details. Backend and frontend framework selection was subsequently settled in D027.

Update (implemented): `concerns`. A second model pass checks each claim against only the rows it cites, and concerns with invalid citations are dropped. Ties break on urgency, then impact. The whiteboard shows the top three; all are stored.

### D020 — Product inputs and persistent conversation memory

Status: clarified by the owner. Implemented; see the update below. Supersedes D009.

The product is a website with 14 person agents and a CEO chat interface. Ingest each day's `data_room` folder to populate and update company data. Repository Markdown documentation is for development and review, not product ingestion.

Subsequent clarification: also ingest each day's `transcripts` folder, including leadership calls and CEO voice-note transcripts, as attributed runtime evidence under the same release-date rules. A release may contain transcripts without a data room. Product requests in those transcripts still require development changes or written pushback, rather than automatically changing application behavior.

Persist CEO/agent conversations across sessions and days so agents can reference prior discussions. New daily ingestion must preserve this history and earlier evidence. Conversation content records what was said rather than automatically establishing verified company facts. Memory must respect historical knowledge cutoffs and existing privacy boundaries. The owner subsequently confirmed separate memory per agent using `conversations(id, user_id, agent_id, created_at)` and `messages(id, conversation_id, role, content, created_at, knowledge_cutoff)`. An agent retrieves its own earlier CEO conversations; shared company knowledge comes from ingested evidence. How relevant prior messages are selected remains open. This correction makes continuity a core product requirement.

Update (implemented): conversations and messages persist in the database. A person agent gets a summary of up to 12 earlier messages from its own conversations before the cutoff (D037).

### D021 — Analyst chat and person chats

Status: confirmed by the owner. Implemented; see the update below.

Provide a general analyst chat that retrieves company evidence directly, alongside individual person chats that use the selected agent’s profile, scoped evidence and separate CEO conversation history. Both paths use the shared AI SDK implementation. Answering general company questions does not require consulting all 14 person agents, keeping the main request flow simpler. Analyst conversation storage was subsequently addressed in D026.

Update (implemented): the analyst chat and the 14 person chats share one agent implementation and one conversations table.

### D022 — Generic JSON records for structured imports

Status: superseded by D023.

Use one generic JSON records table for imported spreadsheet and CSV rows instead of separate typed tables for each domain. Each record retains its source-evidence link. A proposed shape is `records(id, record_type, data_json, evidence_id)`; exact columns remain unconfirmed. This accommodates differing export schemas with fewer tables, but record validation and queries over JSON need explicit handling. Documents and transcripts remain extracted passages rather than being forced into export-shaped records.

### D023 — Unified evidence storage

Status: confirmed direction by the owner. Implemented; see the update below. Supersedes D022.

Store transcript content and data-room content in the same evidence table. Optional structured JSON can preserve spreadsheet and CSV fields, eliminating the separate records table. Retain source provenance so later phases can distinguish and prioritize evidence from transcripts versus data-room files. Both are sources of attributed evidence, not inherently established facts. Original-file metadata can remain in a sources table referenced by evidence; exact columns remain proposed.

Update (implemented): the `evidence` table holds transcript and data-room rows; `sources.source_kind` distinguishes them.

### D024 — Fourteen person-agent roster

Status: selected by the owner from highlighted employee-sheet rows. Implemented; see the update below.

Create person agents for Manoj Kumar (VX002), Meera Iyer (VX003), Vikram Menon (VX004), Deepa Joshi (VX005), Nikhil Bose (VX006), Priya Nair (VX007), Arjun Das (VX009), Karthik Subramanian (VX010), Aisha Khan (VX011), Sneha Kulkarni (VX012), Fatima Sheikh (VX014), Rohan Banerjee (VX015), Lakshmi Pillai (VX017) and Rahul Verma (VX018). This covers Engineering, Finance, People & Ops and Marketing, plus the Sales Lead.

Exclude Ananya Rao, Divya Reddy, Siddharth Mehta, Imran Siddiqui and Kavya Narayan from person-agent creation, while retaining their source records. The brief requires 14 people across the four named functions; it does not require a Support agent. The owner chose Manoj rather than the previously proposed Support replacement.

Update (implemented): these 14 are the agents; the others remain evidence and appear in relationships without an interview.

### D025 — Employee fields on agent profiles

Status: confirmed by the owner. Implemented; see the update below.

Store the employee-sheet fields on the agent profile except Status and Exit Date. The confirmed fields are `employee_id`, `full_name`, `work_email`, `department`, `title`, `manager_id`, `join_date` and `location`. This replaces the proposed minimal identity-only profile. Status and exit date remain in ingested evidence; excluding them from the profile does not erase departure evidence. The owner subsequently selected a `soul` text field rather than `persona_json` for a stable, reviewed personal-life and communication-style persona. Preserve it across daily imports and log invented details in `ASSUMPTIONS.md`. How daily imports refresh the employee fields remains open.

Update: revised by D033; status and exit date are now dated profile fields.

### D026 — Core seven-table structure

Status: agreed in broad terms by the owner; exact columns adjustable during implementation.

Use `sources`, `evidence`, `agents`, `conversations`, `messages`, `concerns` and `concern_evidence`. The architecture lists the planned columns. Analyst conversations share the conversation/message tables, with an analyst kind and no person-agent ID. Message content must accommodate AI SDK message parts and tool interactions.

Do not initially add separate records, entities, aliases, claims, conflicts or assumptions tables. Evidence metadata can hold agent associations, aliases and conflict notes, while structured source fields remain distinct in optional JSON. Documentation remains the development review log. The concern-evidence join table retains traceable support for rankings. This favors a small schema over separately normalized review and identity models; JSON metadata validation remains an implementation responsibility.

Update (implemented): the seven tables plus `agent_profiles` (D033), eight in all.

### D027 — React/Vite UI, Hono/Bun API, AI SDK streaming and a single container

Status: selected by the owner. Implemented; see the update below.

Use React with Vite for the UI, Hono on Bun for the API, and the AI SDK for streamed model responses. This replaces the deferred Next.js/T3 options. Keep database access, model credentials, evidence filtering and conversation persistence in the API. Ingestion remains a separate command. Exact repository directories, local startup commands and integration compatibility remain to be verified during setup.

Merged: the owner also required React and one Docker container holding the API, the built UI and the local database, with hosted model calls outside it and the database, sources and conversations in mounted storage. Update (implemented): `Dockerfile` and `compose.yaml`; `data` is mounted at `data`, and `GOOGLE_GENERATIVE_AI_API_KEY=<key> docker compose up --build` sets up and runs it from a fresh clone.

### D028 — Single-package repository layout

Status: confirmed by the owner. Implemented; see the update below.

Use one root package rather than Bun workspaces or a separate core package. Put the UI and API entry points in separate app folders, shared server modules (db, ingestion, retrieval, agents, ai, concerns) in one shared source folder, ingestion and start entry points in scripts, and verification under tests. Keep the local database in an ignored data folder. API and ingestion reuse ordinary imports from `src`; the frontend accesses server functionality through HTTP. This avoids package-management overhead for a single application. Root commands will handle startup, ingestion and tests; exact names and setup behavior remain to be implemented.

Update (implemented): as described, except the live questions live in `eval-questions.ts` rather than `questions`.

### D029 — Fresh-clone data and credential prerequisites

Status: confirmed by the owner. Implemented; see the update below.

The evaluator supplies the original release pack at a documented local path and a hosted-model API key through environment variables. With those prerequisites, one command installs dependencies, initializes and ingests the local database, and starts the app. The release pack remains ignored and credentials remain outside Git. Repeated setup must preserve conversation history. This depends on the evaluator supplying the two documented prerequisites rather than shipping source data or credentials in the repository. Exact command names and default release selection remain open.

Update: revised by D032; the release packs are now committed, so only the API key is needed.

### D030 — Two-layer verification

Status: confirmed by the owner. Implemented; see the update below.

One root test command runs deterministic checks for ingestion, filtering, per-agent memory and scoring, plus at least 25 questions through the real chat pipeline with the configured hosted model. At least five questions exercise refusal or uncertainty. Check expected facts, source references and uncertainty instead of exact generated wording. Live tests require an API key and network access, may incur costs and may vary with model output. Test fixtures must isolate conversation history and knowledge cutoffs so earlier runs do not contaminate results. No tests have been implemented or run.

For future decisions record the date, status, alternatives, rationale, consequences, and revision history. Source-trust judgments belong in `TRANSCRIPT_NOTES.md` and require the project owner’s reasoning.

Update (implemented, revised by D037): the two layers are two commands. `bun test tests` runs the deterministic tests. `bun run eval` runs 26 live questions, 10 of them testing refusal or uncertainty, checked by fixed rules with no LLM judge.

### D031 — Ingest each day's release at 10:00 AM IST

Status: confirmed by the owner.

Ingest each day folder as soon as it is released: 10:00 AM IST on its date, per the hackathon email's timeline ("Treat as released at 10:00 AM"). Day 1 is ingested on Mon 16 Nov, Day 2 on Tue 17 Nov, Day 3 on Wed 18 Nov and Day 4 on Thu 19 Nov, each with `bun run ingest <day>`. Top concerns are regenerated at that point for the new knowledge cutoff. All folders arrived together in one zip, but a day's material is not ingested or used before its release time.

Consequences: each day's voice-note response and top three use only material released up to that day (for example, T6a on Day 2 uses Day 1 + Day 2). Earlier cutoffs stay queryable, and later material must not leak into them (D015). By submission, all four days are ingested, as the email requires.

### D032 — Release packs committed to the repository, Gemini as the model provider

Status: confirmed by the owner. Revises D029.

The four day folders are copied to `Release_Packs` and committed, so a fresh clone needs only an API key. The challenge email stays out of the repository. The release time is 10:00 IST on the date in each folder's name (D031), and nothing else.

The model is Gemini through Google AI Studio (`google`), replacing the generic OpenAI-compatible endpoint. Settings: `GOOGLE_GENERATIVE_AI_API_KEY`, and `GEMINI_MODEL` (default `gemini-3.5-flash-lite`). The first default, `gemini-4-hydrogen`, hit rate limits too often and was too slow for interviews and the eval, so the default was changed; any Gemini model can be set. Structured output always uses Gemini's native JSON schema mode. Small talk in chat runs with low thinking so it answers quickly.

### D033 — Dated agent profiles

Status: confirmed by the owner. Settles the open part of D025; prompted by T6b.

Agent identity (ID, name, email, join date, `soul`) is stored once. Department, title, manager, location, status and exit date are stored per employee export in `agent_profiles`, dated by that export's release. Every read takes the profile as of the selected cutoff, so a reorg changes later views without rewriting earlier ones. A person serving notice stays visible; after their exit date (last working day) they are hidden from that cutoff on, and their history is kept. Status and exit date are now profile fields, revising D025.

Alternatives: overwrite the latest profile (breaks earlier cutoffs); add every employee as an agent (owner declined for now; the four non-roster employees are only mentioned incidentally, apart from Siddharth, who has left). The roster stays as in D024.

### D034 — Office relationships and people without agents

Status: implemented.

Draw relationships only for the hovered or keyboard-focused person. List relationships to off-floor people in the card. Draw floor lines only when both people have a position on the floor. Ananya and former employees such as Sid still appear in sourced relationships, with no interview target. Snehal appears only when a record actually supplies a relationship of the supported kinds. Use the original email date when available and label undated transcript items with the pack date. Specific cited passages define the six starting open items. Retain them until a released record establishes closure. On narrow screens the label list sits below the floor so the lines and all labels remain visible.

### D035 — Status age and calendar events

Status: implemented.

Measure status age from the dated source update to the selected calendar date in IST. Leave covers its recorded start and end dates. An on-call week covers seven calendar days beginning on the rota date. Work status may use a work record up to 30 calendar days old, inclusive, and describes it as last recorded. Undated work is excluded from the status icon. The pack date can label an undated relationship report, but it does not make the work itself recent.

### D036 — Requests to the CEO

Status: implemented.

Require an explicit ask in an email addressed directly to Ananya. The supplied packs contain a copied message, a suggestion that Vikram act, and a transcript action item without a direct request. These do not raise a hand. Show one hand per person, with qualifying requests listed newest first. Match replies by subject and participants. Keep the hand when the latest record only acknowledges the request. Remove it when an available reply establishes a decision or the sender withdraws the request. The absence of a reply is shown as “No response found.”

### D037 — Date questions, interview memory and live eval

Status: implemented.

Use the dashboard date as the reference for relative expressions and yearless dates. Bare weekday names use the dashboard's Monday–Sunday week. “Last Monday” means the previous occurrence, including a full week back when the dashboard is already on Monday. When a question names several dates, use the earliest to keep the answer within every named date. Cap that day's end in IST at the exact selected release cutoff. Explicit date questions also filter stored messages by their actual timestamp.

Build working briefs from scoped retrieval, including mail only where the interviewee is a sender, recipient, or copied recipient. Use standalone mail records in person interviews because the compiled printout contains unrelated threads on the same pages. Summarize up to twelve recent messages from the same person's conversations as short excerpts. Historical person answers produced before mail scoping are excluded from prompt memory. Cite the underlying records for company claims.

Run the Gemini eval separately from the Bun unit tests. The eval ingests released packs into an in-memory database so it runs the real evidence and agent pipeline without changing dashboard conversations or the on-disk database.

### D038 — What the cockpit refuses to answer

Status: confirmed by the owner.

| Request | Response | Enforced in | Tested by (`bun run eval`) |
| --- | --- | --- | --- |
| An individual's salary or pay | Refuses; company payroll totals only | `evidence.ts`, `redact.ts`: restricted rows never reach the model; pay amounts in other text are masked (A002) | `individual-pay`, `person-pay` |
| Anything released after the selected or asked date | "I don't know" or no record yet | `evidenceAtCutoff`, point-in-time parser (D015, D037) | `remote-before`, `leave-before`, `incident-before`, `ownership-before`, `future-date` |
| Email the person was not on | Can't recall or discuss it | `scopedEvidence` (D008, D037) | `mail-outsider`, `mail-named-outsider` |
| Something the records don't cover | "I don't know" / "no record"; nothing invented | Answer prompt; a final step forced to admit missing evidence | `silent` |
| Ranking people by who is likely to quit, or showing Slack messages (T6c) | Refused | Not built | none |

Why: individual pay is restricted by the CFO (T2). Later material must not leak into earlier answers (hackathon must-have 5). An agent knowing other people's email would make the 14 people inconsistent with the records. For T6c, there is no Slack export or endpoint access in any release, and a Slack workspace is mostly bot logs, alerts and chit-chat, too large and noisy to judge who might quit.

Rules that sit in code, not in the prompt, hold even if the model ignores instructions. The prompt-only rule (not inventing) is the weakest and is checked only by the eval.

### D039 — Incremental concerns

Status: implemented.

Update the previous briefing using newly released evidence and a bounded set of related older rows. The first briefing uses the full evidence pack.

Why: sending the full history makes daily token cost grow with every release.

Trade-off: an early mistake can carry forward. Each run re-checks cited rows against their full text.

### D040 — Container runs as root

Status: confirmed by the owner, 20 Nov 2026.

The image has no `USER` line, so the app runs as root inside the container.

Why: Compose bind-mounts `./data` from the host, and the API writes `veloxa.db` there. A fixed non-root user inside the image would only work when its UID matches the owner of the cloned folder. On Linux hosts with a different UID, the first start would fail to create the database, breaking the one-command setup the submission is judged on.

Alternatives: a non-root user with `user: "${UID}:${GID}"` in Compose (needs the variables exported on every host), an entrypoint that `chown`s the volume and drops privileges (more moving parts), or a named volume instead of a bind mount (the database is no longer visible in `./data`).

Trade-off: running as non-root limits the damage of a container escape. That matters less here: the port binds to `127.0.0.1` only, the data is fictional, and it is a local evaluation tool. A production deployment should use a non-root user with a named volume.
