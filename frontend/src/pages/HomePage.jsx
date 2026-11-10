import { useEffect, useRef, useState } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLanguage } from '../i18n/LanguageProvider'
import useCatalog from '../hooks/useCatalog'
import Icon from '../components/Icon'
import HeroVisual from '../components/HeroVisual/HeroVisual'
import ScrollDrops from '../components/ScrollDrops/ScrollDrops'
import RippleButton from '../components/RippleButton/RippleButton'
import TradeRail from '../components/TradeRail'
import WorkerCard from '../components/WorkerCard'
import AccountHome from '../components/AccountHome'
import Testimonials from '../components/Testimonials'
import WorkerOverview from '../components/WorkerOverview'
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
const noServices = []

export default function HomePage({ revision, user, call, onOpenWorkspace, onRequest, onReviews, onJoinWorker, onEditProfile, onBrowse }) {
  const { t } = useLanguage()
  const hero = useRef(null)
  const workerSection = useRef(null)
  const customer = user?.role === 'customer'
  const worker = user?.role === 'worker'
  const city = user?.location?.city || 'Islamabad'
  const area = user?.location?.area || ''
  const [service, setService] = useState('')
  const [available, setAvailable] = useState(true)
  const { catalog, workers, loading, error, retry } = useCatalog({ city, area, service, available, enabled: customer && !!area }, revision)
  const services = catalog?.services || noServices

  useEffect(() => {
    // Catalog results and loaded fonts can move the headings below them.
    let frame
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => ScrollTrigger.refresh())
    })
    observer.observe(hero.current)
    if (workerSection.current) observer.observe(workerSection.current)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [])

  function chooseTrade(id) {
    if (!customer) { onBrowse(); return }
    setService(id)
    document.getElementById('workers')?.scrollIntoView({ block: 'start' })
  }

  return (
    <main id="main" tabIndex={-1}>
      <section ref={hero} className={`hero container${user ? ' hero-signed-in' : ''}`} id="top" data-hero-pointer-area aria-labelledby="hero-title">
        {user ? <AccountHome key={user.id} user={user} call={call} revision={revision} onOpen={onOpenWorkspace} onEditProfile={onEditProfile} /> : <>
        <div className="hero-copy">
          <p className="hero-locale"><Icon name="pin" size={17} /> {t('Islamabad & Rawalpindi')}</p>
          <h1 id="hero-title">{t('Skilled hands.')}<br /><span>{t('Closer to home.')}</span></h1>
          <p className="hero-description">{t('Find local electricians, plumbers and other tradespeople. See who’s free, talk through the job, and book at a price you agree on.')}</p>
          <div className="hero-actions">
            <RippleButton href="#workers" className="button-primary">{t('Find a worker')}</RippleButton>
            <a className="button-secondary" href="#for-workers">{t('I’m a skilled worker')} <Icon name="chevron" size={17} /></a>
          </div>
          <p className="hero-urdu" lang="ur" dir="rtl">ہنر مند لوگ، آپ کے قریب</p>
        </div>
        <HeroVisual />
        </>}
      </section>

      {!user && <div className="container">
        <ul className="value-strip" aria-label={t('How Roshan Rozgar helps')}>
          {reasons.map(({ icon, title, text }) => <li key={title}>
            <span className="value-icon"><Icon name={icon} size={24} /></span>
            <span><strong>{t(title)}</strong><small>{t(text)}</small></span>
          </li>)}
        </ul>
      </div>}

      {!worker && <TradeRail services={services} selected={service} onSelect={chooseTrade} />}

      {!worker && <section ref={workerSection} className="container worker-section" id="workers" aria-labelledby="workers-title">
        <div className="section-heading">
          <div><p className="eyebrow">02 <span /> {t('Find someone nearby')}</p><h2 id="workers-title">{t('Local workers.')}</h2></div>
          <p className="section-deck">{t('Workers within 5 km of your saved neighbourhood.')}</p>
        </div>
        {!customer || !area ? <div className="discovery-gate">
          <Icon name="pin" size={30} /><h3>{t(customer ? 'Set your neighbourhood.' : 'Find help close to home.')}</h3>
          <p>{t(customer ? 'Save your neighbourhood to see workers within 5 km. Distances use approximate neighbourhood centres.' : 'Sign in to discover available workers near you and send a request.')}</p>
          <button type="button" className="button-primary" onClick={onBrowse}>{t(customer ? 'Set my location' : 'Get started')}</button>
        </div> : <><div className="worker-filters nearby-filters" aria-label={t('Filter local workers')}>
          <div className="saved-location"><span>{t('Your neighbourhood')}</span><strong>{t(area)}, {t(city)}</strong>
            <button type="button" className="text-button" onClick={onEditProfile}>{t('Change location')}</button></div>
          <label className="filter-field"><span>{t('Trade')}</span>
            <select value={service} onChange={(event) => setService(event.target.value)}>
              <option value="">{t('All trades')}</option>
              {services.map(({ id, name }) => <option key={id} value={id}>{t(name)}</option>)}
            </select>
          </label>
          <label className="availability-filter">
            <input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />
            <span>{t('Available now')}</span>
          </label>
        </div>
        {loading ? <p className="catalog-message" role="status">{t('Finding workers nearby…')}</p>
          : error || !catalog ? <div className="catalog-message" role="alert">
            <p>{t(error || 'The trade list couldn’t load. Please try again.')}</p>
            <button className="button-secondary" type="button" onClick={retry}>{t('Try again')}</button>
          </div> : <>
            <p className="catalog-summary" aria-live="polite">
              <strong>{t(workers.length === 1 ? '{count} worker' : '{count} workers', { count: workers.length })}</strong> {t('in {city}', { city: t(city) })}
              {area && <span> · {t('Distances are approximate from {area}', { area: t(area) })}</span>}
            </p>
            {workers.length ? <div className="worker-grid">
              {workers.map((worker) => <WorkerCard key={worker.id} worker={worker}
                service={services.find(({ id }) => id === worker.service_id)} onRequest={onRequest} onReviews={onReviews} />)}
            </div> : <p className="catalog-message">{t('No workers match your filters. Try a different trade or include workers who are off duty.')}</p>}
          </>}</>}
      </section>}

      {worker && <WorkerOverview call={call} revision={revision} onEditProfile={onEditProfile} onOpenWorkspace={onOpenWorkspace} />}

      {!user && <Testimonials />}

      {!user && <ScrollDrops className="how-section" id="how-it-works" count={28} startAt="[data-drops-start]" aria-labelledby="how-title">
        <div className="container how-inner">
          <div>
            <p className="eyebrow" data-drops-start>03 <span /> {t('How it works')}</p>
            <h2 id="how-title">{t('Good work,')}<br />{t('step by step.')}</h2>
            <p className="section-deck">{t('A simple way to go from a repair you need to a job well done.')}</p>
          </div>
          <ol className="work-steps">
            {steps.map((step, index) => <li key={step.title}>
              <span className="step-number">0{index + 1}</span>
              <div><h3>{t(step.title)}</h3><p>{t(step.text)}</p></div>
            </li>)}
          </ol>
        </div>
      </ScrollDrops>}

      {!user && <section className="container" id="for-workers" aria-labelledby="worker-intro-title">
        <div className="worker-intro">
          <div>
            <p className="eyebrow">{t('For tradespeople')}</p>
            <h2 id="worker-intro-title">{t('Let your work speak.')}</h2>
            <p>{t('Set up your profile by voice, tell neighbours when you’re free, and quote jobs in your area.')}</p>
            <RippleButton className="button-primary" onClick={onJoinWorker}>{t('Join as a worker')}</RippleButton>
          </div>
          <div className="worker-callout">
            <span className="worker-callout-icon"><Icon name="mic" size={52} /></span>
            <p lang="ur" dir="rtl">ہنر آپ کا، روزگار روشن</p>
            <span>{t('Build a profile in your own words')}</span>
          </div>
        </div>
      </section>}
    </main>
  )
}
