import { useLanguage } from '../../i18n/LanguageProvider'
import { useEffect, useState } from 'react'
import Icon from '../Icon'
import Panel from './Panel'

export default function ReviewsPanel({ worker, call, onClose }) {
  const { t } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    call(`/workers/${worker.id}/reviews`, { signal: controller.signal })
      .then(({ reviews }) => { if (!controller.signal.aborted) setData(reviews) })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [worker.id, call, attempt])

  return (
    <Panel title={worker.name} kicker={t('Reviews from completed jobs')} onClose={onClose}>
      {error ? <div role="alert">
        <p className="form-error">{t(error)}</p>
        <button className="button-secondary" type="button" onClick={() => { setError(''); setAttempt((value) => value + 1) }}>{t('Try again')}</button>
      </div> : data === null ? <p role="status">{t('Loading reviews…')}</p> : !data.length ? <p className="panel-deck">{t('There are no reviews yet.')}</p>
        : <ul className="reviews-list">{data.map((review, index) => <li key={index}>
          <strong><Icon name="star" size={17} /> {review.rating} / 5</strong>
          {review.text && <p dir="auto">{review.text}</p>}
          {review.demo && <small>{t('Sample review')}</small>}
        </li>)}</ul>}
    </Panel>
  )
}
