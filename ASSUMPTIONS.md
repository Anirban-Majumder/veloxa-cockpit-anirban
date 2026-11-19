# Assumptions

Status: the following entries record the owner's initial judgments. The agreed conversational personas are recorded separately below.

### A001 — Employee count after Siddharth's scheduled exit

- **Status:** accepted working assumption by the owner.
- **Assumption:** There are 18 employees, assuming Siddharth Mehta left as scheduled and no other employee changes occurred after the export. This is an employee count, not a count of contractors.
- **Evidence:** `Employee_Master.xlsx`, Employees sheet, rows 4–22: 19 employee records; row 16: Siddharth's exit date is 31 October and status is “Notice period”; row 1: export dated 31 October and excludes contractors.
- **Confidence:** medium. The calculation follows from the scheduled exit, but the export does not confirm the departure happened or that no later changes occurred. The candidate brief also describes a 180-person company.
- **What would change this:** evidence of a different effective departure date, a cancelled exit, another hire or departure, or a more complete later headcount record. Preserve the original 19-record snapshot.

### A002 — CEO access to individual salary data

- **Status:** accepted by the owner as a system rule based on the CFO's instruction.
- **Rule:** The CEO cockpit may provide payroll totals but must not reveal individual salaries, including through small-group totals or subtraction.
- **Evidence:** `T2_CFO_Call.docx`, paragraph 7: individual salaries must never show up in anything Ananya sees, only totals.
- **Confidence:** high for the stated restriction; the exact implementation of safe aggregation remains to be designed.
- **What would change this:** a later authoritative, applicable change to the instruction or evidence that a particular aggregate discloses individual pay. Record any policy change with its effective and release dates.

### A003 — Atlas GA and hiring status

- **Status:** accepted working interpretation by the owner.
- **Assumption:** As reported in the September board update, Atlas GA was postponed, the revised GA date is unknown, and hiring was paused while the round closed. These are reported statuses, not proof of the situation beyond the report's period.
- **Evidence:** `Board_Update_Apr-Jun_2026.pdf`, page 1: target GA 15 September and search for two backend engineers; `Board_Update_Jul-Sep_2026.pdf`, page 1: GA moved and hiring paused; `GL_Export_Apr-Sep_2026.xlsx`, GL Apr-Sep sheet, row 15: ₹177,000 search fee for two backend roles, described as a 50% advance.
- **Confidence:** high that these were reported; current status and revised GA date are unknown. The advance does not establish that either role was filled.
- **What would change this:** a later reliable release date, hiring decision, hiring outcome, or evidence correcting the board update. Keep the earlier target and advance in the record.

- **Revised:** the revised GA date is known. The Day 3 Jira export, `Jira_Export_ATLAS.xlsx`, Versions sheet, row 2, records Atlas GA moved from 2026-09-15 to **2026-12-15**, changed by Vikram on 2026-09-02. In T5 (Day 3), Vikram calls v3 "on track" with a board date "still September-ish", which conflicts with his own Jira change. The export is believed over the call: it is a system record with a named editor and timestamp. Confidence: high that the target is 15 Dec; how realistic that is remains unknown, especially after Priya's reported resignation (A010).

### A004 — Possible February payroll proration issue

- **Status:** accepted investigation hypothesis by the owner; not a confirmed payroll error.
- **Assumption:** Rahul's February pay warrants checking for possible proration because the register shows 28 payable days despite a 3 February join date.
- **Evidence:** `Employee_Master.xlsx`, Employees sheet, row 21; `Payroll_Register_Jan-Mar_2026.xlsx`, Payroll Q4 sheet, row 39; `01.eml` through `03.eml`: January sheet reused, Rahul questions partial-month pay, and Fatima says she will check.
- **Confidence:** high that further investigation is warranted; low that an overpayment occurred without payroll policy or adjustments.
- **What would change this:** the applicable proration policy, payroll adjustments, or Fatima's completed investigation. Do not calculate a correction or disclose individual pay to the CEO.

### A005 — Transcript names matched to employee records

- **Status:** accepted by the owner.
- **Assumption:** T1's “Pria” is **Priya Nair (VX007)**; T2's “Kartik” is **Karthik Subramanian (VX010)**; and T2's “Fatima Shaikh” is **Fatima Sheikh (VX014)**. Use the exact employee-master names as canonical names and retain the transcript spellings as aliases.
- **Evidence:** `T1_CEO_Kickoff_Call.docx`, paragraph 7; `T2_CFO_Call.docx`, paragraph 8; `Employee_Master.xlsx`, Employees sheet, rows 10, 13 and 17 respectively. The names and roles in each transcript correspond to the employee records.
- **Confidence:** high for Karthik and Fatima given their roles; medium-high for Priya given the engineering and routing context. These are interpreted matches, not explicit IDs in the transcripts.
- **What would change this:** a reliable source identifying a different person for any mention, or evidence that a similar name belongs to another relevant employee. Preserve the original wording and revise the affected mapping.

