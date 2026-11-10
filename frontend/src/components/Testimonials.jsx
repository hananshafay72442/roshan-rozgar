import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../i18n/LanguageProvider'

export default function Testimonials() {
  const { t } = useLanguage()
  const [reviews, setReviews] = useState(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api('/testimonials', { signal: controller.signal }).then(data => { if (!controller.signal.aborted) { setReviews(data.reviews); setError(false) } })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [attempt])
  return <section className="container testimonials-section" id="reviews" aria-labelledby="testimonials-title">
    <div className="section-heading"><div><p className="eyebrow">{t('After the work')}</p><h2 id="testimonials-title">{t('Reviews from completed jobs.')}</h2></div>
      <p className="section-deck">{t('See what customers shared after their booking.')}</p></div>
    {error ? <button type="button" className="button-secondary" onClick={() => setAttempt(v => v + 1)}>{t('Try again')}</button>
      : reviews === null ? <p role="status">{t('Loading reviews…')}</p>
        : reviews.length ? <div className="testimonials-grid">{reviews.map((review, i) => <figure className="testimonial" key={i}>
          <span className="review-stars" aria-label={t('{rating} out of 5', { rating: review.rating })}>{'★'.repeat(review.rating)}<span aria-hidden="true">{'☆'.repeat(5 - review.rating)}</span></span>
          <blockquote dir="auto">{t(review.text)}</blockquote><figcaption><strong>{review.worker_name}</strong><span>{t('Completed job')}{review.demo ? ` · ${t('Sample review')}` : ''}</span></figcaption>
        </figure>)}</div> : <p className="catalog-message">{t('Reviews will appear after customers complete their first jobs.')}</p>}
  </section>
}
