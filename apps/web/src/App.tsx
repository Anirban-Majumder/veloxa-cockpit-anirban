import { useEffect, useState } from 'react'

interface Evidence {
  id: number
  rationale: string | null
  text: string
  path: string
  locator: Record<string, unknown>
  released_at: string
}
interface Concern {
  id: number
  rank: number
  title: string
  description: string
  impact: number
  urgency: number
  evidence_strength: number
  score: number
  reasons: { impact: string; urgency: string; evidence_strength: string; uncertainty: string }
  model: string
  generated_at: string
  evidence: Evidence[]
}
interface ConcernsResponse {
  cutoff: string | null
  concerns: Concern[]
  message?: string
  error?: string
}
interface Status {
  releases: { day: number; released_at: string }[]
  concernCutoffs: string[]
  evidence: number
  agents: number
}

const LABELS = {
  impact: ['', 'Limited', 'Team-level', 'Company-wide'],
  urgency: ['', 'Monitor', 'Act soon', 'Act now'],
  evidence_strength: ['', 'Tentative', 'Single source', 'Corroborated'],
} as const

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const fileName = (path: string) => path.split('/').pop()
const locate = (l: Record<string, unknown>) =>
  Object.entries(l).filter(([k, v]) => v != null && k !== 'role').map(([k, v]) => `${k} ${v}`).join(', ')

function Factor({ name, value, reason }: { name: keyof typeof LABELS; value: number; reason: string }) {
  return (
    <div className="rounded-lg bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tracking-wide text-slate-400 uppercase">{name.replace('_', ' ')}</span>
        <span className="flex gap-1" aria-label={`${value} of 3`}>
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 w-4 rounded-full ${i <= value ? 'bg-amber-400' : 'bg-slate-700'}`} />
          ))}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-200">{LABELS[name][value]}</p>
      <p className="mt-1 text-xs text-slate-400">{reason}</p>
    </div>
  )
}

function ConcernCard({ c }: { c: Concern }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg sm:p-6">
      <header className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-400 text-lg font-bold text-slate-950">
          {c.rank}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">{c.title}</h2>
          <p className="mt-1 text-slate-300">{c.description}</p>
        </div>
        <span className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300" title="2 × impact + urgency + evidence strength">
          score {c.score}/12
        </span>
      </header>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Factor name="impact" value={c.impact} reason={c.reasons.impact} />
        <Factor name="urgency" value={c.urgency} reason={c.reasons.urgency} />
        <Factor name="evidence_strength" value={c.evidence_strength} reason={c.reasons.evidence_strength} />
      </div>

      {c.reasons.uncertainty && (
        <p className="mt-3 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400">
          <span className="font-medium text-slate-300">Unknown: </span>
          {c.reasons.uncertainty}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-sm font-medium text-teal-400 hover:text-teal-300"
        aria-expanded={open}
      >
        {open ? 'Hide' : 'Show'} evidence ({c.evidence.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {c.evidence.map((e) => (
            <li key={e.id} className="rounded-lg bg-slate-950/60 p-3 text-sm">
              <div className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                <span className="font-mono text-teal-500">E{e.id}</span>
                <span>{fileName(e.path)}</span>
                <span>{locate(e.locator)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-slate-300">{e.text.length > 400 ? `${e.text.slice(0, 400)}…` : e.text}</p>
              {e.rationale && <p className="mt-1 text-xs text-slate-500 italic">{e.rationale}</p>}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export default function App() {
  const [status, setStatus] = useState<Status | null>(null)
  const [cutoff, setCutoff] = useState<string | undefined>()
  const [data, setData] = useState<ConcernsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => setError('API unreachable. Is `bun run dev` running?'))
  }, [])

  useEffect(() => {
    const q = cutoff ? `?cutoff=${encodeURIComponent(cutoff)}` : ''
    fetch(`/api/concerns${q}`)
      .then((r) => r.json() as Promise<ConcernsResponse>)
      .then((d) => (d.error ? setError(d.error) : (setError(null), setData(d))))
      .catch(() => setError('API unreachable. Is `bun run dev` running?'))
  }, [cutoff])

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-widest text-teal-400 uppercase">Veloxa Cockpit</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">What to worry about today</h1>
            {data?.cutoff && <p className="mt-1 text-sm text-slate-400">Based on everything known as of {fmtDate(data.cutoff)} IST</p>}
          </div>
          {status && status.concernCutoffs.length > 1 && (
            <label className="text-sm text-slate-400">
              Knowledge date{' '}
              <select
                className="ml-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
                value={data?.cutoff ?? ''}
                onChange={(e) => setCutoff(e.target.value)}
              >
                {status.concernCutoffs.map((c) => (
                  <option key={c} value={c}>{fmtDate(c)}</option>
                ))}
              </select>
            </label>
          )}
        </header>

        <section className="mt-8 space-y-4" aria-label="Top concerns">
          {error && <p className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">{error}</p>}
          {!error && !data && <p className="text-slate-400">Loading…</p>}
          {data && data.concerns.length === 0 && <p className="text-slate-400">{data.message ?? 'No concerns for this date.'}</p>}
          {data?.concerns.map((c) => <ConcernCard key={c.id} c={c} />)}
        </section>

        {data && data.concerns[0] && status && (
          <footer className="mt-8 text-xs text-slate-500">
            Ranked by 2 × impact + urgency + evidence strength. Proposed by {data.concerns[0].model} from {status.evidence} evidence
            rows; individual salaries are never shown.
          </footer>
        )}
      </div>
    </main>
  )
}