### A006 — Similar vendor names remain separate

- **Status:** accepted by the owner.
- **Assumption:** Treat **Sapphire Events Pvt Ltd**, **Saphire Event Mgmt**, and **Sapphire Residency Hotel** as separate vendor entities until evidence establishes otherwise.
- **Evidence:** `GL_Export_Apr-Sep_2026.xlsx`, GL Apr-Sep sheet, rows 23, 26 and 29 respectively. Their names and descriptions differ; similarity alone does not establish common identity.
- **Confidence:** medium as a cautious working treatment, not proof they are unrelated.
- **What would change this:** a reliable shared legal identifier or other documentary evidence establishing that any records refer to the same entity. Preserve the original vendor names when revising.

### A007 — ARR and burn figures unresolved

- **Status:** unresolved, as decided by the owner. Revised; see the resolution below.
- **Working position:** Preserve the board and transcript figures as attributed claims. Do not select a definitive ARR or monthly burn until the discrepancy is reconciled.
- **Evidence:** `Board_Update_Apr-Jun_2026.pdf`, page 1: recurring ARR ₹5.8 Cr and monthly burn ₹46 L; `Board_Update_Jul-Sep_2026.pdf`, page 1: ₹6.1 Cr and ₹44 L respectively. `T1_CEO_Kickoff_Call.docx`, paragraphs 4 and 8: ARR around ₹42–45 Cr and burn “two point two” without a unit. `T2_CFO_Call.docx`, paragraph 4: start-of-year ARR “forty-eight” without an explicit unit and burn ₹2.2–2.5 L per month. The GL export, GL Apr-Sep sheet row 1, covers selected cost centres only.
- **Confidence:** high in the recorded wording; the correct figures, units, dates and comparability remain uncertain.
- **What would change this:** reliable evidence explaining the figures, units, definitions and reporting periods, or sufficiently complete financial data to reconcile them. Record the owner's reasoning before resolving the conflict.
- **Revised (owner's conclusion):** treat ARR as **₹40–50 Cr** and monthly burn as **₹44 L**.
  - ARR: the CEO (T1: "around forty-two crore, maybe forty-five now") and the CFO (T2: "forty-eight") independently give figures in the same range. The board figure of ₹6.1 Cr comes from the Jul–Sep update sent 6 Oct, about two months before the calls; income may have grown or an investment may have closed since.
  - Burn: ₹44 L from the latest board update, the most recent written figure.
  - Confidence: low-medium. The two transcript figures are machine-transcribed and the CFO's has no unit. Moving from ₹6.1 Cr to ₹40–50 Cr in two months is a large jump that no export explains.
  - What would change this: a later board update, a revenue export, or evidence that the transcripts misheard the figures (for example "4.2 crore" as "forty-two crore"). The board figures stay recorded as attributed claims.

Preserve entries when revised. Add an update with the new status rather than deleting the old reasoning. AI-proposed interpretations are recorded for review in `TRANSCRIPT_NOTES.md`.

For each entry record:

- ID.
- Assumption and status (proposed, accepted, revised, or rejected).
- Source file and exact line/row/paragraph supporting it.
- Confidence and rationale.
- What would change the conclusion.
- Revisions and owner review.

### A008 — Proposed character voices for the 14 agents

- **Status:** accepted by the owner for inclusion in agent system prompts. These are invented character details, not evidence of personality or company facts. They are intended to influence conversational style without labels in the interview.
- **Scope and confidence:** The sources below provide limited starting points, often a single message or a secondhand account. The inferred enduring traits and preferences are creative choices with low evidential confidence. The name match between the T4 transcript's “Ayesha” and Aisha Khan is an interpretation based on the marketing role.
- **Priya's workload:** The owner explicitly chose to include “overloaded.” T5 reports late nights but also records Vikram disputing that anyone is overloaded. Treat overload as an assumption, not an established fact; workload can change over time. It must not be used as evidence in answers about the company.
- **What would change this:** owner review, contradictory reliable evidence, or a decision to revise a character. Preserve the original entry and add a dated revision.

| Person | Agreed soul | Source starting point |
| --- | --- | --- |
| Deepa Joshi | Thoughtful and approachable; listens closely and prefers plain, human language. | Day 2, `T3_Head_of_People_Call.docx`, Key points: “numbers alone hide everything”. |
| Nikhil Bose | Upbeat and persuasive; likes telling a clear, energetic story. | Day 3, `T4_Head_of_Marketing_Call.docx`, Summary: “our best quarter ever for pipeline”; paid search is “going great”. |
| Vikram Menon | Direct and pragmatic; prefers brief, practical conversations and simple explanations. | Day 3, `T5_VP_Engineering_Call.docx`, Summary: “everyone's busy, that's startups”; v3 is “on track, maybe a couple of weeks of buffer needed”. |
| Meera Iyer | Concise and matter-of-fact; prefers clear priorities and straightforward explanations. | Day 2, `06.eml`: “Burn is the priority this quarter.” |
| Arjun Das | Friendly and direct; makes requests politely and suggests practical compromises. | Day 2, `10.eml`: requests permanent remote work and offers to visit Bengaluru monthly. |
| Sneha Kulkarni | Calm and concise; prefers explaining the situation before the next step. | Day 3, `08.eml`: reports a third SEV1 and describes pausing tickets to stabilise the API. |
| Priya Nair | Direct and understated; overloaded, she gets to the point and prefers talking things through. | Day 3, `09.eml`: asks to talk about Atlas ownership; `T5_VP_Engineering_Call.docx`, Summary and Key points: Vikram disputes overload and reports Priya's late nights. |
| Rahul Verma | Polite and curious; asks clear questions and checks his understanding. | Day 1, `02.eml`: politely asks a question and checks “Is that right?” |
| Fatima Sheikh | Brief and courteous; prefers simple replies and a practical tone. | Day 1, `03.eml`: “Will check and get back.” |
| Karthik Subramanian | Concise and straightforward; likes giving a clear update without unnecessary detail. | Day 1, `01.eml`: gives a brief update and points to the register. |
| Rohan Banerjee | Practical and specific; prefers getting to the point with concrete details. | Day 2, `T3_Head_of_People_Call.docx`, Key points: provides hiring figures and a different recollection of training dates. |
| Manoj Kumar | Frank and practical; prefers clear answers and speaking plainly about concerns. | Day 3, `T4_Head_of_Marketing_Call.docx`, Key points: secondhand report that “the summit leads are cold”. |
| Aisha Khan | Bright and focused; prefers concise conversations and clear, concrete examples. | Day 3, `T4_Head_of_Marketing_Call.docx`, Summary: “going great since Ayesha took over”; employee master identifies Aisha's performance marketing role. |
| Lakshmi Pillai | Gentle and discreet; listens carefully and speaks in a reassuring, straightforward way. | Day 2, `T3_Head_of_People_Call.docx`, Key points: Lakshmi “handles exits”; the character traits are creative choices. |

### A009 — Day 4 voice-note mishearings

- **Status:** accepted by the owner.
- **Assumption:** In T6c, "slag messages" means Slack messages. In T6d, "Pria" is Priya Nair (VX007) and "version three" is Atlas, the routing engine v3.
- **Evidence:** `T6c_CEO_Voice_Note.docx` and `T6d_CEO_Voice_Note.docx`, paragraph 3. T5 also writes "Pria" for Priya ("Pria has been doing late nights"). `Board_Update_Apr-Jun_2026.pdf`: "Atlas (routing engine v3)"; `Jira_Export_ATLAS.xlsx`: ATLAS-1 "Core routing engine v3". Only one Priya is in the employee master.
- **Confidence:** high for Priya and v3; medium for Slack (no Slack export exists, so it can't be cross-checked).
- **What would change this:** a second Priya, another product called version three, or a different chat tool named in a later source.

### A010 — Priya's resignation is reported, not confirmed

- **Status:** accepted by the owner.
- **Assumption:** Priya resigned on the morning of 19 Nov 2026, as the CEO said. It is treated as a reported event with low confidence. No notice period or exit date is assumed.
- **Evidence:** `T6d_CEO_Voice_Note.docx`, paragraph 3: "Pria resigned this morning. Notice period two months, I think." The employee master (31 Oct export) lists her as Active. No resignation letter is in the data room, unlike Siddharth's (`Resignation_Letter_SM.pdf`, 15 Sep → last day 31 Oct, about six and a half weeks).
- **Confidence:** medium that she resigned (the CEO speaking first-hand); low for "two months", which she hedged herself.
- **What would change this:** a resignation letter, an HR export with her status and exit date, a notice-period policy, or a retraction.

### A011 — No Slack data exists

- **Status:** accepted by the owner.
- **Assumption:** The cockpit has no Slack messages and no access to Slack. The refusal this leads to is recorded in D038.
- **Evidence:** none of the four releases contains a Slack export; T6c's "slag messages" is read as Slack (A009).
- **Confidence:** high.
- **What would change this:** a Slack export or API access provided by IT.

### A012 — Two git identities are both Priya

- **Status:** accepted by the owner.
- **Assumption:** Commits by `pnair@users.noreply.github.com` are Priya Nair's, as are those by `priya.n@veloxa.in`.
- **Evidence:** `git_log.csv`: 425 commits from `priya.n@veloxa.in`, 163 from `pnair@users.noreply.github.com`. "pnair" matches Priya Nair and the Jira assignee initials "PN"; no other employee has those initials.
- **Confidence:** medium-high. GitHub noreply addresses are a normal way for the same person to commit from a personal setup.
- **What would change this:** another employee or contractor with the username pnair. If wrong, Priya's share of commits drops from 40% to 29%.
