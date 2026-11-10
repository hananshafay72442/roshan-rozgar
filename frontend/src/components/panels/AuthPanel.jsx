import { useState } from 'react'
import Icon from '../Icon'
import RippleButton from '../RippleButton/RippleButton'
import { Dictate, Listen } from '../SpeechButtons'
import Panel from './Panel'

const roles = [
  { id: 'customer', title: 'I need a worker', urdu: 'مجھے کاریگر چاہیے', icon: 'house' },
  { id: 'worker', title: 'I’m a skilled worker', urdu: 'میں کاریگر ہوں', icon: 'tool' },
]

function phoneDigits(text) {
  return text.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) & 15)).replace(/[^+0-9]/g, '')
}

export default function AuthPanel({ initialMode, initialRole, session, call, onSuccess, onClose }) {
  const [mode, setMode] = useState(initialMode)
  const [role, setRole] = useState(initialRole || '')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chooseRole = mode === 'register' && !role
  const worker = role === 'worker'

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
    <Panel title={challenge ? 'Verify your phone' : mode === 'login' ? 'Welcome back.' : 'Get started.'}
      kicker="Your Roshan Rozgar account" onClose={onClose}>
      {chooseRole ? <>
        <p className="panel-deck">Choose how you’ll use Roshan Rozgar.</p>
        <div className="role-options">
          {roles.map(({ id, title, urdu, icon }) => <button key={id} className="role-option" type="button" onClick={() => setRole(id)}>
            <span className="role-icon"><Icon name={icon} size={24} /></span>
            <span><strong>{title}</strong><small lang="ur" dir="rtl">{urdu}</small></span><Icon name="chevron" size={18} />
          </button>)}
        </div>
      </> : <form className="panel-form" onSubmit={submit}>
        {challenge ? <>
          <p className="panel-deck">{challenge.demo_code
            ? 'Verify with the local demo code below.'
            : `Enter the six-digit code sent to ${phone}.`}</p>
          <label className="form-field">Verification code <input type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(phoneDigits(event.target.value).slice(0, 6))} /></label>
          {challenge.demo_code && <div className="demo-banner"><span><strong>Demo code</strong> <code>{challenge.demo_code}</code></span>
            <button type="button" className="text-button" onClick={() => setCode(challenge.demo_code)}>Use demo code</button></div>}
          <RippleButton type="submit" className="button-primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</RippleButton>
          <button type="button" className="text-button align-start" disabled={busy} onClick={resetChallenge}>Request a new code or change number</button>
        </> : <>
          <p className="panel-deck">Use your Pakistani mobile number. You’ll get a one-time code.</p>
          {worker && <Listen text="اپنا موبائل نمبر بتائیں۔ آپ کو چھ ہندسوں کا کوڈ ملے گا۔" english="Enter your mobile number to get a six digit code." />}
          <label className="form-field">Mobile number <span lang="ur" dir="rtl">موبائل نمبر</span>
            <input type="tel" inputMode="tel" autoComplete="tel" placeholder="0300 1234567" maxLength={22}
              required value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          {worker && <Dictate onText={(text) => { const number = phoneDigits(text); if (number) setPhone(number) }} label="Say my number" />}
          {session.demo_auth && session.demo_data && mode === 'login' && <div className="demo-banner demo-accounts">
            <span>Try a sample account</span>
            <button type="button" className="text-button" onClick={() => setPhone('03000000001')}>Demo worker</button>
            <button type="button" className="text-button" onClick={() => setPhone('03000000099')}>Demo customer</button>
          </div>}
          <RippleButton type="submit" className="button-primary" disabled={busy || !session.csrf_token}>
            {busy ? 'Requesting code…' : session.demo_auth ? 'Get demo code' : 'Send SMS code'}
          </RippleButton>
          {mode === 'register' && <button type="button" className="text-button align-start" disabled={busy} onClick={() => setRole('')}>Choose a different account type</button>}
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>}
      {!challenge && <div className="panel-bottom">
        <span>{mode === 'login' ? 'New here?' : 'Already registered?'}</span>
        <button className="text-button" type="button" disabled={busy} onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          setRole('')
          setError('')
        }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button>
      </div>}
    </Panel>
  )
}
