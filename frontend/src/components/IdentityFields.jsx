import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageProvider'

async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15_000_000) {
    throw new Error('Choose a JPG, PNG or WebP image smaller than 15 MB.')
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    if (Math.min(bitmap.width, bitmap.height) < 160 || bitmap.width * bitmap.height > 20_000_000) {
      throw new Error('Use a clear photo at least 160 pixels on each side.')
    }
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78))
    if (!blob || blob.size > 700_000) throw new Error('This image is too large. Choose a smaller photo.')
    return blob
  } finally { bitmap.close() }
}

function PhotoField({ kind, label, value, onChange, disabled, onError }) {
  const { t } = useLanguage()
  const image = useRef(null)
  const [working, setWorking] = useState(false)
  useEffect(() => {
    if (!value) return
    const next = URL.createObjectURL(value)
    if (image.current) image.current.src = next
    return () => URL.revokeObjectURL(next)
  }, [value])
  return <label className="identity-photo form-field">
    <strong>{t(label)}</strong>
    {value ? <img ref={image} alt={t(label)} /> : <span className="identity-placeholder">{t(kind === 'selfie' ? 'Face clearly visible, no sunglasses' : 'Full front of your CNIC, readable and without glare')}</span>}
    <input type="file" accept="image/jpeg,image/png,image/webp" {...(kind === 'selfie' ? { capture: 'user' } : {})}
      disabled={disabled || working} onChange={async event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        setWorking(true)
        onError('')
        try { onChange(await preparePhoto(file)) }
        catch (error) { onError(error.message) }
        finally { setWorking(false) }
      }} />
    {working && <span role="status">{t('Preparing photo…')}</span>}
  </label>
}

export default function IdentityFields({ photos, setPhotos, consent, setConsent, mode, disabled, onError }) {
  const { t } = useLanguage()
  return <fieldset className="identity-fields" disabled={disabled}>
    <legend>{t('Verify your identity')}</legend>
    <p className="hint">{t(mode === 'automatic'
      ? 'Your face photo is compared with your CNIC photo before admin approval.'
      : 'An administrator will compare your face photo with your CNIC before approving your profile. Automatic face matching is not enabled.')}</p>
    <div className="identity-grid">
      {['selfie', 'cnic_front'].map(kind => <PhotoField key={kind} kind={kind}
        label={kind === 'selfie' ? 'Your face photo' : 'CNIC front'} value={photos[kind]} disabled={disabled}
        onError={onError} onChange={blob => setPhotos(current => ({ ...current, [kind]: blob }))} />)}
    </div>
    <label className="identity-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
      <span>{t('I agree to private identity review and, when enabled, face comparison by Amazon Rekognition. These photos are visible only to me and administrators.')}</span></label>
  </fieldset>
}
