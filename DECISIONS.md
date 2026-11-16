# Decisions

## 16 November 2026 (IST)

### D001 — Start with structured data and conversational evidence retrieval

Status: agreed direction; implementation pending.

The user’s chosen starting point is a chatbot backed by structured company data and 14 grounded people. The concern ranking can be implemented later, with support included in the initial architecture. This prioritises a working cited-answer path while retaining the mandatory concern view.

The architecture proposes SQLite and a shared implementation for person agents. These are proposals, not confirmed stack decisions. Language, framework, exact roster, and ranking method remain open.

For future decisions record the date, status, alternatives, rationale, consequences, and revision history. Source-trust judgments belong in `TRANSCRIPT_NOTES.md` and require the project owner’s reasoning.
