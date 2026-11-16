# Transcript Notes

## 16 November 2026 (IST) — Day One initial review

Interpretations below are AI-proposed unless a dated owner review says otherwise. Observations report source contents. Keep each original entry and append dated revisions.

Paths below are relative to `Veloxa_Hackathon_Release_Packs/`. Spreadsheet row numbers are the actual worksheet row IDs, including blank rows. T1/T2 refer to the Day One transcript files.

### TN001 — Old brief versus current hackathon instructions

- Evidence: root hackathon email, sections 3–4; `Day1_Mon_16Nov/brief/Candidate_Brief.docx`, “Rules of engagement” and “Scope”.
- Observation: the brief describes ten working days, live reviews, and temporal answers/tests as stretch. The email specifies five days, no live sessions, and mandatory temporal answers/tests.
- Proposed handling: use the email for current delivery requirements. Do not carry the older review schedule into the plan.
- Confidence: high; explicit newer challenge instructions. Owner review: pending.

### TN002 — Company size, export size, and agent scope differ

- Evidence: T1, “Summary”: “eighteen people” followed by “one-eighty, give or take”; candidate brief, “The ask”: 180-person company and a 14-person simulation; `Day1_Mon_16Nov/data_room/hr/Employee_Master.xlsx`, sheet1 rows 4–22: 19 employee records; row 1 excludes contractors.
- Observation: 14 agents, 19 exported employees, and stated company size are different quantities. The roster is not necessarily an exhaustive company census.
- Proposed handling: keep all export records; select and document the 14-person agent scope separately. Do not claim a verified total headcount from these records alone.
- Confidence: high for the counts and wording; company-wide headcount remains unverified. Owner review: pending.
- **Owner review, 16 November:** Assume 18 employees after Siddharth's scheduled 31 October exit, subject to the exit occurring and no other changes. Keep the 19-record snapshot and the conflicting brief figure visible; see A001 in `ASSUMPTIONS.md`.

### TN003 — Person-name variants

- Evidence: T1, “Key points”: “Pria”; T2, “Key points”: “Kartik” and “Fatima Shaikh”; Employee Master sheet1 rows 10, 13, 17: Priya Nair (VX007), Karthik Subramanian (VX010), Fatima Sheikh (VX014).
- Observation: similar names and roles suggest aliases or transcription errors.
- Proposed handling: propose mappings using role/context and stable employee IDs, retaining original spellings and supporting evidence. Do not silently replace source text.
- Confidence: medium-high for these proposed mappings; owner review: pending.
- **Owner review, 16 November:** Match Pria to Priya Nair (VX007), Kartik to Karthik Subramanian (VX010), and Fatima Shaikh to Fatima Sheikh (VX014), using employee-master spellings as canonical and preserving original transcript names. See A005 in `ASSUMPTIONS.md`.

### TN004 — Tool names may be misheard

- Evidence: T1, “Key points”/“Action items”: “Jeera”, “Cult Amp”, “hub sport”, “slag”; T2, “Key points”: “Joho books”, “Kayka”; `Day1_Mon_16Nov/data_room/README.txt`: Jira, Culture Amp, Zoho Books, Keka.
- Observation: the README supports several likely tool-name corrections. No Day One HubSpot or Slack export has been established by this review.
- Proposed handling: use supported aliases for retrieval, preserving attribution. Do not invent Slack/HubSpot records or treat a tool mention as proof its data is available.
- Confidence: high for README-listed tools, lower for unsupported inferred names. Owner review: pending.

### TN005 — ARR cannot yet be reconciled

- Evidence: T1, “Summary”: “around forty-two crore, maybe forty-five now”; T2, “Summary”: ARR at the start of the year was “forty-eight”. Day One includes two board-update PDFs, not yet read in this review.
- Observation: the statements differ in value and reference time; T2’s unit is unstated in the summary.
- Proposed handling: preserve both attributed claims; check board figures, units, metric definition, and effective dates before deciding whether they conflict. Do not publish one definitive ARR yet.
- Confidence: high that reconciliation is incomplete. Owner review: pending.
- **Update, 16 November:** Both PDFs have now been read. The Apr–Jun board update reports ₹5.8 Cr ARR and the Jul–Sep update reports ₹6.1 Cr. The owner has not yet decided how to resolve the transcript figures against these reports.
- **Owner review, 16 November:** Mark the ARR discrepancy unresolved and preserve the attributed figures; see A007 in `ASSUMPTIONS.md`.

