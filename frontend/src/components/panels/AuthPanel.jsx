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

const methods = [
  { id: 'email', title: 'Email', icon: 'mail' },
  { id: 'sms', title: 'Phone (SMS)', icon: 'phone' },
]

function phoneDigits(text) {
  return text.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) & 15)).replace(/[^+0-9]/g, '')
}

export default function AuthPanel({ initialMode, initialRole, session, call, onSuccess, onClose, onRetry }) {
  const { t } = useLanguage()
  const [mode, setMode] = useState(initialMode)
  const [role, setRole] = useState(initialRole || '')
  const [channel, setChannel] = useState('email')
  const [emailCode, setEmailCode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [contactPhone, setContactPhone] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chooseRole = mode === 'register' && !role
  const worker = role === 'worker'
  const sms = channel === 'sms'
  const usePassword = !sms && !emailCode
  const canUseEmailCode = ['email', 'demo'].includes(session.verification_modes?.email)
  const verification = session.verification_modes?.[channel] ?? (sms ? session.verification_mode : 'unavailable')
  const unavailable = !usePassword && verification === 'unavailable'
  const demo = verification === 'demo'

  async function submit(event) {
    event.preventDefault()
    if (usePassword && mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (challenge) {
        onSuccess(await call('/auth/verify', { method: 'POST', data: { code } }))
      } else if (usePassword) {
        onSuccess(await call('/auth/password', { method: 'POST', data: { intent: mode, role, email, password, contact_phone: contactPhone.trim() } }))
      } else {
        const contact = sms ? { phone } : { email }
        const next = await call('/auth/code', { method: 'POST', data: { intent: mode, role, channel, ...contact } })
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

  const passwordAction = mode === 'register' ? 'Create an account' : 'Sign in'
  const codeAction = demo ? 'Get demo code' : sms ? 'Send SMS code' : 'Send email code'

  return (
    <Panel title={t(challenge ? (sms ? 'Verify your phone' : 'Verify your email') : mode === 'login' ? 'Welcome back.' : 'Get started')}
      kicker={t('Your Roshan Rozgar account')} onClose={onClose}>
      {chooseRole ? <>
        <p className="panel-deck">{t('Choose how you’ll use Roshan Rozgar.')}</p>
        <div className="role-options">
          {roles.map(({ id, title, icon }) => <button key={id} className="role-option" type="button" onClick={() => setRole(id)}>
            <span className="role-icon"><Icon name={icon} size={24} /></span>
            <strong>{t(title)}</strong><Icon name="chevron" size={18} />
          </button>)}
        </div>
      </> : <form className="panel-form" onSubmit={submit}>
        {challenge ? <>
          <p className="panel-deck auth-code-deck">{challenge.demo_code
            ? t('Verify with the local demo code below.')
            : t('Enter the six-digit code sent to {address}.', { address: `\u2066${sms ? phone : email.trim()}\u2069` })}</p>
          <label className="form-field">{t('Verification code')} <input type="text" dir="ltr" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(phoneDigits(event.target.value).slice(0, 6))} /></label>
          {challenge.demo_code && <div className="demo-banner"><span><strong>{t('Demo code')}</strong> <code dir="ltr">{challenge.demo_code}</code></span>
            <button type="button" className="text-button" onClick={() => setCode(challenge.demo_code)}>{t('Use demo code')}</button></div>}
          <RippleButton type="submit" className="button-primary" disabled={busy}>{t(busy ? 'Verifying…' : 'Verify and continue')}</RippleButton>
          <button type="button" className="text-button align-start" disabled={busy} onClick={resetChallenge}>{t('Request a new code or change contact details')}</button>
        </> : <>
          <div className="auth-methods" role="group" aria-label={t('Sign-in method')}>
            {methods.map(({ id, title, icon }) => <button key={id} type="button" className="auth-method"
              aria-pressed={channel === id} disabled={busy} onClick={() => {
                if (channel !== id) { setChannel(id); setEmailCode(false); setPassword(''); setConfirmPassword(''); setShowPassword(false); setError('') }
              }}>
              <Icon name={icon} size={19} />{t(title)}
            </button>)}
          </div>
          {unavailable ? <>
            <p className="form-error" role="status">{t(sms
              ? 'SMS sign-in is unavailable right now. Please try again later.'
              : 'Email sign-in is unavailable right now. Please try again later.')}</p>
            <button type="button" className="button-secondary" onClick={onRetry}>{t('Try again')}</button>
          </> : <>
            {sms ? <>
              <p className="panel-deck">{t(demo ? 'Use your Pakistani mobile number to get a local demo code.' : 'Use your Pakistani mobile number. You’ll get a one-time code.')}</p>
              {worker && <Listen text="اپنا موبائل نمبر بتائیں۔ آپ کو چھ ہندسوں کا کوڈ ملے گا۔" english="Enter your mobile number to get a six-digit code." />}
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
            </> : <>
              {!usePassword && <p className="panel-deck">{t('Use your email address to get a one-time code.')}</p>}
              <label className="form-field">{t('Email address')}
                <input type="email" dir="ltr" autoComplete="email" autoCapitalize="none" placeholder="name@example.com" maxLength={254}
                  required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              {usePassword && mode === 'register' && <label className="form-field">{t('Mobile number (optional)')}
                <input type="tel" dir="ltr" autoComplete="tel" placeholder="0300 1234567" maxLength={22}
                  value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
              </label>}
              {usePassword && mode === 'register' && <label className="form-field">{t('Contact phone (optional)')}
                <input type="tel" dir="ltr" autoComplete="tel" maxLength={24} value={contactPhone} onChange={event => setContactPhone(event.target.value)} />
                <span className="hint">{t('Only administrators can see this number.')}</span>
              </label>}
              {usePassword && <><label className="form-field">{t('Password')}
                <input type={showPassword ? 'text' : 'password'} dir="ltr" autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
                {mode === 'register' && <span className="hint">{t('Use at least 8 characters.')}</span>}
              </label>
                {mode === 'register' && <label className="form-field">{t('Confirm password')}
                  <input type={showPassword ? 'text' : 'password'} dir="ltr" autoComplete="new-password"
                    minLength={8} maxLength={128} required value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)} />
                </label>}
                <label className="availability-filter password-visibility">
                  <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
                  <span>{t('Show password')}</span>
                </label>
              </>}
            </>}
            <RippleButton type="submit" className="button-primary" disabled={busy || !session.csrf_token}>
              {t(usePassword ? (busy ? 'Please wait…' : passwordAction) : (busy ? 'Requesting code…' : codeAction))}
            </RippleButton>
          </>}
          {!sms && mode === 'login' && (canUseEmailCode || emailCode) && <button type="button" className="text-button align-start" disabled={busy}
            onClick={() => { setEmailCode(!emailCode); setPassword(''); setConfirmPassword(''); setShowPassword(false); setError('') }}>
            {t(emailCode ? 'Use my password' : 'Use an email code')}
          </button>}
          {mode === 'register' && <button type="button" className="text-button align-start" disabled={busy} onClick={() => setRole('')}>{t('Choose a different account type')}</button>}
        </>}
        {error && <p className="form-error" role="alert">{t(error)}</p>}
      </form>}
      {!challenge && <div className="panel-bottom">
        <span>{t(mode === 'login' ? 'New here?' : 'Already registered?')}</span>
        <button className="text-button" type="button" disabled={busy} onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          setRole('')
          setEmailCode(false)
          setPassword('')
          setConfirmPassword('')
          setShowPassword(false)
          setError('')
        }}>{t(mode === 'login' ? 'Create an account' : 'Sign in')}</button>
      </div>}
    </Panel>
  )
}
