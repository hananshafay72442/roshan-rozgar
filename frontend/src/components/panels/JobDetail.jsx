import { useLanguage } from '../../i18n/LanguageProvider'
import { useEffect, useState } from 'react'
import { messageData } from '../../api/client'
import Icon from '../Icon'
import RippleButton from '../RippleButton/RippleButton'
import VoiceInput from '../VoiceInput'

export const statusLabels = {
  requested: 'Waiting for worker', quoted: 'Quote sent', countered: 'Counteroffer sent',
  confirmed: 'Booked', completed: 'Completed', cancelled: 'Cancelled', declined: 'Declined by worker',
}
export function jobStatus(job) {
  if (job.state !== 'cancelled' && job.moderation === 'rejected') return 'Rejected'
  return statusLabels[job.state]
}

const amount = new Intl.NumberFormat('en-PK')

export default function JobDetail({ jobId, call, role, revision, onChange }) {
  const { t } = useLanguage()
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
  const negotiating = job?.moderation !== 'rejected' && ['requested', 'quoted', 'countered'].includes(job?.state)
  const open = negotiating || job?.state === 'confirmed'
  const canPropose = negotiating && (isWorker || job.state === 'quoted')
  const canAccept = negotiating && job.state === (isWorker ? 'countered' : 'quoted')
  const canDecline = negotiating && isWorker
  const closeAction = canDecline ? 'decline' : 'cancel'

  if (!job) return <div className="job-detail">{loadError ? <>
    <p className="form-error" role="alert">{t(loadError)}</p>
    <button type="button" className="button-secondary" onClick={() => setAttempt((value) => value + 1)}>{t('Try again')}</button>
  </> : <p role="status">{t('Loading the conversation…')}</p>}</div>

  return (
    <div className="job-detail">
      <div className="job-head">
        <div><p className="eyebrow">{t('Request {id}', { id: job.id })}</p><h3>{isWorker ? t('Job conversation') : job.worker.name}</h3></div>
        <span className={`job-status is-${job.state}`}>{t(jobStatus(job))}</span>
      </div>
      {loadError && <p className="form-error" role="alert">{t(loadError)} {t('Retrying…')}</p>}
      {job.quote_pkr && <div className="quote-summary">
        <span>{t({
          quoted: 'Worker’s quote', countered: 'Customer’s counteroffer', declined: 'Previous quote', cancelled: 'Previous quote',
        }[job.state] || 'Agreed price')}</span>
        <strong>{t('Rs {amount}', { amount: amount.format(job.quote_pkr) })}</strong>
      </div>}
      <div className="chat-log" role="log" aria-label={t('Job messages')} aria-live="polite">
        {messages.map((item) => <article key={item.id} className={`chat-message${item.mine ? ' is-mine' : ''}`}>
          <strong>{item.mine ? t('You') : isWorker ? t('Customer') : job.worker.name}</strong>
          {item.text && <p dir="auto">{item.text}</p>}
          {item.audio_url && <audio src={item.audio_url} controls preload="none" aria-label={t('Play voice message')} />}
        </article>)}
      </div>
      {canAccept && <RippleButton className="button-primary" disabled={busy}
        onClick={() => act('accept', { quote_pkr: job.quote_pkr })}>{t('Accept Rs {amount} and book', { amount: amount.format(job.quote_pkr) })}</RippleButton>}
      {canPropose && <form className="quote-form" onSubmit={(event) => {
        event.preventDefault()
        act(isWorker ? 'quote' : 'counter', {
          quote_pkr: Number(quote), previous_quote_pkr: job.quote_pkr,
        }, () => setQuote(''))
      }}>
        <label className="form-field">{t(canAccept ? 'Counteroffer in PKR' : 'Quote in PKR')}
          <input type="number" inputMode="numeric" min="1" max="1000000" step="1" required value={quote} onChange={(event) => setQuote(event.target.value)} />
          {canAccept && <span className="hint">{t('Suggest a lower or higher price.')}</span>}
        </label>
        <RippleButton className="button-primary" type="submit" disabled={busy || (canAccept && Number(quote) === job.quote_pkr)}>
          {t(canAccept ? 'Send counteroffer' : job.state === 'requested' ? 'Accept request and send price' : 'Update quote')}
        </RippleButton>
      </form>}
      {negotiating && !isWorker && job.state === 'requested' && <p className="hint">{t('The worker will send a price if they can take the job.')}</p>}
      {negotiating && !isWorker && job.state === 'countered' && <p className="hint">{t('Waiting for the worker to respond to your counteroffer.')}</p>}
      {open && <form className="chat-form" onSubmit={(event) => {
        event.preventDefault()
        act('messages', messageData(message, audio), () => { setMessage(''); setAudio(null) })
      }}>
        <label className="form-field">{t('Reply')}
          <textarea rows={2} maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t('Write a message or record a voice note')} dir="auto" />
        </label>
        <VoiceInput value={audio} onChange={setAudio} disabled={busy} />
        <button type="submit" className="button-secondary align-start" disabled={busy || (!message.trim() && !audio)}>{t('Send message')}</button>
      </form>}
      {isWorker && job.state === 'confirmed' && <RippleButton className="button-primary" disabled={busy} onClick={() => act('complete')}>{t('Mark job complete')}</RippleButton>}
      {job.state === 'completed' && !isWorker && (job.reviewed ? <p className="hint"><Icon name="check" size={17} /> {t('Your review has been published.')}</p>
        : <form className="panel-form review-form" onSubmit={(event) => { event.preventDefault(); act('review', { rating, text: review }) }}>
          <h4 className="form-title">{t('How did it go?')}</h4>
          <div className="star-options" aria-label={t('Choose a rating')}>
            {[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={`icon-button${value <= rating ? ' filled' : ''}`}
              aria-pressed={value === rating} aria-label={t(value === 1 ? '{count} star' : '{count} stars', { count: value })} onClick={() => setRating(value)}><Icon name="star" size={20} /></button>)}
          </div>
          <label className="form-field">{t('Note (optional)')}<textarea dir="auto" rows={2} maxLength={400} value={review} onChange={(event) => setReview(event.target.value)} /></label>
          <RippleButton type="submit" className="button-primary" disabled={busy || rating < 1}>{t('Post review')}</RippleButton>
        </form>)}
      {open && (cancelling ? <div className="cancel-confirm">
        <p>{t(canDecline ? 'Decline this request?' : 'Cancel this request? A confirmed booking will free the worker for another job.')}</p>
        <div className="panel-actions">
          <button type="button" className="button-secondary" onClick={() => setCancelling(false)} disabled={busy}>{t('Keep request')}</button>
          <button type="button" className="button-secondary danger" disabled={busy} onClick={() => act(closeAction, {}, () => setCancelling(false))}>{t(canDecline ? 'Confirm decline' : 'Confirm cancellation')}</button>
        </div>
      </div> : <button type="button" className="text-button align-start" disabled={busy} onClick={() => setCancelling(true)}>{t(canDecline ? 'Decline request' : 'Cancel request')}</button>)}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
    </div>
  )
}
