export async function api(path, { signal, method = 'GET', data, csrf } = {}) {
  const headers = { Accept: 'application/json' }
  const multipart = data instanceof FormData
  if (data != null && !multipart) headers['Content-Type'] = 'application/json'
  if (csrf) headers['X-CSRF-Token'] = csrf

  const response = await fetch(`/api${path}`, {
    method, headers, signal,
    body: data == null || multipart ? data : JSON.stringify(data),
  })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('Cannot reach the service. Please try again shortly.')
  }
  const payload = await response.json()
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Something went wrong. Please try again.'), { status: response.status })
  return payload
}

export function messageData(text, audio, extra = {}) {
  if (!audio) return { ...extra, text }
  const form = new FormData()
  Object.entries(extra).forEach(([key, value]) => form.append(key, value))
  form.append('text', text)
  form.append('audio', audio, 'voice-note')
  return form
}

export function identityForm(photos, consent) {
  const form = new FormData()
  form.append('selfie', photos.selfie, 'selfie.jpg')
  form.append('cnic_front', photos.cnic_front, 'cnic-front.jpg')
  form.append('identity_consent', String(consent))
  return form
}
