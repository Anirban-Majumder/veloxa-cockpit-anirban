import type { ChatMessage } from '../../lib/api'
import { Answer } from './Answer'
import type { Source } from './sources'
import { SearchStep } from './SearchStep'
import { TableStep } from './TableStep'
import { Thinking } from './Thinking'

export function Message({ message, speaker, sources, streaming }: {
  message: ChatMessage
  speaker: string
  sources: Map<string, Source>
  streaming: boolean
}) {
  if (message.role === 'user') {
    const text = message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')
    return <p className="rise ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-paper">{text}</p>
  }

  const searched = message.parts.some((part) => part.type.startsWith('tool-'))
  const lastPart = message.parts.at(-1)
  const waitingAfterTool = streaming && !!lastPart && 'toolCallId' in lastPart && lastPart.state === 'output-available'
  const hasContent = message.parts.some((part) => part.type.startsWith('tool-') || ('text' in part && part.text.trim()))
  const lastTextIndex = message.parts.findLastIndex((part) => part.type === 'text')

  return (
    <div className="rise max-w-[95%] space-y-3 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-ink/5">
      <p className="text-sm font-bold text-ink-soft">{speaker}</p>
      {message.parts.map((part, index) => {
        switch (part.type) {
          case 'text':
            return part.text.trim() ? (
              <Answer key={index} text={part.text} sources={sources} searched={searched}
                streaming={streaming && index === lastTextIndex && part.state === 'streaming'} />
            ) : null
          case 'reasoning':
            return part.text.trim() ? (
              <details key={index} className="text-sm text-ink-soft">
                <summary className="cursor-pointer">{part.state === 'streaming' ? 'Thinking…' : 'Thought it through'}</summary>
                <p className="mt-1 whitespace-pre-line">{part.text}</p>
              </details>
            ) : null
          case 'tool-search_evidence':
            return <SearchStep key={part.toolCallId} {...searchStepProps(part)} />
          case 'tool-summarize_table':
            return (
              <TableStep key={part.toolCallId} table={part.input?.table}
                summary={part.state === 'output-available' ? part.output.summary : undefined}
                failed={part.state === 'output-error'} />
            )
          default:
            return null
        }
      })}
      {streaming && !hasContent && <Thinking />}
      {waitingAfterTool && <Thinking label="Reading the records" />}
    </div>
  )
}

type SearchPart = Extract<ChatMessage['parts'][number], { type: 'tool-search_evidence' }>

function searchStepProps(part: SearchPart): Parameters<typeof SearchStep>[0] {
  switch (part.state) {
    case 'output-available':
      return { state: part.state, query: part.input.query, results: part.output }
    case 'output-error':
      return { state: part.state, query: part.input?.query, error: part.errorText }
    default:
      return { state: 'input-available', query: part.input?.query }
  }
}
