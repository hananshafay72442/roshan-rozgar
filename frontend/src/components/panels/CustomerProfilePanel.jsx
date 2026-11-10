import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageProvider'
import Panel from './Panel'

export default function CustomerProfilePanel({ call, onClose, onSuccess }) {
  const { t } = useLanguage()
  const [catalog, setCatalog] = useState(null)
  const [profile, setProfile] = useState({ name: '', city: 'Islamabad', area: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([call('/services', { signal: controller.signal }), call('/account/profile', { signal: controller.signal })])
      .then(([data, account]) => { if (!controller.signal.aborted) { setCatalog(data); if (account.profile) setProfile(account.profile); setError('') } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [call, attempt])
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { onSuccess(await call('/account/profile', { method: 'PATCH', data: profile })) }
    catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <Panel title={t('Edit your profile')} kicker={t('Your customer account')} onClose={onClose}>
    <p className="panel-deck">{t('Save your neighbourhood to see workers within 5 km. Distances use approximate neighbourhood centres.')}</p>
    {catalog ? <form className="panel-form" onSubmit={save}>
      <label className="form-field">{t('Name')}<input autoComplete="name" dir="auto" minLength={2} maxLength={80} required value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} /></label>
      <label className="form-field">{t('City')}<select value={profile.city} onChange={event => setProfile({ ...profile, city: event.target.value, area: '' })}>
        {catalog.cities.map(city => <option key={city} value={city}>{t(city)}</option>)}</select></label>
      <label className="form-field">{t('Neighbourhood')}<select required value={profile.area} onChange={event => setProfile({ ...profile, area: event.target.value })}>
        <option value="">{t('Choose your area')}</option>{catalog.areas[profile.city]?.map(area => <option key={area} value={area}>{t(area)}</option>)}</select></label>
      <button type="submit" className="button-primary" disabled={busy}>{t(busy ? 'Please wait…' : 'Save changes')}</button>
    </form> : !error && <p role="status">{t('Loading trades and neighbourhoods…')}</p>}
    {error && <div role="alert"><p className="form-error">{t(error)}</p>{!catalog && <button className="text-button" type="button" onClick={() => setAttempt(v => v + 1)}>{t('Try again')}</button>}</div>}
  </Panel>
}
