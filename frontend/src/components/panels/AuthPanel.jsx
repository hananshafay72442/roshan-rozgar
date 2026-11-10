import { useState } from 'react'
import { useLanguage } from '../../i18n/LanguageProvider'
import Icon from '../Icon'
import RippleButton from '../RippleButton/RippleButton'
import { Dictate, Listen } from '../SpeechButtons'
import Panel from './Panel'

const roles = [
  { id: 'customer', title: 'I need a worker', icon: 'house' },
  { id: 'worker', title: 'I’m a skilled worker', icon: 'tool' },
]

function phoneDigits(text) {
  return text.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) & 15)).replace(/[^+0-9]/g, '')
}

export default function AuthPanel({ initialMode, initialRole, session, call, onSuccess, onClose, onRetry }) {
  const { t } = useLanguage()
  const [mode, setMode] = useState(initialMode)
  const [role, setRole] = useState(initialRole || '')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chooseRole = mode === 'register' && !role
  const worker = role === 'worker'
  const unavailable = session.verification_mode === 'unavailable' && !challenge
  const demo = session.verification_mode === 'demo' || session.demo_auth

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (challenge) {
        onSuccess(await call('/auth/verify', { method: 'POST', data: { code } }))
      } else {
        const next = await call('/auth/code', { method: 'POST', data: { intent: mode, role, phone } })
        setChallenge(next)
      }
    } catch (failure) {
      setError(failure.message)
    } finally { setBusy(false) }
  }

  function resetChallenge() {
    setChallenge(null)
    setCode('')
    setError('')
  }

  return (
    <Panel title={t(challenge ? 'Verify your phone' : mode === 'login' ? 'Welcome back.' : 'Get started')}
      kicker={t('Your Roshan Rozgar account')} onClose={onClose}>
      {unavailable ? <div className="panel-form">
        <p className="form-error" role="status">{t('SMS sign-in is unavailable right now. Please try again later.')}</p>
        <button type="button" className="button-secondary" onClick={onRetry}>{t('Try again')}</button>
      </div> : chooseRole ? <>
        <p className="panel-deck">{t('Choose how you’ll use Roshan Rozgar.')}</p>
        <div className="role-options">
          {roles.map(({ id, title, icon }) => <button key={id} className="role-option" type="button" onClick={() => setRole(id)}>
            <span className="role-icon"><Icon name={icon} size={24} /></span>
            <strong>{t(title)}</strong><Icon name="chevron" size={18} />
          </button>)}
        </div>
      </> : <form className="panel-form" onSubmit={submit}>
        {challenge ? <>
          <p className="panel-deck">{challenge.demo_code
            ? t('Verify with the local demo code below.')
            : t('Enter the six-digit code sent to {phone}.', { phone })}</p>
          <label className="form-field">{t('Verification code')} <input type="text" dir="ltr" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(phoneDigits(event.target.value).slice(0, 6))} /></label>
          {challenge.demo_code && <div className="demo-banner"><span><strong>{t('Demo code')}</strong> <code dir="ltr">{challenge.demo_code}</code></span>
            <button type="button" className="text-button" onClick={() => setCode(challenge.demo_code)}>{t('Use demo code')}</button></div>}
          <RippleButton type="submit" className="button-primary" disabled={busy}>{t(busy ? 'Verifying…' : 'Verify and continue')}</RippleButton>
          <button type="button" className="text-button align-start" disabled={busy} onClick={resetChallenge}>{t('Request a new code or change number')}</button>
        </> : <>
          <p className="panel-deck">{t(demo ? 'Use your Pakistani mobile number to get a local demo code.' : 'Use your Pakistani mobile number. You’ll get a one-time code.')}</p>
          {worker && <Listen text="اپنا موبائل نمبر بتائیں۔ آپ کو چھ ہندسوں کا کوڈ ملے گا۔" english="Enter your mobile number to get a six digit code." />}
          <label className="form-field">{t('Mobile number')}
            <input type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="0300 1234567" maxLength={22}
              required value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          {worker && <Dictate onText={(text) => { const number = phoneDigits(text); if (number) setPhone(number) }} label="Say my number" />}
          {demo && session.demo_data && mode === 'login' && <div className="demo-banner demo-accounts">
            <span>{t('Try a sample account')}</span>
            <button type="button" className="text-button" onClick={() => setPhone('03000000001')}>{t('Demo worker')}</button>
            <button type="button" className="text-button" onClick={() => setPhone('03000000099')}>{t('Demo customer')}</button>
          </div>}
          <RippleButton type="submit" className="button-primary" disabled={busy || !session.csrf_token}>
            {t(busy ? 'Requesting code…' : demo ? 'Get demo code' : 'Send SMS code')}
          </RippleButton>
          {mode === 'register' && <button type="button" className="text-button align-start" disabled={busy} onClick={() => setRole('')}>{t('Choose a different account type')}</button>}
        </>}
        {error && <p className="form-error" role="alert">{t(error)}</p>}
      </form>}
      {!unavailable && !challenge && <div className="panel-bottom">
        <span>{t(mode === 'login' ? 'New here?' : 'Already registered?')}</span>
        <button className="text-button" type="button" disabled={busy} onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          setRole('')
          setError('')
        }}>{t(mode === 'login' ? 'Create an account' : 'Sign in')}</button>
      </div>}
    </Panel>
  )
}
