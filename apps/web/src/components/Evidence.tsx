import { useState } from 'react'
import { fileName, locatorText, type EvidenceRef } from '../lib/api'

/** A citation chip that expands into the source passage it points to. */
export function Citation({ e }: { e: EvidenceRef }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="inline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mr-1 mb-1 inline-flex items-center gap-1 rounded-full border border-ink/15 bg-paper px-2 py-0.5 text-xs text-ink-soft hover:border-route hover:text-route"
        title={e.text.slice(0, 200)}
      >
        <span className="font-bold">E{e.id}</span>
        <span className="max-w-[14rem] truncate">{fileName(e.path)}</span>
      </button>
      {open && <SourceQuote e={e} />}
    </span>
  )
}

export function SourceQuote({ e }: { e: EvidenceRef }) {
  return (
    <span className="rise my-2 block rounded-lg border-l-4 border-route bg-route-soft/60 px-3 py-2 text-sm">
      <span className="block text-xs text-ink-soft">
        {fileName(e.path)}{locatorText(e.locator) && `, ${locatorText(e.locator)}`}
      </span>
      <span className="mt-1 block whitespace-pre-line text-ink">{e.text.length > 500 ? `${e.text.slice(0, 500)}…` : e.text}</span>
      {e.rationale && <span className="mt-1 block text-xs text-ink-soft italic">Why it matters: {e.rationale}</span>}
    </span>
  )
}
