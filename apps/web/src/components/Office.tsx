import type { Agent } from '../lib/api'

/** Shirt colour per department, so teams read at a glance. */
const DEPT_COLOR: Record<string, string> = {
  Engineering: '#75bca8',
  Finance: '#d7a5cb',
  'People & Ops': '#e7b96a',
  Marketing: '#e58f7a',
  Sales: '#8fa9e0',
}
const DEPT_ORDER = ['Engineering', 'Finance', 'People & Ops', 'Marketing', 'Sales']

/** Desk centres in the studio (4 × 2), then standing spots in the break room. Percent of the scene. */
const DESKS = [8, 20, 32, 44].flatMap((x) => [24, 58].map((y) => ({ x, y })))
const LOUNGE = [
  { x: 60, y: 42 }, { x: 92, y: 42 }, { x: 60, y: 74 }, { x: 92, y: 74 },
  { x: 76, y: 74 }, { x: 58, y: 24 }, { x: 94, y: 24 }, { x: 76, y: 92 },
]
const SPOTS = [...DESKS.map((d) => ({ x: d.x, y: d.y + 15, desk: true })), ...LOUNGE.map((p) => ({ ...p, desk: false }))]

function Sprite({ file, x, y, width }: { file: string; x: number; y: number; width: number }) {
  return <img className="furniture" src={`/office/${file}.png`} alt="" style={{ left: `${x}%`, top: `${y}%`, width: `${width}%` }} />
}

function Character({ color }: { color: string }) {
  return (
    <svg className="character" viewBox="0 0 16 26" aria-hidden="true" shapeRendering="crispEdges">
      <ellipse cx="8" cy="25" rx="6" ry="1" fill="#172b3e66" />
      <path d="M4 19h3v5H3v-2h1m5-3h3v3h1v2H9" fill="#253950" />
      <path d="M4 13h8v8H4zM2 14h2v6H2m10-6h2v6h-2" fill={color} />
      <path d="M3 4h10v8H3zM5 12h6v2H5" fill="#cf956e" />
      <path d="M2 4h1V2h2V1h6v1h2v2h1v5h-2V5H7v2H3v2H2" fill="#382a30" />
      <path d="M5 8h1v2H5m5-2h1v2h-1" fill="#2c2733" />
      <path d="M7 11h2v1H7" fill="#8b4d43" />
    </svg>
  )
}

/** Pixel office: every agent from the database is a clickable teammate; the whiteboard opens the worries. */
export function Office({ agents, selected, onOpen, onWhiteboard }: {
  agents: Agent[]; selected?: string; onOpen: (a: Agent) => void; onWhiteboard: () => void
}) {
  const people = [...agents].sort((a, b) => DEPT_ORDER.indexOf(a.department) - DEPT_ORDER.indexOf(b.department) || a.employee_id.localeCompare(b.employee_id))
  const placed = people.slice(0, SPOTS.length).map((a, i) => ({ a, spot: SPOTS[i]! }))

  return (
    <section aria-labelledby="office-title">
      <h2 id="office-title" className="font-display text-xl font-bold">Talk to your team</h2>
      <p className="mt-1 text-sm text-ink-soft">Click anyone in the office. Each person answers from their own records and remembers your past conversations.</p>
      <div className="scene-wrap mt-4">
        <div className="scene">
          <div className="wood-room" />
          <div className="lounge-room" />
          <div className="kitchen" />
          <div className="wall-top" />
          <div className="wall-divider" />
          <Sprite file="BOOKSHELF" x={6} y={1} width={14} />
          <Sprite file="BOOKSHELF" x={30} y={1} width={14} />
          <Sprite file="CLOCK" x={23} y={2} width={4} />
          <Sprite file="LARGE_PLANT" x={1} y={3} width={6} />
          <Sprite file="LARGE_PLANT" x={45} y={3} width={6} />
          <button type="button" className="whiteboard-btn" style={{ left: '66%', top: '1%', width: '17%' }} onClick={onWhiteboard} aria-label="Open the whiteboard of today’s worries">
            <img src="/office/WHITEBOARD.png" alt="" />
          </button>
          {DESKS.map((d) => (
            <div key={`${d.x}-${d.y}`}>
              <Sprite file="DESK_FRONT" x={d.x - 5.5} y={d.y} width={11} />
              <Sprite file="PC_FRONT_ON_1" x={d.x - 2} y={d.y - 4} width={4} />
            </div>
          ))}
          <Sprite file="SOFA_FRONT" x={67} y={30} width={18} />
          <Sprite file="COFFEE_TABLE" x={70} y={50} width={12} />
          <div className="room-label engineering">Studio</div>
          <div className="room-label lounge">The break room</div>
          <div className="coffee-steam">≈</div>
          {placed.map(({ a, spot }, i) => (
            <button
              key={a.employee_id}
              type="button"
              className={`person ${selected === a.employee_id ? 'selected' : ''}`}
              style={{ left: `${spot.x}%`, top: `${spot.y}%`, animationDelay: `${-i * 0.7}s` }}
              onClick={() => onOpen(a)}
              aria-label={`Talk to ${a.full_name}, ${a.title}, ${a.department}`}
            >
              <span className="speech">{selected === a.employee_id ? '•••' : 'Hi!'}</span>
              <Character color={DEPT_COLOR[a.department] ?? '#9fb3c8'} />
              <span className="nameplate">
                {a.full_name.split(' ')[0]}
                <small>{a.department}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {DEPT_ORDER.map((d) => (
          <span key={d} className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: DEPT_COLOR[d] }} />{d}
          </span>
        ))}
      </p>
    </section>
  )
}
