import { useEffect, useRef, type ReactNode } from 'react'

/** Shared shell: a right-hand sidebar on wide screens, full screen on phones (or always, with `full`). */
export function Panel({ title, subtitle, onClose, full, children, footer }: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void; full?: boolean; children: ReactNode; footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`panel-in relative flex h-full w-full flex-col bg-paper shadow-2xl outline-none ${full ? '' : 'md:max-w-[34rem] md:rounded-l-3xl'}`}
      >
        <header className="flex items-start gap-4 border-b border-ink/10 px-5 py-4 sm:px-7">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight font-bold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-ink-soft">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-ink-soft hover:bg-ink/5 hover:text-ink">
            Close
          </button>
        </header>
        <div className={`flex-1 overflow-y-auto px-5 py-5 sm:px-7 ${full ? 'mx-auto w-full max-w-3xl' : ''}`}>{children}</div>
        {footer && <div className={`border-t border-ink/10 px-5 py-4 sm:px-7 ${full ? 'mx-auto w-full max-w-3xl border-x-0' : ''}`}>{footer}</div>}
      </div>
    </div>
  )
}
