# Decisions

## 16 November 2026 (IST)

### D001 — Start with structured data and conversational evidence retrieval

Status: confirmed by the owner on 16 November 2026; implementation pending.

The cockpit will combine a structured database for people, dates and calculations with searchable source passages. Structured queries and deterministic code handle calculations and date filtering; a language model composes cited answers from retrieved evidence. The owner chose this hybrid approach over relying only on document retrieval so precise calculations and evidence-based conversation can work together. It requires maintaining source links and keeping structured data and passages consistent. The concern ranking can be implemented later, with support included in the initial architecture.

Revision, 16 November 2026: D018 supersedes the calculation responsibility above. The model performs arithmetic; backend date and access filtering remain in code.

Subsequent decisions below settle the framework, roster and ranking. Detailed search implementation, model selection and evidence-access implementation remain open.

### D002 — Database: Turso

Status: selected by the owner on 16 November 2026; implementation pending.

The owner chose Turso after considering SQLite and PostgreSQL, and subsequently chose local database operation for the evaluator. A fresh-clone run must not require a hosted database or its credentials. The specific Turso product is undecided; its local setup, compatibility, retrieval integration and data availability must be verified. The owner's rationale for choosing Turso has not yet been recorded.

### D003 — Backend runtime and language: Bun and TypeScript

Status: confirmed by the owner on 16 November 2026; implementation pending.

Use Bun and TypeScript for the backend. The owner values TypeScript's static type checking and expects low runtime overhead and latency compared with Python. Python was considered for its document-processing ecosystem. TypeScript checks types before runtime when type checking is run; external input still requires runtime validation.

