# AI Log

## 16 November 2026 (IST)

### AI001 — Initial scope and architecture discussion

- Assistant: GPT-6.1 Sol through the Codex harness in T3 Code.
- Tasks: read the hackathon email and Day One text/spreadsheet sources; explain deliverables; propose a small architecture; create the six documentation files at the user’s request.
- Output: proposed design and initial Day One discrepancy notes. No application code or source-trust resolutions have been approved.
- Limitations: Day One board-update PDFs were not extracted because available PDF tooling was absent. Initial spreadsheet inspection was partial; a later targeted read checked the full employee roster and Rahul’s payroll rows. Financial reconciliation remains incomplete.
- Correction: an early description could imply the employee export contains only the 14 simulated people. The export has 19 employee records; the simulation roster still needs selection. The architecture now separates ingestion scope from agent scope.
- Tool correction: the first extraction attempted `python`, which was unavailable; subsequent reads used `python3`. A PDF extraction attempt failed because `pdftotext` was absent. No dependencies were installed.
- Owner review: pending for all proposed business interpretations and source-trust decisions.
