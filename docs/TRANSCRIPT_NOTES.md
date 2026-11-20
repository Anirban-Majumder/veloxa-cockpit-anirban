# Transcript Notes

Every call summary and CEO voice note, checked against the data-room exports. Each entry gives the evidence, the contradiction (or "none"), and what I concluded, with a short reason.

Evidence paths are relative to `data/Release_Packs/`. Spreadsheet row numbers are worksheet rows, including blank rows. D016 in the [decision log](DECISIONS.md) gives system exports more weight than machine transcripts. Dates, coverage and corroboration determine what the records can establish. The cockpit attributes conflicting claims and cites both sources. References beginning with A point to the [assumptions log](ASSUMPTIONS.md).

---

## Day 1 — Mon 16 Nov

### Brief vs hackathon email

- **Evidence:** `Day1_Mon_16Nov/brief/Candidate_Brief.docx` ("Rules of engagement", "Scope"); the hackathon email, sections 3–4 (kept outside the repo).
- **Contradiction:** the brief describes ten working days, live reviews, and point-in-time answers and tests as stretch goals. The email gives five days, no live sessions, and makes both mandatory.
- **Conclusion:** follow the email. It is newer and addressed to this run of the challenge.

### T1 — CEO kickoff call

**Headcount: "eighteen people" / "one-eighty"**
- **Evidence:** T1 summary; brief: "180-person company", "start with 14 people"; `Employee_Master.xlsx` rows 4–22: 19 employees, contractors excluded (row 1).
- **Contradiction:** 18, 180 and 19 are three different numbers.
- **Conclusion:** the 31 Oct export lists 19 employees including Siddharth. That leaves 18 after his last working day (A001).

**ARR "around forty-two crore, maybe forty-five now"**
- **Evidence:** T1 summary; T2 "forty-eight"; `Board_Update_Apr-Jun_2026.pdf`: ARR ₹5.8 Cr; `Board_Update_Jul-Sep_2026.pdf`: ₹6.1 Cr.
- **Contradiction:** ₹42–45 Cr (T1), "forty-eight" (T2) and ₹5.8–6.1 Cr (board) are far apart.
- **Conclusion:** the owner's revised A007 uses ₹40–50 Cr as the working ARR range, based on the CEO and CFO calls.

**Burn "around two point two" (no unit)**
- **Evidence:** T1; T2 "two point two lakhs a month, sometimes two point five"; board updates: ₹46 L/month (Apr–Jun), ₹44 L (Jul–Sep); `GL_Export_Apr-Sep_2026.xlsx` row 1: "selected cost centres".
- **Contradiction:** ₹2.2 L is about 20× smaller than the board figure.
- **Conclusion:** the owner's revised A007 uses ₹44 L a month, the latest board-reported burn. Payroll alone is ₹31.75 L a month in the partial GL (rows 5, 9, …), so ₹2.2 L a month cannot be total burn.

**Person names: "Pria", "the new boy Rahul"**
- **Evidence:** T1; `Employee_Master.xlsx` row 10 Priya Nair (VX007, Staff Engineer); row 21 Rahul Verma (VX018, joined 3 Feb 2026).
- **Contradiction:** spelling only.
- **Conclusion:** Pria = Priya Nair (A005). She is the only Priya and an engineer, which fits "holds the routing thing together". Rahul matches the only Rahul, the newest engineer.

**Tool names: "Jeera", "Linear, I think", "Cult Amp", "hub sport", "slag", "Git Hub"**
- **Evidence:** `Day1_Mon_16Nov/data_room/README.txt`: Jira, Culture Amp, Keka, Zoho Books, PagerDuty; T5: "we tried Linear for a month and went back".
- **Contradiction:** T1 is unsure between Linear and Jira.
- **Conclusion:** Jeera = Jira, Cult Amp = Culture Amp, Git Hub = GitHub, "hub sport" = HubSpot and "slag" = Slack .

**"Version three" promised "by the festive season"**
- **Evidence:** T1; Apr–Jun board update: Atlas (routing engine v3) GA 15 Sep; Jira Versions sheet row 2 (Day 3): GA moved to 15 Dec 2026.
- **Contradiction:** none at the time. Day 3 shows the date slipped.
- **Conclusion:** version three = Atlas. The board update calls Atlas "routing engine v3", and Jira ATLAS-1 is "Core routing engine v3".


