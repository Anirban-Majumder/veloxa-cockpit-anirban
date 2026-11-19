import { useEffect, useId, useState } from 'react'
import { fileName, locatorText, type EvidenceRef } from '../lib/api'

export function EvidenceList({ evidence, id, activeId }: {
  evidence: EvidenceRef[]
  id?: string
  activeId?: number
}) {
  const instance = useId()
  const listId = id ?? instance
  const files = new Map<string, Map<string, EvidenceRef[]>>()
  for (const item of evidence) {
    const sheets = files.get(item.path) ?? new Map<string, EvidenceRef[]>()
    if (!files.has(item.path)) files.set(item.path, sheets)
    const sheet = typeof item.locator?.sheet === 'string' ? item.locator.sheet : ''
    const items = sheets.get(sheet)
    if (items) items.push(item)
    else sheets.set(sheet, [item])
  }

  return (
    <div id={listId} className="my-2 space-y-2">
      {[...files].map(([path, sheets]) => (
        <EvidenceCard key={path} path={path} sheets={sheets} listId={listId} activeId={activeId} />
      ))}
    </div>
  )
}

const PREVIEW_LIMIT = 3

function EvidenceCard({ path, sheets, listId, activeId }: {
  path: string
  sheets: Map<string, EvidenceRef[]>
  listId: string
  activeId?: number
}) {
  const contentId = useId()
  const items = [...sheets.values()].flat()
  const activeIndex = items.findIndex((item) => item.id === activeId)
  const [view, setView] = useState({ activeId, expanded: activeIndex >= PREVIEW_LIMIT })
  if (view.activeId !== activeId) {
    setView({ activeId, expanded: view.expanded || activeIndex >= PREVIEW_LIMIT })
  }
  const { expanded } = view
  const remaining = items.length - PREVIEW_LIMIT
  const activeVisible = activeIndex >= 0 && (expanded || activeIndex < PREVIEW_LIMIT)
  const visibleIds = new Set((expanded ? items : items.slice(0, PREVIEW_LIMIT)).map((item) => item.id))

  useEffect(() => {
    if (activeVisible) document.getElementById(`${listId}-E${activeId}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeId, activeVisible, listId])

  return (
    <article className="rounded-lg border-l-4 border-route bg-route-soft/60 px-3 py-2">
      <h3 title={path} className="wrap-anywhere text-sm font-bold text-ink">{fileName(path)}</h3>
      <div id={contentId}>
        {[...sheets].map(([sheet, items]) => {
          const visible = items.filter((item) => visibleIds.has(item.id))
          if (!visible.length) return null
          return (
            <div key={sheet} className="mt-2">
              {sheets.size > 1 && sheet && <h4 className="text-xs font-bold text-ink-soft">{sheet}</h4>}
              <ul className="divide-y divide-ink/15">
                {visible.map((item) => {
                  const anchor = `${listId}-E${item.id}`
                  return (
                    <li key={item.id} id={anchor} aria-current={activeId === item.id || undefined}
                      className="scroll-m-2 px-2 py-2 text-sm target:bg-route/15 aria-current:bg-route/15">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-soft">
                        <a href={`#${anchor}`} className="font-bold text-route underline">E{item.id}</a>
                        <span>{locatorText(item.locator)}</span>
                      </div>
                      <p className="mt-1 wrap-anywhere whitespace-pre-line text-ink">{item.text}</p>
                      {item.rationale && <p className="mt-1 text-xs text-ink-soft italic">Why it matters: {item.rationale}</p>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      {remaining > 0 && (
        <button type="button" aria-expanded={expanded} aria-controls={contentId}
          className="mt-1 rounded px-2 py-1 text-sm font-semibold text-route hover:underline focus-visible:outline-2 focus-visible:outline-route"
          onClick={() => setView({ activeId, expanded: !expanded })}>
          {expanded ? 'Show less' : `Show ${remaining} more`}
        </button>
      )}
    </article>
  )
}
