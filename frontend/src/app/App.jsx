import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import ThemeToggle from '../components/ThemeToggle'
import AuthPanel from '../components/panels/AuthPanel'
import ProfilePanel from '../components/panels/ProfilePanel'
import RequestPanel from '../components/panels/RequestPanel'
import ReviewsPanel from '../components/panels/ReviewsPanel'
import WorkspacePanel from '../components/panels/WorkspacePanel'
import Panel from '../components/panels/Panel'
import HomePage from '../pages/HomePage'
import '../styles/panels.css'

export default function App() {
  const [session, setSession] = useState({})
  const [sessionError, setSessionError] = useState('')
  const [sessionAttempt, setSessionAttempt] = useState(0)
  const [panel, setPanel] = useState(null)
  const [revision, setRevision] = useState(0)
  const user = session.user
  const call = useCallback((path, options) => api(path, { ...options, csrf: session.csrf_token }), [session.csrf_token])
  const refreshCatalog = useCallback(() => setRevision((value) => value + 1), [])
  const close = useCallback(() => setPanel(null), [])

  useEffect(() => {
    const controller = new AbortController()
    api('/session', { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setSession(data); setSessionError('') }
    }).catch((error) => {
      if (!controller.signal.aborted) setSessionError(error.message)
    })
    return () => controller.abort()
  }, [sessionAttempt])

  const openAuth = useCallback((mode, role, worker) => setPanel({ type: 'auth', mode, role, worker }), [])
  const openWorkspace = useCallback(() => {
    setPanel({ type: user?.role === 'worker' && !user.profile_complete ? 'profile' : 'workspace' })
  }, [user])

  function requestWorker(worker) {
    if (!user) openAuth('register', 'customer', worker)
    else if (user.role === 'worker') setPanel({ type: 'role', worker })
    else setPanel({ type: 'request', worker })
  }

  function authSuccess(data) {
    setSession(data)
    if (data.user.role === 'worker' && !data.user.profile_complete) setPanel({ type: 'profile' })
    else if (data.user.role === 'customer' && panel.worker) setPanel({ type: 'request', worker: panel.worker })
    else setPanel({ type: 'workspace' })
  }

  function signedOut(data) {
    setSession(data)
    close()
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader user={user} openAuth={openAuth} openWorkspace={openWorkspace} />
      <HomePage revision={revision} onRequest={requestWorker}
        onReviews={(worker) => setPanel({ type: 'reviews', worker })}
        onJoinWorker={() => {
          if (!user) openAuth('register', 'worker')
          else if (user.role === 'worker') openWorkspace()
          else setPanel({ type: 'role' })
        }} />
      <SiteFooter />
      <ThemeToggle />
      {panel?.type === 'auth' && (session.csrf_token ? <AuthPanel key={`${panel.mode}:${panel.role}`} initialMode={panel.mode} initialRole={panel.role}
        session={session} call={call} onClose={close} onSuccess={authSuccess} />
        : <Panel kicker="Your account" title="Connecting…" onClose={close}>
          {sessionError ? <div role="alert"><p className="form-error">{sessionError}</p>
            <button type="button" className="button-secondary" onClick={() => setSessionAttempt((value) => value + 1)}>Try again</button>
          </div> : <p role="status">Getting your account ready…</p>}
        </Panel>)}
      {panel?.type === 'profile' && <ProfilePanel call={call} voiceEnabled={session.voice_profile} onClose={close} onLogout={signedOut}
        onSuccess={(data) => { setSession(data); refreshCatalog(); setPanel({ type: 'workspace' }) }} />}
      {panel?.type === 'workspace' && user && <WorkspacePanel user={user} initialJob={panel.job} call={call}
        onClose={close} onLogout={signedOut} onCatalogChange={refreshCatalog} />}
      {panel?.type === 'request' && <RequestPanel worker={panel.worker} call={call} onClose={close}
        onSuccess={(job) => setPanel({ type: 'workspace', job })} />}
      {panel?.type === 'reviews' && <ReviewsPanel worker={panel.worker} call={call} onClose={close} />}
      {panel?.type === 'role' && <Panel title="Switch account type?" kicker="Your account" onClose={close}>
        <p className="panel-deck">You’re signed in as a {user.role}. Sign out from your workspace to use the other account type.</p>
        <button className="button-secondary" type="button" onClick={openWorkspace}>Open my workspace</button>
      </Panel>}
    </>
  )
}
