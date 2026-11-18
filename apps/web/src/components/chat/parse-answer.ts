export type Confidence = 'high' | 'medium' | 'low'

/** Citation ids are "E12" for an evidence row or "T1" for a table summary. */
export type AnswerPiece = { kind: 'text'; text: string } | { kind: 'cite'; ids: string[]; raw: string }

const CONFIDENCE = /^confidence:\s*(high|medium|low)\b(.*)$/i
const LINE_BREAK = /\r\n|[\n\r\u2028\u2029]/g
const CITATION = /\[([ET]?\d{1,6}(?:\s*[,;]\s*[ET]?\d{1,6}){0,11})\]/gi

export function splitConfidence(text: string): { body: string; confidence?: { level: Confidence; reason: string } } {
  const trimmed = text.trimEnd()
  const lineStart = lastLineStart(trimmed)
  const lastLine = trimmed.slice(lineStart).trim()
  const body = trimmed.slice(0, lineStart).trimEnd()

  const match = lastLine.match(CONFIDENCE)
  if (match) return { body, confidence: { level: match[1]!.toLowerCase() as Confidence, reason: match[2]!.replace(/^[\s—–:-]+/, '') } }

  const stillTyping = lineStart > 0 && lastLine.length > 0 && 'confidence:'.startsWith(lastLine.toLowerCase())
  return { body: stillTyping ? body : text }
}

function lastLineStart(text: string): number {
  let start = 0
  for (const match of text.matchAll(LINE_BREAK)) start = match.index + match[0].length
  return start
}

export function splitCitations(text: string): AnswerPiece[] {
  const pieces: AnswerPiece[] = []
  let last = 0
  for (const match of text.matchAll(CITATION)) {
    if (match.index > last) pieces.push({ kind: 'text', text: text.slice(last, match.index) })
    const ids = match[1]!.split(/[,;\s]+/).filter(Boolean).map((id) => (/^t/i.test(id) ? id.toUpperCase() : `E${id.replace(/^e/i, '')}`))
    pieces.push({ kind: 'cite', ids, raw: match[0] })
    last = match.index + match[0].length
  }
  if (last < text.length) pieces.push({ kind: 'text', text: text.slice(last) })
  return pieces
}
