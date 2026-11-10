import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageProvider'

export default function WorkerOverview({ call, revision, onEditProfile, onOpenWorkspace }) {
  const { t } = useLanguage()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    call('/profile', { signal: controller.signal }).then(data => { if (!controller.signal.aborted) { setProfile(data.profile); setError('') } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [call, revision])
  return <section className="container worker-overview" id="my-profile" aria-labelledby="my-profile-title">
    <div className="section-heading"><div><p className="eyebrow">{t('Your trade account')}</p><h2 id="my-profile-title">{t('Your public profile.')}</h2></div>
      <button type="button" className="button-secondary" onClick={onEditProfile}>{t('Edit your profile')}</button></div>
    {error ? <p className="form-error" role="alert">{t(error)}</p> : profile ? <div className="worker-profile-summary">
      <div><h3 dir="auto">{profile.name}</h3><p>{t(profile.area)}, {t(profile.city)}</p></div>
      <div><strong>{t('{years} years', { years: profile.experience_years })}</strong><p>{t('Experience')}</p></div>
      <div><strong>{t(profile.busy ? 'Currently booked' : profile.available ? 'Available now' : 'Not available')}</strong><p>{t('Availability')}</p></div>
      <button type="button" className="text-button" onClick={() => onOpenWorkspace()}>{t('Manage availability')}</button>
    </div> : <div className="catalog-message"><p>{t('Complete your profile to receive requests from nearby customers.')}</p><button type="button" className="button-primary" onClick={onEditProfile}>{t('Complete your profile')}</button></div>}
  </section>
}