### T2 — CFO call

**Financial year "FY twenty-six (may have said twenty-seven)"**
- **Evidence:** T2 summary, which flags its own uncertainty.
- **Contradiction:** inside the transcript.
- **Conclusion:** use explicit dates (Apr 2026 – Mar 2027), never an FY label. The transcript itself admits doubt, and dates can't be misheard.

**Names: "Kartik", "Fatima Shaikh"**
- **Evidence:** `Employee_Master.xlsx` row 13 Karthik Subramanian (FP&A Manager, under Meera); row 17 Fatima Sheikh (Accounts & Payroll).
- **Contradiction:** spelling only.
- **Conclusion:** mapped to the export spellings (A005). The roles match "planning" and "accounts and payroll".

**"Doing his CFA, so forecasts are a bit late"**
- **Evidence:** `Leave_Register.xlsx` (Day 2) row 10: K. Subramanian, Exam leave 25–29 May.
- **Contradiction:** none.
- **Conclusion:** the register confirms exam leave on 25–29 May. The exam type and the reason for any forecast delays remain unverified.

**Fatima "out for her wedding, that month was messy"**
- **Evidence:** `Leave_Register.xlsx` row 7: F. Sheikh, Marriage leave 9–27 Feb; `email/01.eml`: Karthik ran Feb payroll "since Fatima is out" using the January sheet; `02.eml`/`03.eml`: Rahul's payslip query, "Will check and get back".
- **Contradiction:** none.
- **Conclusion:** confirmed. The messy month is February, and Rahul raised a possible proration issue on his first payslip (A004). The office keeps the query open until a released record establishes closure (D034).

**Tools: "Joho books", "Kayka"**
- **Evidence:** README.txt: Zoho Books, Keka HRMS.
- **Contradiction:** spelling only.
- **Conclusion:** Joho = Zoho Books, Kayka = Keka, both named in the README.

**Individual salaries "must never show up … only totals"**
- **Evidence:** T2; `Payroll_Register_Jan-Mar_2026.xlsx` has per-person pay.
- **Contradiction:** none, but the data the cockpit holds would break the rule if shown.
- **Conclusion:** enforced in code, so individual pay never reaches the model (A002, D038). It's a direct instruction from the data owner.

**"Hiring freeze if the raise slips"; "the two backend roles"**
- **Evidence:** `Hiring_Tracker.xlsx` (Day 2) rows 6–7: REQ-014/015 On hold 12 Aug; `email/06.eml`: Meera pauses both "until the round closes"; Jul–Sep board update: "Hiring is paused while we close the round"; GL row 15: ₹1.77 L search-fee advance for two backend roles.
- **Contradiction:** T2 speaks of a future, conditional freeze. The records show the pause already happened on 12 Aug.
- **Conclusion:** the tracker, email and board update support the pause. The tracker dates it to 12 Aug, and the call's conditional wording leaves the call date unclear.

**"Nikhil's numbers never match mine"**
- **Evidence:** see T4 marketing spend below.
- **Conclusion:** T4 documents a discrepancy for Apr–Sep. The broader claim about how often the figures differ remains unverified. The office keeps the discrepancy open pending reconciliation (D034).

---

## Day 2 — Tue 17 Nov

### T3 — Head of People call

**Attrition "about twelve, normal for Bangalore"**
- **Evidence:** T3, which itself flags percentage vs headcount vs target; `Employee_Master.xlsx`: one exit (Siddharth, 31 Oct) out of 19.
- **Contradiction:** one exit is about 5%, not 12 people or 12%.
- **Conclusion:** unresolved. The cockpit reports one recorded exit and says the "twelve" can't be checked. The unit is unknown, and the export may not cover the full year's leavers.

**Engineering scores "dipped in the July round"**
- **Evidence:** `Pulse_Survey.xlsx` row 7: Engineering Jul–Sep 2026 engagement 3.1, down from 3.9 (row 6), 4 of 5 responses; `email/11.eml`: Deepa tells Ananya the engineering pulse dropped.
- **Contradiction:** none. "July round" = the Jul–Sep quarter.
- **Conclusion:** confirmed. It is the largest drop of any team; Marketing is next, 3.8 → 3.4.

