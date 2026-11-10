import { useLanguage } from '../../i18n/LanguageProvider'
import { useEffect, useState } from 'react'
import Icon from '../Icon'
import Panel from './Panel'
import JobDetail, { jobStatus } from './JobDetail'
import IdentitySubmission from '../IdentitySubmission'

export default function WorkspacePanel({ user, initialJob, call, onClose, onLogout, onCatalogChange, onEditProfile }) {
  const { t } = useLanguage()
  const [jobs, setJobs] = useState(null)
  const [profile, setProfile] = useState(null)
  const [identityMode, setIdentityMode] = useState('manual')
  const [reviewsOnly, setReviewsOnly] = useState(false)
  const [selected, setSelected] = useState(initialJob)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const worker = user.role === 'worker'

  useEffect(() => {
    const controller = new AbortController()
    function load() {
      const options = { signal: controller.signal }
      Promise.all([call('/jobs', options), worker ? call('/profile', options) : null]).then(([result, info]) => {
        if (controller.signal.aborted) return
        setJobs(result.jobs)
        setProfile(info?.profile)
        if (info) setIdentityMode(info.identity_mode)
        setError('')
      }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message) })
    }
    load()
    const timer = setInterval(() => { if (!document.hidden) load() }, 6500)
    return () => { controller.abort(); clearInterval(timer) }
  }, [call, revision, worker])

  function changed() {
    setRevision((value) => value + 1)
    onCatalogChange()
  }

  async function updateAvailability(event) {
    const takingWork = event.target.checked
    setActionError('')
    setBusy(true)
    try {
      const result = await call('/profile/availability', { method: 'PATCH', data: { taking_work: takingWork } })
      setProfile((current) => ({ ...current, ...result }))
      changed()
    } catch (failure) { setActionError(failure.message) } finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true)
    setActionError('')
    try { onLogout(await call('/auth/logout', { method: 'POST' })) }
    catch (failure) { setActionError(failure.message) }
    finally { setBusy(false) }
  }

  const reviewable = jobs?.filter(job => job.state === 'completed' && !job.reviewed) || []
  const visibleJobs = reviewsOnly ? reviewable : jobs
  const activeJob = visibleJobs?.some(({ id }) => id === selected) ? selected : visibleJobs?.[0]?.id
  const verifiedLabel = {
    sms: 'Phone verified', email: 'Email verified', demo: 'Demo verification',
  }[user.verification]

  return (
    <Panel title={t(worker ? 'Worker workspace.' : 'My requests.')} kicker={worker && user.profile_name ? user.profile_name : t(worker ? 'Your trade account' : 'Your customer account')}
      onClose={onClose} wide>
      <div className="workspace-toolbar">
        <button type="button" className="text-button" onClick={onEditProfile}>{t('Edit your profile')}</button>
        {worker && profile && <label className="availability-filter">
          <input type="checkbox" checked={profile.taking_work} onChange={updateAvailability} disabled={busy} />
          <span>{t('Accept new jobs')}</span>
        </label>}
        {worker && profile?.busy && <span className="job-status is-confirmed">{t('Currently booked')}</span>}
        {verifiedLabel && <span className="workspace-account"><Icon name={user.verification === 'demo' ? 'phone' : 'shield'} size={16} />
          {t(verifiedLabel)}</span>}
        <button type="button" className="text-button" onClick={signOut} disabled={busy}>{t('Sign out')}</button>
      </div>
      {worker && profile && <IdentitySubmission profile={profile} mode={identityMode} call={call} onChange={changed} />}
      {!worker && jobs && <div className="panel-actions review-filters">
        <button type="button" className="button-secondary" aria-pressed={!reviewsOnly} onClick={() => setReviewsOnly(false)}>{t('All requests')}</button>
        <button type="button" className="button-secondary" aria-pressed={reviewsOnly} onClick={() => setReviewsOnly(true)}>{t('Reviews to write')} ({reviewable.length})</button>
      </div>}
      {actionError && <p className="form-error" role="alert">{t(actionError)}</p>}
      {error && <div className="workspace-error" role="alert">
        <p className="form-error">{t(error)}</p>
        <button type="button" className="button-secondary" onClick={() => setRevision((value) => value + 1)}>{t('Retry')}</button>
      </div>}
      {jobs === null && !error && <p className="panel-deck" role="status">{t('Loading jobs…')}</p>}
      {jobs?.length === 0 && <div className="workspace-empty">
        <Icon name="chat" size={31} />
        <h3>{t('No requests yet.')}</h3>
        <p>{t(worker ? 'Requests from neighbours will appear here.' : 'Choose a local worker to start a conversation.')}</p>
        {!worker && <a className="button-secondary" href="#workers" onClick={onClose}>{t('Find a worker')}</a>}
      </div>}
      {reviewsOnly && !reviewable.length && <p className="hint">{t('You are all caught up. Reviews become available after a completed job.')}</p>}
      {visibleJobs?.length > 0 && <div className="workspace-layout">
        <nav className="job-list" aria-label={t('Your jobs')}>
          {visibleJobs.map((job) => <button key={job.id} type="button" className="job-list-item" onClick={() => setSelected(job.id)}
            aria-pressed={job.id === activeJob}>
            <strong>{worker ? t('Request {id}', { id: job.id }) : job.worker.name}</strong>
            <small>{t(jobStatus(job))}{job.quote_pkr ? ` · ${t('Rs {amount}', { amount: job.quote_pkr.toLocaleString('en-PK') })}` : ''}</small>
            {!worker && job.state === 'completed' && !job.reviewed && <span className="review-prompt">★ {t('Leave a review')}</span>}
          </button>)}
        </nav>
        <JobDetail key={activeJob} jobId={activeJob} call={call} revision={revision} role={user.role} onChange={changed} />
      </div>}
    </Panel>
  )
}
