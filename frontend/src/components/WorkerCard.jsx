import Icon from './Icon'

export default function WorkerCard({ worker, service, onRequest, onReviews }) {
  const initials = worker.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')

  return (
    <article className="worker-card">
      <div className="worker-card-top">
        <span className="worker-avatar" aria-hidden="true">{initials}</span>
        <span className={`availability${worker.available ? ' is-available' : ''}`}>
          <span aria-hidden="true" />{worker.available ? 'Available now' : worker.busy ? 'Booked' : 'Off duty'}
        </span>
      </div>
      <div className="worker-name"><h3>{worker.name}</h3>{worker.phone_verified && <span title="Phone verified"><Icon name="shield" size={19} /><span className="sr-only">Phone verified</span></span>}</div>
      <p className="worker-trade">{service?.name} <span>·</span> {worker.experience_years} years’ experience</p>
      <p className="worker-location"><Icon name="pin" size={16} />{worker.area}, {worker.city}
        {worker.distance_km !== null && worker.distance_km !== undefined && <small>≈ {worker.distance_km.toFixed(1)} km</small>}
      </p>
      {worker.demo && <span className="worker-demo">Sample profile</span>}
      <div className="worker-card-actions">
        <button type="button" className="worker-rating" onClick={() => onReviews(worker)} aria-label={`Read reviews for ${worker.name}`}>
          <Icon name="star" size={17} />{worker.review_count ? <><strong>{worker.rating.toFixed(1)}</strong> ({worker.review_count})</> : 'No reviews'}
        </button>
        <button type="button" className="button-small" onClick={() => onRequest(worker)} disabled={!worker.available}>
          Request <Icon name="arrow" size={16} />
        </button>
      </div>
    </article>
  )
}
