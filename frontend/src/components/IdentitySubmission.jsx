import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageProvider'
import IdentityFields from './IdentityFields'
import { identityForm } from '../api/client'

export default function IdentitySubmission({ profile, mode, call, onChange }) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [photos, setPhotos] = useState({})
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const identity = profile.identity
  return <section className="identity-submission">
    <div><h3>{t('Identity verification')}</h3><p className="hint" role="status">{t(!identity ? 'Upload your face photo and CNIC to request admin approval.'
      : profile.moderation === 'approved' ? 'Your profile has been approved.'
        : profile.moderation === 'rejected' ? 'Your submission was rejected. Upload clearer photos to try again.'
          : identity.face_check === 'matched' ? 'Face matched. Waiting for admin approval.' : 'Waiting for an administrator to check your face and CNIC.')}</p></div>
    {identity && !editing && <button className="text-button" type="button" onClick={() => setEditing(true)}>{t('Replace identity photos')}</button>}
    {(!identity || editing) && <form className="panel-form" onSubmit={async event => {
      event.preventDefault()
      setBusy(true); setError('')
      try {
        await call('/profile/identity', { method: 'POST', data: identityForm(photos, consent) })
        setEditing(false); setPhotos({}); setConsent(false); onChange()
      } catch (failure) { setError(failure.message) }
      finally { setBusy(false) }
    }}>
      <IdentityFields photos={photos} setPhotos={setPhotos} consent={consent} setConsent={setConsent} mode={mode} disabled={busy} onError={setError} />
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="panel-actions">
        <button className="button-primary" disabled={busy || !consent || !photos.selfie || !photos.cnic_front}>{t(busy ? 'Checking your photos…' : 'Submit for review')}</button>
        {identity && <button className="button-secondary" type="button" disabled={busy} onClick={() => setEditing(false)}>{t('Cancel')}</button>}
      </div>
    </form>}
  </section>
}
