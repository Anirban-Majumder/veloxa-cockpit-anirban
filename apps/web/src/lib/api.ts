import type { UIMessage } from 'ai'

export interface EvidenceRef {
  id: number
  path: string
  text: string
  locator?: Record<string, unknown>
  rationale?: string | null
  released_at?: string
}

export interface Concern {
  id: number
  rank: number
  title: string
  description: string
  impact: number
  urgency: number
  evidence_strength: number
  score: number
  reasons: { impact: string; urgency: string; evidence_strength: string; uncertainty: string }
  model: string
  generated_at: string
  evidence: EvidenceRef[]
}

export interface Agent {
  employee_id: string
  full_name: string
  department: string
  title: string
  manager_id: string | null
  join_date: string
  location: string
  status: string | null
  exit_date: string | null
}

export interface OfficeFact {
  label: string
  date: string
  evidence: { id: number; path: string }
}

export interface OfficeIndicator {
  status?: OfficeFact & { kind: 'leave' | 'on-call' | 'open' | 'recent' }
  requests: (OfficeFact & { response: string })[]
}

export interface OfficeData {
  agents: Agent[]
  names: Record<string, string>
  reporting: { from: string; to: string }[]
  openItems: (OfficeFact & { from: string; to: string })[]
  indicators: Record<string, OfficeIndicator>
}

export interface Status {
  releases: { day: number; released_at: string }[]
  concernCutoffs: string[]
  sources: number
  evidence: number
  agents: number
  model: string | null
}

export type ChatMessage = UIMessage<{ asOf?: string; briefSources?: EvidenceRef[] }, never, {
  search_evidence: { input: { query: string }; output: EvidenceRef[] }
  summarize_table: { input: { table: string }; output: { id: string; table: string; summary: string } }
}>

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (res.status === 401) window.location.replace('login')
  const body = await res.json().catch(() => ({ error: `Server returned ${res.status}` }))
  if (!res.ok) throw new Error(body.error ?? `Server returned ${res.status}`)
  return body as T
}

const chatUrl = (agent: string, cutoff?: string, conversation?: number) =>
  `api/chat?${new URLSearchParams({ agent, ...(cutoff && { cutoff }), ...(conversation && { conversation: String(conversation) }) })}`

export const api = {
  session: () => request<{ enabled: boolean }>('api/session'),
  logout: () => request<{ ok: boolean }>('api/logout', { method: 'POST' }),
  status: () => request<Status>('api/status'),
  office: (cutoff: string) => request<OfficeData>(`api/agents/office?cutoff=${encodeURIComponent(cutoff)}`),
  concerns: (cutoff: string) =>
    request<{ cutoff: string | null; concerns: Concern[] }>(`api/concerns?cutoff=${encodeURIComponent(cutoff)}`),
  chatHistory: (agent: string, cutoff: string, conversation?: number) =>
    request<ChatMessage[]>(chatUrl(agent, cutoff, conversation)),
  newConversation: (agent: string) =>
    request<{ conversation: number }>(chatUrl(agent), { method: 'DELETE' }).then((r) => r.conversation),
}

export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })

export const fileName = (path: string) => path.split('/').pop() ?? path

export const locatorText = (locator?: Record<string, unknown>) =>
  locator
    ? Object.entries(locator)
        .filter(([key, value]) => value != null && key !== 'role' && key !== 'message')
        .map(([key, value]) => `${key} ${value}`)
        .join(', ')
    : ''
