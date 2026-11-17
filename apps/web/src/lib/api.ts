export interface EvidenceRef { id: number; path: string; text: string; locator?: Record<string, unknown>; rationale?: string | null; released_at?: string }
export interface Concern {
  id: number; rank: number; title: string; description: string
  impact: number; urgency: number; evidence_strength: number; score: number
  reasons: { impact: string; urgency: string; evidence_strength: string; uncertainty: string }
  model: string; generated_at: string; evidence: EvidenceRef[]
}
export interface Agent { employee_id: string; full_name: string; department: string; title: string; manager_id: string | null; join_date: string; location: string }
export interface Status { releases: { day: number; released_at: string }[]; concernCutoffs: string[]; evidence: number; sources: number; agents: number; model: string | null }
export interface Reply { answer: string; status: 'answered' | 'unknown' | 'disagree' | 'refused'; confidence: 'high' | 'medium' | 'low'; confidence_reason: string; citations: number[]; evidence: EvidenceRef[]; model?: string }
export interface Message { id: number | string; role: 'user' | 'assistant'; content: string; reply?: Reply; created_at: string; pending?: boolean; error?: string }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({ error: `Server returned ${res.status}` }))
  if (!res.ok || (body && typeof body === 'object' && 'error' in body && body.error)) throw new Error((body as { error: string }).error ?? `Server returned ${res.status}`)
  return body as T
}

/** A stalled model call must not leave the chat spinning forever (the server retries invalid JSON once). */
const ASK_TIMEOUT_MS = 90_000

export const api = {
  status: () => fetch('/api/status').then((r) => json<Status>(r)),
  agents: () => fetch('/api/agents').then((r) => json<Agent[]>(r)),
  concerns: (cutoff: string) => fetch(`/api/concerns?cutoff=${encodeURIComponent(cutoff)}`).then((r) => json<{ cutoff: string | null; concerns: Concern[]; message?: string }>(r)),
  history: (agent: string, cutoff: string) => fetch(`/api/chat/${agent}?cutoff=${encodeURIComponent(cutoff)}`).then((r) => json<Message[]>(r)),
  newChat: (agent: string) => fetch(`/api/chat/${agent}/new`, { method: 'POST' }).then((r) => json<{ ok: boolean }>(r)),
  ask: (agent: string, message: string, cutoff: string) =>
    fetch(`/api/chat/${agent}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, cutoff }), signal: AbortSignal.timeout(ASK_TIMEOUT_MS) })
      .then((r) => json<Reply>(r))
      .catch((e: Error) => { throw e.name === 'TimeoutError' ? new Error('The answer took too long. Your question is back in the box; please retry.') : e }),
}

export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })
export const fileName = (p: string) => p.split('/').pop() ?? p
export const locatorText = (l?: Record<string, unknown>) =>
  l ? Object.entries(l).filter(([k, v]) => v != null && k !== 'role' && k !== 'message').map(([k, v]) => `${k} ${v}`).join(', ') : ''
