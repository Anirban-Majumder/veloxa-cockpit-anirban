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
  const [quick, setQuick] = useState('')

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

  return (
    <div className="floor-tiles min-h-full pb-32">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="font-display text-lg font-bold text-route">Veloxa</p>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">{greeting()}</h1>
          </div>
          {status && status.releases.length > 0 && (
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="sr-only">What the company knew on</legend>
              <span className="mr-1 text-sm text-ink-soft">What we knew on</span>
              {status.releases.map((r) => {
                const on = r.released_at === cutoff
                return (
                  <label key={r.day} className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-bold ring-1 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-route ${on ? 'bg-ink text-paper ring-ink' : 'bg-paper text-ink ring-ink/15 hover:ring-ink/40'}`}>
                    <input type="radio" name="cutoff" className="sr-only" checked={on} onChange={() => setCutoff(r.released_at)} />
                    {dayLabel(r.released_at)}
                  </label>
                )
              })}
            </fieldset>
          )}
        </header>

        {error && <p role="alert" className="mt-6 rounded-xl bg-[#fbd9c9] p-4 text-alarm">{error}</p>}

        <main className="mt-8 space-y-10">
          <div id="whiteboard" className="scroll-mt-6">
          <Whiteboard
            concerns={concerns}
            loading={loading && !error}
            empty={status && !status.concernCutoffs.includes(cutoff ?? '') ? 'The worries for this date haven’t been worked out yet. Run `bun run ingest` for this day to rank them.' : undefined}
            onOpen={(c) => setOpen({ kind: 'concern', concern: c })}
          />
          </div>
          <Office
            agents={agents}
            selected={open?.kind === 'person' ? open.agent.employee_id : undefined}
            onOpen={(a) => setOpen({ kind: 'person', agent: a })}
            onWhiteboard={() => document.getElementById('whiteboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        </main>

        {status && (
          <p className="mt-8 max-w-prose text-sm text-ink-soft">
            Built from {status.sources} files and {status.evidence} records released up to {cutoff ? dayLabel(cutoff) : 'today'}. Individual salaries are never shown.
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setOpen({ kind: 'analyst', question: quick.trim() || undefined }); setQuick('') }}
        className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:pb-6"
      >
        <div className="mx-auto flex max-w-2xl gap-2 rounded-[22px] bg-ink p-2 shadow-[0_20px_40px_-12px_rgb(38_52_59/.6)]">
          <label htmlFor="quick-ask" className="sr-only">Ask about Veloxa</label>
          <input
            id="quick-ask"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="Ask anything about Veloxa"
            className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 text-paper placeholder:text-paper/60 focus:outline-none"
          />
          <button type="submit" className="rounded-2xl bg-marigold px-5 py-3 font-bold text-ink hover:bg-[#ffbe1f]">Ask</button>
        </div>
      </form>

      {open?.kind === 'concern' && (
        <Panel title={open.concern.title} subtitle={`Worry ${open.concern.rank} of 3`} onClose={close}>
          <ConcernDetail c={open.concern} />
        </Panel>
      )}
      {open?.kind === 'person' && cutoff && (
        <Panel title={open.agent.full_name} subtitle={`${open.agent.title}, ${open.agent.department} · joined ${open.agent.join_date}`} onClose={close} footer={footer}>
          <Chat key={open.agent.employee_id + cutoff} agent={open.agent.employee_id} cutoff={cutoff} speaker={open.agent.full_name}
            suggestions={['What are you working on right now?', 'What’s getting in your way?']} onFooter={setFooter} />
        </Panel>
      )}
      {open?.kind === 'analyst' && cutoff && (
        <Panel full title="Ask about Veloxa" subtitle={`Using what we knew on ${dayLabel(cutoff)}`} onClose={close} footer={footer}>
          <Chat key={'analyst' + cutoff} agent="analyst" cutoff={cutoff} speaker="Cockpit" suggestions={SUGGESTIONS} initial={open.question} onFooter={setFooter} />
        </Panel>
      )}
    </div>
  )
}
