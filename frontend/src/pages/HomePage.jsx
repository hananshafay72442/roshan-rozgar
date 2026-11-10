import { useState } from 'react'
import useCatalog from '../hooks/useCatalog'
import Icon from '../components/Icon'
import RippleButton from '../components/RippleButton/RippleButton'
import ServiceCard from '../components/ServiceCard'
import WorkerCard from '../components/WorkerCard'
import '../styles/home.css'

const steps = [
  { title: 'Find the right skill', text: 'Choose a service and browse workers in your city.' },
  { title: 'Talk through the job', text: 'Describe what you need and agree on a price together.' },
  { title: 'Build local trust', text: 'Share your experience to help the next neighbour.' },
]

export default function HomePage() {
  const { catalog, loading, error, retry } = useCatalog()
  const [city, setCity] = useState('Islamabad')
  const [serviceId, setServiceId] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const services = catalog?.services || []
  const workers = (catalog?.workers || []).filter((worker) =>
    worker.city === city && (!serviceId || worker.service_id === serviceId)
      && (!availableOnly || worker.available))

  function chooseService(id) {
    setServiceId((current) => current === id ? '' : id)
  }

  return (
    <main id="main">
      <section className="hero container" aria-labelledby="hero-title">
        <p className="eyebrow"><span className="ember-dot" /> Islamabad & Rawalpindi</p>
        <h1 id="hero-title">Skilled hands.<br /><span className="text-ember">Closer to home.</span></h1>
        <p className="hero-description">Connect with local electricians, plumbers, and tradespeople.<br className="desktop-break" /> Good work starts with the right person.</p>
        <div className="hero-actions">
          <RippleButton href="#workers" className="button-primary">Find a worker</RippleButton>
          <a className="text-link" href="#for-workers">I’m a skilled worker <Icon name="arrow" size={18} /></a>
        </div>
        <p className="hero-urdu" lang="ur" dir="rtl">ہنر آپ کا، روزگار روشن</p>
      </section>

      <section className="catalog-section container" id="workers" aria-labelledby="workers-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A little help, close by</p>
            <h2 id="workers-title">What needs fixing?</h2>
          </div>
          <label className="city-select"><Icon name="pin" size={18} />
            <span className="sr-only">Choose your city</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              {(catalog?.cities || ['Islamabad', 'Rawalpindi']).map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>

        {loading ? <p className="catalog-message" role="status">Loading local services…</p>
          : error ? <div className="catalog-message" role="alert">
            <p>We couldn’t load the workers. {error}</p>
            <RippleButton onClick={retry} showArrow={false}>Try again</RippleButton>
          </div>
          : <>
            <div className="service-grid" aria-label="Filter workers by service">
              {services.map((service) => <ServiceCard key={service.id} service={service}
                selected={service.id === serviceId} onSelect={chooseService} />)}
            </div>
            <div className="workers-heading">
              <div className="workers-summary" aria-live="polite">
                <h3>{serviceId ? services.find((service) => service.id === serviceId)?.name : 'Local workers'}</h3>
                <span>{workers.length} {workers.length === 1 ? 'worker' : 'workers'} in {city}</span>
              </div>
              <div className="worker-filters">
                {serviceId && <button type="button" className="clear-filter" onClick={() => setServiceId('')}>All services</button>}
                <label className="availability-filter"><input type="checkbox" checked={availableOnly}
                  onChange={(event) => setAvailableOnly(event.target.checked)} /> Available only</label>
              </div>
            </div>
            <p className="demo-note">Sample profiles for the demo. Booking is not available yet.</p>
            <div className="worker-grid">
              {workers.map((worker) => <WorkerCard key={worker.id} worker={worker}
                service={services.find((service) => service.id === worker.service_id)} />)}
            </div>
            {workers.length === 0 && <p className="catalog-message" role="status">No workers match these filters. Try another service or include busy workers.</p>}
          </>}
      </section>

      <section className="how-section container" id="how-it-works" aria-labelledby="how-title">
        <p className="eyebrow">The idea is simple</p>
        <h2 id="how-title">From a small repair to a better day.</h2>
        <div className="steps-grid">
          {steps.map((step, index) => <article key={step.title}>
            <span className="step-number">0{index + 1}</span>
            <h3>{step.title}</h3><p>{step.text}</p>
          </article>)}
        </div>
        <p className="demo-note">Worker discovery is ready to explore. Communication, booking, and reviews are coming next.</p>
      </section>

      <section className="worker-intro container" id="for-workers" aria-labelledby="worker-intro-title">
        <div><p className="eyebrow">For the hands that build our cities</p>
          <h2 id="worker-intro-title">Your skill deserves to be seen.</h2>
          <p>We’re building an easier way to connect your skills with work nearby.</p>
        </div>
        <div className="worker-intro-note"><span lang="ur" dir="rtl">اپنے ہنر کو پہچان دیں</span><p>Worker registration is coming next.</p></div>
      </section>
    </main>
  )
}
