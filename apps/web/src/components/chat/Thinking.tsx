export function Thinking({ label = 'Thinking' }: { label?: string }) {
  return (
    <p className="rise flex items-center gap-2 text-sm text-ink-soft" role="status">
      <span className="typing text-xl leading-none" aria-hidden><span>•</span><span>•</span><span>•</span></span>
      {label}
    </p>
  )
}