The owner cited [this Bun/Elysia versus Python/FastAPI URL-shortener benchmark](https://medium.com/deno-the-complete-reference/url-shortener-service-benchmarking-bun-elysia-vs-python-fastapi-9e74857eafe1). It reports an advantage for the Bun application in that particular 2023 PostgreSQL workload, but compares full application stacks rather than languages in isolation; its conclusion also refers to Hono although the setup names Elysia. It does not establish latency, overhead or a speed ratio for this local-Turso, retrieval-and-LLM workload. Measure this application's performance if needed.

A local smoke check on the development machine used Bun 1.4.2 and `@tursodatabase/database` 0.8.3 to create a database, insert and query a row, and read it after reopening in a new process. This is not a cross-platform compatibility or performance test. Verify the evaluator's setup and document parsing libraries before relying on them. The backend framework remains undecided.

### D004 — Separate repeatable ingestion

Status: confirmed by the owner on 16 November 2026; implementation pending.

Ingest the supplied source files in a repeatable step before the chatbot runs, storing extracted records with exact source locations in the local database. This avoids parsing PDFs and spreadsheets on each question and makes records available for citation. On-demand parsing was considered as an alternative. The implementation must handle reruns without corrupting or duplicating records, and the degree of automated interpretation remains undecided.

Owner clarification, 16 November 2026: retain the original document and deterministically extracted text, with a vector representation as a possibility. Original storage and initial retrieval were subsequently settled in D005 and D006. This does not settle the review process for entity matches or business conclusions.

### D005 — Original source storage

Status: confirmed by the owner on 16 November 2026; implementation pending.

Keep original files on disk and store a stable path and content hash in the database, instead of storing their bytes there. This keeps the database smaller, enables citations to refer back to originals, and allows changes to files to be detected. Source availability and paths must work on a fresh clone; the evaluator-supplied local release pack is documented in D029.

### D006 — Initial retrieval without embeddings

Status: confirmed by the owner on 16 November 2026; implementation pending.

Start with keyword and structured search over the extracted records, rather than adding vector embeddings immediately. Names, identifiers and precise citations matter in this small dataset; the initial design avoids an embedding model and vector index. Add embeddings if retrieval tests demonstrate an improvement. The search implementation and passage boundaries remain open.

### D007 — Shared implementation for interviewable people

Status: confirmed by the owner on 16 November 2026; implementation pending.

Use one shared agent implementation with a separate profile and evidence for each of the 14 interviewable people, rather than 14 separately maintained implementations. Profiles provide distinct roles and histories while keeping the implementation consistent and easier to change. The roster and detailed implementation remain open; subsequent knowledge and memory decisions are recorded in D008 and D009.

### D008 — Person-agent knowledge boundary

Status: confirmed by the owner on 16 November 2026; implementation pending.

Each person agent may draw on evidence explicitly connected to the person or their work, and broadly shared company information. Treat access to other material as unknown unless a record supports it. Personal-life inventions must be labelled as assumptions and cannot support business claims; salary restrictions continue to apply. This conservative boundary reduces unsupported claims about what someone knows, but requires a defensible way to identify relevant and broadly shared evidence. Those implementation rules remain open; conversation memory is addressed in D009.

### D009 — Interview conversation memory

Status: superseded by D020 on 16 November 2026.

Interview conversations are temporary by default and do not carry new memory into later sessions. Source-backed profiles persist. This reduces the risk of generated conversation being mistaken for company evidence or contaminating point-in-time answers, at the cost of continuity across sessions. Within-session context handling remains to be designed.

Revision: the owner clarified that agents must remember CEO conversations across sessions and days. D020 replaces the temporary-memory approach.

### D010 — AI SDK and hosted models

Status: confirmed by the owner on 16 November 2026 as the initial approach; implementation pending.

Use the AI SDK with hosted models for cockpit and person-agent responses for now. Compared with requiring a local model, this avoids requiring an evaluator to download and run a large model, but introduces network, credential, provider-availability and potential cost dependencies. The owner subsequently selected one configurable provider and model shared by both paths, with its API key supplied through an environment variable. The provider, model and evaluator key provisioning remain undecided. The local database does not require a hosted database or credentials.

### D011 — Hosted model failure behavior

Status: confirmed by the owner on 16 November 2026; implementation pending.

If the API key is absent or the hosted model is unavailable, show a clear error rather than fabricate an answer or silently switch models. Keep non-AI features such as evidence browsing usable where practical. This makes the dependency explicit but means AI responses require a working configured model.

### D012 — Initial retrieval with optional search tool

Status: confirmed by the owner on 16 November 2026; implementation pending.

The backend retrieves relevant evidence before the model call. The model may optionally invoke a search tool for additional evidence; a tool call is not required for every answer. Both retrieval paths enforce the applicable release-date, salary and person-knowledge filters before returning evidence to the model. This gives the model a way to seek more context without unrestricted database access. Tool limits, search mechanics and enforcement still need design and tests.

### D013 — Restricted evidence search tool

Status: confirmed by the owner on 16 November 2026; implementation pending.

The optional search tool accepts a natural-language query and returns matching, filtered evidence with source IDs and locations. It does not execute arbitrary model-generated SQL. Backend code must enforce access and date restrictions for each call; search ranking, result limits and implementation remain open. This reduces unrestricted data access while preserving a way to find additional evidence.

### D014 — Citation validation

Status: confirmed by the owner on 16 November 2026; implementation pending.

For the first version, trust the model's citations rather than validating citation IDs in the backend or rejecting and retrying answers with unknown IDs. Tests should still assess citation accuracy. This keeps the answer path simpler but risks fabricated, unavailable or irrelevant citations; even checking an ID would not establish that a source supports a claim. Revisit if evaluation shows citation errors.

### D015 — User-selected knowledge date

Status: confirmed by the owner on 16 November 2026; implementation pending.

Allow the user to select a knowledge date. Both initial retrieval and optional tool searches must exclude material released after that cutoff, and derived facts and agent context must respect it too. When no date is selected, default to the latest release available in the local dataset. This supports the mandatory point-in-time questions and avoids later material leaking into earlier answers. The input interface remains open; cutoff behavior needs tests.

### D016 — Conflicting sources

Status: confirmed by the owner on 16 November 2026; implementation pending.

Prefer system exports over machine transcripts where they conflict, but report the discrepancy and reduce confidence where appropriate. Preserve the attributed claims and their evidence; source preference alone does not settle a conflict. In particular, ARR and burn remain unresolved under A007 until the owner records a resolution. A general preference is not proof that any individual export is correct, so dates, coverage and source-specific evidence still matter.

### D017 — Confidence labels

Status: confirmed by the owner on 16 November 2026; implementation pending.

Use high, medium and low confidence labels with a short reason based on source quality, agreement and coverage, rather than numeric probabilities. The available evidence does not justify calibrated percentages. The exact criteria and how confidence is assigned remain to be designed and tested.

### D018 — Model-performed calculations

Status: confirmed by the owner on 16 November 2026; implementation pending. Revises D001.

The model performs arithmetic from retrieved evidence rather than relying on predefined backend calculations for supported metrics. This simplifies the initial calculation path but may produce less reproducible or incorrect numerical answers. Numerical tests must check expected results and incomplete coverage. Backend code continues to enforce release-date and access filters; model arithmetic does not resolve conflicting source values.

### D019 — Fixed concern-ranking formula

Status: confirmed by the owner on 16 November 2026; implementation pending.

Use a fixed scoring formula for the ranked concerns view rather than allowing the model to choose the ordering directly. The owner selected business impact, urgency and evidence strength as the three factors and confirmed `score = 2 × impact + urgency + evidence strength`, with each factor scored from 1 to 3. This weights impact most heavily; weak evidence lowers priority without automatically hiding a serious concern. The model proposes concerns and factor scores from filtered evidence; backend code validates the ranges and computes the final scores and ordering. Each concern must retain supporting evidence and uncertainty. Ranking is reproducible for fixed inputs, but model-proposed inputs may vary between runs. This deterministic ranking is separate from model-performed calculations in conversational answers (D018).

Confirmed initial criteria: impact 1/2/3 = limited / team-level / company-or-critical-project; urgency = monitor / act soon / act now; evidence strength = tentative-or-conflicting / direct single-source / corroborated independent sources. Require a short evidence-based reason for every factor score. Break equal total scores by urgency first; further tie handling is deferred to implementation.

Architecture review scope, 16 November 2026: settle the main architecture, tools, tables and flows before discussing further implementation details. Backend and frontend framework selection was subsequently settled in D027.

### D020 — Product inputs and persistent conversation memory

Status: clarified by the owner on 16 November 2026; implementation pending. Supersedes D009.

The product is a website with 14 person agents and a CEO chat interface. Ingest each day's `data_room` folder to populate and update company data. Repository Markdown documentation is for development and review, not product ingestion.

Subsequent clarification, 16 November 2026: also ingest each day's `transcripts` folder, including leadership calls and CEO voice-note transcripts, as attributed runtime evidence under the same release-date rules. A release may contain transcripts without a data room. Product requests in those transcripts still require development changes or written pushback, rather than automatically changing application behavior.

Persist CEO/agent conversations across sessions and days so agents can reference prior discussions. New daily ingestion must preserve this history and earlier evidence. Conversation content records what was said rather than automatically establishing verified company facts. Memory must respect historical knowledge cutoffs and existing privacy boundaries. The owner subsequently confirmed separate memory per agent using `conversations(id, user_id, agent_id, created_at)` and `messages(id, conversation_id, role, content, created_at, knowledge_cutoff)`. An agent retrieves its own earlier CEO conversations; shared company knowledge comes from ingested evidence. How relevant prior messages are selected remains open. This correction makes continuity a core product requirement.

### D021 — Analyst chat and person chats

Status: confirmed by the owner on 16 November 2026; implementation pending.

Provide a general analyst chat that retrieves company evidence directly, alongside individual person chats that use the selected agent’s profile, scoped evidence and separate CEO conversation history. Both paths use the shared AI SDK implementation. Answering general company questions does not require consulting all 14 person agents, keeping the main request flow simpler. Analyst conversation storage was subsequently addressed in D026.

### D022 — Generic JSON records for structured imports

Status: superseded by D023 on 16 November 2026.

Use one generic JSON records table for imported spreadsheet and CSV rows instead of separate typed tables for each domain. Each record retains its source-evidence link. A proposed shape is `records(id, record_type, data_json, evidence_id)`; exact columns remain unconfirmed. This accommodates differing export schemas with fewer tables, but record validation and queries over JSON need explicit handling. Documents and transcripts remain extracted passages rather than being forced into export-shaped records.

### D023 — Unified evidence storage

Status: confirmed direction by the owner on 16 November 2026; implementation pending. Supersedes D022.

Store transcript content and data-room content in the same evidence table. Optional structured JSON can preserve spreadsheet and CSV fields, eliminating the separate records table. Retain source provenance so later phases can distinguish and prioritize evidence from transcripts versus data-room files. Both are sources of attributed evidence, not inherently established facts. Original-file metadata can remain in a sources table referenced by evidence; exact columns remain proposed.

### D024 — Fourteen person-agent roster

Status: selected by the owner on 16 November 2026 from highlighted employee-sheet rows; implementation pending.

Create person agents for Manoj Kumar (VX002), Meera Iyer (VX003), Vikram Menon (VX004), Deepa Joshi (VX005), Nikhil Bose (VX006), Priya Nair (VX007), Arjun Das (VX009), Karthik Subramanian (VX010), Aisha Khan (VX011), Sneha Kulkarni (VX012), Fatima Sheikh (VX014), Rohan Banerjee (VX015), Lakshmi Pillai (VX017) and Rahul Verma (VX018). This covers Engineering, Finance, People & Ops and Marketing, plus the Sales Lead.

Exclude Ananya Rao, Divya Reddy, Siddharth Mehta, Imran Siddiqui and Kavya Narayan from person-agent creation, while retaining their source records. The brief requires 14 people across the four named functions; it does not require a Support agent. The owner chose Manoj rather than the previously proposed Support replacement.

### D025 — Employee fields on agent profiles

Status: confirmed by the owner on 16 November 2026; implementation pending.

Store the employee-sheet fields on the agent profile except Status and Exit Date. The confirmed fields are `employee_id`, `full_name`, `work_email`, `department`, `title`, `manager_id`, `join_date` and `location`. This replaces the proposed minimal identity-only profile. Status and exit date remain in ingested evidence; excluding them from the profile does not erase departure evidence. The owner subsequently selected a `soul` text field rather than `persona_json` for a stable, reviewed personal-life and communication-style persona. Preserve it across daily imports and log invented details in `ASSUMPTIONS.md`. How daily imports refresh the employee fields remains open.

### D026 — Core seven-table structure

Status: agreed in broad terms by the owner on 16 November 2026; exact columns adjustable during implementation.

Use `sources`, `evidence`, `agents`, `conversations`, `messages`, `concerns` and `concern_evidence`. The architecture lists the planned columns. Analyst conversations share the conversation/message tables, with an analyst kind and no person-agent ID. Message content must accommodate AI SDK message parts and tool interactions.

Do not initially add separate records, entities, aliases, claims, conflicts or assumptions tables. Evidence metadata can hold agent associations, aliases and conflict notes, while structured source fields remain distinct in optional JSON. Documentation remains the development review log. The concern-evidence join table retains traceable support for rankings. This favors a small schema over separately normalized review and identity models; JSON metadata validation remains an implementation responsibility.

### D027 — React frontend and single-container deployment

Status: required by the owner on 16 November 2026; framework selection pending.

Use React for the website and package the application in one Docker container. The backend and local Turso database run in that container; hosted model calls remain external. Persistent mounted storage is needed for database, original sources and conversation history. React build tooling and the backend framework remain open; a single container does not require separate frontend and backend server processes.

### D027 — React/Vite UI, Hono/Bun API and AI SDK streaming

Status: selected by the owner on 16 November 2026; implementation pending.

Use React with Vite for the UI, Hono on Bun for the API, and the AI SDK for streamed model responses. This replaces the deferred Next.js/T3 options. Keep database access, model credentials, evidence filtering and conversation persistence in the API. Ingestion remains a separate command. Exact repository directories, local startup commands and integration compatibility remain to be verified during setup.

### D028 — Single-package repository layout

Status: confirmed by the owner on 16 November 2026; implementation pending.

Use one root package rather than Bun workspaces or a separate core package. Put UI/API entry points in `apps/web` and `apps/api`, shared server modules under `src/{db,ingestion,retrieval,agents,ai,concerns}`, ingestion/start entry points under `scripts`, and verification under `tests/{fixtures,questions}`. Keep the local database under ignored `data/`. API and ingestion reuse ordinary imports from `src/`; the frontend accesses server functionality through HTTP. This avoids package-management overhead for a single application. Root commands will handle startup, ingestion and tests; exact names and setup behavior remain to be implemented.

### D029 — Fresh-clone data and credential prerequisites

Status: confirmed by the owner on 16 November 2026; implementation pending.

The evaluator supplies the original release pack at a documented local path and a hosted-model API key through environment variables. With those prerequisites, one command installs dependencies, initializes and ingests the local database, and starts the app. The release pack remains ignored and credentials remain outside Git. Repeated setup must preserve conversation history. This depends on the evaluator supplying the two documented prerequisites rather than shipping source data or credentials in the repository. Exact command names and default release selection remain open.

### D030 — Two-layer verification

Status: confirmed by the owner on 16 November 2026; implementation pending.

One root test command runs deterministic checks for ingestion, filtering, per-agent memory and scoring, plus at least 25 questions through the real chat pipeline with the configured hosted model. At least five questions exercise refusal or uncertainty. Check expected facts, source references and uncertainty instead of exact generated wording. Live tests require an API key and network access, may incur costs and may vary with model output. Test fixtures must isolate conversation history and knowledge cutoffs so earlier runs do not contaminate results. No tests have been implemented or run.

For future decisions record the date, status, alternatives, rationale, consequences, and revision history. Source-trust judgments belong in `TRANSCRIPT_NOTES.md` and require the project owner’s reasoning.
