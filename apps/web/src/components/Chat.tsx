import { useEffect, useRef, useState } from 'react'
import { api, type Message, type Reply } from '../lib/api'
import { Citation } from './Evidence'

const CONFIDENCE = {
  high: 'bg-[#d6efd9] text-[#1f6b33]',
  medium: 'bg-marigold-soft text-[#7a5600]',
  low: 'bg-[#fbd9c9] text-alarm',
} as const
const STATUS: Record<Reply['status'], string | null> = {
  answered: null, unknown: 'I don’t know', disagree: 'The sources disagree', refused: 'Can’t share this',
}

function Answer({ r }: { r: Reply }) {
  return (
    <div>
      {STATUS[r.status] && <p className="mb-1 font-display font-bold text-alarm">{STATUS[r.status]}</p>}
      <p className="leading-relaxed whitespace-pre-line">{r.answer}</p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-2.5 py-0.5 font-bold ${CONFIDENCE[r.confidence]}`}>{r.confidence[0]!.toUpperCase() + r.confidence.slice(1)} confidence</span>
        <span className="text-ink-soft">{r.confidence_reason}</span>
      </p>
      {r.evidence.length > 0 && <div className="mt-2">{r.evidence.map((e) => <Citation key={e.id} e={e} />)}</div>}
      {r.evidence.length === 0 && r.status === 'answered' && <p className="mt-2 text-sm text-alarm">No source was cited for this answer. Treat it with caution.</p>}
    </div>
  )
}

/** Reusable conversation with the analyst ("analyst") or a person agent (employee ID). History persists per agent. */
export function Chat({ agent, cutoff, speaker, suggestions, initial, onFooter }: {
  agent: string; cutoff: string; speaker: string; suggestions?: string[]; initial?: string
  onFooter: (node: React.ReactNode) => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const sentInitial = useRef(false)

  useEffect(() => {
    let live = true
    setLoaded(false)
    api.history(agent, cutoff).then((m) => { if (live) { setMessages(m); setLoaded(true) } }).catch(() => live && setLoaded(true))
    return () => { live = false }
  }, [agent, cutoff])

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setDraft(''); setBusy(true)
    const tmp = `tmp-${Date.now()}`
    setMessages((m) => [...m, { id: tmp, role: 'user', content: q, created_at: '' }, { id: `${tmp}-a`, role: 'assistant', content: '', created_at: '', pending: true }])
    try {
      const reply = await api.ask(agent, q, cutoff)
      setMessages((m) => m.map((x) => (x.id === `${tmp}-a` ? { ...x, pending: false, content: reply.answer, reply } : x)))
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === `${tmp}-a` ? { ...x, pending: false, error: (e as Error).message } : x)))
    } finally { setBusy(false) }
  }

  useEffect(() => {
    if (loaded && initial && !sentInitial.current) { sentInitial.current = true; void send(initial) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, initial])

  useEffect(() => {
    onFooter(
      <form onSubmit={(e) => { e.preventDefault(); void send(draft) }} className="flex items-end gap-2">
        <label htmlFor={`ask-${agent}`} className="sr-only">Your question</label>
        <textarea
          id={`ask-${agent}`}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft) } }}
          placeholder={agent === 'analyst' ? 'Ask one question about the company' : `Ask ${speaker.split(' ')[0]} something`}
          className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-ink/15 bg-white px-4 py-3 text-ink placeholder:text-ink-soft/70 focus:border-route focus:outline-none"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="h-12 rounded-2xl bg-route px-5 font-bold text-white disabled:opacity-40">
          {busy ? 'Asking…' : 'Ask'}
        </button>
      </form>,
    )
  }, [draft, busy, agent, speaker]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5" aria-live="polite">
      {loaded && messages.length === 0 && (
        <div>
          <p className="text-ink-soft">
            {agent === 'analyst'
              ? 'Answers cite the records behind them, state how sure they are, and say so when the files don’t know.'
              : `${speaker.split(' ')[0]} only knows what their own records and conversations show, and remembers what you discussed before.`}
          </p>
          {suggestions && (
            <ul className="mt-4 space-y-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => void send(s)} className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-left hover:border-route">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {messages.map((m) =>
        m.role === 'user' ? (
          <p key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-paper">{m.content}</p>
        ) : (
          <div key={m.id} className="max-w-[95%] rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-ink/5">
            <p className="mb-1 text-sm font-bold text-ink-soft">{speaker}</p>
            {m.pending && <p className="typing text-2xl leading-none text-ink-soft" aria-label="Thinking"><span>•</span><span>•</span><span>•</span></p>}
            {m.error && <p className="text-alarm">{m.error}</p>}
            {m.reply && <Answer r={m.reply} />}
          </div>
        ),
      )}
      <div ref={end} />
    </div>
  )
}
