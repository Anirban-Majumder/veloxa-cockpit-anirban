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

### AI002 — Full release review and architecture grilling

- Tasks: review all supplied day folders and the controlling email; ask one architecture question at a time and record owner decisions.
- Sources: all four supplied day folders were reviewed, including PDF, DOCX, XLSX, CSV and email content. There is no Day Five release folder. Python readers were installed in a temporary environment for source inspection; this corrects the earlier tooling limitation in AI001.
- Decisions: the owner selected the stack, 14-person roster, unified evidence model, persistent per-agent memory, analyst/person chat paths, repository layout, setup prerequisites and two-layer verification plan. The owner retained unresolved ARR/burn discrepancies.
- Corrections: the assistant initially overemphasized implementation details, proposed unnecessary separate record/review tables, and misunderstood the product inputs and desired memory. The owner clarified that daily data-room and transcript folders are ingested, repository Markdown is development documentation, and agents remember CEO conversations across days. Superseded decisions remain in the decision history.
- Compatibility evidence: Bun 1.4.2 with `@tursodatabase/database` 0.8.3 passed a temporary local create/write/read/reopen check. This was not a benchmark, application integration test or cross-platform test.
- Limitations: no application code or automated tests have been implemented. The remaining work includes parser and full-stack integration checks, concrete retrieval/privacy rules and end-to-end verification. Model arithmetic and unvalidated runtime citations were explicit owner choices, with accuracy to be evaluated in tests.
