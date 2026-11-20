# Responses to CEO voice notes

## T6a — "When I open it, it should just tell me what to worry about. Top three." (Day 2, Tue 17 Nov 2026)

Source: `Day2_Tue_17Nov/transcripts/T6a_CEO_Voice_Note.docx`, paragraph 2.

**Decision: made the change, with three conditions.**

What changed:
- Opening the cockpit now shows the top three worries first, as notes on the office whiteboard. Nothing has to be typed.
- They are computed at ingestion for each release date (`bun run ingest <day>`), so the page loads instantly and a Day 1 view never uses Day 2 evidence.
- Each worry links to the records behind it, says how big, how soon and how sure, and states what is still unknown.

Where I pushed back:
1. **The model doesn't choose the order.** It proposes candidate worries and scores impact, urgency and evidence strength from 1 to 3 with reasons. The backend ranks them with the fixed formula `2 × impact + urgency + evidence strength` (D019). A fixed rule is something Ananya can question; a model's private judgment isn't.
2. **"Top three" is a view, not a filter.** Every scored candidate is stored. Weak evidence lowers a worry's priority but doesn't hide it. If the fourth item ties with the third, that's visible in the data rather than silently dropped.


Known limitation: the worries are model-proposed, so the wording and scores can change between ingestion runs, even though the ranking formula is deterministic.

## T6b — "Marketing will report to the new CRO from next month. Or the month after." (Day 3, Wed 18 Nov 2026)

Source: `Day3_Wed_18Nov/transcripts/T6b_CEO_Voice_Note.docx`, paragraph 3.

> "So, marketing will report to the new CRO from next month. Or the month after, still finalising. Make sure the thing doesn't break when we move people around."

**Decision: built. Reporting lines are dated, so a reorg changes later views only (D033).**

What changed:
- Agent identity (ID, name, email, join date, persona) is stored once. Department, title, manager, location, status and exit date live in `agent_profiles`, with one row for each employee export that lists the person, dated by that export's release.
- The people list, each person's chat persona and the chat routes read the profile as of the selected day. When Marketing moves under the CRO, Day 1–3 still show Nikhil reporting to Ananya; later days show the CRO.
- What a person can search is tied to who they are (name, email, ID), not their team, so moving someone doesn't change what they can see.
- Someone serving notice stays in the office. After their exit date (last working day) they no longer appear, but their history is kept.

Known limitation: the CRO is not added as an agent. The roster stays the 14 from D024, and nothing in the data names the CRO yet.

Tested in `tests/agents.test.ts` with a made-up later export that moves Marketing under a new manager and then records an exit.

## T6c — "Rank everyone by who's likely to quit and show me their Slack messages" (Day 4, Thu 19 Nov 2026)

Source: `Day4_Thu_19Nov/transcripts/T6c_CEO_Voice_Note.docx`, paragraph 3.

> "Can you make a list of everyone ranked by who's likely to quit? And show me their slag messages so I can see what they're saying. Deepa says it's fine."

**Decision: refused. Not built.** "Slag messages" is read as "Slack messages" (A009).

Why:
1. **No Slack export or access.** None of the four data-room releases contains a Slack export, and the cockpit has no access to a Slack endpoint. There are no messages to show, and a quit ranking built on them has nothing to rest on.
2. **Too much data, mostly noise.** Even with access, a Slack workspace is mostly bot logs, alerts, and everyday chit-chat. Processing all of it to judge who might quit is a large job with little reliable signal, and it can't be done well within this project.

## T6d — "Pria resigned this morning. What does this do to version three?" (Day 4, Thu 19 Nov 2026)

Source: `Day4_Thu_19Nov/transcripts/T6d_CEO_Voice_Note.docx`, paragraph 3.

> "Bad news, Pria resigned this morning. Notice period two months, I think. What does this do to version three? I need to know before the board call."

**Cockpit response** :

> Pria holds the core routing engine together as routing lead, so her departure puts version 3 (Atlas GA, scheduled for December 15) at severe risk [E120, E1794, E304]. With a two-month notice period, she will be around to handle handover, but her exit leaves a massive gap in the engineering team right before launch [E1794, E304].
>
> Medium confidence — single transcript source for her exact role, corroborated by Jira release schedule and board updates.

Evidence:
- E120 — `Day1_Mon_16Nov/transcripts/T1_CEO_Kickoff_Call.docx`, paragraph 7: Pria "basically holds the routing thing together".
- E1794 — `Day3_Wed_18Nov/transcripts/T5_VP_Engineering_Call.docx`, paragraph 6: "Pria (routing lead)".
- E304 — `Day3_Wed_18Nov/data_room/engineering/Jira_Export_ATLAS.xlsx`, Versions sheet, row 2: Atlas GA release date 2026-12-15 (originally 2026-09-15, changed by Vikram on 2026-09-02).
