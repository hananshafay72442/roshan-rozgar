import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageProvider'
import Icon from './Icon'
import { statusLabels } from './panels/JobDetail'

export default function AccountHome({ user, call, revision, onOpen }) {
  const { t } = useLanguage()
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const worker = user.role === 'worker'
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const data = await call('/jobs', { signal: controller.signal })
        if (!controller.signal.aborted) { setJobs(data.jobs); setError('') }
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message) }
    }
    load()
    const timer = setInterval(() => { if (!document.hidden) load() }, 6500)
    return () => { controller.abort(); clearInterval(timer) }
  }, [call, revision, attempt])
  const active = jobs?.filter(({ state }) => ['requested', 'quoted', 'confirmed'].includes(state)) || []
  const reviewable = !worker ? jobs?.filter(({ state, reviewed }) => state === 'completed' && !reviewed) || [] : []
  const latest = [...active, ...reviewable].slice(0, 3)
  return <div className="account-home">
    <div className="account-home-heading">
      <p className="hero-locale"><Icon name={worker ? 'tool' : 'house'} size={18} />{t(worker ? 'Your trade account' : 'Your customer account')}</p>
      <h1 id="hero-title">{t(worker ? 'Your work, at a glance.' : 'Your home, taken care of.')}</h1>
      <p className="hero-description">{t(worker ? 'See new requests, discuss the work and manage your bookings.' : 'Track your requests, check quotes and keep your jobs moving.')}</p>
      <div className="hero-actions">
        <button type="button" className="button-primary" onClick={() => onOpen()}>{t(worker && !user.profile_complete ? 'Complete your profile' : worker ? 'Open my workspace' : 'My requests')}</button>
        {!worker && <a className="button-secondary" href="#workers">{t('Find a worker')}</a>}
      </div>
    </div>
    <section className="home-requests" aria-label={t('Your jobs')}>
      <div className="home-requests-heading"><h2>{t(worker ? 'Latest requests' : 'My requests')}</h2>
        {jobs && <span>{t('{count} active', { count: active.length })}</span>}</div>
      {error ? <div role="alert"><p className="form-error">{t(error)}</p><button type="button" className="text-button" onClick={() => setAttempt(v => v + 1)}>{t('Try again')}</button></div>
        : jobs === null ? <p role="status">{t('Loading jobs…')}</p>
          : latest.length ? <div className="home-request-list">{latest.map(job => <button type="button" key={job.id} className="home-request" onClick={() => onOpen(job.id)}>
            <span><strong>{worker ? t('Request {id}', { id: job.id }) : job.worker.name}</strong>
              <small>{t(statusLabels[job.state])}{job.state === 'completed' && !job.reviewed ? ` · ${t('Leave a review')}` : ''}</small></span>
            <span className="home-request-price">{job.quote_pkr ? t('Rs {amount}', { amount: job.quote_pkr.toLocaleString('en-PK') }) : t('View request')}<Icon name="chevron" size={18} /></span>
          </button>)}</div> : <div className="home-requests-empty"><Icon name="chat" size={28} /><h3>{t('No requests yet.')}</h3><p>{t(worker ? 'Requests from neighbours will appear here.' : 'Choose a local worker to start a conversation.')}</p></div>}
      {jobs?.length > 0 && <button type="button" className="text-button" onClick={() => onOpen()}>{t('View all jobs')} <Icon name="chevron" size={15} /></button>}
    </section>
  </div>
}
