import { useState } from 'react'
import { messageData } from '../../api/client'
import RippleButton from '../RippleButton/RippleButton'
import VoiceInput from '../VoiceInput'
import Panel from './Panel'

export default function RequestPanel({ worker, call, onSuccess, onClose }) {
  const [text, setText] = useState('')
  const [audio, setAudio] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = messageData(text, audio, { worker_id: worker.id })
      const { job } = await call('/jobs', { method: 'POST', data })
      onSuccess(job.id)
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  return (
    <Panel title={`Ask ${worker.name}.`} kicker="New request" onClose={onClose}>
      <form className="panel-form" onSubmit={submit}>
        <p className="panel-deck">Tell the worker what needs fixing. You can agree on a quote together before you book.</p>
        <label className="form-field">What do you need help with?
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={1000}
            placeholder="For example, the switch in my kitchen stopped working." />
        </label>
        <VoiceInput value={audio} onChange={setAudio} disabled={busy} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <RippleButton type="submit" className="button-primary" disabled={busy || (!text.trim() && !audio)}>
          {busy ? 'Sending…' : 'Send request'}
        </RippleButton>
      </form>
    </Panel>
  )
}
