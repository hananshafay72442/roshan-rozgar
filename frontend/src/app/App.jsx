import { useLanguage } from '../i18n/LanguageProvider'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import ThemeToggle from '../components/ThemeToggle'
import AuthPanel from '../components/panels/AuthPanel'
import ProfilePanel from '../components/panels/ProfilePanel'
import CustomerProfilePanel from '../components/panels/CustomerProfilePanel'
import RequestPanel from '../components/panels/RequestPanel'
import ReviewsPanel from '../components/panels/ReviewsPanel'
import WorkspacePanel from '../components/panels/WorkspacePanel'
import AdminPanel from '../components/panels/AdminPanel'
import Panel from '../components/panels/Panel'
import HomePage from '../pages/HomePage'
import '../styles/panels.css'

export default function App() {
  const { t } = useLanguage()
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
  const openProfile = () => setPanel({ type: user?.role === 'worker' ? 'profile' : 'customer-profile', editing: !!user?.profile_complete })
  const openWorkspace = useCallback(() => {
    setPanel({ type: user?.role === 'admin' ? 'admin' : user?.role === 'worker' && !user.profile_complete ? 'profile' : 'workspace' })
  }, [user])

  function requestWorker(worker) {
    if (!user) openAuth('register', 'customer', worker)
    else if (user.role === 'worker') setPanel({ type: 'role', worker })
    else if (!user.location) setPanel({ type: 'customer-profile', worker })
    else setPanel({ type: 'request', worker })
  }

  function authSuccess(data) {
    setSession(data)
    if (data.user.role === 'admin') setPanel({ type: 'admin' })
    else if (data.user.role === 'worker' && !data.user.profile_complete) setPanel({ type: 'profile' })
    else if (data.user.role === 'customer' && !data.user.profile_complete) setPanel({ type: 'customer-profile', worker: panel.worker })
    else if (data.user.role === 'customer' && panel.worker) setPanel({ type: 'request', worker: panel.worker })
    else close()
  }

  function signedOut(data) {
    setSession(data)
    close()
  }

  return (
    <>
      <a className="skip-link" href="#main">{t('Skip to content')}</a>
      <SiteHeader user={user} openAuth={openAuth} openWorkspace={openWorkspace} />
      {user?.role === 'admin' ? <main id="main" className="container worker-section" tabIndex={-1}>
        <div id="top" className="worker-intro"><div><h2>{t('Admin review')}</h2>
          <button type="button" className="button-primary" onClick={openWorkspace}>{t('Open review queue')}</button>
        </div></div>
      </main> : <HomePage key={user?.id || 'guest'} revision={revision} user={user} call={call} onEditProfile={openProfile}
        onBrowse={() => user?.role === 'customer' ? openProfile() : openAuth('register', 'customer')}
        onOpenWorkspace={(job) => setPanel({ type: user?.role === 'worker' && !user.profile_complete ? 'profile' : 'workspace', job })} onRequest={requestWorker}
        onReviews={(worker) => setPanel({ type: 'reviews', worker })}
        onJoinWorker={() => {
          if (!user) openAuth('register', 'worker')
          else if (user.role === 'worker') openWorkspace()
          else setPanel({ type: 'role' })
        }} />}
      <SiteFooter user={user} openWorkspace={openWorkspace} />
      <ThemeToggle />
      {panel?.type === 'auth' && (session.csrf_token ? <AuthPanel key={`${panel.mode}:${panel.role}`} initialMode={panel.mode} initialRole={panel.role}
        session={session} call={call} onClose={close} onSuccess={authSuccess} onRetry={() => setSessionAttempt((value) => value + 1)} />
        : <Panel kicker={t('Your account')} title={t('Connecting…')} onClose={close}>
          {sessionError ? <div role="alert"><p className="form-error">{t(sessionError)}</p>
            <button type="button" className="button-secondary" onClick={() => setSessionAttempt((value) => value + 1)}>{t('Try again')}</button>
          </div> : <p role="status">{t('Getting your account ready…')}</p>}
        </Panel>)}
      {panel?.type === 'customer-profile' && <CustomerProfilePanel call={call} onClose={close}
        onSuccess={data => { setSession(data); refreshCatalog(); if (panel.worker) setPanel({ type: 'request', worker: panel.worker }); else close() }} />}
      {panel?.type === 'admin' && user?.role === 'admin' && <AdminPanel call={call} onClose={close} onLogout={signedOut} />}
      {panel?.type === 'profile' && <ProfilePanel editing={panel.editing} call={call} voiceEnabled={session.voice_profile} identityMode={session.identity_mode} onClose={close} onLogout={signedOut}
        onSuccess={(data) => { setSession(data); refreshCatalog(); setPanel({ type: 'workspace' }) }} />}
      {panel?.type === 'workspace' && user && <WorkspacePanel user={user} initialJob={panel.job} call={call} onEditProfile={openProfile}
        onClose={() => { refreshCatalog(); close() }} onLogout={signedOut} onCatalogChange={refreshCatalog} />}
      {panel?.type === 'request' && <RequestPanel worker={panel.worker} call={call} onClose={close}
        onSuccess={(job) => setPanel({ type: 'workspace', job })} />}
      {panel?.type === 'reviews' && <ReviewsPanel worker={panel.worker} call={call} onClose={close} />}
      {panel?.type === 'role' && <Panel title={t('Switch account type?')} kicker={t('Your account')} onClose={close}>
        <p className="panel-deck">{t(user.role === 'worker'
          ? 'You’re signed in as a worker. Sign out from your workspace to use the other account type.'
          : 'You’re signed in as a customer. Sign out from your workspace to use the other account type.')}</p>
        <button className="button-secondary" type="button" onClick={openWorkspace}>{t('Open my workspace')}</button>
      </Panel>}
    </>
  )
}
