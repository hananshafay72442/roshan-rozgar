import { useLanguage } from '../../i18n/LanguageProvider'
import { useEffect, useState } from 'react'
import { profileAudio } from '../../api/audio'
import Icon from '../Icon'
import RippleButton from '../RippleButton/RippleButton'
import { Dictate, Listen } from '../SpeechButtons'
import VoiceInput from '../VoiceInput'
import Panel from './Panel'

const empty = { name: '', service_id: '', city: '', area: '', experience_years: null }
const years = [0, 1, 3, 5, 10, 15, 20, 25]
const steps = [
  { id: 'trade', title: 'What’s your trade?', urdu: 'آپ کا ہنر کیا ہے؟' },
  { id: 'area', title: 'Where do you work?', urdu: 'آپ کہاں کام کرتے ہیں؟' },
  { id: 'years', title: 'How many years have you worked?', urdu: 'آپ کو کتنے سال کا تجربہ ہے؟' },
  { id: 'name', title: 'What should customers call you?', urdu: 'آپ کا نام کیا ہے؟' },
]

export default function ProfilePanel({ editing = false, voiceEnabled, call, onSuccess, onClose, onLogout }) {
  const { t } = useLanguage()
  const [catalog, setCatalog] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState(editing ? 0 : voiceEnabled ? -1 : 0)
  const [profile, setProfile] = useState(empty)
  const [audio, setAudio] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([call('/services', { signal: controller.signal }), editing ? call('/profile', { signal: controller.signal }) : null])
      .then(([services, data]) => { if (!controller.signal.aborted) { setCatalog(services); if (data?.profile) setProfile(data.profile) } })
      .catch((failure) => { if (!controller.signal.aborted) setLoadError(failure.message) })
    return () => controller.abort()
  }, [call, attempt, editing])

  function update(values) {
    setProfile((current) => ({ ...current, ...values }))
    setError('')
  }

  async function useVoice() {
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('audio', await profileAudio(audio), 'profile.wav')
      const { profile: draft } = await call('/voice/profile', { method: 'POST', data: form })
      setProfile(draft)
      const ready = draft.name && draft.city && draft.area && draft.service_id && draft.experience_years != null
      setStep(ready ? steps.length : 0)
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  async function publish() {
    setBusy(true)
    setError('')
    try { onSuccess(await call('/profile', { method: editing ? 'PATCH' : 'POST', data: profile })) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true)
    setError('')
    try { onLogout(await call('/auth/logout', { method: 'POST' })) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  const active = steps[step]
  const allowed = [profile.service_id, profile.city && profile.area, profile.experience_years != null, profile.name.trim().length >= 2][step]
  const trade = catalog?.services.find(({ id }) => profile.service_id === id)

  return (
    <Panel title={t(editing ? 'Edit your profile' : 'Set up your trade profile.')} kicker={t('Your trade account')} onClose={onClose}>
      {!catalog && (loadError ? <div role="alert"><p className="form-error">{t(loadError)}</p>
        <button type="button" className="button-secondary" onClick={() => { setLoadError(''); setAttempt((value) => value + 1) }}>{t('Try again')}</button>
      </div> : <p role="status">{t('Loading trades and neighbourhoods…')}</p>)}
      {catalog && step < 0 && <div className="panel-form">
        <p className="panel-deck">{t('Say your name, trade, neighbourhood and years of experience. We’ll put it into a profile for you to check.')}</p>
        <div className="voice-example">
          <Icon name="mic" size={26} />
          <p><span lang="ur" dir="rtl">میرا نام احمد ہے۔ میں جی ٹین، اسلام آباد میں آٹھ سال سے الیکٹریشن ہوں۔</span>
          <small>Mera naam Ahmed hai. Main G-10 Islamabad mein aath saal se electrician hoon.</small></p>
        </div>
        <Listen text="اپنا نام، ہنر، علاقہ اور تجربہ بتائیں۔" english="Say your name, trade, neighbourhood, and years of experience." />
        <VoiceInput label="Record my introduction" value={audio} onChange={setAudio} seconds={28} disabled={busy} />
        <p className="hint">{t('Your recording is sent to the configured AI provider only when you choose “Fill my profile.”')}</p>
        <RippleButton className="button-primary" onClick={useVoice} disabled={!audio || busy}>{t(busy ? 'Listening to your introduction…' : 'Fill my profile')}</RippleButton>
        <button type="button" className="text-button align-start" disabled={busy} onClick={() => { setStep(0); setError('') }}>{t('Use guided setup')}</button>
      </div>}
      {catalog && active && <div className="panel-form">
        <div className="profile-progress" aria-label={t('Step {step} of {total}', { step: step + 1, total: steps.length })}>
          {steps.map(({ id }, index) => <span key={id} className={index <= step ? 'filled' : ''} />)}
        </div>
        <h3 className="form-title">{t(active.title)}</h3>
        <Listen text={active.urdu} english={active.title} />
        {active.id === 'trade' && <div className="profile-choices">
          {catalog.services.map(({ id, name, icon }) => <button type="button" className="profile-choice" key={id}
            aria-pressed={profile.service_id === id} onClick={() => update({ service_id: id })}>
            <Icon name={icon} size={24} /><span>{t(name)}</span>
          </button>)}
        </div>}
        {active.id === 'area' && <>
          <div className="profile-choices">
            {catalog.cities.map((city) => <button type="button" className="profile-choice" key={city}
              aria-pressed={profile.city === city} onClick={() => update({ city, area: profile.city === city ? profile.area : '' })}>
              <Icon name="pin" size={20} />{t(city)}</button>)}
          </div>
          {profile.city && <label className="form-field">{t('Neighbourhood')}
            <select value={profile.area} onChange={(event) => update({ area: event.target.value })}>
              <option value="">{t('Choose your area')}</option>
              {catalog.areas[profile.city].map((area) => <option key={area} value={area}>{t(area)}</option>)}
            </select>
          </label>}
        </>}
        {active.id === 'years' && <>
          <div className="profile-numbers">
            {years.map((value) => <button key={value} type="button" className="profile-choice"
              aria-pressed={profile.experience_years === value} onClick={() => update({ experience_years: value })}>{value}</button>)}
          </div>
          <label className="form-field">{t('Years of experience')}
            <input type="number" min="0" max="70" value={profile.experience_years ?? ''}
              onChange={(event) => update({ experience_years: event.target.value === '' ? null : Math.max(0, Math.min(70, Math.trunc(Number(event.target.value)))) })} />
          </label>
        </>}
        {active.id === 'name' && <>
          <Dictate label="Say my name" onText={(name) => update({ name: name.slice(0, 80) })} />
          <label className="form-field">{t('Name')} <input dir="auto" autoComplete="name" maxLength={80} value={profile.name} onChange={(event) => update({ name: event.target.value })} /></label>
        </>}
        <div className="panel-actions">
          {(step > 0 || voiceEnabled) && <button type="button" className="button-secondary" onClick={() => setStep(step - 1)}><Icon name="left" size={17} /> {t('Back')}</button>}
          <RippleButton className="button-primary" disabled={!allowed} onClick={() => setStep(step + 1)}>{t('Continue')}</RippleButton>
        </div>
      </div>}
      {catalog && step === steps.length && <div className="panel-form">
        <p className="panel-deck">{t('Check the details customers will see. Your sign-in details stay private.')}</p>
        <dl className="profile-preview">
          <div><dt>{t('Name')}</dt><dd dir="auto">{profile.name}</dd></div>
          <div><dt>{t('Trade')}</dt><dd>{trade && t(trade.name)}</dd></div>
          <div><dt>{t('Area')}</dt><dd><bdi>{t(profile.area)}</bdi>, {t(profile.city)}</dd></div>
          <div><dt>{t('Experience')}</dt><dd>{t('{years} years', { years: profile.experience_years })}</dd></div>
        </dl>
        <Listen text={`${profile.name}، ${trade?.urdu}، ${profile.area}، ${profile.city}، ${profile.experience_years} سال کا تجربہ۔`}
          english={`${profile.name}, ${trade?.name}, ${profile.area} ${profile.city}, ${profile.experience_years} years of experience.`} label="Listen to my profile" />
        <div className="panel-actions">
          <button type="button" className="button-secondary" disabled={busy} onClick={() => setStep(0)}>{t('Change details')}</button>
          <RippleButton className="button-primary" disabled={busy} onClick={publish}>{t(busy ? 'Please wait…' : editing ? 'Save changes' : 'Publish profile')}</RippleButton>
        </div>
      </div>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="panel-bottom"><button type="button" className="text-button" disabled={busy} onClick={signOut}>{t('Sign out')}</button></div>
    </Panel>
  )
}
