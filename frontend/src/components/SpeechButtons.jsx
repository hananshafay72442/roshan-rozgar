import { useLanguage } from '../i18n/LanguageProvider'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export function Listen({ text, english, label = 'Listen to this step' }) {
  const { t } = useLanguage()
  if (!window.speechSynthesis) return null
  function speak() {
    const synth = window.speechSynthesis
    const voice = synth.getVoices().find(({ lang }) => lang.toLowerCase().startsWith('ur'))
    synth.cancel()
    const prompt = new SpeechSynthesisUtterance(voice || !english ? text : english)
    prompt.lang = voice?.lang || (english ? 'en' : 'ur-PK')
    if (voice) prompt.voice = voice
    prompt.rate = .9
    synth.speak(prompt)
  }
  return <button type="button" className="button-secondary" onClick={speak}><Icon name="volume" size={17} />{t(label)}</button>
}

export function Dictate({ onText, label }) {
  const { t, language } = useLanguage()
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const [status, setStatus] = useState('')
  const active = useRef(null)

  useEffect(() => () => {
    if (active.current) {
      active.current.onresult = null
      active.current.onerror = null
      active.current.onend = null
      active.current.abort()
    }
  }, [])

  if (!Recognition) return null

  function record() {
    setStatus('Listening…')
    const recognition = new Recognition()
    active.current = recognition
    recognition.lang = language === 'en' ? 'en-PK' : 'ur-PK'
    recognition.onresult = (event) => {
      onText(event.results[0][0].transcript)
      setStatus('')
    }
    recognition.onerror = () => setStatus('Couldn’t hear you. Try again or use the keyboard.')
    recognition.onend = () => {
      active.current = null
      setStatus((current) => current === 'Listening…' ? '' : current)
    }
    try { recognition.start() } catch {
      active.current = null
      setStatus('Speech recognition is unavailable. You can use the keyboard.')
    }
  }

  return <div className="dictation"><button type="button" className="button-secondary" onClick={record} disabled={status === 'Listening…'}>
    <Icon name="mic" size={18} />{t(label)}
  </button>{status && <p className="hint" role="status">{t(status)}</p>}</div>
}
