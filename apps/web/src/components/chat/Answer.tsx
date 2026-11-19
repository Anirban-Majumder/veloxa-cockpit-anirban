import { Fragment, useId, useState } from 'react'
import { fileName } from '../../lib/api'
import { EvidenceList } from '../Evidence'
import { splitCitations, splitConfidence, type Confidence } from './parse-answer'
import type { Source } from './sources'

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'bg-[#d6efd9] text-[#1f6b33]',
  medium: 'bg-marigold-soft text-[#7a5600]',
  low: 'bg-[#fbd9c9] text-alarm',
}

export function Answer({ text, sources, searched, streaming }: {
  text: string
  sources: Map<string, Source>
  searched: boolean
  streaming: boolean
}) {
  const evidenceListId = useId()
  const [openId, setOpenId] = useState<string | null>(null)
  const { body, confidence } = splitConfidence(text)
  const pieces = splitCitations(body)
  const cited = pieces.flatMap((p) => (p.kind === 'cite' ? p.ids : [])).filter((id) => sources.has(id))
  const evidence = [...new Set(cited)].flatMap((id) => {
    const source = sources.get(id)
    return source?.kind === 'evidence' ? [source.evidence] : []
  })
  const open = openId ? sources.get(openId) : undefined

  return (
    <div>
      <p className="leading-relaxed whitespace-pre-line">
        {pieces.map((piece, i) =>
          piece.kind === 'text' ? (
            <Fragment key={i}>{piece.text}</Fragment>
          ) : (
            piece.ids.map((id) => {
              const source = sources.get(id)
              if (!source) return <span key={`${i}-${id}`} className="text-ink-soft" title="Not from a search in this chat">[{id}]</span>
              return (
                <button
                  key={`${i}-${id}`}
                  type="button"
                  className={`cite-chip ${openId === id ? 'is-open' : ''}`}
                  aria-expanded={openId === id}
                  aria-controls={open?.kind === 'evidence' && source.kind === 'evidence' ? evidenceListId : undefined}
                  title={source.kind === 'table' ? `Summary of ${fileName(source.table)}` : fileName(source.evidence.path)}
                  onClick={() => setOpenId((current) => (current === id ? null : id))}
                >
                  {id}
                </button>
              )
            })
          ),
        )}
        {streaming && <span className="stream-caret" aria-hidden />}
      </p>

      {open?.kind === 'evidence' && <EvidenceList id={evidenceListId} evidence={evidence} activeId={open.evidence.id} />}
      {open?.kind === 'table' && (
        <pre className="rise my-2 max-h-64 overflow-auto rounded-lg border-l-4 border-route bg-route-soft/60 px-3 py-2 text-xs whitespace-pre-wrap">
          {`Summary of ${fileName(open.table)}\n${open.summary}`}
        </pre>
      )}

      {confidence && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full px-2.5 py-0.5 font-bold ${CONFIDENCE_STYLE[confidence.level]}`}>
            {confidence.level[0]!.toUpperCase() + confidence.level.slice(1)} confidence
          </span>
          <span className="text-ink-soft">{confidence.reason}</span>
        </p>
      )}

      {searched && !streaming && cited.length === 0 && (
        <p className="mt-2 text-sm text-alarm">No record was cited for this answer. Treat it with caution.</p>
      )}
    </div>
  )
}
