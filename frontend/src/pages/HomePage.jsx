import { useState } from 'react'
import useCatalog from '../hooks/useCatalog'
import Icon from '../components/Icon'
import HeroVisual from '../components/HeroVisual/HeroVisual'
import ScrollDrops from '../components/ScrollDrops/ScrollDrops'
import RippleButton from '../components/RippleButton/RippleButton'
import TradeRail from '../components/TradeRail'
import WorkerCard from '../components/WorkerCard'
import '../styles/home.css'

const reasons = [
  { icon: 'pin', title: 'Neighbourhood first', text: 'See who’s close and available.' },
  { icon: 'mic', title: 'Voice-friendly', text: 'Explain the job in your own words.' },
  { icon: 'calendar', title: 'Agree before you book', text: 'Confirm a price together first.' },
]
const steps = [
  { title: 'Find the right hands', text: 'Pick a trade and your neighbourhood. See who’s free and read reviews from past jobs.' },
  { title: 'Talk it through', text: 'Send a voice note or a message. Get a quote and confirm when you’re happy with the price.' },
  { title: 'Leave a review', text: 'After the work is done, share how it went to help the next neighbour choose.' },
]
const fallbackCities = ['Islamabad', 'Rawalpindi']
const noServices = []

export default function HomePage({ revision, onRequest, onReviews, onJoinWorker }) {
  const [city, setCity] = useState('Islamabad')
  const [area, setArea] = useState('')
  const [service, setService] = useState('')
  const [available, setAvailable] = useState(true)
  const { catalog, workers, loading, error, retry } = useCatalog({ city, area, service, available }, revision)
  const services = catalog?.services || noServices

  function chooseTrade(id) {
    setService(id)
    document.getElementById('workers')?.scrollIntoView({ block: 'start' })
  }

  return (
    <main id="main" tabIndex={-1}>
      <section className="hero container" id="top" data-hero-pointer-area aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="hero-locale"><Icon name="pin" size={17} /> Islamabad &amp; Rawalpindi</p>
          <h1 id="hero-title">Skilled hands.<br /><span>Closer to home.</span></h1>
          <p className="hero-description">Find local electricians, plumbers and other tradespeople. See who’s free, talk through the job, and book at a price you agree on.</p>
          <div className="hero-actions">
            <RippleButton href="#workers" className="button-primary">Find a worker</RippleButton>
            <a className="button-secondary" href="#for-workers">I’m a skilled worker <Icon name="chevron" size={17} /></a>
          </div>
          <p className="hero-urdu" lang="ur" dir="rtl">ہنر مند لوگ، آپ کے قریب</p>
        </div>
        <HeroVisual />
      </section>

      <div className="container">
        <ul className="value-strip" aria-label="How Roshan Rozgar helps">
          {reasons.map(({ icon, title, text }) => <li key={title}>
            <span className="value-icon"><Icon name={icon} size={24} /></span>
            <span><strong>{title}</strong><small>{text}</small></span>
          </li>)}
        </ul>
      </div>

      <TradeRail services={services} selected={service} onSelect={chooseTrade} />

      <section className="container worker-section" id="workers" aria-labelledby="workers-title">
        <div className="section-heading">
          <div><p className="eyebrow">02 <span /> Find someone nearby</p><h2 id="workers-title">Local workers.</h2></div>
          <p className="section-deck">Choose your neighbourhood to see who’s closest and ready to help.</p>
        </div>
        <div className="worker-filters" aria-label="Filter local workers">
          <label className="filter-field"><span>City</span>
            <select value={city} onChange={(event) => { setCity(event.target.value); setArea('') }}>
              {(catalog?.cities || fallbackCities).map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label className="filter-field"><span>Neighbourhood</span>
            <select value={area} onChange={(event) => setArea(event.target.value)}>
              <option value="">Any neighbourhood</option>
              {catalog?.areas?.[city]?.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label className="filter-field"><span>Trade</span>
            <select value={service} onChange={(event) => setService(event.target.value)}>
              <option value="">All trades</option>
              {services.map(({ id, name, urdu }) => <option key={id} value={id}>{name} · {urdu}</option>)}
            </select>
          </label>
          <label className="availability-filter">
            <input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />
            <span>Available now</span>
          </label>
        </div>
        {loading ? <p className="catalog-message" role="status">Finding workers nearby…</p>
          : error || !catalog ? <div className="catalog-message" role="alert">
            <p>{error || 'The trade list couldn’t load. Please try again.'}</p>
            <button className="button-secondary" type="button" onClick={retry}>Try again</button>
          </div> : <>
            <p className="catalog-summary" aria-live="polite">
              <strong>{workers.length} {workers.length === 1 ? 'worker' : 'workers'}</strong> in {city}
              {area && <span> · Distances are approximate from {area}</span>}
            </p>
            {workers.length ? <div className="worker-grid">
              {workers.map((worker) => <WorkerCard key={worker.id} worker={worker}
                service={services.find(({ id }) => id === worker.service_id)} onRequest={onRequest} onReviews={onReviews} />)}
            </div> : <p className="catalog-message">No workers match your filters. Try a different trade or include workers who are off duty.</p>}
          </>}
      </section>

      <ScrollDrops className="how-section" id="how-it-works" count={26} aria-labelledby="how-title">
        <div className="container how-inner">
          <div>
            <p className="eyebrow">03 <span /> How it works</p>
            <h2 id="how-title">Good work,<br />step by step.</h2>
            <p className="section-deck">A simple way to go from a repair you need to a job well done.</p>
          </div>
          <ol className="work-steps">
            {steps.map((step, index) => <li key={step.title}>
              <span className="step-number">0{index + 1}</span>
              <div><h3>{step.title}</h3><p>{step.text}</p></div>
            </li>)}
          </ol>
        </div>
      </ScrollDrops>

      <section className="container" id="for-workers" aria-labelledby="worker-intro-title">
        <div className="worker-intro">
          <div>
            <p className="eyebrow">For tradespeople</p>
            <h2 id="worker-intro-title">Let your work speak.</h2>
            <p>Set up your profile by voice, tell neighbours when you’re free, and quote jobs in your area.</p>
            <RippleButton className="button-primary" onClick={onJoinWorker}>Join as a worker</RippleButton>
          </div>
          <div className="worker-callout">
            <span className="worker-callout-icon"><Icon name="mic" size={52} /></span>
            <p lang="ur" dir="rtl">ہنر آپ کا، روزگار روشن</p>
            <span>Build a profile in your own words</span>
          </div>
        </div>
      </section>
    </main>
  )
}
