import { useEffect, useRef, type ReactNode } from 'react'

/** Shared pixel-window shell: a right-hand sidebar on wide screens, full screen on phones (or always, with `full`). */
export function Panel({ title, subtitle, onClose, full, children, footer, avatar }: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void; full?: boolean; children: ReactNode; footer?: ReactNode
  /** Employee ID whose office sprite is shown in the title bar. */
  avatar?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])

  const sprite = avatar && /^VX0(0[2-9]|1[0-8])$/.test(avatar) ? avatar : 'default'
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#0b1118]/55" />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`px-window panel-in relative flex h-full w-full flex-col outline-none ${full ? '' : 'md:max-w-[34rem]'}`}
      >
        <header className="px-window-bar">
          {avatar && <span className="px-avatar" aria-hidden style={{ backgroundImage: `url(/office/people/${sprite}.png)` }} />}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-tight sm:text-2xl">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-[#b9c6d3]">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="px-btn" aria-label="Close panel">✕</button>
        </header>
        <div className={`flex-1 overflow-y-auto px-5 py-5 sm:px-7 ${full ? 'mx-auto w-full max-w-3xl' : ''}`}>{children}</div>
        {footer && <div className={`px-window-foot ${full ? 'mx-auto w-full max-w-3xl' : ''}`}>{footer}</div>}
      </div>
    </div>
  )
}
