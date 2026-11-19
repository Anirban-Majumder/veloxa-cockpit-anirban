import type { OfficeData } from '../lib/api'

/** "N people working" note on the wall under Sales. */
export function OfficeRoster({ data }: { data: OfficeData }) {
  const count = data.agents.length
  return <p className="office-roster">{count} {count === 1 ? 'person' : 'people'} working · click or hover to interact</p>
}
