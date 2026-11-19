import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, dayLabel, type Agent, type OfficeData, type Concern, type Status } from './lib/api'
import { Whiteboard } from './components/Whiteboard'
import { ConcernDetail } from './components/ConcernDetail'
import { Office } from './components/Office'
import { OfficeRoster } from './components/OfficeRoster'
import { Panel } from './components/Panel'
import { Chat } from './components/chat/Chat'
import { useDictation } from './lib/dictation'

type Open =
  | { kind: 'notice' }
  | { kind: 'concern'; concern: Concern }
  | { kind: 'person'; agent: Agent }
  | { kind: 'analyst'; question?: { text: string; cutoff: string } }
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
  const [authEnabled, setAuthEnabled] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [office, setOffice] = useState<{ cutoff: string; data: OfficeData } | null>(null)
  const [cutoff, setCutoff] = useState<string | null>(null)
  const [board, setBoard] = useState<{ cutoff: string; concerns: Concern[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Open>(null)
  const [footer, setFooter] = useState<ReactNode>(null)
  const [ask, setAsk] = useState('')
  /** The analyst chat lasts one page visit: each visit (and each Clear) gets its own conversation. */
  const [analystConversation, setAnalystConversation] = useState<number | null>(null)
  const voice = useDictation(setAsk)

  useEffect(() => {
    api.session().then(({ enabled }) => setAuthEnabled(enabled)).catch(() => {})
    api.status()
      .then((s) => { setStatus(s); setCutoff(s.releases.at(-1)?.released_at ?? null) })
      .catch(() => setError('The Veloxa Digital HQ server isn’t running. Start it with `bun run dev`.'))
  }, [])

  useEffect(() => {
    if (!cutoff) return
    let current = true
    api.office(cutoff)
      .then((data) => current && setOffice({ cutoff, data }))
      .catch((e: Error) => current && setError(e.message))
    api.concerns(cutoff)
      .then((d) => current && setBoard({ cutoff, concerns: d.concerns }))
      .catch((e: Error) => current && setError(e.message))
    return () => { current = false }
  }, [cutoff])

  const officeData = office?.cutoff === cutoff ? office?.data : undefined
  const loading = !!cutoff && board?.cutoff !== cutoff
  const concerns = useMemo(() => (board?.cutoff === cutoff ? board.concerns : []), [board, cutoff])

  const logout = async () => {
    try {
      await api.logout()
      window.location.replace('login')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const chooseDay = (releasedAt: string) => {
    setCutoff(releasedAt)
    setOpen((o) => (o?.kind === 'analyst' ? { kind: 'analyst' } : null))
  }

  const close = useCallback(() => { setOpen(null); setFooter(null) }, [])

  const startAnalystConversation = async () => {
    try {
      setAnalystConversation(await api.newConversation('analyst'))
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }
  const askAnalyst = async (question?: string) => {
    voice.stop()
    if (!cutoff) {
      setError('Nothing has been ingested yet. Run `bun run ingest`, then reload.')
      return
    }
    if (analystConversation === null && !(await startAnalystConversation())) return
    setFooter(null)
    setOpen({ kind: 'analyst', question: question && cutoff ? { text: question, cutoff } : undefined })
    setAsk('')
  }
  const clearChat = async () => {
    if (!(await startAnalystConversation())) return
    setFooter(null)
    setOpen({ kind: 'analyst' })
  }
  const openPerson = (agent: Agent) => setOpen({ kind: 'person', agent })
  const openConcern = (concern: Concern) => setOpen({ kind: 'concern', concern })
  const emptyBoard = status && !status.concernCutoffs.includes(cutoff ?? '')
    ? 'The worries for this date haven’t been worked out yet. Run `bun run ingest` for this day.'
    : undefined

  return (
    <div className="hq">
      {/* The building's top wall doubles as the header. */}
      <header className="hq-roof">
        <div className="hq-brand">
          <span className="hq-logo" aria-hidden>▚</span>
          <span className="font-display">Veloxa Digital <b>HQ</b></span>
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
                  <input type="radio" name="cutoff" className="sr-only" checked={on} onChange={() => chooseDay(r.released_at)} />
                  {dayLabel(r.released_at)}
                </label>
              )
            })}
          </fieldset>
        )}
        {authEnabled && <button type="button" className="px-btn" onClick={() => void logout()}>Sign out</button>}
      </header>

      {error && <p role="alert" className="hq-error">{error}</p>}

      <main className="hq-floor">
        <div className="hq-office">
          <Office
            key={cutoff}
            data={officeData}
            alerts={concerns.length}
            selected={open?.kind === 'person' ? open.agent.employee_id : undefined}
            onOpen={openPerson}
            onWhiteboard={() => setOpen({ kind: 'notice' })}
          >
            {officeData && <OfficeRoster data={officeData} />}
          </Office>
        </div>
        <aside className="hq-side">
          <Whiteboard
            concerns={concerns.slice(0, 3)}
            loading={loading && !error}
            empty={emptyBoard}
            onOpen={openConcern}
          />
          <form className="dock" onSubmit={(e) => { e.preventDefault(); void askAnalyst(ask.trim() || undefined) }}>
            <label htmlFor="dock-ask" className="dock-head font-display">Ask Veloxa Digital HQ</label>
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
              <span className="dock-meta">{voice.listening ? 'Listening…' : status ? `${status.sources} files read` : ''}</span>
              <button type="submit" className="px-btn is-go">Ask ▸</button>
            </div>
          </form>
        </aside>
      </main>

      {open?.kind === 'notice' && (
        <Panel title="What to worry about" onClose={close}>
          <Whiteboard expanded concerns={concerns} loading={loading && !error} empty={emptyBoard} onOpen={openConcern} />
        </Panel>
      )}
      {open?.kind === 'concern' && (
        <Panel title={open.concern.title} subtitle={`Worry ${open.concern.rank} of ${concerns.length}`} onClose={close}>
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
      {open?.kind === 'analyst' && cutoff && analystConversation !== null && (
        <Panel title="Ask about Veloxa" subtitle={`Using what we knew on ${dayLabel(cutoff)}`} onClose={close} footer={footer}
          actions={<button type="button" className="px-btn" onClick={() => void clearChat()}>Clear chat</button>}>
          <Chat key={`analyst-${analystConversation}-${cutoff}`} agent="analyst" cutoff={cutoff} conversation={analystConversation} speaker="Veloxa Digital HQ"
            suggestions={SUGGESTIONS} initialQuestion={open.question?.cutoff === cutoff ? open.question.text : undefined} onFooter={setFooter} />
        </Panel>
      )}
    </div>
  )
}
