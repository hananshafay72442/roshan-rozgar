import { useEffect, useState } from 'react'
import { messageData } from '../../api/client'
import Icon from '../Icon'
import RippleButton from '../RippleButton/RippleButton'
import VoiceInput from '../VoiceInput'

export const statusLabels = {
  requested: 'Requested', quoted: 'Quote sent', confirmed: 'Booked', completed: 'Completed', cancelled: 'Cancelled',
}
const amount = new Intl.NumberFormat('en-PK')

export default function JobDetail({ jobId, call, role, revision, onChange }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [audio, setAudio] = useState(null)
  const [quote, setQuote] = useState('')
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    function load() {
      call(`/jobs/${jobId}`, { signal: controller.signal }).then((response) => {
        if (controller.signal.aborted) return
        setData(response)
        setLoadError('')
      }).catch((failure) => {
        if (!controller.signal.aborted) setLoadError(failure.message)
      })
    }
    load()
    const timer = setInterval(() => { if (!document.hidden) load() }, 5000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [jobId, call, revision, attempt])

  async function act(action, payload = {}, onSuccess) {
    setBusy(true)
    setError('')
    try {
      await call(`/jobs/${jobId}/${action}`, { method: 'POST', data: payload })
      onSuccess?.()
      onChange()
    } catch (failure) {
      setError(failure.message)
      if (failure.status === 409) onChange()
    } finally { setBusy(false) }
  }

  const { job, messages } = data || {}
  const isWorker = role === 'worker'
  const open = job && ['requested', 'quoted', 'confirmed'].includes(job.state)
  const canQuote = isWorker && ['requested', 'quoted'].includes(job?.state)

  if (!job) return <div className="job-detail">{loadError ? <>
    <p className="form-error" role="alert">{loadError}</p>
    <button type="button" className="button-secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
  </> : <p role="status">Loading the conversation…</p>}</div>

  return (
    <div className="job-detail">
      <div className="job-head">
        <div><p className="eyebrow">Request {job.id}</p><h3>{isWorker ? 'Job conversation' : job.worker.name}</h3></div>
        <span className={`job-status is-${job.state}`}>{statusLabels[job.state]}</span>
      </div>
      {loadError && <p className="form-error" role="alert">{loadError} Retrying…</p>}
      {job.quote_pkr && <div className="quote-summary">
        <span>{job.state === 'quoted' ? 'Worker’s quote' : job.state === 'cancelled' ? 'Previous quote' : 'Agreed price'}</span>
        <strong>Rs {amount.format(job.quote_pkr)}</strong>
      </div>}
      <div className="chat-log" role="log" aria-label="Job messages" aria-live="polite">
        {messages.map((item) => <article key={item.id} className={`chat-message${item.mine ? ' is-mine' : ''}`}>
          <strong>{item.mine ? 'You' : isWorker ? 'Customer' : job.worker.name}</strong>
          {item.text && <p dir="auto">{item.text}</p>}
          {item.audio_url && <audio src={item.audio_url} controls preload="none" aria-label="Play voice message" />}
        </article>)}
      </div>
      {open && <form className="chat-form" onSubmit={(event) => {
        event.preventDefault()
        act('messages', messageData(message, audio), () => { setMessage(''); setAudio(null) })
      }}>
        <label className="form-field">Reply
          <textarea rows={2} maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message or record a voice note" />
        </label>
        <VoiceInput value={audio} onChange={setAudio} disabled={busy} />
        <button type="submit" className="button-secondary align-start" disabled={busy || (!message.trim() && !audio)}>Send message</button>
      </form>}
      {canQuote && <form className="quote-form" onSubmit={(event) => {
        event.preventDefault()
        act('quote', { quote_pkr: Number(quote) }, () => setQuote(''))
      }}>
        <label className="form-field">Quote in PKR
          <input type="number" inputMode="numeric" min="1" max="1000000" step="1" required value={quote} onChange={(event) => setQuote(event.target.value)} />
        </label>
        <RippleButton className="button-primary" type="submit" disabled={busy}>{job.quote_pkr ? 'Update quote' : 'Send quote'}</RippleButton>
      </form>}
      {!isWorker && job.state === 'quoted' && <RippleButton className="button-primary" disabled={busy}
        onClick={() => act('accept', { quote_pkr: job.quote_pkr })}>Accept Rs {amount.format(job.quote_pkr)} and book</RippleButton>}
      {isWorker && job.state === 'confirmed' && <RippleButton className="button-primary" disabled={busy} onClick={() => act('complete')}>Mark job complete</RippleButton>}
      {job.state === 'completed' && !isWorker && (job.reviewed ? <p className="hint"><Icon name="check" size={17} /> Your review has been published.</p>
        : <form className="panel-form review-form" onSubmit={(event) => { event.preventDefault(); act('review', { rating, text: review }) }}>
          <h4 className="form-title">How did it go?</h4>
          <div className="star-options" aria-label="Choose a rating">
            {[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={`icon-button${value <= rating ? ' filled' : ''}`}
              aria-pressed={value === rating} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} onClick={() => setRating(value)}><Icon name="star" size={20} /></button>)}
          </div>
          <label className="form-field">Note (optional)<textarea rows={2} maxLength={400} value={review} onChange={(event) => setReview(event.target.value)} /></label>
          <RippleButton type="submit" className="button-primary" disabled={busy || rating < 1}>Post review</RippleButton>
        </form>)}
      {open && (cancelling ? <div className="cancel-confirm">
        <p>Cancel this request? A confirmed booking will free the worker for another job.</p>
        <div className="panel-actions">
          <button type="button" className="button-secondary" onClick={() => setCancelling(false)} disabled={busy}>Keep request</button>
          <button type="button" className="button-secondary danger" disabled={busy} onClick={() => act('cancel', {}, () => setCancelling(false))}>Confirm cancellation</button>
        </div>
      </div> : <button type="button" className="text-button align-start" disabled={busy} onClick={() => setCancelling(true)}>Cancel request</button>)}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
