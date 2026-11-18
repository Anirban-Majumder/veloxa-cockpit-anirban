import { useState } from 'react'
import { useDictation } from '../../lib/dictation'

export function Composer({ id, placeholder, busy, onSend, onStop }: {
  id: string
  placeholder: string
  busy: boolean
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [draft, setDraft] = useState('')
  const voice = useDictation(setDraft)

  const send = () => {
    const text = draft.trim()
    if (!text || busy) return
    voice.stop()
    onSend(text)
    setDraft('')
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-end gap-2">
      <label htmlFor={id} className="sr-only">Your question</label>
      <textarea
        id={id}
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        placeholder={placeholder}
        className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-ink/15 bg-white px-4 py-3 text-ink placeholder:text-ink-soft/70 focus:border-route focus:outline-none"
      />
      {voice.supported && (
        <button
          type="button"
          onClick={() => (voice.listening ? voice.stop() : voice.start(draft))}
          aria-pressed={voice.listening}
          aria-label={voice.listening ? 'Stop voice input' : 'Speak your question'}
          title={voice.error ?? (voice.listening ? 'Listening… tap to stop' : 'Speak your question')}
          className={`mic-btn ${voice.listening ? 'is-live' : ''}`}
        >
          <svg viewBox="0 0 8 10" aria-hidden shapeRendering="crispEdges"><path d="M3 0h2v1h1v4H5v1H3V5H2V1h1zM1 4h1v1h1v1h2V5h1V4h1v2H6v1H5v1h1v1H2V8h1V7H2V6H1z" fill="currentColor" /></svg>
        </button>
      )}
      {busy ? (
        <button type="button" onClick={onStop} className="h-12 rounded-2xl bg-ink px-5 font-bold text-white">Stop</button>
      ) : (
        <button type="submit" disabled={!draft.trim()} className="h-12 rounded-2xl bg-route px-5 font-bold text-white disabled:opacity-40">Ask</button>
      )}
    </form>
  )
}
