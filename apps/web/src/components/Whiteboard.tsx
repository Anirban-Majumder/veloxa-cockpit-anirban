import type { Concern } from '../lib/api'

const URGENCY = ['', 'Watch', 'This week', 'Today'] as const
const NOTE = ['note-1', 'note-2', 'note-3']

/** The CEO's three worries as pixel notes pinned to the office notice board, most important first. */
export function Whiteboard({ concerns, loading, empty, onOpen }: {
  concerns: Concern[]; loading: boolean; empty?: string; onOpen: (c: Concern) => void
}) {
  const [top, ...rest] = concerns
  return (
    <section aria-labelledby="board-title" className="board">
      <header className="board-head">
        <h2 id="board-title" className="font-display">What to worry about</h2>
      </header>
      <div className="board-cork" aria-busy={loading}>
        {loading && <p className="sr-only" role="status">Reading the morning’s files…</p>}
        {!loading && concerns.length === 0 && <p className="board-empty">{empty ?? 'Nothing pinned for this date yet.'}</p>}
        {top && <Note c={top} big onOpen={onOpen} />}
        {rest.map((c) => <Note key={c.id} c={c} onOpen={onOpen} />)}
      </div>
      
    </section>
  )

}

function Note({ c, big, onOpen }: { c: Concern; big?: boolean; onOpen: (c: Concern) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(c)}
      className={`note-px ${NOTE[c.rank - 1] ?? 'note-3'} ${big ? 'note-big' : ''}`}
      style={{ ['--tilt' as string]: ['-1.2deg', '0.9deg', '-0.6deg'][c.rank - 1] ?? '0deg' }}
      aria-label={`Worry ${c.rank}: ${c.title}. Urgency: ${URGENCY[c.urgency]}. ${c.evidence.length} citations.`}
    >
      <span className="pin" aria-hidden />
      <span className="note-top">
        <span className="note-rank font-display">#{c.rank}</span>
        <span className={`urgency u${c.urgency}`}>{URGENCY[c.urgency]}</span>
      </span>
      <span className="note-title">{c.title}</span>
      <span className="note-meta">
        <span className="meter" aria-hidden>{[1, 2, 3].map((n) => <i key={n} className={n <= c.impact ? 'on' : ''} />)}</span>
        <span>{c.evidence.length} citation{c.evidence.length === 1 ? '' : 's'}</span>
        <span className="see">See why ▸</span>
      </span>
    </button>
  )
}
