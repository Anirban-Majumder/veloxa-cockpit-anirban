import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, dayLabel, type Agent, type Concern, type Status } from './lib/api'
import { Whiteboard } from './components/Whiteboard'
import { ConcernDetail } from './components/ConcernDetail'
import { Office } from './components/Office'
import { Panel } from './components/Panel'
import { Chat } from './components/Chat'

type Open =
  | { kind: 'concern'; concern: Concern }
  | { kind: 'person'; agent: Agent }
  | null

const SUGGESTIONS = [
  'How many employees do we have right now?',
  'Is Atlas going to make its GA date?',
  'What did the last board update say about burn and runway?',
]

function greeting() {
  const h = Number(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }))
  return h < 12 ? 'Good morning, Ananya' : h < 17 ? 'Good afternoon, Ananya' : 'Good evening, Ananya'
}

export default function App() {
  const [status, setStatus] = useState<Status | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [cutoff, setCutoff] = useState<string | null>(null)
  const [concerns, setConcerns] = useState<Concern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Open>(null)
  const [footer, setFooter] = useState<ReactNode>(null)
  const [dock, setDock] = useState<ReactNode>(null)

  useEffect(() => {
    Promise.all([api.status(), api.agents()])
      .then(([s, a]) => { setStatus(s); setAgents(a); setCutoff(s.releases.at(-1)?.released_at ?? null) })
      .catch(() => setError('The cockpit server isn’t running. Start it with `bun run dev`.'))
  }, [])

  useEffect(() => {
    if (!cutoff) return
    setLoading(true)
    api.concerns(cutoff).then((d) => setConcerns(d.concerns)).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [cutoff])

  const close = useCallback(() => { setOpen(null); setFooter(null) }, [])
  const focusBoard = useCallback(() => {
    const first = concerns[0]
    if (first) setOpen({ kind: 'concern', concern: first })
    else document.getElementById('board-title')?.scrollIntoView({ behavior: 'smooth' })
  }, [concerns])

  return (
    <div className="hq">
      {/* The building's top wall doubles as the header. */}
      <header className="hq-roof">
        <div className="hq-brand">
          <span className="hq-logo" aria-hidden>▚</span>
          <span className="font-display">Veloxa <b>HQ</b></span>
        </div>
        <h1 className="hq-greeting font-display">{greeting()}</h1>
        {status && status.releases.length > 0 && (
          <fieldset className="hq-days">
            <legend className="sr-only">What the company knew on</legend>
            <span className="hq-days-label">Knew on</span>
            {status.releases.map((r) => {
              const on = r.released_at === cutoff
              return (
                <label key={r.day} className={`px-btn ${on ? 'is-on' : ''}`}>
                  <input type="radio" name="cutoff" className="sr-only" checked={on} onChange={() => setCutoff(r.released_at)} />
                  {dayLabel(r.released_at)}
                </label>
              )
            })}
          </fieldset>
        )}
      </header>

      {error && <p role="alert" className="hq-error">{error}</p>}

      <main className="hq-floor">
        <div className="hq-office">
          <Office
            agents={agents}
            alerts={concerns.length}
            selected={open?.kind === 'person' ? open.agent.employee_id : undefined}
            onOpen={(a) => setOpen({ kind: 'person', agent: a })}
            onWhiteboard={focusBoard}
          />
          <p className="hq-hint"><span className="live-dot" aria-hidden /> {agents.length} people in today · tap anyone at their desk to talk</p>
        </div>
        <aside className="hq-side">
          <Whiteboard
            concerns={concerns}
            loading={loading && !error}
            empty={status && !status.concernCutoffs.includes(cutoff ?? '') ? 'The worries for this date haven’t been worked out yet. Run `bun run ingest` for this day.' : undefined}
            onOpen={(c) => setOpen({ kind: 'concern', concern: c })}
          />
          <section className="dock" aria-labelledby="dock-title">
            <header className="dock-head">
              <h2 id="dock-title" className="font-display">Ask the cockpit</h2>
              {cutoff && <span className="dock-sub">as of {dayLabel(cutoff)}</span>}
            </header>
            <div className="dock-log">
              {cutoff && <Chat key={'analyst' + cutoff} agent="analyst" cutoff={cutoff} speaker="Cockpit" suggestions={SUGGESTIONS} onFooter={setDock} />}
            </div>
            <div className="dock-foot">{dock}</div>
            {status && <p className="dock-meta">{status.sources} files · {status.evidence} records · salaries never shown</p>}
          </section>
        </aside>
      </main>

      {open?.kind === 'concern' && (
        <Panel title={open.concern.title} subtitle={`Worry ${open.concern.rank} of 3`} onClose={close}>
          <ConcernDetail c={open.concern} />
        </Panel>
      )}
      {open?.kind === 'person' && cutoff && (
        <Panel title={open.agent.full_name} subtitle={`${open.agent.title}, ${open.agent.department} · joined ${open.agent.join_date}`} onClose={close} footer={footer}
          avatar={open.agent.employee_id}>
          <Chat key={open.agent.employee_id + cutoff} agent={open.agent.employee_id} cutoff={cutoff} speaker={open.agent.full_name}
            suggestions={['What are you working on right now?', 'What’s getting in your way?']} onFooter={setFooter} />
        </Panel>
      )}
    </div>
  )
}
