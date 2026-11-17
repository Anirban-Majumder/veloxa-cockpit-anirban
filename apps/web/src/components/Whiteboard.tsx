import type { Concern } from '../lib/api'

const TILTS = ['-2.2deg', '1.4deg', '-0.8deg']
const NOTE_COLORS = ['bg-marigold', 'bg-marigold-soft', 'bg-[#ffd1b8]']
const URGENCY = ['', 'Keep an eye on it', 'Act this week', 'Act today']

/** The CEO's three worries, pinned to the office whiteboard. */
export function Whiteboard({ concerns, loading, empty, onOpen }: {
  concerns: Concern[]; loading: boolean; empty?: string; onOpen: (c: Concern) => void
}) {
  return (
    <section aria-labelledby="board-title" className="relative rounded-[28px] border-[10px] border-[#b9c2c6] bg-white p-5 shadow-[0_2px_0_#9aa5aa,0_18px_40px_-20px_rgb(38_52_59/.5)] sm:p-8">
      <h2 id="board-title" className="font-display text-2xl font-bold text-ink/80 sm:text-3xl">What to worry about today</h2>
      <p className="mt-1 max-w-prose text-ink-soft">Ranked from everything the company knew on this date. Tap a note to see the evidence.</p>

      {loading && <p className="mt-8 text-ink-soft">Reading the morning’s files…</p>}
      {!loading && concerns.length === 0 && (
        <p className="mt-8 max-w-prose rounded-xl bg-floor/60 p-4 text-ink">{empty ?? 'Nothing ranked for this date yet.'}</p>
      )}

      <ol className="mt-7 grid gap-6 md:grid-cols-3">
        {concerns.map((c, i) => (
          <li key={c.id} className="note" style={{ '--tilt': TILTS[i], animationDelay: `${i * 90}ms` } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => onOpen(c)}
              className={`group relative flex h-full w-full flex-col rounded-sm ${NOTE_COLORS[i]} p-5 pt-7 text-left text-ink shadow-[0_10px_18px_-10px_rgb(38_52_59/.55)] transition-transform hover:-translate-y-1 hover:rotate-0`}
            >
              <span aria-hidden className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-route shadow-[0_2px_0_#1d4ea8]" />
              <span className="font-display text-5xl leading-none font-extrabold text-ink/25">{c.rank}</span>
              <span className="mt-2 font-display text-xl leading-tight font-bold">{c.title}</span>
              <span className="mt-3 text-[15px] leading-relaxed">{c.description}</span>
              <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-5 text-sm">
                <span className={c.urgency === 3 ? 'font-bold text-alarm' : 'font-bold'}>{URGENCY[c.urgency]}</span>
                <span className="text-ink/70">{c.evidence.length} sources</span>
                <span className="ml-auto text-ink/70 group-hover:underline">See why</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div aria-hidden className="absolute right-8 -bottom-[10px] hidden h-3 w-40 translate-y-full rounded-b-md bg-[#9aa5aa] sm:block" />
    </section>
  )
}
