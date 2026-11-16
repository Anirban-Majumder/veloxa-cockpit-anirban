# Architecture

Date: 16 November 2026 (IST)

Status: proposed; not implemented. Stack and detailed schema require owner review.

## Goal

Build a conversational company analyst backed by structured facts and retrievable source evidence. Support 14 interviewable people, cited answers with confidence, a ranked concern view, and point-in-time queries. Keep unsupported conclusions and invented character details distinct from recorded facts.

## Proposed flow

1. Parse spreadsheets, documents, emails, and transcripts into source records with exact locators.
2. Resolve people and project identifiers without discarding original spellings.
3. Store attributed claims, structured records, assumptions, and conflicts.
4. Apply release-date and privacy filters before retrieving evidence for a question.
5. Use structured queries and deterministic calculations for numerical answers; retrieve text for context.
6. Generate a short answer containing citations, confidence, and any unresolved disagreement or missing evidence.

## Data model

The initial storage proposal is SQLite plus source files; the language and UI framework are undecided. Add a vector index only if retrieval quality warrants it.

| Record | Key information |
| --- | --- |
| Source | Stable ID, path, type, release timestamp, original metadata |
| Evidence | Source ID, sheet/row or page/paragraph/message locator, original content |
| Entity and alias | Stable person/project/vendor ID, original identifier, mapping evidence and confidence |
| Claim | Subject, property/value, evidence, attribution, effective/event date, available-at timestamp, confidence |
| Conflict and resolution | Competing claims, status, human rationale, reviewer, revision date |
| Person profile | Role, reporting line, dated status, workload/history evidence, separately labelled fictional background |
| Assumption | Dated proposition, source locator, confidence, revision history, disconfirming evidence |
| Concern | Evidence, affected entities/projects, severity rationale, uncertainty, available-at timestamp |

Keep dated claims rather than overwrite changes in status. Ingest all relevant entities; the 14 simulated people are a selected view, not a limit on the underlying data model. The roster is still to be selected.

## Temporal and privacy boundaries

Event dates describe when something happened; release timestamps describe when the cockpit could know it. Filter evidence and all derived facts, summaries, agent context, and concerns by the requested knowledge cutoff. Unknown or conflicting dates stay explicit. No Day Two or later evidence may affect a Day One answer.

T2 requires aggregate-only payroll information for the CEO. Filter individual salary fields before model context and prevent person-specific salary answers or revealing aggregates. Exact enforcement and allowed aggregation granularity need implementation and tests.

## Agents and concerns

Use one shared agent implementation with 14 distinct profiles and scoped evidence. Profiles must support role, workload, history, and personal life. Invented details are assumptions and cannot substantiate business answers. Lack of records is not evidence of idleness.

Implement the concern view after the first cited-answer path works. Its ranking must cite evidence and expose the rationale and uncertainty. Preserve the ability to reject unsupported requested rankings and record written pushback to voice notes.

## Trust and review

Exports are generally more reliable than machine transcripts, but neither is automatically correct. Preserve source disagreements. AI may surface conflicts; the project owner must approve source-trust resolutions and record their reasoning in `TRANSCRIPT_NOTES.md`.

## Verification and delivery

Build tests for entity aliases, calculations and incomplete coverage, citations, missing evidence, conflicting claims, salary privacy, and release-date leakage. Deliver at least 25 automated questions with expected answers, including at least five uncertainty/refusal cases. Assert evidence and key facts rather than exact generated wording.

Provide one documented fresh-clone setup/run command and one test command. Defer autonomous post-31-October simulation until mandatory scope works.
