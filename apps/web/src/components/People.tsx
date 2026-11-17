import type { Agent } from '../lib/api'

const ORDER = ['Engineering', 'Finance', 'People & Ops', 'Marketing', 'Sales']

export function People({ agents, onOpen }: { agents: Agent[]; onOpen: (a: Agent) => void }) {
  const groups = ORDER.map((d) => [d, agents.filter((a) => a.department === d)] as const).filter(([, l]) => l.length)
  return (
    <section aria-labelledby="people-title">
      <h2 id="people-title" className="font-display text-xl font-bold">Talk to your team</h2>
      <p className="mt-1 text-sm text-ink-soft">Each person answers from their own records and remembers your past conversations.</p>
      <div className="mt-4 space-y-5">
        {groups.map(([dept, list]) => (
          <div key={dept}>
            <h3 className="text-sm font-bold text-ink-soft">{dept}</h3>
            <ul className="mt-1.5 divide-y divide-ink/10 rounded-2xl bg-paper ring-1 ring-ink/10">
              {list.map((a) => (
                <li key={a.employee_id}>
                  <button type="button" onClick={() => onOpen(a)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left first:rounded-t-2xl last:rounded-b-2xl hover:bg-route-soft/50">
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-floor font-display text-sm font-bold">
                      {a.full_name.split(' ').map((p) => p[0]).join('')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{a.full_name}</span>
                      <span className="block truncate text-sm text-ink-soft">{a.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
