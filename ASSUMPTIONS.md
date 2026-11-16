# Assumptions

## 16 November 2026 (IST)

Status: the following entries record the owner's initial judgments. No invented personal backgrounds have been added.

Paths are relative to `Veloxa_Hackathon_Release_Packs/Day1_Mon_16Nov/`.

### A001 — Employee count after Siddharth's scheduled exit

- **Status:** accepted working assumption by the owner on 16 November 2026.
- **Assumption:** There are 18 employees from 1 November 2026, assuming Siddharth Mehta left as scheduled and no other employee changes occurred after the export. This is an employee count, not a count of contractors.
- **Evidence:** `data_room/hr/Employee_Master.xlsx`, Employees sheet, rows 4–22: 19 employee records; row 16: Siddharth's exit date is 31 October and status is “Notice period”; row 1: export dated 31 October and excludes contractors.
- **Confidence:** medium. The calculation follows from the scheduled exit, but the export does not confirm the departure happened or that no later changes occurred. The candidate brief also describes a 180-person company.
- **What would change this:** evidence of a different effective departure date, a cancelled exit, another hire or departure, or a more complete later headcount record. Preserve the original 19-record snapshot.

### A002 — CEO access to individual salary data

- **Status:** accepted by the owner on 16 November 2026 as a system rule based on the CFO's instruction.
- **Rule:** The CEO cockpit may provide payroll totals but must not reveal individual salaries, including through small-group totals or subtraction.
- **Evidence:** `transcripts/T2_CFO_Call.docx`, paragraph 7: individual salaries must never show up in anything Ananya sees, only totals.
- **Confidence:** high for the stated restriction; the exact implementation of safe aggregation remains to be designed.
- **What would change this:** a later authoritative, applicable change to the instruction or evidence that a particular aggregate discloses individual pay. Record any policy change with its effective and release dates.

### A003 — Atlas GA and hiring status

- **Status:** accepted working interpretation by the owner on 16 November 2026.
- **Assumption:** As reported in the September board update, Atlas GA was postponed, the revised GA date is unknown, and hiring was paused while the round closed. These are reported statuses, not proof of the situation beyond the report's period.
- **Evidence:** `data_room/documents/Board_Update_Apr-Jun_2026.pdf`, page 1: target GA 15 September and search for two backend engineers; `data_room/documents/Board_Update_Jul-Sep_2026.pdf`, page 1: GA moved and hiring paused; `data_room/finance/GL_Export_Apr-Sep_2026.xlsx`, GL Apr-Sep sheet, row 15: ₹177,000 search fee for two backend roles, described as a 50% advance.
- **Confidence:** high that these were reported; current status and revised GA date are unknown. The advance does not establish that either role was filled.
- **What would change this:** a later reliable release date, hiring decision, hiring outcome, or evidence correcting the board update. Keep the earlier target and advance in the record.

### A004 — Possible February payroll proration issue

- **Status:** accepted investigation hypothesis by the owner on 16 November 2026; not a confirmed payroll error.
- **Assumption:** Rahul's February pay warrants checking for possible proration because the register shows 28 payable days despite a 3 February join date.
- **Evidence:** `data_room/hr/Employee_Master.xlsx`, Employees sheet, row 21; `data_room/finance/Payroll_Register_Jan-Mar_2026.xlsx`, Payroll Q4 sheet, row 39; `data_room/email/01.eml` through `03.eml`: January sheet reused, Rahul questions partial-month pay, and Fatima says she will check.
- **Confidence:** high that further investigation is warranted; low that an overpayment occurred without payroll policy or adjustments.
- **What would change this:** the applicable proration policy, payroll adjustments, or Fatima's completed investigation. Do not calculate a correction or disclose individual pay to the CEO.

### A005 — Transcript names matched to employee records

- **Status:** accepted by the owner on 16 November 2026.
- **Assumption:** T1's “Pria” is **Priya Nair (VX007)**; T2's “Kartik” is **Karthik Subramanian (VX010)**; and T2's “Fatima Shaikh” is **Fatima Sheikh (VX014)**. Use the exact employee-master names as canonical names and retain the transcript spellings as aliases.
- **Evidence:** `transcripts/T1_CEO_Kickoff_Call.docx`, paragraph 7; `transcripts/T2_CFO_Call.docx`, paragraph 8; `data_room/hr/Employee_Master.xlsx`, Employees sheet, rows 10, 13 and 17 respectively. The names and roles in each transcript correspond to the employee records.
- **Confidence:** high for Karthik and Fatima given their roles; medium-high for Priya given the engineering and routing context. These are interpreted matches, not explicit IDs in the transcripts.
- **What would change this:** a reliable source identifying a different person for any mention, or evidence that a similar name belongs to another relevant employee. Preserve the original wording and revise the affected mapping.

### A006 — Similar vendor names remain separate

- **Status:** accepted by the owner on 16 November 2026.
- **Assumption:** Treat **Sapphire Events Pvt Ltd**, **Saphire Event Mgmt**, and **Sapphire Residency Hotel** as separate vendor entities until evidence establishes otherwise.
- **Evidence:** `data_room/finance/GL_Export_Apr-Sep_2026.xlsx`, GL Apr-Sep sheet, rows 23, 26 and 29 respectively. Their names and descriptions differ; similarity alone does not establish common identity.
- **Confidence:** medium as a cautious working treatment, not proof they are unrelated.
- **What would change this:** a reliable shared legal identifier or other documentary evidence establishing that any records refer to the same entity. Preserve the original vendor names when revising.

### A007 — ARR and burn figures unresolved

- **Status:** unresolved, as decided by the owner on 16 November 2026.
- **Working position:** Preserve the board and transcript figures as attributed claims. Do not select a definitive ARR or monthly burn until the discrepancy is reconciled.
- **Evidence:** `data_room/documents/Board_Update_Apr-Jun_2026.pdf`, page 1: recurring ARR ₹5.8 Cr and monthly burn ₹46 L; `data_room/documents/Board_Update_Jul-Sep_2026.pdf`, page 1: ₹6.1 Cr and ₹44 L respectively. `transcripts/T1_CEO_Kickoff_Call.docx`, paragraphs 4 and 8: ARR around ₹42–45 Cr and burn “two point two” without a unit. `transcripts/T2_CFO_Call.docx`, paragraph 4: start-of-year ARR “forty-eight” without an explicit unit and burn ₹2.2–2.5 L per month. The GL export, GL Apr-Sep sheet row 1, covers selected cost centres only.
- **Confidence:** high in the recorded wording; the correct figures, units, dates and comparability remain uncertain.
- **What would change this:** reliable evidence explaining the figures, units, definitions and reporting periods, or sufficiently complete financial data to reconcile them. Record the owner's reasoning before resolving the conflict.

Preserve entries when revised. Add a dated update with the new status rather than deleting the old reasoning. AI-proposed interpretations are recorded for review in `TRANSCRIPT_NOTES.md`.

For each entry record:

- ID and date.
- Assumption and status (proposed, accepted, revised, or rejected).
- Source file and exact line/row/paragraph supporting it.
- Confidence and rationale.
- What would change the conclusion.
- Dated revisions and owner review.
