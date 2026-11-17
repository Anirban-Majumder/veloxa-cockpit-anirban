import { useEffect, useRef, useState } from 'react'

/** Minimal typing for the browser Web Speech API (Chrome/Edge/Safari expose it, sometimes prefixed). */
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}
type RecognitionCtor = new () => Recognition

const Ctor: RecognitionCtor | undefined = typeof window === 'undefined'
  ? undefined
  : ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition)

/**
 * Browser speech-to-text. `onText` receives the draft as it should read now: what was typed
 * before listening started plus everything heard so far (interim words included).
 */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const cb = useRef(onText)
  useEffect(() => { cb.current = onText })
  useEffect(() => () => rec.current?.abort(), [])

  const start = (base: string) => {
    if (!Ctor || rec.current) return
    const r = new Ctor()
    r.lang = navigator.language || 'en-IN'
    r.interimResults = true
    r.continuous = true
    let finalText = ''
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!
        if (res.isFinal) finalText += res[0].transcript
        else interim += res[0].transcript
      }
      cb.current(`${base}${base && !base.endsWith(' ') ? ' ' : ''}${finalText}${interim}`.replace(/\s+/g, ' ').trimStart())
    }
    r.onerror = (e) => setError(e.error === 'not-allowed' ? 'Microphone access was blocked.' : e.error === 'no-speech' ? null : 'Voice input stopped.')
    r.onend = () => { rec.current = null; setListening(false) }
    setError(null)
    rec.current = r
    r.start()
    setListening(true)
  }
  const stop = () => rec.current?.stop()

  return { supported: !!Ctor, listening, error, start, stop }
}
