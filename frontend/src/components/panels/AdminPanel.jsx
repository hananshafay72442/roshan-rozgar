import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageProvider'
import Panel from './Panel'

function Phone({ number }) {
  return number ? <a href={`tel:${number}`} dir="ltr">{number}</a> : <span>—</span>
}

export default function AdminPanel({ call, onClose, onLogout }) {
  const { t } = useLanguage()
  const [status, setStatus] = useState('pending')
  const [queue, setQueue] = useState(null)
  const [revision, refresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    call(`/admin/review?status=${status}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setQueue(data) })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [call, status, revision])

  async function act(path, options) {
    setBusy(true)
    setError('')
    try {
      const result = await call(path, options)
      if (path === '/auth/logout') onLogout(result)
      else refresh(value => value + 1)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  function actions(id) {
    return status === 'pending' && <div className="panel-actions">
      {['approved', 'rejected'].map(decision => <button key={decision} type="button" className="button-secondary"
        disabled={busy} onClick={() => act(`/admin/review/profiles/${id}`, { method: 'PATCH', data: { decision } })}>
        {t(decision === 'approved' ? 'Approve' : 'Reject')}
      </button>)}
    </div>
  }

  return <Panel wide title={t('Admin review')} kicker={t('Your account')} onClose={onClose}>
    <div className="panel-form">
      <div className="panel-actions">
        <label className="form-field">{t('Review status')}
          <select value={status} disabled={busy} onChange={event => {
            setQueue(null); setError(''); setStatus(event.target.value)
          }}>
            <option value="pending">{t('Pending review')}</option>
            <option value="approved">{t('Approved')}</option>
            <option value="rejected">{t('Rejected')}</option>
          </select>
        </label>
        <button type="button" className="text-button" disabled={busy} onClick={() => { setError(''); refresh(value => value + 1) }}>{t('Refresh')}</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => act('/auth/logout', { method: 'POST' })}>{t('Sign out')}</button>
      </div>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      {!queue && !error && <p role="status">{t('Loading…')}</p>}
      {queue && <>
        <h3>{t('Worker profiles')}</h3>
        {queue.profiles.map(item => <article key={item.id} className="admin-review-item">
          <strong dir="auto">{item.name}</strong>
          <p>{item.service} · {item.area}, {item.city} · {t('{years} years', { years: item.experience })}</p>
          <Phone number={item.phone} />
          {actions(item.id)}
        </article>)}
        {!queue.profiles.length && <p>{t('No items in this queue.')}</p>}
      </>}
    </div>
  </Panel>
}