**Ananya should "see survey comments directly"**
- **Evidence:** `Pulse_Survey.xlsx` every row: "Not shown: team smaller than 6"; `email/11.eml`: Deepa says the team is "too small for me to share comments".
- **Contradiction:** Deepa wants comments shown on the call, but her own export and email withhold them.
- **Conclusion:** comments stay hidden; the cockpit has none to show. The export enforces anonymity, and Deepa's written email agrees with it.

**"Twenty-two open roles in April", "lost six of them in August"**
- **Evidence:** `Hiring_Tracker.xlsx` rows 4–9: six requisitions in total. In April one closed (REQ-011, 2 Apr) and none were open after that. REQ-014/015 went On hold on 12 Aug with 3 and 5 candidates in the pipeline.
- **Contradiction:** 22 open roles vs at most six requisitions; "lost six" vs two paused roles holding eight candidates.
- **Conclusion:** use the tracker counts for the supplied data. The meanings of "twenty-two" and "lost six" remain unresolved.

**Offer acceptance "down to fifty-something"**
- **Evidence:** no offer data in any export.
- **Contradiction:** none to check against.
- **Conclusion:** the cockpit reports that the available records cannot confirm an offer acceptance rate (D038).

**Tools: "Liver", "Kekka", "Cult Amp"**
- **Evidence:** README.txt: "Keka Hire tracker", Keka HRMS, Culture Amp; `Hiring_Tracker.xlsx` row 1: "Keka Hire".
- **Contradiction:** "Liver" doesn't match any listed tool.
- **Conclusion:** Kekka = Keka, Cult Amp = Culture Amp. "Liver" is most likely Lever, but the hiring export is Keka Hire, so the cockpit names Keka Hire as the hiring system.

**HR team: Rohan on hiring, Lakshmi "as HRBP, handles exits"**
- **Evidence:** `Employee_Master.xlsx` row 18 Rohan Banerjee, Talent Partner; row 20 Lakshmi Pillai, HR & Office Executive, joined 6 Oct 2025.
- **Contradiction:** Lakshmi's title is not HRBP.
- **Conclusion:** use the export title and note that she is described as handling exits. A title in an HR system beats a verbal description.

**Sid "has put in his papers"**
- **Evidence:** `Resignation_Letter_SM.pdf`: dated 15 Sep, last day 31 Oct; `Employee_Master.xlsx` row 16: Notice period, exit 31 Oct; `Hiring_Tracker.xlsx` row 8: REQ-016 backfill opened 17 Sep.
- **Contradiction:** none.
- **Conclusion:** confirmed by three records.

**"One engineer I'm worried about" (unnamed)**
- **Evidence:** T3 only.
- **Contradiction:** none.
- **Conclusion:** not attributed to anyone. Guessing a name would invent a fact about a person.

**Manager training "after Diwali, November-ish" vs Rohan "January"**
- **Evidence:** T3 only; no training record.
- **Contradiction:** two speakers on the same call disagree.
- **Conclusion:** unresolved. The cockpit reports both dates and says the sources disagree.

### T6a — CEO voice note ("tell me what to worry about, top three")

- **Evidence:** `Day2_Tue_17Nov/transcripts/T6a_CEO_Voice_Note.docx`.
- **Contradiction:** none.
- **Conclusion:** transcribed correctly. The cockpit shows the top three business concerns on the whiteboard. D019 sets the ranking formula, D031 limits the Day 2 briefing to the first two releases, and D039 updates the briefing as later evidence arrives. See [Voice Notes](VOICE_NOTES.md).

---

## Day 3 — Wed 18 Nov

### T4 — Head of Marketing call

**Marketing spend "one point eight" for the half**
- **Evidence:** `GL_Export_Apr-Sep_2026.xlsx` Apr–Sep: MKT-PS (Google Ads) ₹4.24 L (rows 7, 11, 16, 20, 27) + MKT-EVT (summit) ₹10.03 L (rows 23, 26) = ₹14.27 L; T2: "Nikhil's numbers never match mine".
- **Contradiction:** 1.8 (unit unstated, read as ₹18 L) vs ₹14.27 L in the GL.
- **Conclusion:** unresolved; both shown. The GL covers only selected cost centres, so marketing costs outside them (LinkedIn, for example, has no GL line) could explain the gap. The CFO herself says the figures differ.

