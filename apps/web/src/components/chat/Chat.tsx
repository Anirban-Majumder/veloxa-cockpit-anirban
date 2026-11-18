import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, type ChatMessage } from '../../lib/api'
import { Composer } from './Composer'
import { Message } from './Message'
import { collectSources } from './sources'
import { Thinking } from './Thinking'

interface ChatProps {
  /** Employee ID, or "analyst" for the cockpit. */
  agent: string
  cutoff: string
  /** Pins this view to one conversation; person chats omit it and continue the latest. */
  conversation?: number
  speaker: string
  suggestions?: string[]
  initialQuestion?: string
  onFooter: (footer: ReactNode) => void
}

export function Chat(props: ChatProps) {
  const [history, setHistory] = useState<ChatMessage[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    props.onFooter(null)
    api.chatHistory(props.agent, props.cutoff, props.conversation)
      .then((messages) => active && setHistory(messages))
      .catch((error: Error) => active && setLoadError(error.message))
    return () => { active = false }
  }, [props.agent, props.cutoff, props.conversation]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) return <p className="text-alarm">{loadError}</p>
  if (!history) return <Thinking label="Opening the conversation" />
  return <Conversation {...props} history={history} />
}

function Conversation({ agent, cutoff, conversation, speaker, suggestions, initialQuestion, onFooter, history }: ChatProps & { history: ChatMessage[] }) {
  const transport = useMemo(() => new DefaultChatTransport<ChatMessage>({
    api: '/api/chat',
    prepareSendMessagesRequest: ({ messages }) => ({ body: { agent, cutoff, conversation, message: messages.at(-1) } }),
  }), [agent, cutoff, conversation])

  const { messages, sendMessage, status, stop, error, regenerate } = useChat<ChatMessage>({
    id: `${agent}@${cutoff}#${conversation ?? 'latest'}`,
    messages: history,
    transport,
  })

  const busy = status === 'submitted' || status === 'streaming'
  const sources = useMemo(() => collectSources(messages), [messages])
  const end = useRef<HTMLDivElement>(null)
  const askedInitial = useRef(false)

  const ask = (text: string) => void sendMessage({ text })

  useEffect(() => {
    if (!initialQuestion || askedInitial.current) return
    const timer = setTimeout(() => {
      askedInitial.current = true
      ask(initialQuestion)
    })
    return () => clearTimeout(timer)
  }, [initialQuestion]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages, status])

  useEffect(() => {
    onFooter(
      <Composer
        id={`ask-${agent}`}
        placeholder={agent === 'analyst' ? 'Ask about Veloxa…' : `Ask ${speaker.split(' ')[0]} something`}
        busy={busy}
        onSend={ask}
        onStop={() => void stop()}
      />,
    )
  }, [agent, speaker, busy]) // eslint-disable-line react-hooks/exhaustive-deps

  const lastIsUser = messages.at(-1)?.role === 'user'

  return (
    <div className="space-y-5" aria-live="polite">
      {messages.length === 0 && (
        <Welcome agent={agent} speaker={speaker} suggestions={suggestions} onPick={ask} />
      )}
      {messages.map((message, index) => (
        <Message
          key={message.id}
          message={message}
          speaker={speaker}
          sources={sources}
          streaming={busy && index === messages.length - 1}
        />
      ))}
      {busy && lastIsUser && (
        <div className="max-w-[95%] w-fit rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-ink/5">
          <Thinking />
        </div>
      )}
      {error && (
        <p className="flex items-center gap-3 text-alarm">
          {error.message || 'Something went wrong.'}
          <button type="button" className="px-btn" onClick={() => void regenerate()}>Try again</button>
        </p>
      )}
      <div ref={end} />
    </div>
  )
}

function Welcome({ agent, speaker, suggestions, onPick }: {
  agent: string
  speaker: string
  suggestions?: string[]
  onPick: (text: string) => void
}) {
  const firstName = speaker.split(' ')[0]
  return (
    <div>
      <p className="text-ink-soft">
        {agent === 'analyst'
          ? 'Answers cite the records behind them, say how sure they are, and admit when the files don’t know.'
          : `${firstName} only knows what their own records and conversations show, and remembers what you discussed before.`}
      </p>
      {suggestions && (
        <ul className="mt-4 space-y-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button type="button" onClick={() => onPick(suggestion)}
                className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-left hover:border-route">
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
