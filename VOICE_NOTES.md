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
3. **The question box stays.** She doesn't want to type every morning, but the brief's core requirement is answering one question with citations and confidence. The ask bar stays at the bottom of the same screen, and so does access to the 14 people.

Not done: no push or WhatsApp delivery. She asked for the list "when I open it", not for notifications, and sending company concerns to a messaging channel raises the same disclosure risk the CFO raised about salaries.

Known limitation: the worries are model-proposed, so the wording and scores can change between ingestion runs, even though the ranking formula is deterministic.
