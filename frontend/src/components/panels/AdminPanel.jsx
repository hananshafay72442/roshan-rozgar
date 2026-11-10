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
  const [confirmed, setConfirmed] = useState({})

  useEffect(() => {
    const controller = new AbortController()
    call(`/admin/review?status=${status}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setQueue(data); setConfirmed({}) } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [call, status, revision])

  async function act(path, options) {
    setBusy(true)
    setError('')
    try {
      const result = await call(path, options)
      if (path === '/auth/logout') onLogout(result)
      else { setConfirmed({}); refresh(value => value + 1) }
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  function actions(id, version) {
    return status === 'pending' && <div className="panel-actions">
      {['approved', 'rejected'].map(decision => <button key={decision} type="button" className="button-secondary"
        disabled={busy || (decision === 'approved' && !confirmed[id])} onClick={() => act(`/admin/review/profiles/${id}`, { method: 'PATCH', data: { decision, identity_confirmed: !!confirmed[id], identity_version: version } })}>
        {t(decision === 'approved' ? 'Approve' : 'Reject')}
      </button>)}
    </div>
  }

  return <Panel wide title={t('Admin review')} kicker={t('Your account')} onClose={onClose}>
    <div className="panel-form">
      <div className="panel-actions">
        <label className="form-field">{t('Review status')}
          <select value={status} disabled={busy} onChange={event => {
            setQueue(null); setError(''); setConfirmed({}); setStatus(event.target.value)
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
          <p className="identity-check-status">{t(item.identity.face_check === 'matched' ? 'Automatic face match passed' : 'Manual face comparison required')}
            {item.identity.similarity != null && ` · ${item.identity.similarity.toFixed(1)}%`}</p>
          <div className="identity-grid admin-identity-images">
            <figure><img src={item.identity.selfie_url} alt={t('Your face photo')} loading="lazy" /><figcaption>{t('Your face photo')}</figcaption></figure>
            <figure><img src={item.identity.cnic_url} alt={t('CNIC front')} loading="lazy" /><figcaption>{t('CNIC front')}</figcaption></figure>
          </div>
          {status === 'pending' && <label className="identity-consent"><input type="checkbox" checked={!!confirmed[item.id]}
            onChange={event => setConfirmed(current => ({ ...current, [item.id]: event.target.checked }))} />
            <span>{t('I checked that the face matches the CNIC photo and the document details match this worker.')}</span></label>}
          {actions(item.id, item.identity.version)}
        </article>)}
        {!queue.profiles.length && <p>{t('No items in this queue.')}</p>}
      </>}
    </div>
  </Panel>
}
