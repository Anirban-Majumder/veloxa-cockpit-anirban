import { useEffect, useRef, useState } from 'react'
import type { Concern } from '../lib/api'

const URGENCY = ['', 'Watch', 'This week', 'Today'] as const
const NOTE = ['note-1', 'note-2', 'note-3']

export function Whiteboard({ concerns, loading, empty, onOpen, expanded = false }: {
  concerns: Concern[]; loading: boolean; empty?: string; onOpen: (c: Concern) => void; expanded?: boolean
}) {
  const [limit, setLimit] = useState(6)
  const cork = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (limit > 6) cork.current?.querySelectorAll('button').item(limit - 6)?.focus()
  }, [limit])
  const visible = expanded ? concerns.slice(0, limit) : concerns
  return (
    <section aria-label={expanded ? 'Pinned concerns' : undefined} aria-labelledby={expanded ? undefined : 'board-title'}
      className={expanded ? 'board board-expanded' : 'board'}>
      {!expanded && <header className="board-head">
        <h2 id="board-title" className="font-display">What to worry about</h2>
      </header>}
      <div ref={cork} className="board-cork" aria-busy={loading}>
        {loading && <p className="sr-only" role="status">Reading the morning’s files…</p>}
        {!loading && concerns.length === 0 && <p className="board-empty">{empty ?? 'Nothing pinned for this date yet.'}</p>}
        {visible.map((c, index) => <Note key={c.id} c={c} big={!expanded && index === 0} onOpen={onOpen} />)}
      </div>
      {expanded && limit < concerns.length && <div className="board-foot">
        <button type="button" className="px-btn" onClick={() => setLimit((current) => current + 6)}>Load more</button>
      </div>}
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
