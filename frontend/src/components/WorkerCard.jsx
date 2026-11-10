import Icon from './Icon'

export default function WorkerCard({ worker, service }) {
  const initials = worker.name.split(' ').slice(0, 2).map((word) => word[0]).join('')

  return (
    <article className="worker-card">
      <div className="worker-card-top">
        <span className="worker-avatar" aria-hidden="true">{initials}</span>
        <span className={`availability${worker.available ? ' is-available' : ''}`}>
          <span aria-hidden="true" />{worker.available ? 'Available' : 'Busy'}
        </span>
      </div>
      <h3>{worker.name}</h3>
      <p className="worker-trade">{service?.name}</p>
      <p className="worker-location"><Icon name="pin" size={16} />{worker.area}, {worker.city}</p>
      <p className="worker-experience">{worker.experience_years} years of experience</p>
    </article>
  )
}
