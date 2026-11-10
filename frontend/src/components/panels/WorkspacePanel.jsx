import { useEffect, useState } from 'react'
import Icon from '../Icon'
import Panel from './Panel'
import JobDetail, { statusLabels } from './JobDetail'

export default function WorkspacePanel({ user, initialJob, call, onClose, onLogout, onCatalogChange }) {
  const [jobs, setJobs] = useState(null)
  const [profile, setProfile] = useState(null)
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

  const activeJob = jobs?.some(({ id }) => id === selected) ? selected : jobs?.[0]?.id

  return (
    <Panel title={worker ? 'Worker workspace.' : 'My requests.'} kicker={worker ? user.profile_name || 'Your trade account' : 'Your customer account'}
      onClose={onClose} wide>
      <div className="workspace-toolbar">
        {worker && profile && <label className="availability-filter">
          <input type="checkbox" checked={profile.taking_work} onChange={updateAvailability} disabled={busy} />
          <span>Accept new jobs</span>
        </label>}
        {worker && profile?.busy && <span className="job-status is-confirmed">Currently booked</span>}
        <span className="workspace-account"><Icon name={user.verification === 'sms' ? 'shield' : 'phone'} size={16} />
          {user.verification === 'sms' ? 'Phone verified' : 'Demo verification'}</span>
        <button type="button" className="text-button" onClick={signOut} disabled={busy}>Sign out</button>
      </div>
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {error && <div className="workspace-error" role="alert">
        <p className="form-error">{error}</p>
        <button type="button" className="button-secondary" onClick={() => setRevision((value) => value + 1)}>Retry</button>
      </div>}
      {jobs === null && !error && <p className="panel-deck" role="status">Loading jobs…</p>}
      {jobs?.length === 0 && <div className="workspace-empty">
        <Icon name="chat" size={31} />
        <h3>No requests yet.</h3>
        <p>{worker ? 'Requests from neighbours will appear here.' : 'Choose a local worker to start a conversation.'}</p>
        {!worker && <a className="button-secondary" href="#workers" onClick={onClose}>Find a worker</a>}
      </div>}
      {jobs?.length > 0 && <div className="workspace-layout">
        <nav className="job-list" aria-label="Your jobs">
          {jobs.map((job) => <button key={job.id} type="button" className="job-list-item" onClick={() => setSelected(job.id)}
            aria-pressed={job.id === activeJob}>
            <strong>{worker ? `Request ${job.id}` : job.worker.name}</strong>
            <small>{statusLabels[job.state]}{job.quote_pkr ? ` · Rs ${job.quote_pkr.toLocaleString('en-PK')}` : ''}</small>
          </button>)}
        </nav>
        <JobDetail key={activeJob} jobId={activeJob} call={call} revision={revision} role={user.role} onChange={changed} />
      </div>}
    </Panel>
  )
}
