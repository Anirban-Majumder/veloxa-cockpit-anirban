import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { RelationshipLabels, RelationshipLines, SignalButtons, SignalDetails, type Point, type Signal } from './OfficeSignals'
import type { Agent, OfficeData } from '../lib/api'

/**
 * The pixel office. Coordinates are in the art's native pixels (16 px tiles) on an 640 × 416 floor
 * plan and rendered as percentages, so the scene scales with its container while labels stay crisp.
 * Each department has its own room; people sit at their desks facing their screens.
 */
const W = 640
const H = 416
const ART = 'office/'

const at = (x: number, y: number, w: number, h: number, z?: number): CSSProperties => ({
  left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%`, zIndex: z,
})

/** A 128 × 96 character sheet: rows down/up/right × 8 frames (walk 1–3, type 1–2, read 1–2, seated). */
const frame = (col: number, row: number): CSSProperties => ({
  backgroundPosition: `${(col / 7) * 100}% ${(row / 2) * 100}%`,
})

type Desk = { x: number; y: number }
type Room = {
  dept: string; label: string; color: string; floor: string
  x: number; y: number; w: number; h: number; desks: Desk[]
}

const DEPT_COLOR: Record<string, string> = {
  Engineering: '#3f9e86', Finance: '#9c4f86', 'People & Ops': '#d9a331', Marketing: '#e0703f', Sales: '#4f74b8',
}

/** Rooms in floor-plan order. Both rows open onto the corridor through doorways. */
const ROOMS: Room[] = [
  { dept: 'Engineering', label: 'Engineering', color: DEPT_COLOR.Engineering!, floor: 'engineering', x: 0, y: 0, w: 256, h: 216,
    desks: [{ x: 20, y: 70 }, { x: 104, y: 70 }, { x: 188, y: 70 }, { x: 20, y: 148 }, { x: 104, y: 148 }, { x: 188, y: 148 }] },
  { dept: 'Finance', label: 'Finance', color: DEPT_COLOR.Finance!, floor: 'finance', x: 256, y: 0, w: 160, h: 216,
    desks: [{ x: 272, y: 70 }, { x: 352, y: 70 }, { x: 272, y: 148 }, { x: 352, y: 148 }] },
  { dept: 'People & Ops', label: 'People & Ops', color: DEPT_COLOR['People & Ops']!, floor: 'people', x: 416, y: 0, w: 224, h: 216,
    desks: [{ x: 432, y: 70 }, { x: 512, y: 70 }, { x: 432, y: 148 }] },
  { dept: 'Marketing', label: 'Marketing', color: DEPT_COLOR.Marketing!, floor: 'marketing', x: 0, y: 264, w: 176, h: 152,
    desks: [{ x: 16, y: 330 }, { x: 96, y: 330 }] },
  { dept: 'Sales', label: 'Sales', color: DEPT_COLOR.Sales!, floor: 'sales', x: 176, y: 264, w: 128, h: 152,
    desks: [{ x: 188, y: 330 }, { x: 248, y: 330 }] },
]
const LOBBY = { x: 304, y: 264, w: 144, h: 152 }
const BREAK = { x: 448, y: 264, w: 192, h: 152 }
const CORRIDOR = { y: 216, h: 48 }
const WALL = 40 // height of a back-wall face
/** Doorway gaps (x range) in the corridor walls. */
const TOP_DOORS = [[76, 100], [326, 346], [576, 600]]
const BOTTOM_DOORS = [[70, 92], [216, 240], [320, 432], [464, 488]]
const ENTRANCE = { x: 364, w: 24 }
/** Where people stand when their room is full or their department has no room. */
const STANDING = [{ x: 474, y: 404 }, { x: 624, y: 404 }, { x: 500, y: 384 }, { x: 604, y: 384 }]

function Img({ file, x, y, w, h, z, flip, className }: { file: string; x: number; y: number; w: number; h: number; z?: number; flip?: boolean; className?: string }) {
  return <img className={`px ${className ?? ''}`} src={`${ART}${file}.png`} alt="" style={{ ...at(x, y, w, h, z ?? Math.round(y + h)), transform: flip ? 'scaleX(-1)' : undefined }} />
}

function Floor({ file, x, y, w, h }: { file: string; x: number; y: number; w: number; h: number }) {
  return <div className="px floor" style={{ ...at(x, y, w, h, 0), backgroundImage: `url(${ART}floor-${file}.png)`, backgroundSize: `${(16 / w) * 100}% ${(16 / h) * 100}%` }} />
}

/** Back-wall faces along y..y+WALL between x0 and x1, leaving gaps for doorways. */
function WallFace({ x0, x1, y, gaps = [] }: { x0: number; x1: number; y: number; gaps?: number[][] }) {
  const segs: ReactNode[] = []
  let cur = x0
  for (const [a, b] of [...gaps.filter(([a]) => a! >= x0 && a! < x1), [x1, x1]]) {
    if (a! > cur) segs.push(<div key={cur} className="wall-face" style={at(cur, y, a! - cur, WALL, 1)} />)
    cur = b!
  }
  return <>{segs}</>
}

function Sheet({ id, x, y, z, col, row, flip, className }: { id: string; x: number; y: number; z: number; col: number; row: number; flip?: boolean; className?: string }) {
  return (
    <div
      className={`px sheet ${className ?? ''}`}
      style={{ ...at(x, y, 16, 32, z), backgroundImage: `url(${ART}people/${id}.png)`, ...frame(col, row), transform: flip ? 'scaleX(-1)' : undefined }}
    />
  )
}

const sprite = (a: Agent) => (/^VX0(0[2-9]|1[0-8])$/.test(a.employee_id) ? a.employee_id : 'default')

function Workstation({ desk, agent, tick, active, onOpen, onHover, onFocus }: {
  desk: Desk; agent?: Agent; tick: number; active: boolean; onOpen: (a: Agent) => void; onHover: (id: string | null) => void; onFocus: (id: string | null) => void
}) {
  const { x, y } = desk
  const screen = agent ? `PC_FRONT_ON_${((tick + x + y) % 3) + 1}` : 'PC_FRONT_OFF'
  return (
    <>
      <Img file="DESK_FRONT" x={x} y={y - 6} w={48} h={32} z={y + 32} />
      <Img file={screen} x={x + 16} y={y - 5} w={16} h={32} z={y + 33} />
      <Img file="CUSHIONED_CHAIR_BACK" x={x + 16} y={y + 30} w={16} h={16} z={y + 40} />
      {agent && (
        <>
          <Sheet
            id={sprite(agent)} x={x + 16} y={y + 12} z={y + 44}
            col={active ? 7 : 3 + (tick % 2)} row={active ? 0 : 1}
            className={active ? 'sheet-active' : ''}
          />
          <button
            type="button"
            className={`desk-hit at-desk ${active ? 'is-active' : ''}`}
            style={at(x - 4, y - 8, 56, 60, 900)}
            onClick={() => onOpen(agent)}
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') onHover(agent.employee_id) }}
            onPointerLeave={() => onHover(null)}
            onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) onFocus(agent.employee_id) }}
            onBlur={() => onFocus(null)}
            aria-label={`Talk to ${agent.full_name}, ${agent.title}`}
          >
            <span className="speech">{active ? 'Hi!' : ''}</span>
            <span className="nameplate">{agent.full_name.split(' ')[0]}</span>
          </button>
        </>
      )}
    </>
  )
}

type Walker = { el: HTMLButtonElement | null; sprite: HTMLSpanElement | null; door: HTMLDivElement | null }

function useCourier(ref: React.RefObject<Walker>, enabled: boolean, dismissLabel: () => void) {
  useEffect(() => {
    const { el, sprite, door } = ref.current
    if (!enabled || !el || !sprite) return
    const entranceX = ENTRANCE.x + ENTRANCE.w / 2
    const path: [number, number][] = [
      [entranceX, H + 32], [entranceX, LOBBY.y + 86], [entranceX + 9, LOBBY.y + 86],
      [entranceX, LOBBY.y + 86], [entranceX, H + 32],
    ]
    let x = entranceX, y = H + 32, stop = 1, last = 0, step = 0, raf = 0
    let timer: ReturnType<typeof setTimeout>
    const randomDelay = (min: number, max: number) => min + Math.random() * (max - min)

    const draw = (dir: number, moving: boolean, flip = false) => {
      const col = moving ? [0, 1, 2, 1][Math.floor(step / 140) % 4]! : 1
      Object.assign(el.style, at(x - 12, y - 30, 24, 32, Math.round(y)))
      Object.assign(sprite.style, frame(col, dir), { transform: flip ? 'scaleX(-1)' : '' })
      el.style.visibility = y > H + 4 ? 'hidden' : 'visible'
      door?.classList.toggle('open', y >= H - 17 && y <= H + 24)
    }

    function walk() {
      last = performance.now()
      raf = requestAnimationFrame(move)
    }

    const move = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      const [tx, ty] = path[stop]!
      const dx = tx - x, dy = ty - y
      const distance = Math.hypot(dx, dy)
      const advance = 0.048 * dt
      if (distance > advance) {
        x += dx / distance * advance
        y += dy / distance * advance
        step += dt
        const dir = dx ? 2 : dy > 0 ? 0 : 1
        draw(dir, true, dx < 0)
        raf = requestAnimationFrame(move)
        return
      }
      x = tx
      y = ty
      stop++
      if (stop === path.length) {
        draw(0, false)
        el.blur()
        dismissLabel()
        stop = 1
        timer = setTimeout(walk, randomDelay(20_000, 90_000))
      } else if (stop === 3) {
        draw(0, false)
        timer = setTimeout(walk, randomDelay(3_000, 9_000))
      } else {
        raf = requestAnimationFrame(move)
      }
    }

    timer = setTimeout(walk, 1500)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      door?.classList.remove('open')
      el.style.visibility = 'hidden'
      dismissLabel()
    }
  }, [ref, enabled, dismissLabel])
}

/** The office cat wanders the break room and naps. */
function useCat(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let x = 480, y = 396, tx = x, ty = y, wait = 2000, last = performance.now(), step = 0, raf = 0
    const loop = (now: number) => {
      const dt = Math.min(50, now - last); last = now
      const el = ref.current
      if (el) {
        let moving = false, sideways = false, upward = false, flip = false
        if (wait > 0) wait -= dt
        else {
          const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy)
          if (d < 1) { wait = 2500 + Math.random() * 5000; tx = 470 + Math.random() * 160; ty = 318 + Math.random() * 88 }
          else { const m = Math.min(d, 0.024 * dt); x += (dx / d) * m; y += (dy / d) * m; moving = true; sideways = Math.abs(dx) > Math.abs(dy); upward = dy < 0; flip = sideways && dx < 0 }
        }
        step += moving ? dt : 0
        // Side views occupy two columns of the front and rear sprite grid.
        const width = sideways ? 16 : 8
        const col = moving ? Math.floor(step / 160) % 3 : 3 + Math.floor(now / 900) % 3
        Object.assign(el.style, at(x - width / 2, y - 14, width, 16, Math.round(y)))
        el.style.backgroundSize = sideways ? '300% 300%' : '600% 300%'
        el.style.backgroundPosition = `${col * (sideways ? 50 : 20)}% ${sideways ? 100 : upward ? 50 : 0}%`
        el.style.transform = flip ? 'scaleX(-1)' : ''
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ref, enabled])
}

export function Office({ data, selected, alerts = 0, onOpen, onWhiteboard }: {
  data?: OfficeData; selected?: string; alerts?: number; onOpen: (a: Agent) => void; onWhiteboard: () => void
}) {
  const [tick, setTick] = useState(0)
  const [hover, setHoverPerson] = useState<string | null>(null)
  const [focus, setFocusPerson] = useState<string | null>(null)
  const [signalHover, setSignalHover] = useState<Signal | null>(null)
  const [signalFocus, setSignalFocus] = useState<Signal | null>(null)
  const [pinned, setPinned] = useState<Signal | null>(null)
  const signal = signalFocus ?? signalHover ?? pinned
  const indicator = signal && data?.indicators[signal.id]
  const activeSignal = signal && indicator && (signal.kind === 'status' ? indicator.status : indicator.requests.length) ? signal : null
  // Moving to a person shows their lines and labels instead of a pinned detail card.
  const setHover = (id: string | null) => { setHoverPerson(id); if (id) setPinned(null) }
  const setFocus = (id: string | null) => { setFocusPerson(id); if (id) setPinned(null) }
  const dismissSignal = () => {
    setPinned(null)
    setSignalHover(null)
    setSignalFocus(null)
  }
  const agents = data?.agents ?? []
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setMotion(!preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  const [courierLabel, setCourierLabel] = useState(false)
  const dismissCourierLabel = useCallback(() => setCourierLabel(false), [])
  const courier = useRef<Walker>({ el: null, sprite: null, door: null })
  const cat = useRef<HTMLDivElement>(null)
  useCourier(courier, motion, dismissCourierLabel)
  useCat(cat, motion)
  useEffect(() => {
    if (!motion) return
    const t = setInterval(() => setTick((n) => n + 1), 420)
    return () => clearInterval(t)
  }, [motion])

  // Seat everyone in their department's room, in employee-ID order; overflow stands in the break room.
  const seats = new Map<Room, (Agent | undefined)[]>(ROOMS.map((r) => [r, r.desks.map(() => undefined)]))
  const standing: Agent[] = []
  for (const a of [...agents].sort((p, q) => p.employee_id.localeCompare(q.employee_id))) {
    const room = ROOMS.find((r) => r.dept === a.department)
    const list = room && seats.get(room)
    const free = list ? list.findIndex((s) => !s) : -1
    if (list && free >= 0) list[free] = a
    else standing.push(a)
  }
  const person = hover ?? focus
  const activePerson = agents.find((agent) => agent.employee_id === person)
  const isActive = (a?: Agent) => !!a && (a.employee_id === selected || a.employee_id === person)
  const points = new Map<string, Point>()
  for (const [room, occupants] of seats) occupants.forEach((agent, i) => {
    if (agent) points.set(agent.employee_id, { x: room.desks[i]!.x + 24, y: room.desks[i]!.y + 18 })
  })
  standing.slice(0, STANDING.length).forEach((agent, i) => {
    points.set(agent.employee_id, { x: STANDING[i]!.x, y: STANDING[i]!.y - 20 })
  })
  const edges = person && data ? [
    ...data.reporting,
    ...data.openItems.map((item) => ({ from: item.from, to: item.to, item })),
  ].filter(({ from, to }) => person === from || person === to) : []

  return (
    <div className="office-scroll">
        <div className="office" role="group" aria-label="Veloxa office floor plan">
          {/* Floors */}
          {ROOMS.map((r) => <Floor key={r.dept} file={r.floor} x={r.x} y={r.y + WALL} w={r.w} h={r.h - WALL} />)}
          <Floor file="corridor" x={0} y={CORRIDOR.y} w={W} h={CORRIDOR.h} />
          <Floor file="lobby" x={LOBBY.x} y={LOBBY.y} w={LOBBY.w} h={LOBBY.h} />
          <Floor file="break" x={BREAK.x} y={BREAK.y + WALL} w={BREAK.w} h={BREAK.h - WALL} />
          {/* Doorway floors into the bottom rooms */}
          {BOTTOM_DOORS.map(([a, b]) => {
            const room = [...ROOMS, { ...BREAK, floor: 'break' }].find((r) => r.y > 0 && a! >= r.x && a! < r.x + r.w)
            return room ? <Floor key={a} file={room.floor} x={a!} y={LOBBY.y} w={b! - a!} h={WALL} /> : null
          })}

          {/* Walls */}
          <WallFace x0={0} x1={W} y={0} />
          <WallFace x0={0} x1={W} y={LOBBY.y} gaps={BOTTOM_DOORS} />
          {TOP_DOORS.reduce<{ segs: ReactNode[]; cur: number }>((acc, [a, b], i) => {
            acc.segs.push(<div key={i} className="wall-edge" style={at(acc.cur, CORRIDOR.y - 6, a! - acc.cur, 6, 300)} />)
            acc.cur = b!
            if (i === TOP_DOORS.length - 1) acc.segs.push(<div key="end" className="wall-edge" style={at(b!, CORRIDOR.y - 6, W - b!, 6, 300)} />)
            return acc
          }, { segs: [], cur: 0 }).segs}
          {[256, 416].map((x) => <div key={x} className="wall-side" style={at(x - 3, 0, 6, CORRIDOR.y, 301)} />)}
          {[176, 304, 448].map((x) => <div key={x} className="wall-side" style={at(x - 3, LOBBY.y, 6, H - LOBBY.y, 301)} />)}
          <div className="wall-edge" style={at(0, H - 5, ENTRANCE.x, 5, 700)} />
          <div className="wall-edge" style={at(ENTRANCE.x + ENTRANCE.w, H - 5, W - ENTRANCE.x - ENTRANCE.w, 5, 700)} />
          <div ref={(el) => { courier.current.door = el }} className="entrance" style={at(ENTRANCE.x - 4, H - 8, ENTRANCE.w + 8, 8, 701)}>
            <i /><i />
          </div>
          <div className="mat" style={at(ENTRANCE.x - 8, H - 30, ENTRANCE.w + 16, 22, 2)} />

          {/* Room signs */}
          {ROOMS.map((r) => (
            <span key={r.dept} className="room-sign" style={{ ...at(r.x + r.w / 2 - 40, r.y + (r.y === 0 ? 22 : r.h - 20), 80, 12, 5), ['--dept' as string]: r.color }}>
              {r.label}
            </span>
          ))}
          <span className="room-sign" style={{ ...at(LOBBY.x + (LOBBY.w - 72) / 2, LOBBY.y + 14, 72, 12, 5), ['--dept' as string]: '#c9a227' }}>Reception</span>
          <span className="room-sign" style={{ ...at(BREAK.x + 56, BREAK.y + 22, 80, 12, 5), ['--dept' as string]: '#8fa3b3' }}>Break room</span>

          {/* Engineering */}
          <Img file="DOUBLE_BOOKSHELF" x={6} y={6} w={32} h={32} />
          <Img file="BOOKSHELF" x={40} y={18} w={32} h={16} />
          <Img file="CLOCK" x={186} y={4} w={16} h={32} />
          <Img file="LARGE_PLANT" x={216} y={6} w={32} h={48} />
          <Img file="BIN" x={6} y={196} w={16} h={16} />
          <Img file="PLANT" x={236} y={178} w={16} h={32} />
          {/* Finance */}
          <Img file="DOUBLE_BOOKSHELF" x={262} y={6} w={32} h={32} />
          <Img file="LARGE_PAINTING" x={378} y={4} w={32} h={32} />
          <Img file="PLANT_2" x={398} y={178} w={16} h={32} />
          {/* People & Ops */}
          <Img file="SMALL_PAINTING" x={426} y={4} w={16} h={32} />
          <Img file="SMALL_PAINTING_2" x={446} y={4} w={16} h={32} />
          <Img file="HANGING_PLANT" x={616} y={2} w={16} h={32} />
          <Img file="SOFA_FRONT" x={540} y={150} w={32} h={16} />
          <Img file="SOFA_FRONT" x={572} y={150} w={32} h={16} />
          <Img file="COFFEE_TABLE" x={556} y={168} w={32} h={32} />
          <Img file="POT" x={618} y={196} w={16} h={16} />
          {/* Marketing */}
          <div className="rug" style={at(24, 384, 128, 24, 1)} />
          <Img file="LARGE_PAINTING" x={136} y={268} w={32} h={32} />
          <Img file="CACTUS" x={156} y={376} w={16} h={32} />
          {/* Sales */}
          <Img file="PLANT" x={284} y={380} w={16} h={32} />
          {/* Corridor */}
          <div className="runner" style={at(16, CORRIDOR.y + 16, W - 32, 16, 1)} />
          {[64, 224, 416, 576].map((x) => <div key={x} className="ceiling-light" style={at(x - 30, CORRIDOR.y - 6, 60, 60, 2)} />)}
          <button type="button" className="board-hit" style={at(354, CORRIDOR.y - 12, 36, 36, 302)} onClick={onWhiteboard} aria-label="Read the whiteboard: today’s top worries">
            <img className="px" src={`${ART}WHITEBOARD.png`} alt="" />
            <span className="board-tag">NOTICE</span>
            {alerts > 0 && <span className="board-alert" aria-hidden>!</span>}
          </button>
          {/* Lobby */}
          <Img file="DESK_FRONT" x={LOBBY.x + 88} y={LOBBY.y + 64} w={48} h={32} />
          <Img file="PC_FRONT_OFF" x={LOBBY.x + 104} y={LOBBY.y + 65} w={16} h={32} z={LOBBY.y + 103} />
          <span className="welcome" style={at(LOBBY.x + (LOBBY.w - 56) / 2, LOBBY.y + 106, 56, 10, 200)}>Welcome</span>
          <Img file="LARGE_PLANT" x={LOBBY.x + 4} y={LOBBY.y + 104} w={32} h={48} />
          <Img file="LARGE_PLANT" x={LOBBY.x + 108} y={LOBBY.y + 104} w={32} h={48} />
          <Img file="CUSHIONED_BENCH" x={LOBBY.x + 10} y={LOBBY.y + 60} w={16} h={16} />
          <Img file="CUSHIONED_BENCH" x={LOBBY.x + 10} y={LOBBY.y + 78} w={16} h={16} />
          {/* Break room */}
          <Img file="SMALL_TABLE_FRONT" x={BREAK.x + 140} y={BREAK.y + 30} w={32} h={32} />
          <Img file="COFFEE" x={BREAK.x + 148} y={BREAK.y + 30} w={16} h={16} z={BREAK.y + 64} />
          <div className="steam" style={at(BREAK.x + 152, BREAK.y + 18, 8, 12, 999)}>≈</div>
          <Img file="SOFA_FRONT" x={BREAK.x + 56} y={BREAK.y + 54} w={32} h={16} />
          <Img file="SOFA_FRONT" x={BREAK.x + 88} y={BREAK.y + 54} w={32} h={16} />
          <Img file="COFFEE_TABLE" x={BREAK.x + 72} y={BREAK.y + 72} w={32} h={32} />
          <Img file="SOFA_BACK" x={BREAK.x + 56} y={BREAK.y + 108} w={32} h={16} />
          <Img file="SOFA_BACK" x={BREAK.x + 88} y={BREAK.y + 108} w={32} h={16} />
          <Img file="LARGE_PLANT" x={BREAK.x + 156} y={BREAK.y + 100} w={32} h={48} />
          <Img file="BIN" x={BREAK.x + 8} y={BREAK.y + 44} w={16} h={16} />

          {/* People at their desks */}
          {ROOMS.flatMap((r) => r.desks.map((d, i) => {
            const a = seats.get(r)![i]
            return <Workstation key={`${r.dept}-${i}`} desk={d} agent={a} tick={tick} active={isActive(a)} onOpen={onOpen} onHover={setHover} onFocus={setFocus} />
          }))}
          {standing.slice(0, STANDING.length).map((a, i) => {
            const s = STANDING[i]!
            const active = isActive(a)
            return (
              <div key={a.employee_id}>
                <Sheet id={sprite(a)} x={s.x - 8} y={s.y - 30} z={s.y} col={active ? 7 : (tick + i) % 8 < 6 ? 1 : 7} row={0} />
                <button type="button" className={`desk-hit ${active ? 'is-active' : ''}`} style={at(s.x - 18, s.y - 36, 36, 44, 900)}
                  onClick={() => onOpen(a)} onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHover(a.employee_id) }}
                  onPointerLeave={() => setHover(null)}
                  onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setFocus(a.employee_id) }} onBlur={() => setFocus(null)} aria-label={`Talk to ${a.full_name}, ${a.title}`}>
                  <span className="speech">{active ? 'Hi!' : ''}</span>
                  <span className="nameplate">{a.full_name.split(' ')[0]}</span>
                </button>
              </div>
            )
          })}

          {edges.length > 0 && <RelationshipLines edges={edges} points={points} width={W} height={H} />}
          {data && agents.map((agent) => {
            const point = points.get(agent.employee_id)
            if (!point) return null
            return <SignalButtons key={agent.employee_id} id={agent.employee_id} name={agent.full_name}
              indicator={data.indicators[agent.employee_id]} active={activeSignal}
              style={{ left: `${100 * (point.x + (point.x > 560 ? -54 : 18)) / W}%`, top: `${100 * (point.y - 24) / H}%` }}
              onHover={setSignalHover} onFocus={setSignalFocus} onDismiss={dismissSignal}
              onToggle={(signal) => {
                setSignalFocus(null)
                setPinned((current) => current?.id === signal.id && current.kind === signal.kind ? null : signal)
              }} />
          })}
          {/* Ambient life */}
          <button type="button" ref={(el) => { courier.current.el = el }} className="courier-hit" aria-label="Zomato guy"
            aria-pressed={courierLabel} onClick={() => setCourierLabel((open) => !open)} onBlur={dismissCourierLabel}
            onKeyDown={(event) => { if (event.key === 'Escape') event.currentTarget.blur() }}>
            <span ref={(el) => { courier.current.sprite = el }} className="px sheet courier-sprite"
              style={{ backgroundImage: `url(${ART}people/courier.png)` }} aria-hidden />
            <span className="nameplate" aria-hidden>Zomato guy</span>
          </button>
          <div ref={cat} className="px cat" style={{ ...at(476, 382, 8, 16, 396), backgroundImage: `url(${ART}cat.png)`, backgroundPosition: '60% 0%' }} aria-hidden />
        </div>
        {data && activeSignal
          ? <SignalDetails signal={activeSignal} data={data} />
          : data && activePerson && <RelationshipLabels person={activePerson} edges={edges} names={data.names}
            status={data.indicators[activePerson.employee_id]?.status} />}
    </div>
  )
}
