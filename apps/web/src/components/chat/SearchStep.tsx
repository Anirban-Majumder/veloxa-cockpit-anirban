import { useState } from 'react'
import type { EvidenceRef } from '../../lib/api'
import { Citation } from '../Evidence'

type Props =
  | { state: 'input-streaming' | 'input-available'; query?: string }
  | { state: 'output-available'; query: string; results: EvidenceRef[] }
  | { state: 'output-error'; query?: string; error?: string }

export function SearchStep(props: Props) {
  const [open, setOpen] = useState(false)
  const query = props.query ? `“${props.query}”` : ''

  if (props.state === 'output-error') {
    return <p className="search-step is-error">Search {query} failed{props.error ? `: ${props.error}` : ''}</p>
  }

  if (props.state !== 'output-available') {
    return (
      <p className="search-step is-running" role="status">
        <span className="search-spinner" aria-hidden />
        Searching the records {query}
      </p>
    )
  }

  const count = props.results.length
  return (
    <div className="rise">
      <button type="button" className="search-step is-done" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden>🔎</span>
        Searched {query} · {count === 0 ? 'nothing found' : `${count} record${count === 1 ? '' : 's'}`}
        {count > 0 && <span className="search-caret" aria-hidden>{open ? '▴' : '▾'}</span>}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap">
          {props.results.map((result) => <Citation key={result.id} e={result} />)}
        </div>
      )}
    </div>
  )
}
