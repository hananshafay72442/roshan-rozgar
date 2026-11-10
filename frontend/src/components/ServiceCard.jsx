import Icon from './Icon'

export default function ServiceCard({ service, selected, onSelect }) {
  return (
    <button type="button" className={`service-card${selected ? ' is-selected' : ''}`}
      aria-pressed={selected} onClick={() => onSelect(service.id)}>
      <span className="service-icon"><Icon name={service.icon} size={27} /></span>
      <strong>{service.name}</strong>
      <span className="service-urdu" lang="ur" dir="rtl">{service.urdu}</span>
    </button>
  )
}
