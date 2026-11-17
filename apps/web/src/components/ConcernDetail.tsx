import type { Concern } from '../lib/api'
import { SourceQuote } from './Evidence'

const SCALE = {
  impact: ['Limited', 'One team', 'Whole company'],
  urgency: ['Monitor', 'Act soon', 'Act now'],
  evidence_strength: ['Tentative or conflicting', 'One direct source', 'Several sources agree'],
} as const
const NAMES = { impact: 'How big', urgency: 'How soon', evidence_strength: 'How sure' } as const

export function ConcernDetail({ c }: { c: Concern }) {
  return (
    <div className="space-y-6">
      <p className="text-lg leading-relaxed">{c.description}</p>
      <dl className="space-y-4">
        {(['impact', 'urgency', 'evidence_strength'] as const).map((k) => (
          <div key={k}>
            <dt className="flex items-baseline justify-between gap-3">
              <span className="font-display font-bold">{NAMES[k]}</span>
              <span className="text-sm text-ink-soft">{SCALE[k][c[k] - 1]}</span>
            </dt>
            <dd>
              <span aria-hidden className="mt-1 flex gap-1">
                {[1, 2, 3].map((n) => <span key={n} className={`h-2 flex-1 rounded-full ${n <= c[k] ? 'bg-marigold' : 'bg-ink/10'}`} />)}
              </span>
              <span className="mt-1 block text-sm text-ink-soft">{c.reasons[k]}</span>
            </dd>
          </div>
        ))}
      </dl>
      {c.reasons.uncertainty && (
        <div className="rounded-xl bg-floor/70 p-4">
          <p className="font-display font-bold">What we don’t know yet</p>
          <p className="mt-1 text-ink-soft">{c.reasons.uncertainty}</p>
        </div>
      )}
      <div>
        <p className="font-display font-bold">Sources</p>
        {c.evidence.map((e) => <SourceQuote key={e.id} e={e} />)}
      </div>
      <p className="text-xs text-ink-soft">
        Priority {c.score} of 12, scored as twice the impact plus urgency plus evidence strength. Suggested by {c.model}; the order is computed, not chosen by the model.
      </p>
    </div>
  )
}
