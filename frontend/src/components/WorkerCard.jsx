import { useLanguage } from '../i18n/LanguageProvider'
import Icon from './Icon'

export default function WorkerCard({ worker, service, onRequest, onReviews }) {
  const { t } = useLanguage()
  const initials = worker.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')

  return (
    <article className="worker-card">
      <div className="worker-card-top">
        <span className="worker-avatar" aria-hidden="true">{initials}</span>
        <span className={`availability${worker.available ? ' is-available' : ''}`}>
          <span aria-hidden="true" />{t(worker.available ? 'Available now' : worker.busy ? 'Booked' : 'Off duty')}
        </span>
      </div>
      <div className="worker-name"><h3 dir="auto">{worker.name}</h3>{worker.phone_verified && <span title={t('Phone verified')}><Icon name="shield" size={19} /><span className="sr-only">{t('Phone verified')}</span></span>}</div>
      <p className="worker-trade">{service && <>{t(service.name)} <span>·</span> </>}{t('{years} years’ experience', { years: worker.experience_years })}</p>
      <p className="worker-location"><Icon name="pin" size={16} /><bdi>{t(worker.area)}</bdi>, {t(worker.city)}
        {worker.distance_km !== null && worker.distance_km !== undefined && <small>≈ {t('{distance} km', { distance: worker.distance_km.toFixed(1) })}</small>}
      </p>
      {worker.demo && <span className="worker-demo">{t('Sample profile')}</span>}
      <div className="worker-card-actions">
        <button type="button" className="worker-rating" onClick={() => onReviews(worker)} aria-label={t('Read reviews for {name}', { name: worker.name })}>
          <Icon name="star" size={17} />{worker.review_count ? <><strong>{worker.rating.toFixed(1)}</strong> ({worker.review_count})</> : t('No reviews')}
        </button>
        <button type="button" className="button-small" onClick={() => onRequest(worker)} disabled={!worker.available}>
          {t('Request')} <Icon name="arrow" size={16} />
        </button>
      </div>
    </article>
  )
}
