export function Thinking({ label = 'Thinking' }: { label?: string }) {
  return (
    <p className="rise flex items-center gap-2.5 text-sm" role="status">
      <span className="thinking-orb" aria-hidden />
      <span className="thinking-text">{label}…</span>
    </p>
  )
}
