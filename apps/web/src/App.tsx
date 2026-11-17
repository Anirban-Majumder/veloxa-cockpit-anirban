import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, dayLabel, type Agent, type Concern, type Status } from './lib/api'
import { Whiteboard } from './components/Whiteboard'
import { ConcernDetail } from './components/ConcernDetail'
import { Office } from './components/Office'
import { Panel } from './components/Panel'
import { Chat } from './components/Chat'
import { useDictation } from './lib/dictation'

type Open =
  | { kind: 'concern'; concern: Concern }
  | { kind: 'person'; agent: Agent }
  | { kind: 'analyst'; question?: string }
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
  const [ask, setAsk] = useState('')
  /** Analyst conversation number for this page visit; bumping it starts a fresh conversation. */
  const [session, setSession] = useState(0)
  const voice = useDictation(setAsk)

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

  /** Each page visit (and each Clear) starts a new analyst conversation on the server. */
  const startSession = async () => { await api.newChat('analyst').catch(() => {}); setSession((n) => n + 1) }
  const askAnalyst = async (question?: string) => {
    voice.stop()
    if (session === 0) await startSession()
    setFooter(null)
    setOpen({ kind: 'analyst', question })
    setAsk('')
  }
  const clearChat = async () => { setFooter(null); await startSession(); setOpen({ kind: 'analyst' }) }
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
          <form className="dock" onSubmit={(e) => { e.preventDefault(); void askAnalyst(ask.trim() || undefined) }}>
            <label htmlFor="dock-ask" className="dock-head font-display">Ask the cockpit</label>
            <div className="dock-row">
              <textarea
                id="dock-ask"
                rows={2}
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
                placeholder={cutoff ? `Ask anything about Veloxa, as of ${dayLabel(cutoff)}…` : 'Ask anything about Veloxa…'}
              />
            </div>
            <div className="dock-actions">
              {voice.supported && (
                <button type="button" onClick={() => (voice.listening ? voice.stop() : voice.start(ask))} aria-pressed={voice.listening}
                  aria-label={voice.listening ? 'Stop voice input' : 'Speak your question'} title={voice.error ?? (voice.listening ? 'Listening… tap to stop' : 'Speak your question')}
                  className={`mic-btn ${voice.listening ? 'is-live' : ''}`}>
                  <svg viewBox="0 0 8 10" aria-hidden shapeRendering="crispEdges"><path d="M3 0h2v1h1v4H5v1H3V5H2V1h1zM1 4h1v1h1v1h2V5h1V4h1v2H6v1H5v1h1v1H2V8h1V7H2V6H1z" fill="currentColor" /></svg>
                </button>
              )}
              <span className="dock-meta">{voice.listening ? 'Listening…' : status ? `${status.sources} files · salaries never shown` : ''}</span>
              <button type="submit" className="px-btn is-go">Ask ▸</button>
            </div>
          </form>
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
      {open?.kind === 'analyst' && cutoff && (
        <Panel title="Ask about Veloxa" subtitle={`Using what we knew on ${dayLabel(cutoff)}`} onClose={close} footer={footer}
          actions={<button type="button" className="px-btn" onClick={() => void clearChat()}>Clear chat</button>}>
          <Chat key={`analyst-${session}-${cutoff}`} agent="analyst" cutoff={cutoff} speaker="Cockpit" fresh
            suggestions={SUGGESTIONS} initial={open.question} onFooter={setFooter} />
        </Panel>
      )}
    </div>
  )
}