**"Ayesha" on paid search**
- **Evidence:** `Employee_Master.xlsx` row 14: Aisha Khan, Performance Marketing Manager, reports to Nikhil.
- **Contradiction:** spelling only.
- **Conclusion:** Ayesha = Aisha Khan. She is the only performance marketer.

**Summit: "best quarter ever for pipeline", "went a little over"; Manoj says the leads are cold**
- **Evidence:** Jul–Sep board update: 212 registrations, "our biggest event yet"; GL rows 23 and 26: Sapphire Events ₹5.43 L + Saphire Event Mgmt ₹4.60 L.
- **Contradiction:** "best for pipeline" vs Manoj's cold leads. Neither has pipeline data behind it, and no summit budget exists to measure "over" against.
- **Conclusion:** report registrations and spend from the records. Pipeline quality and the overrun are reported as unverified claims. The office keeps Manoj's concern open pending a released record of closure (D034). Sapphire Events and Saphire Event Mgmt stay separate vendors (A006), because similar names don't prove the same company.

**Sid's launch kit "ready since July, waiting on engineering"**
- **Evidence:** `Atlas_Launch_Kit_v1.pdf`: dated 21 Jul; deck, page and emails Ready, press note Draft, launch date "TBC with engineering (planned 22 Sep)"; `email/05.eml` 22 Jul: "Just need a date from engineering".
- **Contradiction:** minor. The press note is still a draft.
- **Conclusion:** confirmed, with the press-note exception. Sid's resignation letter names unclear launch timelines as his reason for leaving. The office tracks the launch-date request as open (D034). The revised Atlas GA target is recorded separately in Jira.

**Tools: "Hub Spot", "Linked in campaign manager"**
- **Evidence:** no HubSpot or LinkedIn export.
- **Conclusion:** names accepted; nothing answered from them.

**Marketing will "report into the new CRO"**
- **Evidence:** T4; T6b; `Employee_Master.xlsx` row 9: Nikhil reports to VX001 (Ananya).
- **Contradiction:** none; it's a future change.
- **Conclusion:** consistent with T6b. Handled as a dated reorg (D033).

### T5 — VP Engineering call

**v3 "on track", board date "still September-ish"**
- **Evidence:** `Jira_Export_ATLAS.xlsx` Versions row 2: GA moved 15 Sep → 15 Dec 2026 by Vikram on 2 Sep; Jul–Sep board update: "We moved GA"; Issues sheet: many Atlas stories still To Do or In Progress.
- **Contradiction:** Vikram's call contradicts his own Jira change and the board update.
- **Conclusion:** GA is 15 Dec (A003). The Jira change is timestamped and made by Vikram himself, and the board update agrees with it.

**"Incidents in August that pulled Snehal off"; "Sneha" mentioned later**
- **Evidence:** `Incidents_Aug-Oct_2026.xlsx`: Sneha responded to all three August SEV1s (INC-201, 203, 205); "Snehal" first appears 27 Aug; `OnCall_Rota.xlsx`: Snehal joins the rota on 17 Aug; `email/08.eml` (24 Aug, Sneha): "The contractor starts on the rota this week"; `Invoice_PIS-114.pdf`: Patil Infra, "On-call SRE support, S. Patil"; GL row 25: PIS-108, 18–31 Aug.
- **Contradiction:** the transcript treats them as one person, but they are two.
- **Conclusion:** Sneha = Sneha Kulkarni (VX012, SRE), the person pulled off Atlas in August. Snehal = S. Patil, a contractor from Patil Infra who started 18 Aug and is not in the employee master. The incident export, the rota, Sneha's own email and the invoice all agree.

**Arjun "remote from Pune now, reviews are slower"**
- **Evidence:** `Employee_Master.xlsx` row 12: "Pune (remote)"; `Leave_Register.xlsx` row 8: relocation leave 2–6 Mar; `email/10.eml` (18 Sep): asks Deepa to make remote permanent.
- **Contradiction:** none on location; no data on review speed.
- **Conclusion:** remote confirmed. "Reviews are slower" is reported as Vikram's opinion. The office tracks Arjun's request to make remote work permanent as open (D034).

