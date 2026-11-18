import { useState } from 'react'
import { fileName } from '../../lib/api'

export function TableStep({ table, summary, failed }: { table?: string; summary?: string; failed: boolean }) {
  const [open, setOpen] = useState(false)
  const name = table ? fileName(table) : 'a table'

  if (failed) return <p className="search-step is-error">Could not summarize {name}</p>
  if (summary === undefined) {
    return (
      <p className="search-step is-running" role="status">
        <span className="search-spinner" aria-hidden />
        Counting rows in {name}
      </p>
    )
  }
  return (
    <div className="rise">
      <button type="button" className="search-step is-done" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden>📊</span>
        Summarized {name}
        <span className="search-caret" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-paper p-3 text-xs whitespace-pre-wrap">{summary}</pre>}
    </div>
  )
}
