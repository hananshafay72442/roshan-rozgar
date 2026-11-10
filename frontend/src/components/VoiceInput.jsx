import { useLanguage } from '../i18n/LanguageProvider'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

const recordingTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']

export default function VoiceInput({ value, onChange, label = 'Record a voice note', seconds = 40, disabled = false }) {
  const { t } = useLanguage()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const mounted = useRef(false)
  const capture = useRef(null)
  const supported = typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const active = capture.current
      if (active) {
        clearTimeout(active.timer)
        active.recorder.onstop = null
        if (active.recorder.state !== 'inactive') active.recorder.stop()
        active.stream.getTracks().forEach((track) => track.stop())
        capture.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!value) return
    const url = URL.createObjectURL(value)
    const frame = requestAnimationFrame(() => setPreview({ blob: value, url }))
    return () => {
      cancelAnimationFrame(frame)
      URL.revokeObjectURL(url)
    }
  }, [value])

  async function start() {
    setError('')
    setStatus('opening')
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const mimeType = recordingTypes.find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: 32000 })
      const chunks = []
      function finish() {
        clearTimeout(capture.current?.timer)
        stream.getTracks().forEach((track) => track.stop())
        capture.current = null
        setStatus('idle')
      }
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = () => {
        finish()
        const audio = new Blob(chunks, { type: (recorder.mimeType || chunks[0]?.type || '').split(';')[0] })
        if (audio.size && audio.size <= 1_500_000) onChange(audio)
        else setError('No playable audio was captured. Try a shorter recording.')
      }
      recorder.onerror = () => {
        recorder.onstop = null
        finish()
        setError('Recording stopped unexpectedly. Try again.')
      }
      recorder.start()
      capture.current = {
        recorder, stream, timer: setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, seconds * 1000),
      }
      setStatus('recording')
    } catch {
      stream?.getTracks().forEach((track) => track.stop())
      if (!mounted.current) return
      setStatus('idle')
      setError('Microphone access is unavailable. Allow it in your browser or use the text option.')
    }
  }

  return (
    <div className="voice-input">
      {value ? <div className="voice-preview">
        {preview?.blob === value && <audio src={preview.url} controls aria-label={t('Preview your voice note')} />}
        <button className="icon-button" type="button" onClick={() => { setPreview(null); onChange(null) }} aria-label={t('Remove recording')} disabled={disabled}><Icon name="close" size={16} /></button>
      </div> : <button type="button" className="button-secondary voice-button"
        onClick={status === 'recording' ? () => capture.current?.recorder.stop() : start}
        disabled={!supported || disabled || status === 'opening'}>
        <Icon name={status === 'recording' ? 'stop' : 'mic'} size={18} />
        {t(status === 'recording' ? 'Stop recording' : status === 'opening' ? 'Opening microphone…' : label)}
      </button>}
      {status === 'recording' && <span className="recording-status" role="status">{t('Recording · Up to {seconds} seconds', { seconds })}</span>}
      {!supported && <p className="hint">{t('Recording requires a browser with microphone access on HTTPS or localhost.')}</p>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
    </div>
  )
}