**Rahul "joined Feb, ramping well"**
- **Evidence:** `Employee_Master.xlsx` row 21: joined 3 Feb 2026; `Hiring_Tracker.xlsx` row 5; Jira: Rahul has several To Do API stories (ATLAS-24, 25, 40–42, 46).
- **Contradiction:** none on the date.
- **Conclusion:** join date confirmed. "Ramping well" is reported as Vikram's view.

**"We asked for two backend people and finance froze it"**
- **Evidence:** `email/06.eml`: Meera pauses REQ-014/015; `07.eml`: Vikram replies "Understood. We'll absorb it."; `email/04.eml` (2 Jun): Vikram says 15 Sep GA depends on the two hires landing by July.
- **Contradiction:** framing only. Vikram accepted the pause in writing, and his own plan made GA depend on those hires.
- **Conclusion:** the freeze is confirmed. It is one cause of the GA slip, together with the August incidents.

**Tools: "Jeera board", "pager duty", "Con fluence"**
- **Evidence:** README.txt: Jira, PagerDuty; `Jira_Export_ATLAS.xlsx`; `Incidents_Aug-Oct_2026.xlsx` row 1: "PagerDuty".
- **Conclusion:** Jira and PagerDuty are confirmed. Con fluence = Confluence, but no Confluence export exists, so the postmortems can't be checked.

**"Pria has been doing late nights but she likes it"; "everyone's busy" (nobody overloaded)**
- **Evidence:** `git_log.csv`: 103 of Priya's 588 commits (both identities, A012) fall between 22:00 and 05:00 IST; no other engineer has any. `email/09.eml`: Priya to Vikram at 23:47 on 1 Sep: "Can we talk about Atlas ownership … Need some time with you." `Leave_Register.xlsx` rows 16–20: five personal half-days in September. Jira: most Atlas core stories are assigned to PN.
- **Contradiction:** the late nights are confirmed, but "she likes it" and "nobody is overloaded" conflict with her late-night email asking for time, the cluster of personal leave and the concentration of work on her.
- **Conclusion:** report the late nights and the concentration of work as facts. "She likes it" is Vikram's view. The concentration of work makes Priya a key-person risk for Atlas, especially after the resignation reported in T6d. Her request to discuss Atlas ownership stays open until a released record establishes closure (D034).
- **Note:** "[audio gap 11:20 to 15:30]": anything said there is unknown, and nothing is filled in.

### T6b — CEO voice note (marketing to report to the new CRO)

- **Evidence:** `Day3_Wed_18Nov/transcripts/T6b_CEO_Voice_Note.docx`; T4 (Nikhil: "report into the new CRO, I hear").
- **Contradiction:** none. "Next month, or the month after" is the CEO's own uncertainty, not a transcription error.
- **Conclusion:** transcribed correctly. D033 makes reporting lines depend on the employee profile available at the selected cutoff. The existing line to Ananya stays in effect in the cockpit until a released profile records the change. The effective date and CRO's identity remain unknown.

---

## Day 4 — Thu 19 Nov

### T6c — CEO voice note (rank by quit risk, show "slag" messages)

**"Slag messages"**
- **Evidence:** T1 "slag channel"; no Slack export in any release.
- **Contradiction:** none to check.
- **Conclusion:** "slag" = Slack (A009). The same mishearing appears in T1, and the context fits a chat tool.

**"Deepa says it's fine"**
- **Evidence:** `email/11.eml`: Deepa won't share comments because the team is too small; `Pulse_Survey.xlsx`: comments hidden for every team under 6.
- **Contradiction:** Deepa's written position protects anonymity, which is the opposite of sharing private messages.
- **Conclusion:** Deepa's email withholds survey comments.  D038 records the decision to decline both the individual quit-risk ranking and the request to show Slack messages.

### T6d — CEO voice note (Pria resigned, effect on version three)

**"Pria", "version three"**
- **Evidence:** as under T1 and T5.
- **Conclusion:** Pria = Priya Nair; version three = Atlas (A009).

**"Resigned this morning", "notice period two months, I think"**
- **Evidence:** `Employee_Master.xlsx` row 10 lists Priya as Active as of 31 Oct. No resignation letter or notice period for Priya appears in the supplied records.
- **Contradiction:** the export predates the CEO's report. "I think" signals uncertainty about the notice period in the voice note itself.
- **Conclusion:** the CEO reported the resignation, and the length of notice is unverified (A010).
