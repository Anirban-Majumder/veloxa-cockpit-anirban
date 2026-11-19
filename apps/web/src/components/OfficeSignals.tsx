import type { CSSProperties } from 'react'
import { fileName, type Agent, type OfficeData, type OfficeFact, type OfficeIndicator } from '../lib/api'

export type Point = { x: number; y: number }
export type Signal = { id: string; kind: 'status' | 'requests' }
export type Relationship = { from: string; to: string; item?: OfficeFact }

const day = (date: string) => new Date(date).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
})
const statusIcons = { leave: '◴', 'on-call': '⚡', open: '◇', recent: '✓' }
const statusNames = { leave: 'Recorded leave', 'on-call': 'On-call duty', open: 'Open work item', recent: 'Recent work item' }

export function SignalButtons({ id, name, indicator, style, active, onHover, onFocus, onToggle, onDismiss }: {
  id: string
  name: string
  indicator?: OfficeIndicator
  style: CSSProperties
  active?: Signal | null
  onHover: (signal: Signal | null) => void
  onFocus: (signal: Signal | null) => void
  onToggle: (signal: Signal) => void
  onDismiss: () => void
}) {
  if (!indicator?.status && !indicator?.requests.length) return null
  const button = (kind: Signal['kind'], icon: string, label: string, count = 1) => {
    const signal = { id, kind }
    const expanded = active?.id === id && active.kind === kind
    return <button type="button" className="office-signal" aria-label={`${name}: ${label}`}
      aria-expanded={expanded} aria-controls={expanded ? 'office-signal-details' : undefined}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') onHover(signal) }}
      onPointerLeave={() => onHover(null)}
      onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) onFocus(signal) }} onBlur={() => onFocus(null)} onClick={() => onToggle(signal)}
      onKeyDown={(event) => { if (event.key === 'Escape') onDismiss() }}>
      <span aria-hidden>{icon}</span>
      {count > 1 && <span className="office-signal-count" aria-hidden>×{count}</span>}
    </button>
  }
  return <div className="office-signals" style={style}>
    {indicator.status && button('status', statusIcons[indicator.status.kind], statusNames[indicator.status.kind])}
    {indicator.requests.length > 0 && button('requests', '✋', indicator.requests.length > 1 ? `${indicator.requests.length} requests for the CEO` : 'Request for the CEO', indicator.requests.length)}
  </div>
}

export function SignalDetails({ signal, data }: { signal: Signal; data: OfficeData }) {
  const indicator = data.indicators[signal.id]
  const facts = signal.kind === 'status' ? (indicator?.status ? [indicator.status] : []) : indicator?.requests ?? []
  if (!facts.length) return null
  return <div className="office-details" id="office-signal-details" role="status">
    <strong>{data.names[signal.id]}{signal.kind === 'requests' && ' · Requests for the CEO'}</strong>
    <ul>{facts.map((fact) => <li key={fact.evidence.id}>
      <div>{fact.label}</div>
      <small>{day(fact.date)} · {fileName(fact.evidence.path)} [E{fact.evidence.id}]</small>
      {'response' in fact && <small>{fact.response}</small>}
    </li>)}</ul>
  </div>
}

export function RelationshipLines({ edges, points, width, height }: {
  edges: Relationship[]
  points: Map<string, Point>
  width: number
  height: number
}) {
  const visible = edges.flatMap(({ from, to, item }) => {
    const start = points.get(from)
    const end = points.get(to)
    return start && end ? [{ from, to, item, start, end }] : []
  })
  if (!visible.length) return null
  return <svg className="office-lines" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <defs>
      <marker id="office-report-tip" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto">
        <path d="M0 0l8 4-8 4z" fill="#a7edff" />
      </marker>
      <marker id="office-open-tip" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto">
        <path d="M0 0l8 4-8 4z" fill="#ffb894" />
      </marker>
    </defs>
    {visible.map(({ from, to, item, start, end }) => {
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.hypot(dx, dy) || 1
      const nx = -dy / length * 23
      const ny = dx / length * 23
      const path = item
        ? `M${start.x} ${start.y} C${start.x + dx / 4 + nx} ${start.y + dy / 4 + ny} ${start.x + dx * .75 - nx} ${start.y + dy * .75 - ny} ${end.x} ${end.y}`
        : `M${start.x} ${start.y} L${end.x} ${end.y}`
      return <path key={`${from}-${to}-${item?.evidence.id ?? 'report'}`} d={path} className={item ? 'open-line' : 'report-line'}
        markerEnd={item ? 'url(#office-open-tip)' : 'url(#office-report-tip)'} />
    })}
  </svg>
}

export function RelationshipLabels({ person, edges, names, status }: {
  person: Agent; edges: Relationship[]; names: OfficeData['names']; status?: OfficeIndicator['status']
}) {
  const name = (id: string) => (names[id] ?? id).split(' ')[0]
  return <section className="office-relationships" aria-label="Relationships">
    <h2>{person.full_name}{person.title && ` · ${person.title}`}</h2>
    {person.location?.trim() && <p className="mt-1 text-sm text-[#d2dfea]">{person.location}</p>}
    {status && <p className="mt-1 text-sm text-[#d2dfea]">{status.label} · <time dateTime={status.date}>{day(status.date)}</time></p>}
    {edges.length > 0 && (
      <ul>
        {edges.map(({ from, to, item }) => (
          <li key={`${from}-${to}-${item?.evidence.id ?? 'report'}`}>
            <span className={item ? 'open-line' : 'report-line'} aria-hidden />
            {item ? <>
              <strong>{name(from)} → {name(to)}</strong>{' '}
              <small className="inline-block rounded-sm bg-[#ffb894]/15 px-1.5 text-xs font-semibold text-[#ffb894]">Open question</small>{' '}
              {item.label} · {day(item.date)}
              <small title={item.evidence.path}> [E{item.evidence.id}]</small>
            </> : to === 'VX001' && from === person.employee_id
              ? 'Reports to you directly'
              : <>{name(from)} reports to {name(to)}</>}
          </li>
        ))}
      </ul>
    )}
  </section>
}