### TN006 — Burn units and ledger coverage

- Evidence: T1, “Key points”: burn “around two point two”, no unit; T2, “Summary”: “two point two lakhs a month, sometimes two point five”; `Day1_Mon_16Nov/data_room/finance/GL_Export_Apr-Sep_2026.xlsx`, sheet1 row 1: “selected cost centres”.
- Observation: transcript burn units are uncertain and the GL is explicitly partial. Selected expenses alone do not establish company net cash burn or runway.
- Proposed handling: reconcile with board updates and coverage before calculating burn; retain uncertainty rather than guessing a unit or treating the partial GL as complete cash flows.
- Confidence: high on the limitation; correct burn remains unresolved. Owner review: pending.
- **Update, 16 November:** The board updates report monthly burn of ₹46 L for Apr–Jun and ₹44 L for Jul–Sep. Their relation to the transcript figures remains for owner review.
- **Owner review, 16 November:** Mark the burn discrepancy unresolved and preserve the attributed figures; see A007 in `ASSUMPTIONS.md`.

### TN007 — Financial-year label

- Evidence: T2, “Summary”: “April to March”, “FY twenty-six”, with an explicit note that the speaker may have said twenty-seven.
- Observation: the transcript itself flags uncertainty in the label.
- Proposed handling: represent periods with explicit start/end dates; verify the company’s FY naming convention against board updates before assigning a label.
- Confidence: high that the transcript label is uncertain. Owner review: pending.

### TN008 — Individual salary restriction

- Evidence: T2, “Key points”: individual salaries “must never show up in anything Ananya sees, only totals”. The Day One payroll register contains individual salary fields.
- Observation: possession of payroll data does not authorise exposing it through the CEO cockpit.
- Proposed handling: enforce aggregate-only access before constructing model context, including protection against person-specific or revealing aggregate queries. Add refusal tests.
- Confidence: high; explicit instruction. Owner review: pending.
- **Owner review, 16 November:** Accepted aggregate-only CEO access, including protection against revealing totals; see A002 in `ASSUMPTIONS.md`.

### TN009 — Rahul’s February payroll needs investigation

- Evidence: Employee Master sheet1 row 21: Rahul Verma (VX018), join date 3 February 2026. `Day1_Mon_16Nov/data_room/finance/Payroll_Register_Jan-Mar_2026.xlsx`, sheet1 row 39: February has 28 days payable of 28. `Day1_Mon_16Nov/data_room/email/01.eml`, body: Karthik used January’s sheet and added the new joiner while Fatima was out. Emails `02.eml` and `03.eml`: Rahul questions partial-month pay; Fatima says she will check.
- Observation: the join date and full-month payable days warrant checking. The reply does not establish an outcome.
- Proposed handling: flag a possible proration issue, not a confirmed overpayment. Verify payroll policy, effective dates, and adjustments before calculating a correction; keep salary amounts out of CEO-facing responses.
- Confidence: high that an investigation is supported; payroll error unconfirmed. Owner review: pending.
- **Owner review, 16 November:** Accepted as a possible proration issue, not a confirmed overpayment; see A004 in `ASSUMPTIONS.md`.

### TN010 — Employment status at the export boundary

- Evidence: Employee Master sheet1 row 1: exported 31 October 2026; row 16: Siddharth Mehta (VX013), status “Notice period”, exit date 31 October 2026.
- Observation: status and exit date coexist at the snapshot boundary. Whether the exit date is inclusive and whether status was updated are not established.
- Proposed handling: preserve both fields and answer with the snapshot date. Do not silently convert the record to “Active” or “Exited”.
- Confidence: high for the observed fields; interpretation unresolved. Owner review: pending.

## Open review work

- Reconcile the now-read board updates with the transcript financial metrics.
- Review the now-read GL and payroll register for date conventions and coverage.
- Select the exact 14-person simulation roster with an explicit rationale.
- Add owner conclusions and reasoning to each proposed note. Later evidence must receive its own dated entry and release timestamp.
